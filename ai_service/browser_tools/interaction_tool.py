"""Tool for interacting with page elements."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Optional

from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

logger = logging.getLogger(__name__)


class BrowserInteractionTool(BaseTool):
    name: str = "browser_interact"
    description: str = "Interact with page elements (click, type, select, upload)."

    def __init__(self, session_manager: BrowserSessionManager):
        super().__init__()
        self.session_manager = session_manager

    def _run(
        self,
        action: str,
        selector: str,
        value: Optional[str] = None,
        session_id: str = "default",
        file_path: Optional[str] = None,
        user_id: Optional[str] = None,
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
    ) -> str:
        try:
            session = await self.session_manager.get_session(session_id, user_id)
            page = await session.ensure_page()
            timeout = session.security.wait_timeout_ms

            if action == "click":
                try:
                    await page.click(selector, timeout=timeout)
                    message = f"Successfully clicked element '{selector}'"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    return message
                except Exception as e:
                    error_msg = f"Error clicking element '{selector}': {str(e)}. Element may not be visible or clickable."
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "type":
                if value is None:
                    return "Error: value parameter is required for type action"
                try:
                    await page.fill(selector, value, timeout=timeout)
                    message = f"Successfully typed '{value}' into '{selector}'"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    return message
                except Exception as e:
                    error_msg = f"Error typing into element '{selector}': {str(e)}. Element may not be visible or not an input field."
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "select":
                if value is None:
                    return "Error: value parameter is required for select action"
                try:
                    await page.select_option(selector, value, timeout=timeout)
                    message = f"Successfully selected option '{value}' in '{selector}'"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    return message
                except Exception as e:
                    error_msg = f"Error selecting option '{value}' in '{selector}': {str(e)}. Element may not be a select dropdown or option not found."
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "upload":
                if not file_path:
                    return "Error: file_path parameter is required for upload action"
                
                # Validate file path for security
                try:
                    resolved_path = Path(file_path).resolve()
                    allowed_dirs = session.security.allowed_upload_dirs or ["/tmp/uploads"]
                    
                    # Check if path is within any allowed directory
                    path_allowed = False
                    for allowed_dir in allowed_dirs:
                        allowed_path = Path(allowed_dir).resolve()
                        try:
                            # Check if resolved_path is within allowed_path
                            resolved_path.relative_to(allowed_path)
                            path_allowed = True
                            break
                        except ValueError:
                            continue
                    
                    if not path_allowed:
                        return f"Error: File path '{file_path}' is outside allowed directories: {allowed_dirs}"
                    
                    if not resolved_path.exists():
                        return f"Error: File not found at path '{file_path}'"
                    
                    if not resolved_path.is_file():
                        return f"Error: Path '{file_path}' is not a file"
                    
                    await page.set_input_files(selector, str(resolved_path), timeout=timeout)
                    message = f"Successfully uploaded file '{file_path}' via '{selector}'"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
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
                    return message
                except Exception as e:
                    error_msg = f"Error hovering over element '{selector}': {str(e)}. Element may not be visible."
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            return f"Error: Unsupported action '{action}'. Supported actions: click, type, select, upload, hover"

        except ValueError as e:
            # Rate limiting or other validation errors
            return f"Error: {str(e)}"
        except Exception as e:
            error_msg = f"Unexpected error in interaction tool: {str(e)}"
            logger.error("[%s] %s", session_id, error_msg)
            return error_msg
