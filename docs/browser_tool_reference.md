# Browser Tool Reference

This note summarizes the callable helpers exposed by each module in `ai_service/browser_tools/` and explains where the Flask app wires the tools into the hybrid AI architecture.

## Exported helpers by module

### `ai_service/browser_tools/navigation_tool.py`
- **Class**: `BrowserNavigationTool` (`browser_navigate`).
- **Actions**: `new_tab`, `switch_tab`, `list_tabs`, `navigate`, `reload`, `back`, `forward`, `content`.
- **Notable helpers**: `_capture_state` (post-navigation screenshot) and `close_session` (close tracked session).

### `ai_service/browser_tools/interaction_tool.py`
- **Class**: `BrowserInteractionTool` (`browser_interact`).
- **Actions**: `click`, `type`, `select`, `upload`, `hover`, `drag`, `drag_panel`.
- **Notable helpers**: `_capture_state` stores screenshots after interactions.

### `ai_service/browser_tools/extraction_tool.py`
- **Class**: `BrowserExtractionTool` (`browser_extract`).
- **Actions**: `text`, `html`, `links`, `javascript`, `panels` (panel metadata via DOM scripting).

### `ai_service/browser_tools/screenshot_tool.py`
- **Class**: `BrowserScreenshotTool` (`browser_screenshot`).
- **Actions**: captures a page or element screenshot (full-page toggle available). Records captured images when allowed.

### `ai_service/browser_tools/realtime_tool.py`
- **Class**: `BrowserRealtimeTool` (`browser_realtime`).
- **Actions**: `wait_for_websocket`, `wait_for_network`, `wait_for_mutation`, `wait_for_console`, `wait_for_event`, `get_recent_events`.

### `ai_service/browser_tools/performance_tool.py`
- **Class**: `BrowserPerformanceTool` (`browser_performance`).
- **Actions**: `get_metrics`, `get_network`, `get_console`, `get_websocket`, `get_mutations`.

### `ai_service/browser_tools/vision_analysis_tool.py`
- **Class**: `BrowserVisionAnalysisTool` (`browser_vision_analyze`).
- **Actions**: captures (optionally scoped) screenshots and sends them to the configured multimodal model for description, falling back when screenshots are disabled.

### `ai_service/browser_tools/browser_sessions.py`
- **Key exports**: `BrowserSessionManager` orchestrates Playwright sessions, tab management, event capture, and telemetry recording used by every tool above.

### `ai_service/browser_tools/browser_config.py`
- **Key exports**: `BrowserSecurityConfig` centralizes domain allow-lists, timeout settings, and feature toggles (screenshots, logging, etc.).

## Tool instantiation path
1. `ai_service/app.py` bootstraps Flask and loads the hybrid integration via `get_ai_integration()`.
2. `ai_service/integration_layer.py` constructs `AIServiceIntegration`, which creates `DellSystemAIService` when the hybrid stack is available.
3. Inside `ai_service/hybrid_ai_architecture.py`, `DellSystemAIService._initialize_tools()` instantiates each browser tool class using a shared `BrowserSessionManager`. The resulting registry is passed to agents and workflows.

These touchpoints ensure the same Playwright session pool is reused across navigation, interaction, extraction, screenshotting, performance, real-time monitoring, and vision analysis operations.
