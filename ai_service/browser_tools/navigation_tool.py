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
                        await page.goto(url, timeout=session.security.wait_timeout_ms, wait_until="networkidle")
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

                    await asyncio.wait_for(
                        page.goto(url, timeout=nav_timeout, wait_until="networkidle"),
                        timeout=nav_timeout / 1000.0 + 5  # Add 5 second buffer for Playwright
                    )

                    if wait_for:
                        try:
                            await asyncio.wait_for(
                                page.wait_for_selector(wait_for, timeout=timeout),
                                timeout=timeout / 1000.0 + 2
                            )
                        except asyncio.TimeoutError:
                            return f"Error: Timeout waiting for selector '{wait_for}' on {url}"
                        except Exception as e:
                            return f"Error waiting for selector '{wait_for}': {str(e)}"

                    message = f"Successfully navigated to {url}"
                    if session.security.log_actions:
                        logger.info("[%s] %s", session_id, message)
                    await self._capture_state(session, page, action, url)
                    await session.get_performance_metrics(page)
                    return message

                except asyncio.TimeoutError:
                    return f"Error: Navigation to {url} timed out after {nav_timeout}ms"
                except Exception as e:
                    error_msg = f"Error navigating to {url}: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "reload":
                try:
                    await page.reload(timeout=timeout, wait_until="networkidle")
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
                    await page.go_back(timeout=timeout, wait_until="networkidle")
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
                    await page.go_forward(timeout=timeout, wait_until="networkidle")
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
