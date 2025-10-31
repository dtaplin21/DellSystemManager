"""Data extraction helpers for automated browsing."""

from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

logger = logging.getLogger(__name__)


class BrowserExtractionTool(BaseTool):
    name = "browser_extract"
    description = "Extract text, tables, and links from the active page."

    def __init__(self, session_manager: BrowserSessionManager):
        super().__init__()
        self.session_manager = session_manager

    def _run(
        self,
        action: str,
        selector: Optional[str] = None,
        session_id: str = "default",
    ) -> str:
        try:
            return asyncio.run(
                self._arun(action=action, selector=selector, session_id=session_id)
            )
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(
                    self._arun(action=action, selector=selector, session_id=session_id)
                )
            finally:
                loop.close()

    async def _arun(
        self,
        action: str,
        selector: Optional[str] = None,
        session_id: str = "default",
    ) -> str:
        session = await self.session_manager.get_session(session_id)
        page = await session.ensure_page()

        if action == "text":
            target = page
            if selector:
                target = await page.query_selector(selector)
                if target is None:
                    return ""
                text = await target.inner_text()
            else:
                text = await page.inner_text("body")
            if session.security.log_actions:
                logger.info(
                    "[%s] Extracted text (%d chars) using selector '%s'",
                    session_id,
                    len(text),
                    selector or "body",
                )
            return text

        if action == "html":
            if selector:
                handle = await page.query_selector(selector)
                if handle is None:
                    return ""
                markup = await handle.inner_html()
            else:
                markup = await page.content()
            if session.security.log_actions:
                logger.info(
                    "[%s] Extracted html (%d chars) using selector '%s'",
                    session_id,
                    len(markup),
                    selector or "document",
                )
            return markup

        if action == "links":
            locator = selector or "a"
            elements = await page.query_selector_all(locator)
            links: List[str] = []
            for element in elements:
                href = await element.get_attribute("href")
                if href:
                    links.append(href)
            if session.security.log_actions:
                logger.info(
                    "[%s] Extracted %d links using selector '%s'",
                    session_id,
                    len(links),
                    locator,
                )
            return "\n".join(links)

        raise ValueError(f"Unsupported action: {action}")
