"""Browser session lifecycle management for automation tools."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Optional, Tuple

from playwright.async_api import Browser, BrowserContext, Page, WebSocket, async_playwright

from .browser_config import BrowserSecurityConfig

logger = logging.getLogger(__name__)


@dataclass
class BrowserSession:
    """Container for an automated browser session with bounded memory usage."""

    security: BrowserSecurityConfig
    created_at: float = field(default_factory=time.time)
    pages_opened: int = 0
    playwright: Optional[object] = None
    browser: Optional[Browser] = None
    context: Optional[BrowserContext] = None
    page: Optional[Page] = None
    pages: Dict[str, Page] = field(default_factory=dict)
    active_page_id: str = "default"
    event_queue: Optional[asyncio.Queue] = None  # Will be initialized in __post_init__
    recent_events: Optional[Deque[Dict[str, Any]]] = None
    websocket_messages: Optional[Deque[Dict[str, Any]]] = None
    network_requests: Optional[Deque[Dict[str, Any]]] = None
    network_responses: Optional[Deque[Dict[str, Any]]] = None
    console_messages: Optional[Deque[Dict[str, Any]]] = None
    dom_mutations: Optional[Deque[Dict[str, Any]]] = None
    performance_metrics: Dict[str, Any] = field(default_factory=dict)
    screenshots: Deque[Dict[str, str]] = field(default_factory=lambda: deque(maxlen=5))  # Stores multiple screenshots with metadata
    total_screenshot_bytes: int = 0  # Track total screenshot memory usage

    def __post_init__(self):
        """Initialize bounded queues based on security configuration."""
        # Initialize bounded event queue
        self.event_queue = asyncio.Queue(maxsize=self.security.max_event_queue_size)

        # Initialize bounded deques with configurable sizes
        self.recent_events = deque(maxlen=self.security.max_recent_events)
        self.websocket_messages = deque(maxlen=self.security.max_websocket_messages)
        self.network_requests = deque(maxlen=self.security.max_network_events)
        self.network_responses = deque(maxlen=self.security.max_network_events)
        self.console_messages = deque(maxlen=self.security.max_console_messages)
        self.dom_mutations = deque(maxlen=self.security.max_dom_mutations)

        # Initialize screenshots deque with configured max
        self.screenshots = deque(maxlen=self.security.max_screenshots_stored)

    async def ensure_page(self, tab_id: Optional[str] = None) -> Page:
        """Ensure that the browser session is ready and return a page."""

        if not self.playwright:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)
            self.context = await self.browser.new_context(
                viewport={"width": 1920, "height": 1080}
            )
            default_page = await self.context.new_page()
            self.pages_opened = 1
            self.active_page_id = "default"
            await self._register_page(default_page, "default")
            logger.debug("Browser session initialized")

        if tab_id:
            if tab_id not in self.pages:
                raise ValueError(f"Tab {tab_id} does not exist")
            self.active_page_id = tab_id

        active_page = self.pages.get(self.active_page_id)
        if not active_page:
            if not self.context:
                raise RuntimeError("Browser context is not initialized")
            if self.pages_opened >= self.security.max_pages_per_session:
                raise ValueError(
                    "Maximum number of pages reached for this session"
                )
            active_page = await self.context.new_page()
            self.pages_opened += 1
            await self._register_page(active_page, self.active_page_id)

        self.page = active_page
        return active_page

    async def new_tab(self, tab_id: Optional[str] = None) -> Page:
        """Create a new tab/page within the session."""

        if not tab_id:
            tab_id = f"tab_{int(time.time() * 1000)}"
        if tab_id in self.pages:
            raise ValueError(f"Tab {tab_id} already exists")

        if self.pages_opened >= self.security.max_pages_per_session:
            raise ValueError(
                "Maximum number of pages reached for this session"
            )

        await self.ensure_page()
        if not self.context:
            raise RuntimeError("Browser context is not initialized")

        page = await self.context.new_page()
        self.pages_opened += 1
        self.active_page_id = tab_id
        await self._register_page(page, tab_id)
        self.page = page
        return page

    async def switch_tab(self, tab_id: str) -> Page:
        """Switch to a different tab."""

        if tab_id not in self.pages:
            raise ValueError(f"Tab {tab_id} does not exist")
        self.active_page_id = tab_id
        page = self.pages[tab_id]
        self.page = page
        return page

    async def get_active_page(self) -> Page:
        """Return the currently active page."""

        return await self.ensure_page(self.active_page_id)

    def list_tabs(self) -> List[str]:
        """Return a list of currently open tab identifiers."""

        return list(self.pages.keys())

    async def close(self) -> None:
        """Close the session and dispose resources."""

        try:
            for page_id, page in list(self.pages.items()):
                try:
                    await page.close()
                except Exception:
                    logger.debug("Failed to close page %s", page_id)
            self.pages.clear()
            self.page = None
        finally:
            self.pages_opened = 0

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

    async def record_screenshot(
        self, screenshot_base64: str, metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Store screenshot with size validation and automatic cleanup."""
        try:
            # Calculate screenshot size in MB
            screenshot_bytes = len(screenshot_base64)
            screenshot_mb = screenshot_bytes / (1024 * 1024)

            # Validate screenshot size
            if screenshot_mb > self.security.max_screenshot_size_mb:
                logger.warning(
                    "Screenshot exceeds maximum size (%.2fMB > %.2fMB), skipping storage",
                    screenshot_mb,
                    self.security.max_screenshot_size_mb,
                )
                raise ValueError(
                    f"Screenshot size {screenshot_mb:.2f}MB exceeds maximum {self.security.max_screenshot_size_mb}MB"
                )

            # Store screenshot with metadata
            screenshot_entry = {
                "data": screenshot_base64,
                "timestamp": time.time(),
                "size_bytes": screenshot_bytes,
                "metadata": metadata or {},
            }

            # Deduct old screenshot size if deque is at capacity
            if len(self.screenshots) >= self.security.max_screenshots_stored:
                old_entry = self.screenshots[0]
                self.total_screenshot_bytes -= old_entry.get("size_bytes", 0)

            # Add new screenshot
            self.screenshots.append(screenshot_entry)
            self.total_screenshot_bytes += screenshot_bytes

            # Emit event
            event = {
                "type": "screenshot",
                "timestamp": time.time(),
                "size_mb": screenshot_mb,
                "total_screenshots": len(self.screenshots),
                "total_memory_mb": self.total_screenshot_bytes / (1024 * 1024),
                "metadata": metadata or {},
            }
            self._record_event(event)

            if self.security.log_actions:
                logger.info(
                    "Screenshot stored: %.2fMB (total: %d screenshots, %.2fMB)",
                    screenshot_mb,
                    len(self.screenshots),
                    self.total_screenshot_bytes / (1024 * 1024),
                )
        except Exception as exc:
            logger.error("Failed to record screenshot: %s", exc)
            raise

    def get_latest_screenshot(self) -> Optional[str]:
        """Retrieve the most recent screenshot data."""
        if self.screenshots:
            return self.screenshots[-1]["data"]
        return None

    def get_screenshot_history(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieve recent screenshots with metadata (excluding base64 data)."""
        screenshots = list(self.screenshots)[-limit:]
        return [
            {
                "timestamp": s["timestamp"],
                "size_bytes": s["size_bytes"],
                "metadata": s.get("metadata", {}),
            }
            for s in screenshots
        ]

    def clear_screenshots(self) -> None:
        """Clear all stored screenshots to free memory."""
        self.screenshots.clear()
        self.total_screenshot_bytes = 0
        logger.info("Cleared all screenshots from session")

    async def get_performance_metrics(self, page: Optional[Page] = None) -> Dict[str, Any]:
        """Retrieve performance metrics from the active page."""

        page = page or await self.get_active_page()
        try:
            metrics = await page.evaluate(
                """
                () => {
                    const perf = performance.getEntriesByType('navigation')[0];
                    if (!perf) {
                        return { error: 'Navigation metrics unavailable' };
                    }
                    return {
                        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
                        loadComplete: perf.loadEventEnd - perf.loadEventStart,
                        dns: perf.domainLookupEnd - perf.domainLookupStart,
                        connect: perf.connectEnd - perf.connectStart,
                        response: perf.responseEnd - perf.responseStart,
                        timestamp: Date.now()
                    };
                }
                """
            )
        except Exception as exc:
            metrics = {"error": str(exc), "timestamp": time.time()}

        self.performance_metrics = metrics
        return metrics

    async def wait_for_event(
        self,
        event_type: Optional[str],
        pattern: Optional[str],
        timeout: float,
    ) -> Dict[str, Any]:
        """Wait for an event of a given type that optionally matches a pattern."""

        deadline = time.time() + timeout
        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                raise TimeoutError("Timed out waiting for browser event")

            try:
                event = await asyncio.wait_for(self.event_queue.get(), timeout=remaining)
            except asyncio.TimeoutError as exc:  # pragma: no cover - defensive
                raise TimeoutError("Timed out waiting for browser event") from exc

            if event_type and event.get("type") != event_type:
                continue

            if pattern:
                serialized = json.dumps(event, default=str)
                if pattern not in serialized:
                    continue

            return event

    def get_recent_events(
        self, event_type: Optional[str] = None, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Return a snapshot of recent events, filtered by type if provided."""

        events = list(self.recent_events)
        if event_type:
            events = [event for event in events if event.get("type") == event_type]
        return events[-limit:]

    def _record_event(self, event: Dict[str, Any]) -> None:
        """Record an event in buffers and enqueue it for waiters."""

        self.recent_events.append(event)
        try:
            self.event_queue.put_nowait(event)
        except asyncio.QueueFull:  # pragma: no cover - defensive
            logger.debug("Event queue full; dropping event")

    async def _register_page(self, page: Page, page_id: str) -> None:
        """Register a page with event listeners and bookkeeping."""

        self.pages[page_id] = page
        await self._setup_realtime_listeners(page, page_id)

    async def _setup_realtime_listeners(self, page: Page, page_id: str) -> None:
        """Attach real-time event listeners to a Playwright page."""

        def handle_console(msg) -> None:
            entry = {
                "type": "console",
                "level": msg.type,
                "text": msg.text,
                "timestamp": time.time(),
                "page_id": page_id,
            }
            self.console_messages.append(entry)
            self._record_event(entry)

        async def handle_mutation(mutations: List[Dict[str, Any]]) -> None:
            entry = {
                "type": "dom_mutation",
                "timestamp": time.time(),
                "page_id": page_id,
                "mutations": mutations,
            }
            self.dom_mutations.append(entry)
            self._record_event(entry)

        def handle_request(request) -> None:
            entry = {
                "type": "network_request",
                "timestamp": time.time(),
                "page_id": page_id,
                "url": request.url,
                "method": request.method,
                "resource_type": request.resource_type,
            }
            self.network_requests.append(entry)
            self._record_event(entry)

        def handle_response(response) -> None:
            entry = {
                "type": "network_response",
                "timestamp": time.time(),
                "page_id": page_id,
                "url": response.url,
                "status": response.status,
            }
            self.network_responses.append(entry)
            self._record_event(entry)

        def handle_websocket(ws: WebSocket) -> None:
            meta = {
                "type": "websocket",
                "timestamp": time.time(),
                "page_id": page_id,
                "url": ws.url,
            }
            self.websocket_messages.append(meta)
            self._record_event(meta)

            def record_frame(data: str, direction: str) -> None:
                entry = {
                    "type": "websocket_message",
                    "timestamp": time.time(),
                    "page_id": page_id,
                    "url": ws.url,
                    "direction": direction,
                    "data": data,
                }
                self.websocket_messages.append(entry)
                self._record_event(entry)

            ws.on("framereceived", lambda frame: record_frame(frame, "received"))
            ws.on("framesent", lambda frame: record_frame(frame, "sent"))
            ws.on("close", lambda: self._record_event({
                "type": "websocket_closed",
                "timestamp": time.time(),
                "page_id": page_id,
                "url": ws.url,
            }))

        page.on("console", handle_console)
        page.on("request", handle_request)
        page.on("response", handle_response)
        page.on("websocket", handle_websocket)

        callback_name = f"__dsmMutationCallback_{page_id}"

        await page.expose_function(callback_name, handle_mutation)
        await page.evaluate(
            """
            (callbackName) => {
                const notify = (payload) => {
                    try {
                        window[callbackName](payload);
                    } catch (err) {
                        console.warn('Failed to notify mutation observer', err);
                    }
                };
                const observer = new MutationObserver((mutations) => {
                    const serialized = mutations.map((mutation) => ({
                        type: mutation.type,
                        target: mutation.target && mutation.target.outerHTML
                            ? mutation.target.outerHTML.slice(0, 500)
                            : null,
                        addedNodes: Array.from(mutation.addedNodes || []).map((node) => {
                            if (node.outerHTML) {
                                return node.outerHTML.slice(0, 500);
                            }
                            return node.textContent ? node.textContent.slice(0, 200) : node.nodeName;
                        }),
                        removedNodes: Array.from(mutation.removedNodes || []).map((node) => {
                            if (node.outerHTML) {
                                return node.outerHTML.slice(0, 500);
                            }
                            return node.textContent ? node.textContent.slice(0, 200) : node.nodeName;
                        }),
                        attributeName: mutation.attributeName || null,
                    }));
                    notify(serialized);
                });
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                });
                window.__dsmMutationObserver = observer;
            }
            """,
            callback_name,
        )


class BrowserSessionManager:
    """Manage browser sessions identified by a session key with user isolation and rate limiting."""

    def __init__(self, security_config: Optional[BrowserSecurityConfig] = None):
        self.security = security_config or BrowserSecurityConfig()
        self._sessions: Dict[str, BrowserSession] = {}
        self._lock = asyncio.Lock()
        # Rate limiting: track request times per session
        self._request_times: Dict[str, list] = defaultdict(list)
        self._rate_limit_lock = asyncio.Lock()

    def _get_session_key(self, session_id: str, user_id: Optional[str] = None) -> str:
        """Generate a user-scoped session key to prevent conflicts."""
        if user_id:
            return f"{user_id}:{session_id}"
        # If no user_id provided, use session_id but log warning
        logger.warning(
            "Session created without user_id. Consider providing user_id for proper isolation."
        )
        return session_id

    async def _check_rate_limit(self, session_key: str) -> Tuple[bool, str]:
        """Check if session is within rate limit. Returns (allowed, error_message)."""
        if self.security.rate_limit_per_minute <= 0:
            return True, ""  # Rate limiting disabled

        async with self._rate_limit_lock:
            now = time.time()
            cutoff = now - 60  # last minute
            times = self._request_times[session_key]
            # Remove old requests outside the time window
            times[:] = [t for t in times if t > cutoff]

            if len(times) >= self.security.rate_limit_per_minute:
                remaining = int(60 - (now - times[0])) if times else 0
                return False, (
                    f"Rate limit exceeded: {len(times)}/{self.security.rate_limit_per_minute} "
                    f"requests per minute. Retry after {remaining} seconds."
                )

            # Record this request
            times.append(now)
            return True, ""

    async def get_session(
        self, session_id: str = "default", user_id: Optional[str] = None
    ) -> BrowserSession:
        """Return an active session for the supplied identifier with user isolation."""

        session_key = self._get_session_key(session_id, user_id)

        # Check rate limit
        allowed, error_msg = await self._check_rate_limit(session_key)
        if not allowed:
            raise ValueError(error_msg)

        async with self._lock:
            session = self._sessions.get(session_key)
            if session and session.expired():
                await session.close()
                session = None
                # Clean up rate limiting data for expired session
                self._request_times.pop(session_key, None)

            if not session:
                session = BrowserSession(self.security)
                self._sessions[session_key] = session

        await session.ensure_page()
        return session

    async def close_session(
        self, session_id: str, user_id: Optional[str] = None
    ) -> None:
        """Close and remove a session by identifier."""

        session_key = self._get_session_key(session_id, user_id)
        async with self._lock:
            session = self._sessions.pop(session_key, None)
            # Clean up rate limiting data
            self._request_times.pop(session_key, None)
        if session:
            await session.close()

    async def shutdown(self) -> None:
        """Close all managed sessions."""

        async with self._lock:
            sessions = list(self._sessions.items())
            self._sessions.clear()
            self._request_times.clear()

        for _, session in sessions:
            try:
                await session.close()
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("Error closing browser session: %s", exc)
