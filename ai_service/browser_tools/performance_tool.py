"""Performance and telemetry monitoring for browser sessions."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

import nest_asyncio
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

from .browser_sessions import BrowserSessionManager

# Apply nest_asyncio to allow nested event loops (fixes CrewAI threading conflicts)
nest_asyncio.apply()

logger = logging.getLogger(__name__)


class BrowserPerformanceToolSchema(BaseModel):
    """Explicit Pydantic schema for browser performance tool with proper defaults."""
    action: str
    session_id: str = Field(default="default")
    user_id: Optional[str] = Field(default=None)
    tab_id: Optional[str] = Field(default=None)
    limit: int = Field(default=50)


class BrowserPerformanceTool(BaseTool):
    """Inspect performance metrics, network traffic, and console output."""

    name: str = "browser_performance"
    description: str = (
        "Retrieve performance metrics, network activity, and console messages from the browser session."
    )
    args_schema: type = BrowserPerformanceToolSchema
    session_manager: Any = None

    def __init__(self, session_manager: BrowserSessionManager):
        super().__init__()
        self.session_manager = session_manager

    def _run(
        self,
        action: str,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
        limit: int = 50,
    ) -> str:
        try:
            return asyncio.run(
                self._arun(
                    action=action,
                    session_id=session_id,
                    user_id=user_id,
                    tab_id=tab_id,
                    limit=limit,
                )
            )
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(
                    self._arun(
                        action=action,
                        session_id=session_id,
                        user_id=user_id,
                        tab_id=tab_id,
                        limit=limit,
                    )
                )
            finally:
                loop.close()

    async def _arun(
        self,
        action: str,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
        limit: int = 50,
    ) -> str:
        try:
            session = await self.session_manager.get_session(session_id, user_id)
            page = await session.ensure_page(tab_id)

            if action == "get_metrics":
                metrics = await session.get_performance_metrics(page)
                return json.dumps(metrics)

            if action == "get_network":
                data = list(session.network_requests)[-limit:] + list(session.network_responses)[-limit:]
                data_sorted = sorted(data, key=lambda item: item.get("timestamp", 0))
                return json.dumps(data_sorted)

            if action == "get_console":
                messages = list(session.console_messages)[-limit:]
                return json.dumps(messages)

            if action == "get_websocket":
                entries = list(session.websocket_messages)[-limit:]
                return json.dumps(entries)

            if action == "get_mutations":
                mutations = list(session.dom_mutations)[-limit:]
                return json.dumps(mutations)

            return (
                "Error: Unsupported action '{action}'. Supported actions: get_metrics, get_network, "
                "get_console, get_websocket, get_mutations"
            ).replace("{action}", action)

        except ValueError as exc:
            return f"Error: {exc}"
        except Exception as exc:
            logger.error("[%s] Unexpected error in performance tool: %s", session_id, exc)
            return f"Unexpected error in performance tool: {exc}"
