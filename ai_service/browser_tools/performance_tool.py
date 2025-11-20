"""Performance and telemetry monitoring for browser sessions."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

import nest_asyncio
from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

# Apply nest_asyncio to allow nested event loops (fixes CrewAI threading conflicts)
nest_asyncio.apply()

logger = logging.getLogger(__name__)


class BrowserPerformanceTool(BaseTool):
    """Inspect performance metrics, network traffic, and console output."""

    name: str = "browser_performance"
    description: str = (
        "Retrieve performance metrics, network activity, and console messages from the browser session."
    )
    session_manager: Any = None

    def __init__(self, session_manager: BrowserSessionManager):
        super().__init__()
        self.session_manager = session_manager
        # Force schema creation and rebuild to resolve Optional forward references
        # CrewAI's BaseTool creates schema lazily, so we need to access it first
        self._ensure_schema_rebuilt()
    
    def _ensure_schema_rebuilt(self):
        """Ensure the Pydantic schema is created and rebuilt to resolve ForwardRefs."""
        try:
            # Force schema creation by accessing it
            if hasattr(self, 'args_schema'):
                schema = self.args_schema
                if schema is not None:
                    # Rebuild with proper namespace that includes Optional
                    # This resolves ForwardRef('Optional[str]') to Optional[str]
                    from typing import Optional, Union
                    # Create namespace with required types
                    types_namespace = {
                        'Optional': Optional,
                        'Union': Union,
                        'str': str,
                        'int': int,
                        'float': float,
                        'bool': bool,
                        'Any': Any,
                    }
                    # Rebuild schema with types namespace
                    schema.model_rebuild(_types_namespace=types_namespace)
                    # Also rebuild the tool model itself
                    if hasattr(self, 'model_rebuild'):
                        self.model_rebuild()
        except (AttributeError, Exception) as e:
            logger.debug(f"Schema rebuild skipped (may not be created yet): {e}")

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
