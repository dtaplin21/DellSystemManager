"""Data extraction helpers for automated browsing."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, List, Optional, Union

import nest_asyncio
from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

# Apply nest_asyncio to allow nested event loops (fixes CrewAI threading conflicts)
nest_asyncio.apply()

logger = logging.getLogger(__name__)


class BrowserExtractionTool(BaseTool):
    name: str = "browser_extract"
    description: str = (
        "Extract text, tables, links, or execute JavaScript on the active page. "
        "Supported actions: 'text' (extract text), 'html' (extract HTML), 'links' (extract links), "
        "'javascript' (execute JavaScript code), 'panels' (extract and sort panels by visual position)."
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
                        'List': List,
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
        selector: Optional[str] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
        output_format: str = "text",
    ) -> Any:
        try:
            return asyncio.run(
                self._arun(
                    action=action,
                    selector=selector,
                    session_id=session_id,
                    user_id=user_id,
                    tab_id=tab_id,
                    output_format=output_format,
                )
            )
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(
                    self._arun(
                        action=action,
                        selector=selector,
                        session_id=session_id,
                        user_id=user_id,
                        tab_id=tab_id,
                        output_format=output_format,
                    )
                )
            finally:
                loop.close()

    async def _arun(
        self,
        action: str,
        selector: Optional[str] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
        output_format: str = "text",
    ) -> Any:
        try:
            session = await self.session_manager.get_session(session_id, user_id)
            page = await session.ensure_page(tab_id)

            if action == "text":
                try:
                    if selector:
                        target = await page.query_selector(selector)
                        if target is None:
                            return f"Error: Selector '{selector}' not found on page"
                        text = await target.inner_text()
                    else:
                        text = await page.inner_text("body")
                    if session.security.log_actions:
                        logger.info(
                            "[%s] Extracted text (%d chars) using selector '%s'",
                            session_id,
                            len(text),
                            selector or "body",
                        )
                    return text
                except Exception as e:
                    error_msg = (
                        f"Error extracting text with selector '{selector or 'body'}': {str(e)}"
                    )
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "html":
                try:
                    if selector:
                        handle = await page.query_selector(selector)
                        if handle is None:
                            return f"Error: Selector '{selector}' not found on page"
                        markup = await handle.inner_html()
                    else:
                        markup = await page.content()
                    if session.security.log_actions:
                        logger.info(
                            "[%s] Extracted html (%d chars) using selector '%s'",
                            session_id,
                            len(markup),
                            selector or "document",
                        )
                    return markup
                except Exception as e:
                    error_msg = (
                        f"Error extracting HTML with selector '{selector or 'document'}': {str(e)}"
                    )
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "links":
                try:
                    locator = selector or "a"
                    elements = await page.query_selector_all(locator)
                    links: List[str] = []
                    for element in elements:
                        href = await element.get_attribute("href")
                        if href:
                            links.append(href)
                    if session.security.log_actions:
                        logger.info(
                            "[%s] Extracted %d links using selector '%s'",
                            session_id,
                            len(links),
                            locator,
                        )
                    return "\n".join(links) if links else f"No links found with selector '{locator}'"
                except Exception as e:
                    error_msg = f"Error extracting links with selector '{selector or 'a'}': {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "javascript":
                try:
                    if not selector:
                        return "Error: JavaScript code is required in the 'selector' parameter for 'javascript' action"
                    
                    # Execute JavaScript code in the page context
                    result = await page.evaluate(selector)
                    
                    # Convert result to string if it's not already
                    if isinstance(result, (dict, list)):
                        import json
                        result_str = json.dumps(result, indent=2)
                    else:
                        result_str = str(result)
                    
                    if session.security.log_actions:
                        logger.info(
                            "[%s] Executed JavaScript (%d chars result)",
                            session_id,
                            len(result_str),
                        )
                    return result_str
                except Exception as e:
                    error_msg = f"Error executing JavaScript: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    return error_msg

            if action == "panels":
                try:
                    # JavaScript code to extract panels from the page and sort by visual position
                    # Using async function so we can use await for fetch if needed
                    panel_extraction_script = """
                    (async function() {
                        // Try multiple methods to get panel data
                        let panels = null;
                        let source = 'unknown';
                        
                        // Method 1: Check localStorage for panel positions
                        try {
                            const stored = localStorage.getItem('panelLayoutPositions');
                            if (stored) {
                                const positionMap = JSON.parse(stored);
                                // We have positions, but need full panel data
                                // Try to get from API or React state
                            }
                        } catch (e) {
                            console.log('localStorage check failed:', e);
                        }
                        
                        // Method 2: Try to access React state via window object or React DevTools
                        try {
                            // Look for React root element
                            const rootElements = document.querySelectorAll('[data-reactroot], #__next, #root');
                            if (rootElements.length > 0) {
                                // Try to find React fiber tree
                                const reactKey = Object.keys(rootElements[0]).find(key => 
                                    key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
                                );
                                if (reactKey) {
                                    let fiber = rootElements[0][reactKey];
                                    // Walk up the fiber tree to find panel data
                                    for (let i = 0; i < 50 && fiber; i++) {
                                        if (fiber.memoizedState || fiber.memoizedProps) {
                                            const state = fiber.memoizedState;
                                            const props = fiber.memoizedProps;
                                            
                                            // Check if state/props contains panels
                                            if (state && (state.panels || (state.panelsState && state.panelsState.panels))) {
                                                panels = state.panels || (state.panelsState && state.panelsState.panels);
                                                source = 'react_state';
                                                break;
                                            }
                                            if (props && (props.panels || (props.externalPanels))) {
                                                panels = props.panels || props.externalPanels;
                                                source = 'react_props';
                                                break;
                                            }
                                        }
                                        fiber = fiber.return || fiber.child;
                                    }
                                }
                            }
                        } catch (e) {
                            console.log('React state access failed:', e);
                        }
                        
                        // Method 3: Try window object
                        if (!panels) {
                            try {
                                if (window.__PANELS__ || window.panels) {
                                    panels = window.__PANELS__ || window.panels;
                                    source = 'window';
                                }
                            } catch (e) {
                                console.log('Window object access failed:', e);
                            }
                        }
                        
                        // Method 4: Fetch from API (fallback if React state not available)
                        if (!panels || !Array.isArray(panels) || panels.length === 0) {
                            try {
                                // Extract project ID from URL
                                const urlMatch = window.location.pathname.match(/\/projects\/([^\/]+)/);
                                const projectId = urlMatch ? urlMatch[1] : null;
                                
                                if (projectId) {
                                    // Try to get auth token from localStorage or cookies
                                    let authToken = null;
                                    try {
                                        const supabaseSession = localStorage.getItem('sb-' + window.location.hostname.split('.')[0] + '-auth-token');
                                        if (supabaseSession) {
                                            const session = JSON.parse(supabaseSession);
                                            authToken = session?.access_token || session?.token;
                                        }
                                    } catch (e) {
                                        console.log('Could not get auth token from localStorage:', e);
                                    }
                                    
                                    // Fetch panels from API
                                    const apiUrl = `/api/projects/${projectId}/panels`;
                                    const headers = {
                                        'Content-Type': 'application/json'
                                    };
                                    if (authToken) {
                                        headers['Authorization'] = `Bearer ${authToken}`;
                                    }
                                    
                                    const response = await fetch(apiUrl, {
                                        method: 'GET',
                                        headers: headers,
                                        credentials: 'include'
                                    });
                                    
                                    if (response.ok) {
                                        const apiData = await response.json();
                                        if (apiData && Array.isArray(apiData)) {
                                            panels = apiData;
                                            source = 'api_fetch';
                                        } else if (apiData && Array.isArray(apiData.panels)) {
                                            panels = apiData.panels;
                                            source = 'api_fetch';
                                        }
                                    } else {
                                        console.log('API fetch failed:', response.status, response.statusText);
                                    }
                                }
                            } catch (e) {
                                console.log('API fetch failed:', e);
                            }
                        }
                        
                        if (!panels || !Array.isArray(panels) || panels.length === 0) {
                            return JSON.stringify({
                                success: false,
                                error: 'Could not find panel data on page. Tried: localStorage, React state, API fetch, window object.',
                                source: source,
                                panels: []
                            });
                        }
                        
                        // Sort panels by visual position: Y coordinate first (top to bottom), then X (left to right)
                        const sortedPanels = [...panels].sort((a, b) => {
                            const yA = a.y || 0;
                            const yB = b.y || 0;
                            const xA = a.x || 0;
                            const xB = b.x || 0;
                            
                            // First sort by Y (top to bottom)
                            if (yA !== yB) {
                                return yA - yB;
                            }
                            // If Y is same, sort by X (left to right)
                            return xA - xB;
                        });
                        
                        // Format result with visual order
                        const result = {
                            success: true,
                            source: source,
                            totalPanels: sortedPanels.length,
                            panels: sortedPanels.map((panel, index) => ({
                                visualOrder: index + 1,
                                panelNumber: panel.panelNumber || panel.id,
                                id: panel.id,
                                x: panel.x,
                                y: panel.y,
                                width: panel.width,
                                height: panel.height,
                                rollNumber: panel.rollNumber || panel.roll || 'N/A'
                            }))
                        };
                        
                        return JSON.stringify(result);
                    })();
                    """
                    
                    result = await page.evaluate(panel_extraction_script)
                    
                    if session.security.log_actions:
                        logger.info(
                            "[%s] Extracted panels data (%d chars)",
                            session_id,
                            len(str(result)),
                        )
                    
                    # Parse and format the result nicely
                    try:
                        import json

                        parsed = json.loads(result) if isinstance(result, str) else result
                        if parsed.get('success'):
                            if output_format == "json":
                                return parsed  # type: ignore[return-value]

                            panels = parsed.get('panels', [])
                            formatted_lines = [
                                f"Found {parsed.get('totalPanels', 0)} panels (sorted by visual position, source: {parsed.get('source', 'unknown')}):",
                                "",
                            ]
                            for panel in panels:
                                formatted_lines.append(
                                    f"  {panel.get('visualOrder', '?')}. {panel.get('panelNumber', 'N/A')} "
                                    f"({panel.get('width', 0)}ft x {panel.get('height', 0)}ft) "
                                    f"at ({panel.get('x', 0)}, {panel.get('y', 0)}) "
                                    f"- Roll: {panel.get('rollNumber', 'N/A')}"
                                )
                            return "\n".join(formatted_lines)

                        if output_format == "json":
                            return parsed  # type: ignore[return-value]
                        return result
                    except Exception:
                        if output_format == "json":
                            return {"success": False, "error": "Failed to parse panel extraction response"}
                        return result

                except Exception as e:
                    error_msg = f"Error extracting panels: {str(e)}"
                    logger.error("[%s] %s", session_id, error_msg)
                    if output_format == "json":
                        return {"success": False, "error": error_msg}
                    return error_msg

            return f"Error: Unsupported action '{action}'. Supported actions: text, html, links, javascript, panels"


        except ValueError as e:
            # Rate limiting or other validation errors
            return f"Error: {str(e)}"
        except Exception as e:
            error_msg = f"Unexpected error in extraction tool: {str(e)}"
            logger.error("[%s] %s", session_id, error_msg)
            return error_msg


# Rebuild Pydantic schema to resolve Optional forward references
# CrewAI's BaseTool creates schemas lazily, so individual instances will rebuild in __init__
try:
    # Check if we can access the class schema
    if hasattr(BrowserExtractionTool, 'args_schema'):
        schema = getattr(BrowserExtractionTool, 'args_schema', None)
        if schema is not None:
            schema.model_rebuild()
    # Also try rebuilding the model itself
    if hasattr(BrowserExtractionTool, 'model_rebuild'):
        BrowserExtractionTool.model_rebuild()
except (AttributeError, Exception):
    # Schema may not be created yet (lazy creation by CrewAI)
    # Individual instances will rebuild in __init__
    pass
