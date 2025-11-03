"""Browser navigation tool leveraging Playwright sessions."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

logger = logging.getLogger(__name__)


class BrowserNavigationTool(BaseTool):
    name: str = "browser_navigate"
    description: str = (
        "Navigate to URLs, control history, capture page content, and wait for selectors."
    )

    def __init__(self, session_manager: BrowserSessionManager):
        super().__init__()
        self.session_manager = session_manager

    def _run(
        self,
        action: str,
        url: Optional[str] = None,
        wait_for: Optional[str] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
    ) -> str:
        try:
            return asyncio.run(
                self._arun(
                    action=action,
                    url=url,
                    wait_for=wait_for,
                    session_id=session_id,
                    user_id=user_id,
                )
            )
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(
                    self._arun(
                        action=action,
                        url=url,
                        wait_for=wait_for,
                        session_id=session_id,
                        user_id=user_id,
                    )
                )
            finally:
                loop.close()

    async def _arun(
        self,
        action: str,
        url: Optional[str] = None,
        wait_for: Optional[str] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
    ) -> str:
        try:
            session = await self.session_manager.get_session(session_id, user_id)
            page = await session.ensure_page()
            timeout = session.security.wait_timeout_ms

            if action == "navigate":
                if not url:
                    return "Error: url parameter is required for navigate action"
                if not session.security.is_url_allowed(url):
                    return f"Error: URL {url} is not permitted by security policy. Allowed domains: {session.security.allowed_domains or 'all (if no restrictions)'}"
                try:
                    await page.goto(url, timeout=timeout, wait_until="networkidle")
                    if wait_for:
                        try:
                            await page.wait_for_selector(
                                wait_for, timeout=timeout
                            )
                        except Exception as e:
                            return f"Error: Timeout waiting for selector '{wait_for}' on {url}: {str(e)}"
                    message = f"Successfully navigated to {url}"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    return message
                except Exception as e:
                    error_msg = f"Error navigating to {url}: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "reload":
                try:
                    await page.reload(timeout=timeout, wait_until="networkidle")
                    if wait_for:
                        try:
                            await page.wait_for_selector(
                                wait_for, timeout=timeout
                            )
                        except Exception as e:
                            return f"Error: Timeout waiting for selector '{wait_for}' after reload: {str(e)}"
                    message = f"Successfully reloaded {page.url}"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    return message
                except Exception as e:
                    error_msg = f"Error reloading page {page.url}: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "back":
                try:
                    await page.go_back(timeout=timeout, wait_until="networkidle")
                    message = f"Successfully navigated back to {page.url}"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    return message
                except Exception as e:
                    error_msg = f"Error navigating back: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "forward":
                try:
                    await page.go_forward(timeout=timeout, wait_until="networkidle")
                    message = f"Successfully navigated forward to {page.url}"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    return message
                except Exception as e:
                    error_msg = f"Error navigating forward: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "content":
                try:
                    content = await page.content()
                    return content
                except Exception as e:
                    error_msg = f"Error getting page content: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            return f"Error: Unsupported action '{action}'. Supported actions: navigate, reload, back, forward, content"

        except ValueError as e:
            # Rate limiting or other validation errors
            return f"Error: {str(e)}"
        except Exception as e:
            error_msg = f"Unexpected error in navigation tool: {str(e)}"
            logger.error("[%s] %s", session_id, error_msg)
            return error_msg

    async def close_session(
        self, session_id: str = "default", user_id: Optional[str] = None
    ) -> None:
        await self.session_manager.close_session(session_id, user_id)
