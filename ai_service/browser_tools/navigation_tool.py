"""Browser navigation tool leveraging Playwright sessions."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

logger = logging.getLogger(__name__)


class BrowserNavigationTool(BaseTool):
    name = "browser_navigate"
    description = (
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
    ) -> str:
        try:
            return asyncio.run(
                self._arun(
                    action=action, url=url, wait_for=wait_for, session_id=session_id
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
    ) -> str:
        session = await self.session_manager.get_session(session_id)
        page = await session.ensure_page()

        if action == "navigate":
            if not url:
                raise ValueError("url is required for navigate action")
            if not session.security.is_url_allowed(url):
                return f"Error: URL {url} is not permitted by security policy"
            await page.goto(url)
            if wait_for:
                await page.wait_for_selector(wait_for, timeout=15000)
            message = f"Navigated to {url}"
            if session.security.log_actions:
                logger.info("[%s] %s", session_id, message)
            return message

        if action == "reload":
            await page.reload()
            if wait_for:
                await page.wait_for_selector(wait_for, timeout=15000)
            message = f"Reloaded {page.url}"
            if session.security.log_actions:
                logger.info("[%s] %s", session_id, message)
            return message

        if action == "back":
            await page.go_back()
            message = f"Navigated back to {page.url}"
            if session.security.log_actions:
                logger.info("[%s] %s", session_id, message)
            return message

        if action == "forward":
            await page.go_forward()
            message = f"Navigated forward to {page.url}"
            if session.security.log_actions:
                logger.info("[%s] %s", session_id, message)
            return message

        if action == "content":
            content = await page.content()
            return content

        raise ValueError(f"Unsupported action: {action}")

    async def close_session(self, session_id: str = "default") -> None:
        await self.session_manager.close_session(session_id)
