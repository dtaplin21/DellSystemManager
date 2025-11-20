"""Tool for capturing page screenshots."""

from __future__ import annotations

import asyncio
import base64
import logging
from typing import Any, Optional

from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

logger = logging.getLogger(__name__)


class BrowserScreenshotTool(BaseTool):
    name: str = "browser_screenshot"
    description: str = "Capture a screenshot of the current page or a selector."
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
        selector: Optional[str] = None,
        session_id: str = "default",
        full_page: bool = True,
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
    ) -> str:
        try:
            return asyncio.run(
                self._arun(
                    selector=selector,
                    session_id=session_id,
                    full_page=full_page,
                    user_id=user_id,
                    tab_id=tab_id,
                )
            )
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(
                    self._arun(
                        selector=selector,
                        session_id=session_id,
                        full_page=full_page,
                        user_id=user_id,
                        tab_id=tab_id,
                    )
                )
            finally:
                loop.close()

    async def _arun(
        self,
        selector: Optional[str] = None,
        session_id: str = "default",
        full_page: bool = True,
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
    ) -> str:
        session = None
        try:
            session = await self.session_manager.get_session(session_id, user_id)
            if not session.security.enable_screenshots:
                return "Error: Screenshots disabled by security policy"

            page = await session.ensure_page(tab_id)

            # Apply timeout to screenshot operation
            timeout_ms = session.security.screenshot_timeout_ms

            try:
                # Capture screenshot with timeout
                if selector:
                    element = await asyncio.wait_for(
                        page.query_selector(selector),
                        timeout=timeout_ms / 1000.0
                    )
                    if element is None:
                        return f"Error: Selector '{selector}' not found for screenshot"

                    buffer = await asyncio.wait_for(
                        element.screenshot(),
                        timeout=timeout_ms / 1000.0
                    )
                    target = selector
                else:
                    buffer = await asyncio.wait_for(
                        page.screenshot(full_page=full_page),
                        timeout=timeout_ms / 1000.0
                    )
                    target = "page"

                encoded = base64.b64encode(buffer).decode("utf-8")

                # Try to record screenshot, but don't fail if it exceeds size limit
                try:
                    await session.record_screenshot(
                        encoded,
                        {"target": target, "full_page": full_page, "selector": selector},
                    )
                    if session.security.log_actions:
                        logger.info(
                            "[%s] Captured screenshot for %s (bytes=%d)",
                            session_id,
                            target,
                            len(buffer),
                        )
                except ValueError as size_error:
                    # Screenshot too large, but still return it
                    logger.warning(
                        "[%s] Screenshot captured but not stored: %s",
                        session_id,
                        str(size_error),
                    )
                    return f"Warning: {str(size_error)}. Screenshot captured but not stored in session history.\n{encoded}"

                return encoded

            except asyncio.TimeoutError:
                error_msg = f"Screenshot operation timed out after {timeout_ms}ms for '{selector or 'page'}'"
                logger.error("[%s] %s", session_id, error_msg)
                return f"Error: {error_msg}"
            except Exception as e:
                error_msg = f"Error capturing screenshot for '{selector or 'page'}': {str(e)}"
                logger.error("[%s] %s", session_id, error_msg)
                return f"Error: {error_msg}"

        except ValueError as e:
            # Rate limiting or other validation errors
            logger.warning("[%s] Validation error: %s", session_id, str(e))
            return f"Error: {str(e)}"
        except Exception as e:
            error_msg = f"Unexpected error in screenshot tool: {str(e)}"
            logger.error("[%s] %s", session_id, error_msg)
            return f"Error: {error_msg}"


# Rebuild Pydantic schema to resolve Optional forward references
# CrewAI's BaseTool creates schemas lazily, so individual instances will rebuild in __init__
try:
    # Check if we can access the class schema
    if hasattr(BrowserScreenshotTool, 'args_schema'):
        schema = getattr(BrowserScreenshotTool, 'args_schema', None)
        if schema is not None:
            schema.model_rebuild()
    # Also try rebuilding the model itself
    if hasattr(BrowserScreenshotTool, 'model_rebuild'):
        BrowserScreenshotTool.model_rebuild()
except (AttributeError, Exception):
    # Schema may not be created yet (lazy creation by CrewAI)
    # Individual instances will rebuild in __init__
    pass
