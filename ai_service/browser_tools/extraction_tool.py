"""Data extraction helpers for automated browsing."""

from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

logger = logging.getLogger(__name__)


class BrowserExtractionTool(BaseTool):
    name: str = "browser_extract"
    description: str = "Extract text, tables, and links from the active page."

    def __init__(self, session_manager: BrowserSessionManager):
        super().__init__()
        self.session_manager = session_manager

    def _run(
        self,
        action: str,
        selector: Optional[str] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
    ) -> str:
        try:
            return asyncio.run(
                self._arun(
                    action=action,
                    selector=selector,
                    session_id=session_id,
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
                        session_id=session_id,
                        user_id=user_id,
                        tab_id=tab_id,
                    )
                )
            finally:
                loop.close()

    async def _arun(
        self,
        action: str,
        selector: Optional[str] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
    ) -> str:
        try:
            session = await self.session_manager.get_session(session_id, user_id)
            page = await session.ensure_page(tab_id)

            if action == "text":
                try:
                    if selector:
                        target = await page.query_selector(selector)
                        if target is None:
                            return f"Error: Selector '{selector}' not found on page"
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
                except Exception as e:
                    error_msg = (
                        f"Error extracting text with selector '{selector or 'body'}': {str(e)}"
                    )
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "html":
                try:
                    if selector:
                        handle = await page.query_selector(selector)
                        if handle is None:
                            return f"Error: Selector '{selector}' not found on page"
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
                except Exception as e:
                    error_msg = (
                        f"Error extracting HTML with selector '{selector or 'document'}': {str(e)}"
                    )
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "links":
                try:
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
                    return "\n".join(links) if links else f"No links found with selector '{locator}'"
                except Exception as e:
                    error_msg = f"Error extracting links with selector '{selector or 'a'}': {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            return "Error: Unsupported action '{action}'. Supported actions: text, html, links".replace(
                "{action}", action
            )

        except ValueError as e:
            # Rate limiting or other validation errors
            return f"Error: {str(e)}"
        except Exception as e:
            error_msg = f"Unexpected error in extraction tool: {str(e)}"
            logger.error("[%s] %s", session_id, error_msg)
            return error_msg
