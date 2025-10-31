"""Tool for capturing page screenshots."""

from __future__ import annotations

import asyncio
import base64
import logging
from typing import Optional

from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

logger = logging.getLogger(__name__)


class BrowserScreenshotTool(BaseTool):
    name = "browser_screenshot"
    description = "Capture a screenshot of the current page or a selector."

    def __init__(self, session_manager: BrowserSessionManager):
        super().__init__()
        self.session_manager = session_manager

    def _run(
        self,
        selector: Optional[str] = None,
        session_id: str = "default",
        full_page: bool = True,
    ) -> str:
        try:
            return asyncio.run(
                self._arun(
                    selector=selector, session_id=session_id, full_page=full_page
                )
            )
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(
                    self._arun(
                        selector=selector, session_id=session_id, full_page=full_page
                    )
                )
            finally:
                loop.close()

    async def _arun(
        self,
        selector: Optional[str] = None,
        session_id: str = "default",
        full_page: bool = True,
    ) -> str:
        session = await self.session_manager.get_session(session_id)
        if not session.security.enable_screenshots:
            return "Error: Screenshots disabled by security policy"

        page = await session.ensure_page()
        if selector:
            element = await page.query_selector(selector)
            if element is None:
                return "Error: Selector not found for screenshot"
            buffer = await element.screenshot()
        else:
            buffer = await page.screenshot(full_page=full_page)

        encoded = base64.b64encode(buffer).decode("utf-8")
        if session.security.log_actions:
            target = selector or "page"
            logger.info("[%s] Captured screenshot for %s (bytes=%d)", session_id, target, len(buffer))
        return encoded
