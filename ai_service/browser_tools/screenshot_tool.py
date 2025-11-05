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
