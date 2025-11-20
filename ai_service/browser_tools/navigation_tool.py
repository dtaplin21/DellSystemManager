"""Browser navigation tool leveraging Playwright sessions."""

from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Any, Optional

import nest_asyncio
from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

# Apply nest_asyncio to allow nested event loops (fixes CrewAI threading conflicts)
nest_asyncio.apply()

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
        logger.info("[%s] ===== BROWSER NAVIGATION START =====", session_id)
        logger.info("[%s] Action: %s, URL: %s, Wait for: %s, Tab ID: %s", session_id, action, url, wait_for, tab_id)
        
        try:
            logger.info("[%s] Getting browser session...", session_id)
            # Extract auth_token and frontend_url from context if available
            # These would be passed through from the AI service
            auth_token = getattr(self, '_auth_token', None)
            frontend_url = getattr(self, '_frontend_url', None)
            session = await self.session_manager.get_session(
                session_id=session_id,
                user_id=user_id,
                auth_token=auth_token,
                frontend_url=frontend_url
            )
            logger.info("[%s] Browser session obtained", session_id)

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
                        # Skip waiting for canvas selectors - they're not required
                        is_canvas_selector = wait_for == "canvas" or (wait_for and "canvas-main" in wait_for)
                        if is_canvas_selector:
                            logger.info("[%s] Skipping wait for canvas selector on new tab (canvas not required)", session_id)
                        else:
                            tab_timeout = session.security.wait_timeout_ms
                            try:
                                await page.wait_for_selector(wait_for, timeout=tab_timeout)
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

            logger.info("[%s] Ensuring page for tab: %s", session_id, tab_id)
            page = await session.ensure_page(tab_id)
            logger.info("[%s] Page obtained, current URL: %s", session_id, page.url)
            
            # Canvas selectors are skipped entirely - no timeout needed
            # Canvas is used for visual rendering but panel data comes from React state/API, not canvas
            is_canvas_selector = wait_for == "canvas" or (wait_for and "canvas-main" in wait_for)
            if is_canvas_selector:
                logger.info("[%s] Canvas selector detected - will skip waiting (canvas not required)", session_id)
                timeout = 0  # Not used since we skip waiting
            else:
                timeout = session.security.wait_timeout_ms  # Full timeout for required selectors
            logger.info("[%s] Wait timeout: %dms, Navigation timeout: %dms", session_id, timeout, session.security.navigation_timeout_ms)

            if action == "navigate":
                if not url:
                    logger.error("[%s] ❌ URL parameter is required for navigate action", session_id)
                    return "Error: url parameter is required for navigate action"
                if not session.security.is_url_allowed(url):
                    logger.error("[%s] ❌ URL %s is not permitted by security policy", session_id, url)
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
                    logger.info("[%s] ===== NAVIGATION PHASE =====", session_id)
                    logger.info("[%s] Navigating to %s (timeout=%dms, wait_until=load)", session_id, url, nav_timeout)
                    logger.info("[%s] Current page URL before navigation: %s", session_id, page.url)
                    
                    try:
                        navigation_start = time.time()
                        logger.info("[%s] Calling page.goto()...", session_id)
                        await asyncio.wait_for(
                            page.goto(url, timeout=nav_timeout, wait_until="load"),
                            timeout=nav_timeout / 1000.0 + 5  # Add 5 second buffer for Playwright
                        )
                        navigation_duration = time.time() - navigation_start
                        logger.info("[%s] ✅ Page navigation completed in %.2fs", session_id, navigation_duration)
                        logger.info("[%s] Final page URL: %s", session_id, page.url)
                        page_title = await page.title()
                        logger.info("[%s] Page title: %s", session_id, page_title)
                        
                        # Log any console errors
                        try:
                            console_messages = list(session.console_messages)
                            errors = [msg for msg in console_messages if msg.get("type") == "error"]
                            if errors:
                                logger.warning("[%s] Found %d console errors on page:", session_id, len(errors))
                                for error in errors[-5:]:  # Show last 5 errors
                                    logger.warning("[%s]   Console error: %s", session_id, error.get("text", ""))
                        except Exception as console_check_error:
                            logger.debug("[%s] Could not check console messages: %s", session_id, console_check_error)
                        
                        logger.info("[%s] Waiting for selector '%s'", session_id, wait_for or "none")
                    except asyncio.TimeoutError:
                        # Check if page loaded but just timed out waiting for networkidle
                        current_url = page.url
                        logger.error("[%s] ❌ Navigation timeout after %dms", session_id, nav_timeout)
                        logger.error("[%s] Current URL after timeout: %s", session_id, current_url)
                        logger.error("[%s] Expected URL: %s", session_id, url)
                        
                        try:
                            page_title = await page.title()
                            logger.error("[%s] Page title: %s", session_id, page_title)
                        except Exception:
                            logger.error("[%s] Could not get page title", session_id)
                        
                        if current_url != "about:blank" and current_url != url:
                            logger.warning("[%s] ⚠️ Navigation timeout but page URL changed to %s, continuing...", session_id, current_url)
                        else:
                            logger.error("[%s] ❌ Page did not navigate - still at %s", session_id, current_url)
                            return f"Error: Navigation to {url} timed out after {nav_timeout}ms (page may have WebSocket connections preventing load completion)"
                    except Exception as nav_exc:
                        error_msg = f"Error during page navigation to {url}: {str(nav_exc)}"
                        logger.error("[%s] ❌ Navigation exception: %s", session_id, error_msg)
                        logger.error("[%s] Exception type: %s", session_id, type(nav_exc).__name__)
                        logger.exception("[%s] Full exception traceback:", session_id, exc_info=nav_exc)
                        try:
                            current_url = page.url
                            logger.error("[%s] Page URL after error: %s", session_id, current_url)
                        except Exception:
                            logger.error("[%s] Could not get page URL after error", session_id)
                        return f"Error: {error_msg}"

                    # Wait for specific selector if provided (this ensures page is ready)
                    # SKIP waiting for canvas selectors - they're not required and cause timeouts
                    selector_found = False
                    if wait_for:
                        # Check if this is a canvas selector - skip waiting for canvas entirely
                        is_canvas_selector = wait_for == "canvas" or (wait_for and "canvas-main" in wait_for)
                        
                        if is_canvas_selector:
                            logger.info("[%s] ⚠️ Skipping wait for canvas selector '%s' - canvas not required for data extraction", session_id, wait_for)
                            logger.info("[%s] Page loaded successfully, proceeding without canvas wait", session_id)
                            selector_found = False  # Canvas not found, but that's OK
                        else:
                            logger.info("[%s] ===== SELECTOR WAIT PHASE =====", session_id)
                            logger.info("[%s] Waiting for selector '%s' (timeout=%dms, state=attached)", session_id, wait_for, timeout)
                            
                            # Log page state before waiting
                            try:
                                page_content = await page.content()
                                logger.debug("[%s] Page content length: %d characters", session_id, len(page_content))
                                # Check if selector exists in HTML (even if not visible)
                                if wait_for in page_content or f'<{wait_for}' in page_content or f'id="{wait_for}"' in page_content:
                                    logger.info("[%s] Selector '%s' appears in page HTML", session_id, wait_for)
                                else:
                                    logger.warning("[%s] Selector '%s' not found in page HTML", session_id, wait_for)
                            except Exception as content_check_error:
                                logger.debug("[%s] Could not check page content: %s", session_id, content_check_error)
                            
                            try:
                                selector_wait_start = time.time()
                                await asyncio.wait_for(
                                    page.wait_for_selector(wait_for, timeout=timeout, state="attached"),
                                    timeout=timeout / 1000.0 + 2
                                )
                                selector_wait_duration = time.time() - selector_wait_start
                                logger.info("[%s] ✅ Selector '%s' found (attached) in %.2fs", session_id, wait_for, selector_wait_duration)
                                
                                # Check if element is actually visible (not just attached)
                                element = await page.query_selector(wait_for)
                                if element:
                                    is_visible = await element.is_visible()
                                    element_bounds = await element.bounding_box()
                                    logger.info("[%s] Element visibility check: visible=%s, bounds=%s", session_id, is_visible, element_bounds)
                                    if is_visible:
                                        logger.info("[%s] ✅ Selector '%s' found and visible, page is ready", session_id, wait_for)
                                        selector_found = True
                                    else:
                                        logger.warning("[%s] ⚠️ Selector '%s' found but not visible (bounds: %s)", session_id, wait_for, element_bounds)
                                else:
                                    logger.warning("[%s] ⚠️ Selector '%s' query returned None", session_id, wait_for)
                            except asyncio.TimeoutError:
                                # Check if page loaded but selector not found
                                current_url = page.url
                                page_title = await page.title()
                                logger.error("[%s] ❌ Selector '%s' timeout after %dms", session_id, wait_for, timeout)
                                logger.info("[%s] Current URL: %s, Page title: %s", session_id, current_url, page_title)
                                
                                # Check if we're on the correct page (URL changed from about:blank)
                                if current_url != "about:blank" and url in current_url:
                                    logger.warning("[%s] ⚠️ Selector '%s' timeout but page loaded successfully. URL: %s, Title: %s", session_id, wait_for, current_url, page_title)
                                    selector_found = False
                                else:
                                    logger.error("[%s] ❌ Selector '%s' timeout and page may not have loaded. URL: %s, Title: %s", session_id, wait_for, current_url, page_title)
                                    return f"Error: Timeout waiting for selector '{wait_for}' on {url} after {timeout}ms. Page may not have loaded correctly. Current URL: {current_url}"
                            except Exception as e:
                                logger.error("[%s] ❌ Error waiting for selector '%s': %s", session_id, wait_for, str(e))
                                logger.error("[%s] Exception type: %s", session_id, type(e).__name__)
                                logger.exception("[%s] Full exception traceback:", session_id, exc_info=e)
                                # Check if page loaded despite selector error
                                current_url = page.url
                                if current_url != "about:blank" and url in current_url:
                                    logger.warning("[%s] ⚠️ Selector error but page loaded, continuing...", session_id)
                                    selector_found = False
                                else:
                                    return f"Error waiting for selector '{wait_for}': {str(e)}"

                    message = f"Successfully navigated to {url}"
                    if wait_for:
                        if selector_found:
                            message += f" and found selector '{wait_for}'"
                        else:
                            is_canvas_selector = wait_for == "canvas" or (wait_for and "canvas-main" in wait_for)
                            if is_canvas_selector:
                                message += f" (optional selector '{wait_for}' not found, but page loaded - panel data can be extracted from React state/API)"
                            else:
                                message += f" (selector '{wait_for}' not found/visible, but page loaded)"
                    
                    logger.info("[%s] ===== NAVIGATION COMPLETE =====", session_id)
                    logger.info("[%s] %s", session_id, message)
                    
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


# Rebuild Pydantic schema to resolve Optional forward references
# CrewAI's BaseTool creates schemas lazily, so we need to ensure it's created first
def _rebuild_navigation_schema():
    """Rebuild schema after module load to resolve ForwardRefs."""
    try:
        # Create a temporary instance to force schema creation
        # We can't actually create one without session_manager, so we'll do it lazily
        # The __init__ method will handle rebuilding for actual instances
        pass
    except Exception:
        pass

# Try to rebuild at module level if possible
try:
    # Check if we can access the class schema
    if hasattr(BrowserNavigationTool, 'args_schema'):
        schema = getattr(BrowserNavigationTool, 'args_schema', None)
        if schema is not None:
            schema.model_rebuild()
    # Also try rebuilding the model itself
    if hasattr(BrowserNavigationTool, 'model_rebuild'):
        BrowserNavigationTool.model_rebuild()
except (AttributeError, Exception):
    # Schema may not be created yet (lazy creation by CrewAI)
    # Individual instances will rebuild in __init__
    pass
