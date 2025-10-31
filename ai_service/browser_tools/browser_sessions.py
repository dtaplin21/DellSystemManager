"""Browser session lifecycle management for automation tools."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, Optional

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from .browser_config import BrowserSecurityConfig

logger = logging.getLogger(__name__)


@dataclass
class BrowserSession:
    """Container for an automated browser session."""

    security: BrowserSecurityConfig
    created_at: float = field(default_factory=time.time)
    pages_opened: int = 0
    playwright: Optional[object] = None
    browser: Optional[Browser] = None
    context: Optional[BrowserContext] = None
    page: Optional[Page] = None

    async def ensure_page(self) -> Page:
        """Ensure that the browser session is ready and return a page."""

        if not self.playwright:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)
            self.context = await self.browser.new_context(
                viewport={"width": 1920, "height": 1080}
            )
            self.page = await self.context.new_page()
            self.pages_opened = 1
            logger.debug("Browser session initialized")

        if not self.page:
            self.page = await self.context.new_page()
            self.pages_opened += 1

        return self.page

    async def close(self) -> None:
        """Close the session and dispose resources."""

        try:
            if self.page:
                await self.page.close()
        finally:
            self.page = None

        try:
            if self.context:
                await self.context.close()
        finally:
            self.context = None

        try:
            if self.browser:
                await self.browser.close()
        finally:
            self.browser = None

        if self.playwright:
            await self.playwright.stop()
            self.playwright = None
        logger.debug("Browser session closed")

    def expired(self) -> bool:
        """Return True if the session exceeds lifetime or navigation limits."""

        lifetime_minutes = (time.time() - self.created_at) / 60
        if lifetime_minutes > self.security.max_session_duration_minutes:
            return True
        if self.pages_opened >= self.security.max_pages_per_session:
            return True
        return False


class BrowserSessionManager:
    """Manage browser sessions identified by a session key."""

    def __init__(self, security_config: Optional[BrowserSecurityConfig] = None):
        self.security = security_config or BrowserSecurityConfig()
        self._sessions: Dict[str, BrowserSession] = {}
        self._lock = asyncio.Lock()

    async def get_session(self, session_id: str = "default") -> BrowserSession:
        """Return an active session for the supplied identifier."""

        async with self._lock:
            session = self._sessions.get(session_id)
            if session and session.expired():
                await session.close()
                session = None

            if not session:
                session = BrowserSession(self.security)
                self._sessions[session_id] = session

        await session.ensure_page()
        return session

    async def close_session(self, session_id: str) -> None:
        """Close and remove a session by identifier."""

        async with self._lock:
            session = self._sessions.pop(session_id, None)
        if session:
            await session.close()

    async def shutdown(self) -> None:
        """Close all managed sessions."""

        async with self._lock:
            sessions = list(self._sessions.items())
            self._sessions.clear()

        for _, session in sessions:
            try:
                await session.close()
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("Error closing browser session: %s", exc)
