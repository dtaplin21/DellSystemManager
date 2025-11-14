"""Browser navigation tool leveraging Playwright sessions."""

from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Any, Optional

from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

logger = logging.getLogger(__name__)


class BrowserNavigationTool(BaseTool):
    name: str = "browser_navigate"
    description: str = (
        "Navigate to URLs, control history, capture page content, and manage tabs."
    )
    session_manager: Any = None

    def __init__(self, session_manager: BrowserSessionManager):
        super().__init__()
        self.session_manager = session_manager

    def _run(
        self,
        action: str,
        url: Optional[str] = None,
        wait_for: Optional[str] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
        selector: Optional[str] = None,
    ) -> str:
        try:
            return asyncio.run(
                self._arun(
                    action=action,
                    url=url,
                    wait_for=wait_for,
                    session_id=session_id,
                    user_id=user_id,
                    tab_id=tab_id,
                    selector=selector,
                )
            )
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(
                    self._arun(
                        action=action,
                        url=url,
                        wait_for=wait_for,
                        session_id=session_id,
                        user_id=user_id,
                        tab_id=tab_id,
                        selector=selector,
                    )
                )
            finally:
                loop.close()

    async def _arun(
        self,
        action: str,
        url: Optional[str] = None,
        wait_for: Optional[str] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
        selector: Optional[str] = None,
    ) -> str:
        try:
            session = await self.session_manager.get_session(session_id, user_id)

            # Handle tab management actions first
            if action == "new_tab":
                tab_name = selector or tab_id or f"tab_{int(time.time() * 1000)}"
                try:
                    page = await session.new_tab(tab_name)
                except ValueError as exc:
                    return f"Error: {exc}"

                if url:
                    if not session.security.is_url_allowed(url):
                        return (
                            f"Error: URL {url} is not permitted by security policy. "
                            f"Allowed domains: {session.security.allowed_domains or 'all (if no restrictions)'}"
                        )
                    try:
                        # Use "load" instead of "networkidle" for same reason as main navigation
                        await page.goto(url, timeout=session.security.navigation_timeout_ms, wait_until="load")
                    except Exception as exc:
                        return f"Error navigating new tab to {url}: {exc}"

                    if wait_for:
                        try:
                            await page.wait_for_selector(wait_for, timeout=session.security.wait_timeout_ms)
                        except Exception as exc:
                            return f"Error: Timeout waiting for selector '{wait_for}' on new tab: {exc}"

                await self._capture_state(session, page, action, tab_name)
                return f"Created new tab: {tab_name}"

            if action == "switch_tab":
                target_tab = selector or tab_id
                if not target_tab:
                    return "Error: tab identifier required to switch_tab"
                try:
                    await session.switch_tab(target_tab)
                except ValueError as exc:
                    return f"Error: {exc}"
                return f"Switched to tab: {target_tab}"

            if action == "list_tabs":
                tabs = session.list_tabs()
                return (
                    "Open tabs: " + ", ".join(tabs)
                    if tabs
                    else "Open tabs: (none)"
                )

            page = await session.ensure_page(tab_id)
            timeout = session.security.wait_timeout_ms

            if action == "navigate":
                if not url:
                    return "Error: url parameter is required for navigate action"
                if not session.security.is_url_allowed(url):
                    return (
                        f"Error: URL {url} is not permitted by security policy. "
                        f"Allowed domains: {session.security.allowed_domains or 'all (if no restrictions)'}"
                    )
                try:
                    # Use navigation-specific timeout
                    nav_timeout = session.security.navigation_timeout_ms
                    
                    # Use "load" instead of "networkidle" because:
                    # - Frontend pages have persistent WebSocket connections that prevent networkidle
                    # - "load" waits for page load event, which is sufficient for our use case
                    # - We then wait for specific selector (wait_for) to ensure page is ready
                    logger.info("[%s] Navigating to %s (timeout=%dms, wait_until=load)", session_id, url, nav_timeout)
                    
                    try:
                        await asyncio.wait_for(
                            page.goto(url, timeout=nav_timeout, wait_until="load"),
                            timeout=nav_timeout / 1000.0 + 5  # Add 5 second buffer for Playwright
                        )
                        logger.info("[%s] Page navigation completed, waiting for selector '%s'", session_id, wait_for or "none")
                    except asyncio.TimeoutError:
                        # Check if page loaded but just timed out waiting for networkidle
                        current_url = page.url
                        if current_url != "about:blank" and current_url != url:
                            logger.warning("[%s] Navigation timeout but page URL changed to %s, continuing...", session_id, current_url)
                        else:
                            return f"Error: Navigation to {url} timed out after {nav_timeout}ms (page may have WebSocket connections preventing load completion)"
                    except Exception as nav_exc:
                        error_msg = f"Error during page navigation to {url}: {str(nav_exc)}"
                        logger.error("[%s] %s", session_id, error_msg)
                        return f"Error: {error_msg}"

                    # Wait for specific selector if provided (this ensures page is ready)
                    selector_found = False
                    if wait_for:
                        logger.info("[%s] Waiting for selector '%s' (timeout=%dms)", session_id, wait_for, timeout)
                        try:
                            await asyncio.wait_for(
                                page.wait_for_selector(wait_for, timeout=timeout, state="attached"),
                                timeout=timeout / 1000.0 + 2
                            )
                            # Check if element is actually visible (not just attached)
                            element = await page.query_selector(wait_for)
                            if element:
                                is_visible = await element.is_visible()
                                if is_visible:
                                    logger.info("[%s] Selector '%s' found and visible, page is ready", session_id, wait_for)
                                    selector_found = True
                                else:
                                    logger.warning("[%s] Selector '%s' found but not visible", session_id, wait_for)
                            else:
                                logger.warning("[%s] Selector '%s' query returned None", session_id, wait_for)
                        except asyncio.TimeoutError:
                            # Check if page loaded but selector not found - be lenient if page loaded successfully
                            current_url = page.url
                            page_title = await page.title()
                            # Check if we're on the correct page (URL changed from about:blank)
                            if current_url != "about:blank" and url in current_url:
                                logger.warning("[%s] Selector '%s' timeout but page loaded successfully. URL: %s, Title: %s", session_id, wait_for, current_url, page_title)
                                # Don't fail - page loaded, selector just not found/visible yet
                                selector_found = False
                            else:
                                logger.error("[%s] Selector '%s' timeout and page may not have loaded. URL: %s, Title: %s", session_id, wait_for, current_url, page_title)
                                return f"Error: Timeout waiting for selector '{wait_for}' on {url} after {timeout}ms. Page may not have loaded correctly. Current URL: {current_url}"
                        except Exception as e:
                            logger.error("[%s] Error waiting for selector '%s': %s", session_id, wait_for, str(e))
                            # Check if page loaded despite selector error
                            current_url = page.url
                            if current_url != "about:blank" and url in current_url:
                                logger.warning("[%s] Selector error but page loaded, continuing...", session_id)
                                selector_found = False
                            else:
                                return f"Error waiting for selector '{wait_for}': {str(e)}"

                    message = f"Successfully navigated to {url}"
                    if wait_for:
                        if selector_found:
                            message += f" and found selector '{wait_for}'"
                        else:
                            message += f" (selector '{wait_for}' not found/visible, but page loaded)"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    await self._capture_state(session, page, action, url)
                    await session.get_performance_metrics(page)
                    return message

                except asyncio.TimeoutError:
                    # This should not be reached due to inner try/except, but keep as fallback
                    return f"Error: Navigation to {url} timed out after {nav_timeout}ms"
                except Exception as e:
                    error_msg = f"Error navigating to {url}: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg, exc_info=True)
                    return f"Error: {error_msg}"

            if action == "reload":
                try:
                    # Use "load" instead of "networkidle" to avoid WebSocket timeout issues
                    await page.reload(timeout=timeout, wait_until="load")
                    if wait_for:
                        try:
                            await page.wait_for_selector(wait_for, timeout=timeout)
                        except Exception as e:
                            return f"Error: Timeout waiting for selector '{wait_for}' after reload: {str(e)}"
                    message = f"Successfully reloaded {page.url}"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    await self._capture_state(session, page, action, page.url)
                    await session.get_performance_metrics(page)
                    return message
                except Exception as e:
                    error_msg = f"Error reloading page {page.url}: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "back":
                try:
                    # Use "load" instead of "networkidle" to avoid WebSocket timeout issues
                    await page.go_back(timeout=timeout, wait_until="load")
                    message = f"Successfully navigated back to {page.url}"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    await self._capture_state(session, page, action, page.url)
                    await session.get_performance_metrics(page)
                    return message
                except Exception as e:
                    error_msg = f"Error navigating back: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "forward":
                try:
                    # Use "load" instead of "networkidle" to avoid WebSocket timeout issues
                    await page.go_forward(timeout=timeout, wait_until="load")
                    message = f"Successfully navigated forward to {page.url}"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    await self._capture_state(session, page, action, page.url)
                    await session.get_performance_metrics(page)
                    return message
                except Exception as e:
                    error_msg = f"Error navigating forward: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "content":
                try:
                    content = await page.content()
                    return content
                except Exception as e:
                    error_msg = f"Error getting page content: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            return (
                "Error: Unsupported action '{action}'. Supported actions: navigate, reload, back, forward, content, new_tab, switch_tab, list_tabs"
                .replace("{action}", action)
            )

        except ValueError as e:
            # Rate limiting or other validation errors
            return f"Error: {str(e)}"
        except Exception as e:
            error_msg = f"Unexpected error in navigation tool: {str(e)}"
            logger.error("[%s] %s", session_id, error_msg)
            return error_msg

    async def close_session(
        self, session_id: str = "default", user_id: Optional[str] = None
    ) -> None:
        await self.session_manager.close_session(session_id, user_id)

    async def _capture_state(self, session, page, action: str, target: Optional[str]) -> None:
        """Capture a screenshot after navigation actions for vision workflows."""

        if not session.security.enable_screenshots:
            return

        try:
            buffer = await page.screenshot(full_page=True)
            encoded = base64.b64encode(buffer).decode("utf-8")
            metadata = {"action": action}
            if target:
                metadata["target"] = target
            await session.record_screenshot(encoded, metadata)
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("Failed to capture navigation state: %s", exc)
