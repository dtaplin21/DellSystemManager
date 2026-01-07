"""
CrewAI tool compatibility shim.

We upgraded to CrewAI 0.157.x (Pydantic v2 native). In that version, `BaseTool`
is exposed from `crewai.tools`. For safety (and to keep local dev resilient if
someone has an older environment), we fall back to LangChain's BaseTool.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

try:
    # CrewAI >= 0.157
    from crewai.tools import BaseTool as CrewAIBaseTool  # type: ignore
except Exception:  # pragma: no cover
    # Older CrewAI / direct langchain tool base
    from langchain_core.tools import BaseTool as CrewAIBaseTool  # type: ignore

BaseTool = CrewAIBaseTool

__all__ = ["BaseTool"]


