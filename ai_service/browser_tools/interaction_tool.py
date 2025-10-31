"""Tool for interacting with page elements."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

logger = logging.getLogger(__name__)


class BrowserInteractionTool(BaseTool):
    name = "browser_interact"
    description = "Interact with page elements (click, type, select, upload)."

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
    ) -> str:
        try:
            return asyncio.run(
                self._arun(
                    action=action,
                    selector=selector,
                    value=value,
                    session_id=session_id,
                    file_path=file_path,
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
    ) -> str:
        session = await self.session_manager.get_session(session_id)
        page = await session.ensure_page()

        if action == "click":
            await page.click(selector)
            message = f"Clicked element {selector}"
            if session.security.log_actions:
                logger.info("[%s] %s", session_id, message)
            return message

        if action == "type":
            if value is None:
                raise ValueError("value is required for type action")
            await page.fill(selector, value)
            message = f"Typed value into {selector}"
            if session.security.log_actions:
                logger.info("[%s] %s", session_id, message)
            return message

        if action == "select":
            if value is None:
                raise ValueError("value is required for select action")
            await page.select_option(selector, value)
            message = f"Selected option {value} in {selector}"
            if session.security.log_actions:
                logger.info("[%s] %s", session_id, message)
            return message

        if action == "upload":
            if not file_path:
                raise ValueError("file_path is required for upload action")
            await page.set_input_files(selector, file_path)
            message = f"Uploaded file {file_path} via {selector}"
            if session.security.log_actions:
                logger.info("[%s] %s", session_id, message)
            return message

        if action == "hover":
            await page.hover(selector)
            message = f"Hovered over {selector}"
            if session.security.log_actions:
                logger.info("[%s] %s", session_id, message)
            return message

        raise ValueError(f"Unsupported action: {action}")
