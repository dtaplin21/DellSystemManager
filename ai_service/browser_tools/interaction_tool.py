"""Tool for interacting with page elements."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

logger = logging.getLogger(__name__)


class BrowserInteractionTool(BaseTool):
    name: str = "browser_interact"
    description: str = "Interact with page elements (click, type, select, upload, drag)."
    session_manager: Any = None

    def __init__(self, session_manager: BrowserSessionManager):
        super().__init__()
        self.session_manager = session_manager
        # Force schema creation and rebuild to resolve Optional forward references
        # CrewAI's BaseTool creates schema lazily, so we need to access it first
        self._ensure_schema_rebuilt()
    
    def _ensure_schema_rebuilt(self):
        """Ensure the Pydantic schema is created and rebuilt to resolve ForwardRefs."""
        try:
            # Force schema creation by accessing it
            if hasattr(self, 'args_schema'):
                schema = self.args_schema
                if schema is not None:
                    # Rebuild with proper namespace that includes Optional
                    # This resolves ForwardRef('Optional[str]') to Optional[str]
                    from typing import Optional, Union
                    # Create namespace with required types
                    types_namespace = {
                        'Optional': Optional,
                        'Union': Union,
                        'str': str,
                        'int': int,
                        'float': float,
                        'bool': bool,
                        'Any': Any,
                    }
                    # Rebuild schema with types namespace
                    schema.model_rebuild(_types_namespace=types_namespace)
                    # Also rebuild the tool model itself
                    if hasattr(self, 'model_rebuild'):
                        self.model_rebuild()
        except (AttributeError, Exception) as e:
            logger.debug(f"Schema rebuild skipped (may not be created yet): {e}")

    def _run(
        self,
        action: str,
        selector: str,
        value: Optional[str] = None,
        session_id: str = "default",
        file_path: Optional[str] = None,
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
    ) -> str:
        try:
            return asyncio.run(
                self._arun(
                    action=action,
                    selector=selector,
                    value=value,
                    session_id=session_id,
                    file_path=file_path,
                    user_id=user_id,
                    tab_id=tab_id,
                )
            )
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(
                    self._arun(
                        action=action,
                        selector=selector,
                        value=value,
                        session_id=session_id,
                        file_path=file_path,
                        user_id=user_id,
                        tab_id=tab_id,
                    )
                )
            finally:
                loop.close()

    async def _arun(
        self,
        action: str,
        selector: str,
        value: Optional[str] = None,
        session_id: str = "default",
        file_path: Optional[str] = None,
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
    ) -> str:
        try:
            session = await self.session_manager.get_session(session_id, user_id)
            page = await session.ensure_page(tab_id)

            # Use action-specific timeout
            action_timeout_ms = session.security.action_timeout_ms
            action_timeout_s = action_timeout_ms / 1000.0

            if action == "click":
                try:
                    await asyncio.wait_for(
                        page.click(selector, timeout=action_timeout_ms),
                        timeout=action_timeout_s + 2
                    )
                    message = f"Successfully clicked element '{selector}'"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    await self._capture_state(session, page, action, selector)
                    return message
                except asyncio.TimeoutError:
                    error_msg = f"Timeout clicking element '{selector}' after {action_timeout_ms}ms"
                    logger.error("[%s] %s", session_id, error_msg)
                    return f"Error: {error_msg}"
                except Exception as e:
                    error_msg = (
                        f"Error clicking element '{selector}': {str(e)}. Element may not be visible or clickable."
                    )
                    logger.error("[%s] %s", session_id, error_msg)
                    return f"Error: {error_msg}"

            if action == "type":
                if value is None:
                    return "Error: value parameter is required for type action"
                try:
                    await asyncio.wait_for(
                        page.fill(selector, value, timeout=action_timeout_ms),
                        timeout=action_timeout_s + 2
                    )
                    message = f"Successfully typed into '{selector}'"
                    if session.security.log_actions:
                        logger.info("[%s] Typed %d characters into '%s'", session_id, len(value), selector)
                    await self._capture_state(
                        session, page, action, selector, {"value_length": len(value)}
                    )
                    return message
                except asyncio.TimeoutError:
                    error_msg = f"Timeout typing into element '{selector}' after {action_timeout_ms}ms"
                    logger.error("[%s] %s", session_id, error_msg)
                    return f"Error: {error_msg}"
                except Exception as e:
                    error_msg = (
                        f"Error typing into element '{selector}': {str(e)}. Element may not be visible or not an input field."
                    )
                    logger.error("[%s] %s", session_id, error_msg)
                    return f"Error: {error_msg}"

            if action == "select":
                if value is None:
                    return "Error: value parameter is required for select action"
                try:
                    await asyncio.wait_for(
                        page.select_option(selector, value, timeout=action_timeout_ms),
                        timeout=action_timeout_s + 2
                    )
                    message = f"Successfully selected option '{value}' in '{selector}'"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    await self._capture_state(
                        session, page, action, selector, {"value": value}
                    )
                    return message
                except asyncio.TimeoutError:
                    error_msg = f"Timeout selecting option in '{selector}' after {action_timeout_ms}ms"
                    logger.error("[%s] %s", session_id, error_msg)
                    return f"Error: {error_msg}"
                except Exception as e:
                    error_msg = (
                        f"Error selecting option '{value}' in '{selector}': {str(e)}. Element may not be a select dropdown or option not found."
                    )
                    logger.error("[%s] %s", session_id, error_msg)
                    return f"Error: {error_msg}"

            if action == "upload":
                if not file_path:
                    return "Error: file_path parameter is required for upload action"

                try:
                    resolved_path = Path(file_path).resolve()
                    allowed_dirs = session.security.allowed_upload_dirs or ["/tmp/uploads"]

                    path_allowed = False
                    for allowed_dir in allowed_dirs:
                        allowed_path = Path(allowed_dir).resolve()
                        try:
                            resolved_path.relative_to(allowed_path)
                            path_allowed = True
                            break
                        except ValueError:
                            continue

                    if not path_allowed:
                        return (
                            f"Error: File path '{file_path}' is outside allowed directories: {allowed_dirs}"
                        )

                    if not resolved_path.exists():
                        return f"Error: File not found at path '{file_path}'"

                    if not resolved_path.is_file():
                        return f"Error: Path '{file_path}' is not a file"

                    await page.set_input_files(selector, str(resolved_path), timeout=timeout)
                    message = f"Successfully uploaded file '{file_path}' via '{selector}'"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    await self._capture_state(
                        session,
                        page,
                        action,
                        selector,
                        {"file_path": str(resolved_path)},
                    )
                    return message
                except Exception as e:
                    error_msg = f"Error uploading file '{file_path}' via '{selector}': {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "hover":
                try:
                    await page.hover(selector, timeout=timeout)
                    message = f"Successfully hovered over element '{selector}'"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    await self._capture_state(session, page, action, selector)
                    return message
                except Exception as e:
                    error_msg = (
                        f"Error hovering over element '{selector}': {str(e)}. Element may not be visible."
                    )
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "drag":
                if not value:
                    return (
                        "Error: target selector required in 'value' parameter for drag action"
                    )
                try:
                    source_element = await page.query_selector(selector)
                    target_element = await page.query_selector(value)
                    if not source_element or not target_element:
                        return "Error: Source or target element not found"
                    await source_element.drag_to(target_element)
                    message = f"Successfully dragged '{selector}' to '{value}'"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    await self._capture_state(
                        session,
                        page,
                        action,
                        selector,
                        {"target": value},
                    )
                    return message
                except Exception as e:
                    error_msg = f"Error dragging: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "drag_panel":
                try:
                    config: Dict[str, object] = {}
                    if value:
                        try:
                            config = json.loads(value)
                        except json.JSONDecodeError:
                            config = {"target_selector": value}

                    source_element = await page.query_selector(selector)
                    if not source_element:
                        return f"Error: Source element '{selector}' not found"

                    source_box = await source_element.bounding_box()
                    if not source_box:
                        return f"Error: Unable to determine bounding box for '{selector}'"

                    start_x = source_box.get("x", 0) + source_box.get("width", 0) / 2
                    start_y = source_box.get("y", 0) + source_box.get("height", 0) / 2

                    start_offset = (
                        config.get("start_offset") if isinstance(config, dict) else None
                    )
                    if isinstance(start_offset, dict):
                        start_x += float(start_offset.get("x", 0))
                        start_y += float(start_offset.get("y", 0))

                    end_x = None
                    end_y = None

                    target_selector = (
                        config.get("target_selector") if isinstance(config, dict) else None
                    )
                    if target_selector:
                        target_element = await page.query_selector(str(target_selector))
                        if not target_element:
                            return (
                                f"Error: Target element '{target_selector}' not found for drag_panel"
                            )
                        target_box = await target_element.bounding_box()
                        if not target_box:
                            return (
                                f"Error: Unable to determine bounding box for '{target_selector}'"
                            )
                        end_x = target_box.get("x", 0) + target_box.get("width", 0) / 2
                        end_y = target_box.get("y", 0) + target_box.get("height", 0) / 2

                    end_offset = (
                        config.get("end_offset") if isinstance(config, dict) else None
                    )
                    if end_offset and isinstance(end_offset, dict):
                        end_x = (end_x or start_x) + float(end_offset.get("x", 0))
                        end_y = (end_y or start_y) + float(end_offset.get("y", 0))

                    if end_x is None or end_y is None:
                        return (
                            "Error: Provide a 'target_selector' or 'end_offset' for drag_panel action"
                        )

                    steps = 10
                    if isinstance(config, dict) and "steps" in config:
                        try:
                            steps = max(1, int(config["steps"]))
                        except (TypeError, ValueError):
                            steps = 10

                    await page.mouse.move(start_x, start_y)
                    await page.mouse.down()
                    await page.mouse.move(end_x, end_y, steps=steps)
                    await page.mouse.up()

                    message = (
                        f"Successfully dragged panel '{selector}' to coordinates ({end_x:.2f}, {end_y:.2f})"
                    )
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    await self._capture_state(
                        session,
                        page,
                        action,
                        selector,
                        {"target_selector": target_selector, "end": [end_x, end_y]},
                    )
                    return message
                except Exception as e:
                    error_msg = f"Error performing panel drag: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            return (
                "Error: Unsupported action '{action}'. Supported actions: click, type, select, upload, hover, drag, drag_panel"
                .replace("{action}", action)
            )

        except ValueError as e:
            # Rate limiting or other validation errors
            return f"Error: {str(e)}"
        except Exception as e:
            error_msg = f"Unexpected error in interaction tool: {str(e)}"
            logger.error("[%s] %s", session_id, error_msg)
            return error_msg

    async def _capture_state(
        self,
        session,
        page,
        action: str,
        selector: str,
        metadata: Optional[Dict[str, str]] = None,
    ) -> None:
        """Capture a post-action screenshot for optional vision analysis."""

        if not session.security.enable_screenshots:
            return

        try:
            buffer = await page.screenshot(full_page=True)
            encoded = base64.b64encode(buffer).decode("utf-8")
            details = {"action": action, "selector": selector}
            if metadata:
                details.update(metadata)
            await session.record_screenshot(encoded, details)
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("Failed to record post-action screenshot: %s", exc)
