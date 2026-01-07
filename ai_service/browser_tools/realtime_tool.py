"""Real-time event monitoring for browser automation sessions."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Optional

import nest_asyncio
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

from .browser_sessions import BrowserSessionManager

# Apply nest_asyncio to allow nested event loops (fixes CrewAI threading conflicts)
nest_asyncio.apply()

logger = logging.getLogger(__name__)


class BrowserRealtimeToolSchema(BaseModel):
    """Explicit Pydantic schema for browser realtime tool with proper defaults."""
    action: str
    event_type: Optional[str] = Field(default=None)
    pattern: Optional[str] = Field(default=None)
    timeout: Optional[float] = Field(default=None)
    session_id: str = Field(default="default")
    user_id: Optional[str] = Field(default=None)
    tab_id: Optional[str] = Field(default=None)
    limit: int = Field(default=20)


class BrowserRealtimeTool(BaseTool):
    """Listen for real-time browser events such as websockets, network, or DOM changes."""

    name: str = "browser_realtime"
    description: str = (
        "Listen to real-time browser events, wait for specific conditions, and inspect "
        "recent console, network, websocket, or DOM mutation events."
    )
    args_schema: type = BrowserRealtimeToolSchema
    session_manager: Any = None

    def __init__(self, session_manager: BrowserSessionManager):
        super().__init__()
        self.session_manager = session_manager

    def _run(
        self,
        action: str,
        event_type: Optional[str] = None,
        pattern: Optional[str] = None,
        timeout: Optional[float] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
        limit: int = 20,
    ) -> str:
        try:
            return asyncio.run(
                self._arun(
                    action=action,
                    event_type=event_type,
                    pattern=pattern,
                    timeout=timeout,
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
                        event_type=event_type,
                        pattern=pattern,
                        timeout=timeout,
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
        event_type: Optional[str] = None,
        pattern: Optional[str] = None,
        timeout: Optional[float] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
        limit: int = 20,
    ) -> str:
        try:
            session = await self.session_manager.get_session(session_id, user_id)
            await session.ensure_page(tab_id)

            wait_timeout = timeout
            if wait_timeout is None:
                wait_timeout = session.security.wait_timeout_ms / 1000.0
            else:
                wait_timeout = float(wait_timeout)

            if action == "wait_for_websocket":
                event = await self._wait_for_types(
                    session,
                    {"websocket", "websocket_message"},
                    pattern,
                    wait_timeout,
                )
                return json.dumps(event)

            if action == "wait_for_network":
                event = await self._wait_for_types(
                    session,
                    {"network_request", "network_response"},
                    pattern,
                    wait_timeout,
                )
                return json.dumps(event)

            if action == "wait_for_mutation":
                event = await self._wait_for_types(
                    session,
                    {"dom_mutation"},
                    pattern,
                    wait_timeout,
                )
                return json.dumps(event)

            if action == "wait_for_console":
                event = await self._wait_for_types(
                    session,
                    {"console"},
                    pattern,
                    wait_timeout,
                )
                return json.dumps(event)

            if action == "wait_for_event":
                if not event_type:
                    return "Error: event_type is required for wait_for_event"
                event = await session.wait_for_event(event_type, pattern, wait_timeout)
                return json.dumps(event)

            if action == "get_recent_events":
                events = session.get_recent_events(event_type, limit)
                return json.dumps(events)

            return (
                "Error: Unsupported action '{action}'. Supported actions: wait_for_websocket, wait_for_network, "
                "wait_for_mutation, wait_for_console, wait_for_event, get_recent_events"
            ).replace("{action}", action)

        except asyncio.TimeoutError:
            return "Error: Timed out waiting for event"
        except ValueError as exc:
            return f"Error: {exc}"
        except Exception as exc:
            logger.error("[%s] Unexpected error in realtime tool: %s", session_id, exc)
            return f"Unexpected error in realtime tool: {exc}"

    async def _wait_for_types(self, session, types, pattern, timeout):
        """Wait for one of the allowed event types."""

        deadline = time.time() + timeout
        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                raise asyncio.TimeoutError
            event = await session.wait_for_event(None, pattern, remaining)
            if event.get("type") in types:
                return event
