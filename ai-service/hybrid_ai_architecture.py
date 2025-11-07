# Hybrid AI Architecture: Combining Framework + Practical Implementation
# This merges the cost-efficient, scalable framework with direct file integration

import asyncio
import base64
import datetime
import json
import logging
import os
import uuid
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Literal

import redis
import requests
from crewai import Agent, Crew, Task

from langchain.tools import BaseTool
from pydantic import BaseModel, Field, PrivateAttr, ValidationError

from crewai.tools import BaseTool
from pydantic import BaseModel, Field, ValidationError


# Configure logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _is_browser_automation_enabled() -> bool:
    """Return True when the runtime configuration allows browser automation."""

    flag = os.getenv("ENABLE_BROWSER_AUTOMATION", "1")
    return str(flag).strip().lower() not in {"0", "false", "no", "off"}

# Try to import OpenAI LLM - handle both old and new langchain versions
# Note: langchain_openai only has ChatOpenAI, not OpenAI class
# Prefer langchain_community first (newer, recommended)
OpenAI = None
try:
    # Force import check - sometimes imports fail silently
    import langchain_community
    logger.info(f"langchain_community package found at: {langchain_community.__file__}")
    from langchain_community.llms import OpenAI  # type: ignore
    logger.info("Loaded OpenAI LLM from langchain_community")
    # Verify it's actually a class, not None
    if OpenAI is None:
        raise ImportError("OpenAI class is None after import")
except ImportError as e:
    logger.warning(f"Failed to import from langchain_community: {e}")
    logger.warning(f"Import error details: {type(e).__name__}: {str(e)}")
    try:
        from langchain.llms import OpenAI
        logger.info("Loaded OpenAI LLM from langchain (deprecated)")
        if OpenAI is None:
            raise ImportError("OpenAI class is None after import")
    except ImportError as e2:
        logger.error(f"Failed to import OpenAI from both langchain_community and langchain")
        logger.error(f"langchain_community error: {e}")
        logger.error(f"langchain error: {e2}")
        logger.warning("OpenAI LLM not available - langchain_community required for legacy OpenAI class")
        OpenAI = None
except Exception as e:
    logger.error(f"Unexpected error importing OpenAI: {type(e).__name__}: {e}", exc_info=True)
    OpenAI = None

# Optional: Ollama for local models
try:
    import ollama
except ImportError:
    ollama = None
    logger.warning("Ollama not available - local models will not work")

BROWSER_AUTOMATION_ENABLED = _is_browser_automation_enabled()
BROWSER_TOOLS_AVAILABLE = False

if not BROWSER_AUTOMATION_ENABLED:
    logger.info("[Browser Tools] Browser automation disabled via ENABLE_BROWSER_AUTOMATION flag")
else:
    try:
        # Try multiple import paths to handle different directory structures
        browser_tools_imported = False

        # Path 1: ai_service (underscore) - when browser_tools is in sibling directory
        try:
            import sys
            import os
            # Get the directory containing this file (ai-service/)
            current_file_dir = os.path.dirname(os.path.abspath(__file__))
            # Get parent directory (DellSystemManager/)
            parent_dir = os.path.dirname(current_file_dir)
            # Path to ai_service/ (sibling directory)
            ai_service_path = os.path.join(parent_dir, 'ai_service')
            browser_tools_path = os.path.join(ai_service_path, 'browser_tools')

            logger.info(f"[Browser Tools] Checking path: {browser_tools_path}")
            logger.info(f"[Browser Tools] Path exists: {os.path.exists(browser_tools_path)}")

            if os.path.exists(browser_tools_path):
                # Add ai_service to path so we can import from it
                if ai_service_path not in sys.path:
                    sys.path.insert(0, ai_service_path)
                    logger.info(f"[Browser Tools] Added {ai_service_path} to sys.path")

                from browser_tools import (
                    BrowserExtractionTool,
                    BrowserInteractionTool,
                    BrowserNavigationTool,
                    BrowserScreenshotTool,
                    BrowserSecurityConfig,
                    BrowserSessionManager,
                )
                browser_tools_imported = True
                logger.info("Browser tools imported from ai_service directory")
        except ImportError as e:
            logger.warning(f"[Browser Tools] Path 1 failed: {e}")
        except Exception as e:
            logger.warning(f"[Browser Tools] Path 1 error: {e}")

        # Path 2: ai_service.browser_tools (package import)
        if not browser_tools_imported:
            try:
                from ai_service.browser_tools import (
                    BrowserExtractionTool,
                    BrowserInteractionTool,
                    BrowserNavigationTool,
                    BrowserScreenshotTool,
                    BrowserSecurityConfig,
                    BrowserSessionManager,
                )
                browser_tools_imported = True
                logger.info("Browser tools imported from ai_service package")
            except ImportError:
                pass

        # Path 3: Relative import (when browser_tools is in same directory)
        if not browser_tools_imported:
            try:
                from browser_tools import (
                    BrowserExtractionTool,
                    BrowserInteractionTool,
                    BrowserNavigationTool,
                    BrowserScreenshotTool,
                    BrowserSecurityConfig,
                    BrowserSessionManager,
                )
                browser_tools_imported = True
                logger.info("Browser tools imported from relative path")
            except ImportError:
                pass

        if browser_tools_imported:
            BROWSER_TOOLS_AVAILABLE = True
        else:
            raise ImportError("Could not find browser_tools in any expected location")

    except Exception as browser_import_error:  # pragma: no cover - optional dependency
        logger.warning(
            "Browser tools not available: %s", getattr(browser_import_error, "detail", browser_import_error)
        )
        logger.warning(f"Browser tools import error details: {browser_import_error}")
        BROWSER_TOOLS_AVAILABLE = False
# === FRAMEWORK LAYER (My Implementation) ===
class ModelTier(Enum):
    LOCAL = "local"
    CLOUD_LITE = "cloud_lite"
    CLOUD_PREMIUM = "cloud_premium"
    SPECIALIZED = "specialized"

@dataclass
class ModelConfig:
    name: str
    tier: ModelTier
    cost_per_1k_tokens: float
    max_context: int
    specialized_for: List[str]
    api_key_env: Optional[str] = None

# Cost-optimized model configurations
MODEL_CONFIGS = {
    "llama3_8b": ModelConfig("llama3:8b", ModelTier.LOCAL, 0.0, 8192, ["chat", "reasoning"]),
    "llama3_70b": ModelConfig("llama3:70b", ModelTier.LOCAL, 0.0, 8192, ["complex_reasoning", "analysis"]),
    "gpt_3_5_turbo": ModelConfig("gpt-3.5-turbo", ModelTier.CLOUD_LITE, 0.002, 16384, ["chat", "basic_analysis"], "OPENAI_API_KEY"),
    "gpt_4_turbo": ModelConfig("gpt-4-turbo", ModelTier.CLOUD_PREMIUM, 0.03, 128000, ["complex_reasoning", "multimodal"], "OPENAI_API_KEY"),
    "claude_3_haiku": ModelConfig("claude-3-haiku-20240307", ModelTier.CLOUD_LITE, 0.001, 200000, ["document_analysis", "summarization"], "ANTHROPIC_API_KEY"),
    "claude_3_sonnet": ModelConfig("claude-3-sonnet-20240229", ModelTier.CLOUD_PREMIUM, 0.015, 200000, ["complex_analysis", "reasoning"], "ANTHROPIC_API_KEY"),
}

class CostOptimizer:
    """Intelligent routing to optimize costs based on query complexity and user tier"""
    
    def __init__(self, redis_client):
        self.redis = redis_client
        self.cost_thresholds = {
            "free_user": 0.01,      # Max $0.01 per request
            "paid_user": 0.10,      # Max $0.10 per request
            "enterprise": 1.00      # Max $1.00 per request
        }
        self.usage_tracking = {}
    
    def select_model(self, query_complexity: str, user_tier: str, agent_type: str) -> ModelConfig:
        """Select optimal model based on complexity, user tier, and cost"""
        
        # Check user's current usage
        user_usage = self._get_user_usage(user_tier)
        
        # Simple queries -> Local models first
        if query_complexity == "simple":
            if agent_type in ["layout", "qc_analysis", "personalization"]:
                return MODEL_CONFIGS["llama3_8b"]  # Free local
            else:
                return MODEL_CONFIGS["gpt_3_5_turbo"]  # Cheap cloud
        
        # Complex queries -> Based on user tier
        elif query_complexity == "complex":
            if user_tier == "free_user":
                return MODEL_CONFIGS["gpt_3_5_turbo"]  # Cheapest cloud option
            elif user_tier == "paid_user":
                if agent_type == "document_analysis":
                    return MODEL_CONFIGS["claude_3_haiku"]  # Better for documents
                else:
                    return MODEL_CONFIGS["gpt_4_turbo"]    # Best performance
            else:  # enterprise
                return MODEL_CONFIGS["gpt_4_turbo"]    # No restrictions
        
        # Default fallback
        return MODEL_CONFIGS["gpt_3_5_turbo"]
    
    def _get_user_usage(self, user_tier: str) -> float:
        """Get current usage for user tier"""
        try:
            if self.redis:
                usage = self.redis.get(f"usage:{user_tier}")
                return float(usage) if usage else 0.0
            # Redis not available - return 0 (no usage tracking)
            return 0.0
        except:
            return 0.0
    
    def track_usage(self, user_tier: str, cost: float):
        """Track usage for cost optimization"""
        try:
            if self.redis:
                current_usage = self._get_user_usage(user_tier)
                new_usage = current_usage + cost
                self.redis.set(f"usage:{user_tier}", new_usage)
                self.usage_tracking[user_tier] = new_usage
            # Redis not available - silently skip usage tracking
        except Exception as e:
            logger.error(f"Failed to track usage: {e}")

# === TOOL INTEGRATIONS ===
class LayoutOptimizerTool(BaseTool):
    """Tool that connects to your existing geometry.py"""
    name: str = "layout_optimizer"
    description: str = "Optimizes panel layouts using existing geometry calculations"
    
    def _run(self, panels: str, constraints: str) -> str:
        """Run layout optimization using existing backend"""
        try:
            # This would connect to your existing panel_layout/geometry.py
            # For now, return a structured response
            return json.dumps({
                "optimized_layout": "Layout optimization completed",
                "panels_processed": len(json.loads(panels)) if panels else 0,
                "constraints_applied": constraints,
                "status": "success"
            })
        except Exception as e:
            return f"Layout optimization failed: {str(e)}"
    
    async def _arun(self, panels: str, constraints: str) -> str:
        """Async version of layout optimization"""
        return self._run(panels, constraints)

class DocumentProcessorTool(BaseTool):
    """Tool that connects to your existing document_processor.py"""
    name: str = "document_processor"
    description: str = "Processes documents using existing OCR and analysis"
    
    def _run(self, document_path: str, analysis_type: str) -> str:
        """Process documents using existing backend"""
        try:
            # This would connect to your existing document_processor.py
            # For now, return a structured response
            return json.dumps({
                "document_processed": document_path,
                "analysis_type": analysis_type,
                "status": "success",
                "extracted_text": "Sample extracted text from document"
            })
        except Exception as e:
            return f"Document processing failed: {str(e)}"
    
    async def _arun(self, document_path: str, analysis_type: str) -> str:
        """Async version of document processing"""
        return self._run(document_path, analysis_type)

class PanelManipulationInput(BaseModel):
    """Validated inputs for panel manipulation operations."""

    action: Literal["get_panels", "move_panel", "batch_move", "reorder_panels_numerically"] = Field(
        ...,
        description="Panel manipulation action to perform.",
    )
    project_id: Optional[str] = Field(
        default=None,
        description="Target project identifier. Falls back to tool context when omitted.",
    )
    panel_id: Optional[str] = Field(
        default=None,
        description="Panel identifier required for single-panel operations.",
    )
    position: Optional[Dict[str, Any]] = Field(
        default=None,
        description="New position object (expects numeric x/y and optional rotation).",
    )
    moves: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="List of move operations for batch updates. Each item should include panelId and newPosition.",
    )
    include_layout: bool = Field(
        default=False,
        description="When true, include the refreshed layout in the response.",
    )


class PanelManipulationTool(BaseTool):
    """Execute panel layout operations through the backend API."""

    name: str = "panel_manipulation"
    description: str = (
        "Execute panel layout operations via API. Use this tool ONLY for operations such as moving, "
        "reordering, or batch operations. Supported actions: 'get_panels', 'move_panel', 'batch_move', "
        "'reorder_panels_numerically'. "
        "⚠️ IMPORTANT: DO NOT use this tool for visual layout questions or questions about panel order/arrangement. "
        "For visual questions, use browser automation tools (browser_navigate, browser_extract, browser_screenshot) instead."
    )
    args_schema: type = PanelManipulationInput
    base_url: str = Field(
        default="http://localhost:8003",
        description="Base URL for the backend service handling panel layout operations.",
    )
    default_headers: Dict[str, str] = Field(
        default_factory=dict,
        description="Default HTTP headers applied to every panel manipulation request.",
    )
    project_id: Optional[str] = Field(
        default=None,
        description="Default project identifier applied when a request omits the project_id argument.",
    )
    auth_token: Optional[str] = Field(
        default=None,
        description="Bearer token used when authenticating requests to the panel manipulation API.",
    )
    _session: requests.Session = PrivateAttr()
    _timeout: int = PrivateAttr(default=15)

    # Define these as fields (following the pattern from browser tools)
    base_url: Any = None
    default_headers: Any = None
    project_id: Any = None
    auth_token: Any = None
    session: Any = None
    timeout: Any = None

    def __init__(
        self,
        base_url: Optional[str] = None,
        default_headers: Optional[Dict[str, str]] = None,
        project_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        caller_session: Optional[Dict[str, Any]] = None,
        browser_base_url: Optional[str] = None,
    ):

        super().__init__()
        resolved_base_url = base_url or "http://localhost:8003"
        self.base_url = resolved_base_url.rstrip("/")
        browser_service_url = (
            browser_base_url
            or os.getenv("BROWSER_SERVICE_URL")
            or resolved_base_url
        )
        self.browser_base_url = browser_service_url.rstrip("/")
        self.default_headers = dict(default_headers or {})
        if "x-dev-bypass" not in self.default_headers and os.getenv("DISABLE_DEV_BYPASS") != "1":
            self.default_headers["x-dev-bypass"] = "true"
        self.project_id = project_id
        self.auth_token = auth_token
        self.session = requests.Session()
        self.timeout = 15
        self.caller_session: Dict[str, Any] = dict(caller_session or {})

        init_data: Dict[str, Any] = {}
        if base_url is not None:
            init_data["base_url"] = base_url
        if default_headers is not None:
            init_data["default_headers"] = default_headers
        if project_id is not None:
            init_data["project_id"] = project_id
        if auth_token is not None:
            init_data["auth_token"] = auth_token

        super().__init__(**init_data)

        # Normalize runtime attributes now that Pydantic validation has completed.
        self.base_url = (self.base_url or "http://localhost:8003").rstrip("/")

        headers = dict(self.default_headers)
        if "x-dev-bypass" not in headers and os.getenv("DISABLE_DEV_BYPASS") != "1":
            headers["x-dev-bypass"] = "true"
        self.default_headers = headers

        self._session = requests.Session()
        self._timeout = 15

    @property
    def session(self) -> requests.Session:
        """HTTP session used for issuing panel API requests."""

        return self._session

    @property
    def timeout(self) -> int:
        """Default timeout (seconds) applied to API requests."""

        return self._timeout


    def with_context(
        self,
        project_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        extra_headers: Optional[Dict[str, str]] = None,
        caller_session: Optional[Dict[str, Any]] = None,
        base_url: Optional[str] = None,
        browser_base_url: Optional[str] = None,
    ) -> "PanelManipulationTool":
        """Return a copy of the tool bound to a specific project/auth context."""

        headers = dict(self.default_headers)
        if extra_headers:
            headers.update(extra_headers)

        session_payload = dict(self.caller_session)
        if caller_session:
            session_payload.update(caller_session)

        return PanelManipulationTool(
            base_url=base_url or self.base_url,
            default_headers=headers,
            project_id=project_id or self.project_id,
            auth_token=auth_token or self.auth_token,
            caller_session=session_payload,
            browser_base_url=browser_base_url or self.browser_base_url,
        )

    def _run(self, **kwargs: Any) -> str:
        try:
            input_data = self.args_schema(**kwargs)
        except ValidationError as exc:
            raise ValueError(f"Invalid panel manipulation arguments: {exc}") from exc

        result = self._execute(input_data)
        return json.dumps(result, default=str)

    async def _arun(self, **kwargs: Any) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self._run(**kwargs))

    # --- Internal helpers -------------------------------------------------
    def _execute(self, data: PanelManipulationInput) -> Dict[str, Any]:
        action = data.action

        if action == "get_panels":
            project_id = self._require_project_id(data.project_id)
            layout = self._get_layout(project_id)
            return {"action": action, "projectId": project_id, "layout": layout}

        if action == "move_panel":
            return self._move_panel(data)

        if action == "batch_move":
            return self._batch_move(data)

        if action == "reorder_panels_numerically":
            project_id = self._require_project_id(data.project_id)
            summary = self._reorder_panels(project_id, include_layout=data.include_layout)
            return {"action": action, **summary}

        raise ValueError(f"Unsupported panel manipulation action: {action}")

    def _move_panel(self, data: PanelManipulationInput) -> Dict[str, Any]:
        project_id = self._require_project_id(data.project_id)
        if not data.panel_id:
            raise ValueError("panel_id is required for move_panel operations.")
        position = self._validate_position(data.position)

        payload = {
            "projectId": project_id,
            "panelId": data.panel_id,
            "newPosition": position,
        }

        response = self._request(
            method="POST",
            path="/api/panel-layout/move-panel",
            json_payload=payload,
        )

        logger.info(
            "✅ [PanelManipulationTool] Moved panel %s to (%.2f, %.2f)",
            data.panel_id,
            position["x"],
            position["y"],
        )

        result = {
            "action": "move_panel",
            "projectId": project_id,
            "panelId": data.panel_id,
            "position": position,
            "response": response,
        }

        if data.include_layout:
            result["layout"] = self._get_layout(project_id)

        return result

    def _batch_move(self, data: PanelManipulationInput) -> Dict[str, Any]:
        project_id = self._require_project_id(data.project_id)
        if not data.moves or not isinstance(data.moves, list):
            raise ValueError("moves must be a non-empty list for batch_move operations.")

        operations = []
        for move in data.moves:
            panel_id = move.get("panelId") or move.get("panel_id")
            new_position = self._validate_position(move.get("newPosition") or move.get("new_position"))

            if not panel_id:
                raise ValueError("Each move must include a 'panelId'.")

            operations.append(
                {
                    "type": "MOVE_PANEL",
                    "payload": {
                        "panelId": panel_id,
                        "newPosition": new_position,
                    },
                }
            )

        payload = {
            "projectId": project_id,
            "operations": operations,
        }

        response = self._request(
            method="POST",
            path="/api/panel-layout/batch-operations",
            json_payload=payload,
        )

        result = {
            "action": "batch_move",
            "projectId": project_id,
            "operations": operations,
            "response": response,
        }

        if data.include_layout:
            result["layout"] = self._get_layout(project_id)

        return result

    def _reorder_panels(self, project_id: str, include_layout: bool = False) -> Dict[str, Any]:
        logger.info(f"[PanelManipulationTool] Starting reorder_panels_numerically for project_id: {project_id}")
        layout_data = self._get_layout(project_id)
        panels = layout_data.get("panels") or []

        if not panels:
            logger.warning(f"[PanelManipulationTool] No panels found for project_id: {project_id}")
            return {"projectId": project_id, "message": "No panels found to reorder.", "moves_executed": []}
        
        logger.info(f"[PanelManipulationTool] Found {len(panels)} panels to reorder")

        sorted_panels = sorted(panels, key=self._panel_sort_key)
        spacing_x = 450
        spacing_y = 350
        base_x = 200
        base_y = 200
        columns = 5

        operations = []
        for index, panel in enumerate(sorted_panels):
            panel_id = panel.get("id")
            if not panel_id:
                logger.warning("Skipping panel without ID during reorder: %s", panel)
                continue

            column = index % columns
            row = index // columns
            target_x = base_x + (column * spacing_x)
            target_y = base_y + (row * spacing_y)

            operations.append(
                {
                    "type": "MOVE_PANEL",
                    "payload": {
                        "panelId": panel_id,
                        "newPosition": {
                            "x": float(target_x),
                            "y": float(target_y),
                            "rotation": float(panel.get("rotation", 0) or 0),
                        },
                    },
                }
            )

        if not operations:
            return {"projectId": project_id, "message": "No valid panels found for reordering.", "moves_executed": []}

        payload = {
            "projectId": project_id,
            "operations": operations,
        }

        logger.info(f"[PanelManipulationTool] Executing batch_move with {len(operations)} operations")
        response = self._request(
            method="POST",
            path="/api/panel-layout/batch-operations",
            json_payload=payload,
        )

        logger.info(f"[PanelManipulationTool] Batch move response: {response}")
        logger.info(
            "🚚 [PanelManipulationTool] Completed batch move with %d operations",
            len(operations),
        )

        summary = {
            "projectId": project_id,
            "moves_executed": len(operations),
            "operations": operations,
            "response": response,
            "message": f"Successfully reordered {len(operations)} panels numerically",
        }

        if include_layout:
            summary["layout"] = self._get_layout(project_id)

        logger.info(
            "🔢 [PanelManipulationTool] Reordered %d panels for project %s",
            len(operations),
            project_id,
        )
        return summary

    def _panel_sort_key(self, panel: Dict[str, Any]) -> Tuple[int, str]:
        raw_number = panel.get("panelNumber") or panel.get("panel_number") or panel.get("id") or ""
        digits = "".join(ch for ch in str(raw_number) if ch.isdigit())
        try:
            numeric = int(digits) if digits else float("inf")
        except ValueError:
            numeric = float("inf")
        return numeric, str(raw_number)

    def _request(
        self,
        method: str,
        path: str,
        json_payload: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        base_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        url_base = (base_url or self.base_url).rstrip("/")
        url = f"{url_base}{path}"
        combined_headers = dict(self.default_headers)

        if headers:
            combined_headers.update(headers)

        if self.auth_token:
            combined_headers.setdefault("Authorization", f"Bearer {self.auth_token}")

        logger.info(
            f"[PanelManipulationTool] {method} {url} (headers: {list(combined_headers.keys())})"
        )
        if json_payload:
            logger.debug(
                f"[PanelManipulationTool] Payload keys: {list(json_payload.keys())}"
            )

        try:
            response = self.session.request(
                method=method.upper(),
                url=url,
                json=json_payload,
                params=params,
                headers=combined_headers,
                timeout=self.timeout,
            )
            logger.info(f"[PanelManipulationTool] Response status: {response.status_code}")
        except requests.RequestException as exc:
            logger.error(f"[PanelManipulationTool] Request exception: {exc}")
            raise ValueError(f"Panel manipulation request failed: {exc}") from exc

        if response.status_code == 401:
            logger.error(f"[PanelManipulationTool] Unauthorized (401) for {url}")
            raise ValueError(
                "Panel manipulation request was unauthorized. Verify authentication headers."
            )

        if not response.ok:
            try:
                error_payload = response.json()
            except ValueError:
                error_payload = response.text
            logger.error(
                f"[PanelManipulationTool] Request failed ({response.status_code}): {error_payload}"
            )
            raise ValueError(
                f"Panel manipulation request failed ({response.status_code}): {error_payload}"
            )

        try:
            result = response.json()
            logger.debug(f"[PanelManipulationTool] Response keys: {list(result.keys()) if isinstance(result, dict) else 'not a dict'}")
            logger.info("📬 [PanelManipulationTool] %s %s succeeded", method.upper(), path)
            return result
        except ValueError as exc:
            logger.error(
                f"[PanelManipulationTool] JSON parse error: {exc}, response text: {response.text[:200]}"
            )
            raise ValueError(
                f"Panel manipulation response could not be parsed: {exc}"
            ) from exc

    def _browser_request(
        self,
        method: str,
        path: str,
        json_payload: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        return self._request(
            method=method,
            path=path,
            json_payload=json_payload,
            params=params,
            headers=headers,
            base_url=self.browser_base_url,
        )

    def _compact_dict(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {k: v for k, v in payload.items() if v not in (None, "", [], {})}

    def _resolve_panel_layout_url(self, project_id: str) -> str:
        session_data = self.caller_session or {}
        for key in ("panel_layout_url", "panelLayoutUrl", "panelLayoutURL"):
            value = session_data.get(key)
            if value:
                return str(value)

        frontend_base = (
            session_data.get("frontend_url")
            or session_data.get("frontendUrl")
            or os.getenv("FRONTEND_URL", "http://localhost:3000")
        )
        frontend_base = str(frontend_base).rstrip("/")
        return f"{frontend_base}/dashboard/projects/{project_id}/panel-layout"

    def _build_browser_payload(
        self,
        base: Dict[str, Any],
        *,
        project_id: Optional[str] = None,
        tab_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = dict(base)
        session_data = dict(self.caller_session or {})

        if project_id:
            payload.setdefault("projectId", project_id)
            session_data.setdefault("projectId", project_id)

        if tab_id:
            payload.setdefault("tabId", tab_id)

        if session_data:
            payload.setdefault("session", session_data)

            key_mappings = {
                "sessionId": ["sessionId", "session_id"],
                "browserSessionId": ["browserSessionId", "browser_session_id"],
                "workspaceId": ["workspaceId", "workspace_id"],
                "workspaceSlug": ["workspaceSlug", "workspace_slug"],
                "workspaceKey": ["workspaceKey", "workspace_key"],
                "userId": ["userId", "user_id"],
                "tabId": ["tabId", "tab_id"],
                "callerSessionId": ["callerSessionId", "caller_session_id"],
                "panelLayoutUrl": ["panelLayoutUrl", "panel_layout_url"],
                "frontendUrl": ["frontendUrl", "frontend_url"],
                "baseUrl": ["baseUrl", "base_url"],
                "browserBaseUrl": ["browserBaseUrl", "browser_base_url"],
                "environment": ["environment", "env"],
            }

            for canonical, options in key_mappings.items():
                for option in options:
                    if option in session_data and session_data[option] is not None:
                        payload.setdefault(canonical, session_data[option])
                        break

        return self._compact_dict(payload)

    def navigate_panel_layout(
        self,
        project_id: Optional[str] = None,
        *,
        wait_for_selector: Optional[str] = None,
        tab_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        target_project = self._require_project_id(project_id)
        url = self._resolve_panel_layout_url(target_project)

        payload = self._build_browser_payload(
            {
                "action": "navigate",
                "url": url,
                "waitFor": wait_for_selector,
            },
            project_id=target_project,
            tab_id=tab_id,
        )

        logger.info(
            "[PanelManipulationTool] Navigating browser session to panel layout URL: %s",
            url,
        )
        return self._browser_request(
            method="POST",
            path="/browser/navigate",
            json_payload=payload,
        )

    def take_panel_screenshot(
        self,
        *,
        selector: Optional[str] = None,
        full_page: bool = True,
        tab_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = self._build_browser_payload(
            {
                "selector": selector,
                "fullPage": full_page,
            },
            tab_id=tab_id,
        )

        logger.info(
            "[PanelManipulationTool] Requesting browser screenshot (selector=%s, full_page=%s)",
            selector,
            full_page,
        )
        return self._browser_request(
            method="POST",
            path="/browser/screenshot",
            json_payload=payload,
        )

    def extract_panel_list(
        self,
        *,
        selector: Optional[str] = None,
        tab_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = self._build_browser_payload(
            {
                "action": "panels",
                "selector": selector,
            },
            tab_id=tab_id,
        )

        logger.info(
            "[PanelManipulationTool] Requesting panel list extraction (selector=%s)",
            selector,
        )
        return self._browser_request(
            method="POST",
            path="/browser/extract",
            json_payload=payload,
        )

    def _get_layout(self, project_id: str) -> Dict[str, Any]:
        try:
            logger.info(f"[PanelManipulationTool] Fetching layout for project_id: {project_id}")
            response = self._request(
                method="GET",
                path=f"/api/panel-layout/get-layout/{project_id}",
            )
            logger.info(f"[PanelManipulationTool] Layout response received: {list(response.keys())}")
            
            layout = response.get("layout")
            if layout is None:
                logger.warning("Layout response missing 'layout' key. Raw response: %s", response)
                # Try to use response directly if it has panels
                if "panels" in response:
                    logger.info("Using response directly as layout")
                    return response
                return {}
            
            logger.info(f"[PanelManipulationTool] Layout retrieved: {len(layout.get('panels', []))} panels")
            logger.info("🧾 [PanelManipulationTool] Layout fetch succeeded for project %s", project_id)
            return layout
        except Exception as e:
            logger.error(f"[PanelManipulationTool] Error getting layout: {e}")
            raise

    def _require_project_id(self, project_id: Optional[str]) -> str:
        resolved = project_id or self.project_id
        if not resolved:
            raise ValueError("A project_id must be provided either in the tool arguments or context.")
        return resolved

    def _validate_position(self, position: Optional[Dict[str, Any]]) -> Dict[str, float]:
        if not position or not isinstance(position, dict):
            raise ValueError("position must be an object containing numeric x and y values.")

        try:
            x = float(position["x"])
            y = float(position["y"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("position must include numeric 'x' and 'y' values.") from exc

        validated = {"x": x, "y": y}

        if "rotation" in position and position["rotation"] is not None:
            try:
                validated["rotation"] = float(position["rotation"])
            except (TypeError, ValueError) as exc:
                raise ValueError("rotation must be numeric when provided.") from exc

        return validated

class QCDataTool(BaseTool):
    """Tool that connects to your existing QC data analysis"""
    name: str = "qc_data_analyzer"
    description: str = "Analyzes QC data and identifies anomalies"
    
    def _run(self, qc_data: str, analysis_type: str = "outliers") -> str:
        """Analyze QC data using existing backend"""
        try:
            # This would connect to your existing QC analysis
            # For now, return a structured response
            return json.dumps({
                "qc_data_analyzed": len(json.loads(qc_data)) if qc_data else 0,
                "analysis_type": analysis_type,
                "anomalies_found": 2,  # Mock data
                "quality_score": 0.85,
                "recommendations": ["Review outlier values", "Check measurement procedures"],
                "status": "success"
            })
        except Exception as e:
            return f"QC data analysis failed: {str(e)}"
    
    async def _arun(self, qc_data: str, analysis_type: str) -> str:
        """Async version of QC data analysis"""
        return self._run(qc_data, analysis_type)

# === AGENT FACTORY ===
class HybridAgentFactory:
    """Creates AI agents with appropriate models based on user tier and task complexity"""
    
    def __init__(self, cost_optimizer: CostOptimizer, tool_resources: Optional[Dict[str, Any]] = None):
        self.cost_optimizer = cost_optimizer
        self.tool_resources = tool_resources or {}
    
    def create_layout_optimizer_agent(self, user_tier: str = "paid_user") -> Agent:
        """Create agent for panel layout optimization"""
        model_config = self.cost_optimizer.select_model("complex", user_tier, "layout")
        llm = self._create_llm(model_config)
        
        return Agent(
            role="Panel Layout Optimization Specialist",
            goal="Optimize panel layouts for maximum efficiency and cost-effectiveness",
            backstory="Expert in geosynthetic panel layout optimization with deep knowledge of material efficiency and installation workflows",
            verbose=True,
            allow_delegation=False,
            tools=[LayoutOptimizerTool()],
            llm=llm
        )
    
    def create_document_intelligence_agent(self, user_tier: str = "paid_user") -> Agent:
        """Create agent for document analysis and intelligence"""
        model_config = self.cost_optimizer.select_model("complex", user_tier, "document_analysis")
        llm = self._create_llm(model_config)
        
        return Agent(
            role="Document Intelligence Analyst",
            goal="Extract insights and structured data from project documents",
            backstory="Specialist in document analysis, OCR processing, and information extraction from technical documents",
            verbose=True,
            allow_delegation=False,
            tools=[DocumentProcessorTool()],
            llm=llm
        )
    
    def create_assistant_agent(
        self,
        user_tier: str = "paid_user",
        tool_context: Optional[Dict[str, Any]] = None,
    ) -> Agent:
        """Create general assistant agent"""
        logger.info(f"[AgentFactory] Creating assistant agent - user_tier: {user_tier}, tool_context: {tool_context}")
        model_config = self.cost_optimizer.select_model("simple", user_tier, "assistant")
        logger.info(f"[AgentFactory] Selected model: {model_config.name} (tier: {model_config.tier})")
        llm = self._create_llm(model_config)

        tools_list: List[BaseTool] = []

        # Add browser tools FIRST so they have priority for visual questions
        browser_tool_count = 0
        for factory in self.tool_resources.get("browser_tool_factories", []):
            try:
                browser_tool = factory()
                if browser_tool:
                    tools_list.append(browser_tool)
                    browser_tool_count += 1
                    logger.info(f"[AgentFactory] Browser tool added: {browser_tool.name}")
            except Exception as exc:  # pragma: no cover - defensive
                logger.error(f"[AgentFactory] Failed to initialize browser tool: {exc}")

        # Add panel tool AFTER browser tools (lower priority for visual questions)
        panel_tool = self._build_panel_tool(tool_context)
        if panel_tool:
            tools_list.append(panel_tool)
            logger.info(f"[AgentFactory] PanelManipulationTool added - name: {panel_tool.name}, project_id: {panel_tool.project_id}")
        else:
            logger.warning("[AgentFactory] PanelManipulationTool NOT created!")

        logger.info(f"[AgentFactory] Total tools registered: {len(tools_list)} (Panel: {1 if panel_tool else 0}, Browser: {browser_tool_count})")
        if tools_list:
            logger.info(f"[AgentFactory] Tool names: {[tool.name for tool in tools_list]}")
        
        # Validate browser tools if visual question might be asked
        if browser_tool_count == 0 and BROWSER_TOOLS_AVAILABLE:
            logger.warning("[AgentFactory] No browser tools registered despite BROWSER_TOOLS_AVAILABLE=True")
            logger.warning(f"[AgentFactory] Browser sessions: {self.tool_resources.get('browser_session_manager')}")
            logger.warning(f"[AgentFactory] Browser tool factories: {len(self.tool_resources.get('browser_tool_factories', []))}")

        return Agent(
            role="AI Assistant",
            goal="Execute user actions using available tools. When users ask about visual panel layouts, use browser automation to check the actual frontend page. When users request panel operations (move, arrange, reorder panels), use PanelManipulationTool to perform the actions directly. Always check visual layouts before answering layout-related questions.",
            backstory="""You are an AI assistant that takes action and checks visual information. 
            IMPORTANT: When users ask about panel layouts, arrangements, or visual positioning, you MUST:
            1. Navigate to the panel layout page using browser_navigate
            2. Take a screenshot using browser_screenshot to see the actual visual layout
            3. Extract visual data using browser_extract to understand panel positions
            4. Answer based on what you SEE, not just backend JSON data
            
            When users ask you to arrange, move, or reorder panels, you MUST execute the operations 
            using the PanelManipulationTool with actions like 'reorder_panels_numerically', 'batch_move', 
            or 'move_panel'. You can also use browser automation tools when UI interactions are needed. 
            Always execute actions and check visual information instead of just describing them.""",
            verbose=True,
            allow_delegation=False,
            tools=tools_list,
            llm=llm
        )
    
    def create_project_config_agent(self, user_tier: str = "paid_user") -> Agent:
        """Create agent for project configuration and setup"""
        model_config = self.cost_optimizer.select_model("complex", user_tier, "project_config")
        llm = self._create_llm(model_config)
        panel_tool = self._build_panel_tool()
        return Agent(
            role="Project Configuration Specialist",
            goal="Configure and optimize project settings for maximum efficiency",
            backstory="Expert in project setup, configuration optimization, and workflow design",
            verbose=True,
            allow_delegation=False,
            tools=[panel_tool] if panel_tool else [],
            llm=llm
        )
    
    def create_qc_analysis_agent(self, user_tier: str = "paid_user") -> Agent:
        """Create agent for QC data analysis"""
        model_config = self.cost_optimizer.select_model("complex", user_tier, "qc_analysis")
        llm = self._create_llm(model_config)
        
        return Agent(
            role="Quality Control Data Analyst",
            goal="Analyze QC data to identify patterns, anomalies, and quality issues",
            backstory="Specialist in quality control data analysis, statistical analysis, and quality assurance",
            verbose=True,
            allow_delegation=False,
            tools=[QCDataTool()],
            llm=llm
        )
    
    def create_personalization_agent(self, user_tier: str = "paid_user") -> Agent:
        """Create agent for user personalization and preferences"""
        model_config = self.cost_optimizer.select_model("simple", user_tier, "personalization")
        llm = self._create_llm(model_config)
        
        return Agent(
            role="User Personalization Specialist",
            goal="Personalize user experience based on preferences and usage patterns",
            backstory="Expert in user experience optimization and personalization strategies",
            verbose=True,
            allow_delegation=False,
            tools=[],
            llm=llm
        )
    
    def _create_llm(self, model_config: ModelConfig):
        """Create LLM instance based on model configuration"""
        logger.info(f"[_create_llm] Creating LLM - model: {model_config.name}, tier: {model_config.tier}")
        logger.info(f"[_create_llm] API key env: {model_config.api_key_env}, Has key: {bool(model_config.api_key_env and os.getenv(model_config.api_key_env))}")
        logger.info(f"[_create_llm] OpenAI class available: {OpenAI is not None}")
        
        if model_config.tier == ModelTier.LOCAL:
            llm = self._create_ollama_llm(model_config.name)
            logger.info(f"[_create_llm] Using local Ollama LLM: {model_config.name}")
            return llm
        elif model_config.api_key_env and os.getenv(model_config.api_key_env):
            api_key = os.getenv(model_config.api_key_env)
            logger.info(f"[_create_llm] API key found (length: {len(api_key) if api_key else 0})")
            
            if "gpt" in model_config.name:
                # Use ChatOpenAI for better tool support if available, fallback to OpenAI
                try:
                    # Try multiple import paths for compatibility
                    try:
                        from langchain_openai import ChatOpenAI  # type: ignore
                        logger.info("[_create_llm] Imported ChatOpenAI from langchain_openai")
                    except ImportError:
                        from langchain.chat_models import ChatOpenAI  # type: ignore
                        logger.info("[_create_llm] Imported ChatOpenAI from langchain.chat_models")
                    
                    llm = ChatOpenAI(
                        openai_api_key=api_key,
                        model=model_config.name,
                        temperature=0
                    )
                    logger.info(f"[_create_llm] Using ChatOpenAI: {model_config.name} (better tool support)")
                    return llm
                except (ImportError, Exception) as e:
                    logger.warning(f"[_create_llm] ChatOpenAI not available ({e}), falling back to OpenAI")
                    logger.info(f"[_create_llm] OpenAI class type: {type(OpenAI)}, is None: {OpenAI is None}")
                    if OpenAI is None:
                        error_msg = "OpenAI LLM not available - please install langchain-community or langchain-openai"
                        logger.error(f"[_create_llm] {error_msg}")
                        raise ImportError(error_msg)
                    try:
                        llm = OpenAI(api_key=api_key, model_name=model_config.name)
                        logger.info(f"[_create_llm] Using OpenAI (legacy): {model_config.name}")
                        return llm
                    except Exception as llm_error:
                        logger.error(f"[_create_llm] Failed to create OpenAI LLM: {llm_error}", exc_info=True)
                        raise
            elif "claude" in model_config.name:
                # Implement Claude integration
                logger.warning(f"[_create_llm] Claude not fully implemented, using GPT fallback")
                if OpenAI is None:
                    raise ImportError("OpenAI LLM not available - please install langchain-community or langchain-openai")
                return OpenAI(api_key=api_key, model_name="gpt-3.5-turbo")
        else:
            # If no API key and not local, we can't create the LLM
            if model_config.tier != ModelTier.LOCAL:
                error_msg = f"No API key found for {model_config.name} (env: {model_config.api_key_env})"
                logger.error(f"[_create_llm] {error_msg}")
                raise ValueError(error_msg)
            logger.warning(f"[_create_llm] No API key found for {model_config.name}, using mock LLM")
            return self._create_mock_llm()
    
    def _create_ollama_llm(self, model_name: str):
        """Create Ollama LLM for local models"""
        try:
            # Test if Ollama is available
            ollama.list()
            
            class OllamaLLM:
                def __init__(self, model_name):
                    self.model_name = model_name
                
                def __call__(self, prompt: str) -> str:
                    try:
                        response = ollama.chat(model=self.model_name, messages=[{"role": "user", "content": prompt}])
                        return response['message']['content']
                    except Exception as e:
                        logger.error(f"Ollama error: {e}")
                        return f"Local model error: {str(e)}"
            
            return OllamaLLM(model_name)
        except Exception as e:
            logger.warning(f"Ollama not available: {e}")
            return self._create_mock_llm()
    
    def _create_mock_llm(self):
        """Create mock LLM for fallback"""
        class MockLLM:
            def __call__(self, prompt: str) -> str:
                return f"Mock response to: {prompt[:100]}..."
        
        return MockLLM()

    def _build_panel_tool(self, tool_context: Optional[Dict[str, Any]] = None) -> Optional[PanelManipulationTool]:
        context = tool_context or {}

        base_url = (
            context.get("base_url")
            or context.get("baseUrl")
            or self.tool_resources.get("backend_base_url")
            or "http://localhost:8003"
        )
        browser_base_url = context.get("browser_base_url") or context.get("browserBaseUrl")

        default_headers = dict(self.tool_resources.get("default_headers", {}))
        extra_headers = context.get("headers") or context.get("authHeaders")
        if isinstance(extra_headers, dict):
            default_headers.update(extra_headers)

        session_data = context.get("session") if isinstance(context.get("session"), dict) else None

        logger.info(f"[_build_panel_tool] Creating tool with base_url: {base_url}")
        logger.debug(f"[_build_panel_tool] Tool context keys: {list(context.keys()) if context else []}")

        tool = PanelManipulationTool(
            base_url=base_url,
            browser_base_url=browser_base_url,
            default_headers=default_headers,
            project_id=context.get("project_id") or context.get("projectId"),
            auth_token=context.get("auth_token") or context.get("authToken"),
            caller_session=session_data,
        )

        logger.info(
            f"[_build_panel_tool] Tool created - project_id: {tool.project_id}, browser_base_url: {tool.browser_base_url}"
        )
        return tool

# === WORKFLOW ORCHESTRATOR ===
class HybridWorkflowOrchestrator:
    """Orchestrates complex AI workflows using multiple agents"""
    
    def __init__(
        self,
        redis_client,
        user_tier: str = "paid_user",
        tool_resources: Optional[Dict[str, Any]] = None,
    ):
        self.redis = redis_client
        self.user_tier = user_tier
        self.cost_optimizer = CostOptimizer(redis_client)
        self.tool_resources = tool_resources or {}
        self.agent_factory = HybridAgentFactory(self.cost_optimizer, self.tool_resources)
    
    async def execute_new_project_workflow(self, project_data: Dict) -> Dict:
        """Execute complete workflow for new project setup"""
        try:
            # Create agents
            config_agent = self.agent_factory.create_project_config_agent(self.user_tier)
            doc_agent = self.agent_factory.create_document_intelligence_agent(self.user_tier)
            layout_agent = self.agent_factory.create_layout_optimizer_agent(self.user_tier)
            
            # Define tasks
            config_task = Task(
                description="Configure project settings and optimize workflow",
                agent=config_agent,
                expected_output="Project configuration optimized for efficiency"
            )
            
            doc_task = Task(
                description="Analyze project documents and extract key information",
                agent=doc_agent,
                expected_output="Structured project information and requirements"
            )
            
            layout_task = Task(
                description="Generate initial panel layout based on project requirements",
                agent=layout_agent,
                expected_output="Optimized panel layout configuration"
            )
            
            # Create crew and execute
            crew = Crew(
                agents=[config_agent, doc_agent, layout_agent],
                tasks=[config_task, doc_task, layout_task],
                verbose=True
            )
            
            result = crew.kickoff()
            
            # Track cost
            cost = self._calculate_workflow_cost(crew)
            self.cost_optimizer.track_usage(self.user_tier, cost)
            
            return {
                "success": True,
                "result": result,
                "cost": cost,
                "workflow": "new_project_setup"
            }
            
        except Exception as e:
            logger.error(f"New project workflow failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def execute_layout_optimization_workflow(self, layout_data: Dict) -> Dict:
        """Execute workflow for panel layout optimization"""
        try:
            # Create agents
            layout_agent = self.agent_factory.create_layout_optimizer_agent(self.user_tier)
            qc_agent = self.agent_factory.create_qc_analysis_agent(self.user_tier)
            
            # Define tasks
            layout_task = Task(
                description="Optimize panel layout for maximum efficiency",
                agent=layout_agent,
                expected_output="Optimized panel layout with efficiency metrics"
            )
            
            qc_task = Task(
                description="Analyze layout for quality and compliance",
                agent=qc_agent,
                expected_output="Quality assessment and compliance verification"
            )
            
            # Create crew and execute
            crew = Crew(
                agents=[layout_agent, qc_agent],
                tasks=[layout_task, qc_task],
                verbose=True
            )
            
            result = crew.kickoff()
            
            # Track cost
            cost = self._calculate_workflow_cost(crew)
            self.cost_optimizer.track_usage(self.user_tier, cost)
            
            return {
                "success": True,
                "result": result,
                "cost": cost,
                "workflow": "layout_optimization"
            }
            
        except Exception as e:
            logger.error(f"Layout optimization workflow failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _calculate_workflow_cost(self, crew) -> float:
        """Calculate estimated cost of workflow execution"""
        # This is a simplified cost calculation
        # In production, you'd track actual token usage
        base_cost = 0.01  # Base cost per workflow
        agent_multiplier = len(crew.agents) * 0.005
        return base_cost + agent_multiplier

# === MAIN SERVICE CLASS ===
class DellSystemAIService:
    """Main service class that provides AI capabilities to the Dell System Manager"""
    
    def __init__(self, redis_host: str = 'localhost', redis_port: int = 6379):
        try:
            self.redis = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
            self.redis.ping()  # Test connection
            logger.info(f"Redis connection successful: {redis_host}:{redis_port}")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            logger.info("Redis is optional - service will continue without caching/cost tracking")
            logger.info("To enable Redis: Install with 'brew install redis' (macOS) or 'apt-get install redis' (Linux), then start with 'redis-server'")
            self.redis = None
        
        self.backend_base_url = self._determine_backend_base_url()
        self.browser_security: Optional[BrowserSecurityConfig] = None
        self.browser_sessions: Optional[BrowserSessionManager] = None
        self._setup_browser_tools()
        self.tool_resources = self._build_tool_resources()
        self._attachments_dir = Path(__file__).resolve().parents[1] / "attached_assets"
        self._attachments_dir.mkdir(parents=True, exist_ok=True)

    def get_orchestrator(self, user_id: str, user_tier: str) -> HybridWorkflowOrchestrator:
        """Get workflow orchestrator for specific user"""
        return HybridWorkflowOrchestrator(self.redis, user_tier, self.tool_resources)

    def _ensure_browser_automation(self) -> None:
        if not BROWSER_TOOLS_AVAILABLE or not self.browser_sessions:
            raise BrowserAutomationUnavailableError(
                "Browser automation tools are not available in this environment."
            )

    async def navigate_panel_layout(
        self,
        session_id: str,
        user_id: str,
        url: str,
        wait_for: str = "canvas",
    ) -> Dict[str, Any]:
        self._ensure_browser_automation()
        navigation_tool = BrowserNavigationTool(self.browser_sessions)
        result = await navigation_tool._arun(
            action="navigate",
            url=url,
            wait_for=wait_for,
            session_id=session_id,
            user_id=user_id,
        )
        if isinstance(result, str) and result.lower().startswith("error"):
            raise BrowserAutomationError(result)
        return {
            "status": result,
            "url": url,
            "waitFor": wait_for,
            "sessionId": session_id,
        }

    async def take_panel_screenshot(
        self,
        session_id: str,
        user_id: str,
        project_id: Optional[str] = None,
        full_page: bool = True,
    ) -> Dict[str, Any]:
        self._ensure_browser_automation()
        screenshot_tool = BrowserScreenshotTool(self.browser_sessions)
        raw_result = await screenshot_tool._arun(
            session_id=session_id,
            user_id=user_id,
            full_page=full_page,
        )
        if isinstance(raw_result, str) and raw_result.lower().startswith("error"):
            raise BrowserAutomationError(raw_result)

        if isinstance(raw_result, str) and raw_result.startswith("Warning"):
            # Tool returned a warning followed by the encoded data
            parts = raw_result.splitlines()
            encoded = parts[-1] if parts else ""
        else:
            encoded = raw_result if isinstance(raw_result, str) else str(raw_result)

        if not encoded:
            raise BrowserAutomationError("Screenshot capture did not return any data")

        attachment = self._store_base64_attachment(
            encoded,
            filename_prefix=f"panel-layout-{project_id or 'session'}",
        )

        metadata = {
            "sessionId": session_id,
            "userId": user_id,
            "projectId": project_id,
            "fullPage": full_page,
        }

        return {
            "base64": encoded,
            "attachments": [attachment],
            "metadata": metadata,
        }

    async def extract_panel_list(
        self,
        session_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        self._ensure_browser_automation()
        extraction_tool = BrowserExtractionTool(self.browser_sessions)
        result = await extraction_tool._arun(
            action="panels",
            session_id=session_id,
            user_id=user_id,
            output_format="json",
        )

        if isinstance(result, str):
            try:
                parsed = json.loads(result)
            except (TypeError, json.JSONDecodeError) as exc:
                raise BrowserAutomationError(
                    f"Unable to parse panel list from browser extraction: {exc}"
                ) from exc
        else:
            parsed = result

        if not isinstance(parsed, dict) or not parsed.get("success"):
            message = (
                parsed.get("error")
                if isinstance(parsed, dict)
                else "Unknown error extracting panels"
            )
            raise BrowserAutomationError(message or "Unknown error extracting panels")

        panels = parsed.get("panels", [])
        return {
            "panels": panels,
            "totalPanels": parsed.get("totalPanels", len(panels)),
            "source": parsed.get("source", "unknown"),
        }

    async def _get_server_panel_fallback(
        self,
        project_id: Optional[str],
        auth_token: Optional[str],
        extra_headers: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if not project_id:
            return {}

        try:
            panel_tool = PanelManipulationTool(
                base_url=self.backend_base_url,
                default_headers=self._default_tool_headers(),
            ).with_context(
                project_id=project_id,
                auth_token=auth_token,
                extra_headers=extra_headers,
            )

            layout = await asyncio.to_thread(panel_tool.get_layout, project_id)
            if isinstance(layout, dict):
                return layout
            return {}
        except Exception as exc:
            logger.error(
                "[panel_fallback] Failed to retrieve server-side panel data: %s",
                exc,
                exc_info=True,
            )
            return {"error": str(exc)}

    def _store_base64_attachment(
        self, encoded: str, filename_prefix: str = "panel-layout"
    ) -> Dict[str, Any]:
        try:
            binary = base64.b64decode(encoded)
        except Exception as exc:
            raise BrowserAutomationError(f"Failed to decode screenshot data: {exc}") from exc

        filename = f"{filename_prefix}-{uuid.uuid4().hex}.png"
        file_path = self._attachments_dir / filename
        with open(file_path, "wb") as file_handle:
            file_handle.write(binary)

        return {
            "type": "image/png",
            "filename": filename,
            "path": str(file_path.relative_to(self._attachments_dir.parent)),
            "sizeBytes": len(binary),
        }

    async def handle_layout_optimization(self, user_id: str, user_tier: str, layout_data: Dict) -> Dict:
        """Handle panel layout optimization requests"""
        orchestrator = self.get_orchestrator(user_id, user_tier)
        return await orchestrator.execute_layout_optimization_workflow(layout_data)
    
    async def handle_new_project(self, user_id: str, user_tier: str, project_data: Dict) -> Dict:
        """Handle new project setup requests"""
        orchestrator = self.get_orchestrator(user_id, user_tier)
        return await orchestrator.execute_new_project_workflow(project_data)
    
    async def handle_chat_message(self, user_id: str, user_tier: str, message: str, context: Dict) -> Dict:
        """Handle general chat messages"""
        try:
            logger.info(f"[handle_chat_message] Processing message from user_id: {user_id}, user_tier: {user_tier}")
            logger.debug(f"[handle_chat_message] Message: {message[:100]}...")
            context = context or {}
            logger.debug(f"[handle_chat_message] Context keys: {list(context.keys())}")
            
            orchestrator = self.get_orchestrator(user_id, user_tier)
            project_id = context.get("projectId") or context.get("project_id")
            auth_token = context.get("authToken") or context.get("auth_token")
            extra_headers = context.get("headers") or context.get("authHeaders")

            logger.info(f"[handle_chat_message] Extracted - project_id: {project_id}, has_auth_token: {bool(auth_token)}, has_headers: {bool(extra_headers)}")

            backend_base_url = (
                context.get("backendBaseUrl")
                or context.get("backend_base_url")
                or context.get("baseUrl")
                or context.get("base_url")
            )
            browser_base_url = context.get("browserBaseUrl") or context.get("browser_base_url")
            frontend_base_url = (
                context.get("frontendUrl")
                or context.get("frontend_url")
                or os.getenv("FRONTEND_URL", "http://localhost:3000")
            )

            tool_context: Dict[str, Any] = {}
            if project_id:
                tool_context["project_id"] = project_id
            if auth_token:
                tool_context["auth_token"] = auth_token
            if isinstance(extra_headers, dict):
                tool_context["headers"] = extra_headers
            if backend_base_url:
                tool_context["base_url"] = backend_base_url
            if browser_base_url:
                tool_context["browser_base_url"] = browser_base_url

            # Aggregate session and workspace identifiers for downstream tools
            session_data: Dict[str, Any] = {}

            if isinstance(context.get("session"), dict):
                session_data.update(context["session"])

            def _harvest_session(source: Optional[Dict[str, Any]]) -> None:
                if not isinstance(source, dict):
                    return
                allowed_keys = {
                    "sessionId",
                    "session_id",
                    "browserSessionId",
                    "browser_session_id",
                    "workspaceId",
                    "workspace_id",
                    "workspaceSlug",
                    "workspace_slug",
                    "workspaceKey",
                    "workspace_key",
                    "userId",
                    "user_id",
                    "tabId",
                    "tab_id",
                    "callerSessionId",
                    "caller_session_id",
                    "callerId",
                    "caller_id",
                    "panelLayoutUrl",
                    "panel_layout_url",
                    "panelLayoutPath",
                    "panel_layout_path",
                    "frontendUrl",
                    "frontend_url",
                    "baseUrl",
                    "base_url",
                    "browserBaseUrl",
                    "browser_base_url",
                    "environment",
                    "env",
                    "sessionToken",
                    "session_token",
                    "projectId",
                    "project_id",
                }
                for key, value in source.items():
                    if value is None:
                        continue
                    if key in allowed_keys and key not in session_data:
                        session_data[key] = value

            _harvest_session(context)
            _harvest_session(context.get("browser"))
            _harvest_session(context.get("workspace"))
            _harvest_session(context.get("caller"))
            _harvest_session(context.get("automation"))

            if user_id and "userId" not in session_data and "user_id" not in session_data:
                session_data["userId"] = user_id
            if project_id:
                session_data.setdefault("projectId", project_id)
            if backend_base_url:
                session_data.setdefault("baseUrl", backend_base_url)
            if browser_base_url:
                session_data.setdefault("browserBaseUrl", browser_base_url)
            if frontend_base_url:
                session_data.setdefault("frontendUrl", frontend_base_url)

            panel_layout_url = (
                context.get("panelLayoutUrl")
                or context.get("panel_layout_url")
                or (
                    f"{str(frontend_base_url).rstrip('/')}/dashboard/projects/{project_id}/panel-layout"
                    if project_id and frontend_base_url
                    else None
                )
            )
            if panel_layout_url:
                session_data.setdefault("panelLayoutUrl", panel_layout_url)

            if session_data:
                tool_context["session"] = session_data

            logger.info(f"[handle_chat_message] Tool context: {list(tool_context.keys())}")

            try:
                assistant_agent = orchestrator.agent_factory.create_assistant_agent(
                    user_tier,
                    tool_context=tool_context if tool_context else None,
                )
                logger.info(f"[handle_chat_message] Agent created with {len(assistant_agent.tools)} tools")
                if assistant_agent.tools:
                    logger.info(f"[handle_chat_message] Agent tools: {[tool.name for tool in assistant_agent.tools]}")
            except Exception as agent_error:
                logger.error(f"[handle_chat_message] Failed to create agent: {agent_error}", exc_info=True)
                return {
                    "success": False,
                    "error": f"Failed to create AI agent: {str(agent_error)}",
                    "response": f"I'm unable to process your request because the AI agent could not be created: {str(agent_error)}",
                    "user_id": user_id,
                    "timestamp": str(datetime.datetime.now()),
                }

            # Detect if user is asking about visual layout
            message_lower = message.lower()
            is_visual_layout_question = any(keyword in message_lower for keyword in [
                'visual', 'layout', 'see', 'show', 'display', 'arrangement', 'arranged',
                'how are the panels', 'what does the layout', 'what is the order',
                'check the panel layout', 'view the panel layout', 'panel layout page',
                'order of panels', 'panel order', 'in the panel layout', 'by panel number',
                'panel positioning', 'panel positions', 'where are the panels'
            ])
            
            # Build frontend URL for panel layout page

            frontend_base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            panel_layout_url = (
                f"{frontend_base_url}/dashboard/projects/{project_id}/panel-layout"
                if project_id
                else None
            )

            automation_details: Dict[str, Any] = {}
            automation_attachments: List[Dict[str, Any]] = []
            automation_error: Optional[str] = None
            if is_visual_layout_question and panel_layout_url:
                session_id = f"panel-visual-{project_id or user_id}"
                try:
                    navigation_result = await self.navigate_panel_layout(
                        session_id=session_id,
                        user_id=user_id,
                        url=panel_layout_url,
                    )
                    screenshot_result = await self.take_panel_screenshot(
                        session_id=session_id,
                        user_id=user_id,
                        project_id=project_id,
                    )
                    panel_result = await self.extract_panel_list(
                        session_id=session_id,
                        user_id=user_id,
                    )

                    automation_attachments.extend(
                        screenshot_result.get("attachments", [])
                    )
                    automation_details = {
                        "navigation": navigation_result,
                        "panelList": panel_result.get("panels", []),
                        "panelMetadata": {
                            key: value
                            for key, value in panel_result.items()
                            if key not in {"panels"}
                        },
                        "screenshot": screenshot_result.get("metadata", {}),
                        "source": "browser_automation",
                        "automationRan": True,
                    }
                    context.setdefault("panelAutomation", {}).update(
                        {
                            "panelList": automation_details.get("panelList", []),
                            "panelMetadata": automation_details.get("panelMetadata", {}),
                            "automationSource": "browser_automation",
                        }
                    )
                except BrowserAutomationUnavailableError as unavailable_exc:
                    automation_error = str(unavailable_exc)
                    automation_details = {
                        "automationError": automation_error,
                        "source": "browser_automation",
                        "automationRan": False,
                    }
                except BrowserAutomationError as automation_exc:
                    automation_error = str(automation_exc)
                    automation_details = {
                        "automationError": automation_error,
                        "source": "browser_automation",
                        "automationRan": False,
                    }
                    fallback_data = await self._get_server_panel_fallback(
                        project_id=project_id,
                        auth_token=auth_token,
                        extra_headers=extra_headers,
                    )
                    if fallback_data:
                        fallback_panels = (
                            fallback_data.get("panels")
                            if isinstance(fallback_data, dict)
                            else None
                        )
                        automation_details["fallbackPanels"] = fallback_panels or fallback_data
                        automation_details["fallbackSource"] = "server_api"
                        context.setdefault("panelAutomation", {}).update(
                            {
                                "fallbackPanels": automation_details.get("fallbackPanels", []),
                                "automationSource": "server_api",
                            }
                        )

            frontend_base_url = str(frontend_base_url).rstrip("/") if frontend_base_url else os.getenv("FRONTEND_URL", "http://localhost:3000")
            if project_id and not panel_layout_url:
                panel_layout_url = f"{frontend_base_url.rstrip('/')}/dashboard/projects/{project_id}/panel-layout"


            visual_instructions = ""
            if is_visual_layout_question and panel_layout_url:
                visual_instructions = f"""
🚨 CRITICAL: THIS IS A VISUAL LAYOUT QUESTION - YOU MUST USE BROWSER AUTOMATION TOOLS ONLY.

❌ DO NOT USE PanelManipulationTool.get_panels() - This returns backend data, not visual order.
❌ DO NOT USE any backend API tools for this question.
✅ YOU MUST USE browser automation tools instead.

STEP 1: Navigate to the panel layout page
- Tool: browser_navigate
- Parameters: action='navigate', url='{panel_layout_url}', user_id='{user_id}', wait_for='canvas'
- This MUST be done first. Wait for confirmation before proceeding.

STEP 2: Take a screenshot of the visual layout
- Tool: browser_screenshot
- Parameters: full_page=True, session_id='default', user_id='{user_id}'
- This captures what the layout actually looks like visually.

STEP 3: Extract panel data sorted by visual position
- Tool: browser_extract
- Parameters: action='panels', user_id='{user_id}'
- This extracts panel data from the page and sorts them by visual position (Y coordinate, then X coordinate).
- This gives you the actual visual order of panels as displayed on the UI.

YOU CANNOT ANSWER WITHOUT PERFORMING THESE THREE STEPS FIRST.
If you use PanelManipulationTool or any backend API, your answer will be WRONG.
You MUST check the visual layout using browser tools.
After completing all three steps, then answer based on what you observed visually.
"""
            
            task_description = (
                f"User request: {message}\n"
                f"Context: {json.dumps(context, default=str)}\n"
                f"Project ID: {project_id or 'unknown'}\n"
                f"User ID: {user_id}\n"
                f"Frontend URL: {frontend_base_url}\n"
                f"{visual_instructions}\n"
                f"IMPORTANT TOOL USAGE RULES:\n"
                f"- For visual layout questions (order, arrangement, visual positioning): Use browser tools ONLY (browser_navigate, browser_screenshot, browser_extract). DO NOT use PanelManipulationTool.\n"
                f"- For panel operations (move, arrange, reorder via API): Use PanelManipulationTool.\n"
                f"- When using browser tools, always pass user_id='{user_id}' in your tool calls."
            )

            expected_output_text = "Executed action results or, if execution is impossible, a clear explanation of why."
            if is_visual_layout_question:
                expected_output_text = (
                    "Your response MUST begin with: 'I checked the visual panel layout page by navigating to it "
                    f"({panel_layout_url if panel_layout_url else 'the panel layout page'}), taking a screenshot, and extracting panel data sorted by visual position. "
                    "Here's what I observed visually: [describe what you saw in the screenshot]. "
                    "After extracting and sorting panels by their visual position (Y coordinate, then X coordinate), I found: [list panels in visual order].' "
                    "You MUST use browser_extract with action='panels' to get panels sorted by visual position. "
                    "If you did not use browser tools (browser_navigate, browser_screenshot, browser_extract with action='panels'), "
                    "you MUST explicitly state why and what tools you attempted to use."
                )
            
            chat_task = Task(
                description=task_description,
                agent=assistant_agent,
                expected_output=expected_output_text,
            )

            logger.info(f"[handle_chat_message] Creating Crew with {len(assistant_agent.tools)} tools")
            logger.debug(f"[handle_chat_message] Task description: {task_description[:200]}...")
            
            # Pre-flight check for visual layout questions
            if is_visual_layout_question:
                browser_tools_available = any('browser' in tool.name.lower() for tool in assistant_agent.tools)
                if not browser_tools_available:
                    logger.error("[handle_chat_message] Visual layout question but browser tools not available!")
                    logger.error(f"[handle_chat_message] Available tools: {[tool.name for tool in assistant_agent.tools]}")
                    logger.error(f"[handle_chat_message] BROWSER_TOOLS_AVAILABLE: {BROWSER_TOOLS_AVAILABLE}")
                    return {
                        "success": False,
                        "error": "Browser automation tools are not available. Cannot perform visual layout check.",
                        "response": "I'm unable to check the visual panel layout because browser automation tools are not available. Please check the Python AI service logs for details.",
                        "user_id": user_id,
                        "timestamp": str(datetime.datetime.now()),
                    }

            crew = Crew(
                agents=[assistant_agent],
                tasks=[chat_task],
                verbose=True,
            )

            logger.info("[handle_chat_message] Starting crew.kickoff()...")
            
            # Track if browser automation was used
            browser_tools_used = []
            if is_visual_layout_question:
                logger.info(f"[handle_chat_message] Visual layout question detected - expecting browser automation usage")
            
            result = crew.kickoff()
            logger.info(f"[handle_chat_message] Crew completed. Result type: {type(result)}")
            
            response_text = self._extract_crew_output(result)
            
            # Detect if browser tools were mentioned in the response (indicates usage)
            browser_tool_names = ["browser_navigate", "browser_screenshot", "browser_extract", "browser_interact"]
            detected_tools = [
                tool
                for tool in browser_tool_names
                if tool in str(result).lower() or tool in response_text.lower()
            ]

            if detected_tools:
                logger.info(
                    f"[handle_chat_message] Browser automation tools detected in response: {detected_tools}"
                )

            automation_succeeded = bool(automation_details.get("panelList"))
            browser_automation_used_flag = bool(detected_tools) or automation_succeeded

            if automation_error:
                logger.warning(
                    "[handle_chat_message] Browser automation failed: %s", automation_error
                )
                response_text = (
                    f"⚠️ Browser automation failed: {automation_error}. "
                    "Using server-side panel data when available.\n\n"
                    f"{response_text}"
                )
            elif automation_succeeded:
                logger.info(
                    "[handle_chat_message] Pre-run browser automation succeeded with %d panels",
                    len(automation_details.get("panelList", [])),
                )
                response_text = f"🔍 [Visual layout captured automatically]\n\n{response_text}"
            elif is_visual_layout_question and detected_tools:
                response_text = f"🔍 [Visual Analysis Used]\n\n{response_text}"
                logger.info("[handle_chat_message] Added visual analysis indicator to response")
            elif is_visual_layout_question and not browser_automation_used_flag:
                logger.warning(
                    "[handle_chat_message] Visual layout question detected but no browser tools appear to have been used!"
                )
                response_text = (
                    "⚠️ [Note: Using backend data - visual check may not have been performed]\n\n"
                    f"{response_text}"
                )

            logger.info(
                f"[handle_chat_message] Extracted response length: {len(response_text)} characters"
            )
            logger.debug(f"[handle_chat_message] Response preview: {response_text[:200]}...")

            response_payload: Dict[str, Any] = {
                "success": True,
                "response": response_text,
                "user_id": user_id,
                "timestamp": str(datetime.datetime.now()),
                "status": "completed",
                "browser_automation_used": browser_automation_used_flag,
                "tools_used": detected_tools,
            }

            if automation_attachments:
                response_payload["attachments"] = automation_attachments

            if automation_details:
                response_payload["panel_sequence"] = automation_details

            return response_payload
        except Exception as e:
            logger.error(f"Chat message handling failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def handle_document_analysis(self, user_id: str, user_tier: str, document_path: str, analysis_type: str) -> Dict:
        """Handle document analysis requests"""
        try:
            orchestrator = self.get_orchestrator(user_id, user_tier)
            doc_agent = orchestrator.agent_factory.create_document_intelligence_agent(user_tier)
            
            # Create analysis task
            analysis_task = Task(
                description=f"Analyze document: {document_path} with type: {analysis_type}",
                agent=doc_agent,
                expected_output="Comprehensive document analysis and insights"
            )
            
            # Execute task
            crew = Crew(
                agents=[doc_agent],
                tasks=[analysis_task],
                verbose=True
            )
            
            result = crew.kickoff()
            
            # Track cost
            cost = orchestrator._calculate_workflow_cost(crew)
            orchestrator.cost_optimizer.track_usage(user_tier, cost)
            
            return {
                "success": True,
                "result": result,
                "cost": cost,
                "document_path": document_path,
                "analysis_type": analysis_type
            }
            
        except Exception as e:
            logger.error(f"Document analysis failed: {e}")
            return {"success": False, "error": str(e)}

    def _determine_backend_base_url(self) -> str:
        base_url = (
            os.getenv("BACKEND_URL")
            or os.getenv("NEXT_PUBLIC_BACKEND_URL")
            or "http://localhost:8003"
        )
        return base_url.rstrip("/")

    def _default_tool_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if os.getenv("DISABLE_DEV_BYPASS") != "1":
            headers.setdefault("x-dev-bypass", "true")
        return headers

    def _setup_browser_tools(self) -> None:
        if not BROWSER_AUTOMATION_ENABLED:
            logger.warning("[_setup_browser_tools] Browser automation disabled via feature flag; skipping init")
            return
        if not BROWSER_TOOLS_AVAILABLE:
            logger.error("[_setup_browser_tools] Browser tools not available - BROWSER_TOOLS_AVAILABLE=False")
            logger.error("[_setup_browser_tools] Check if playwright is installed: pip install playwright && playwright install")
            return

        # Get allowed domains - include localhost and common frontend URLs
        default_domains = "localhost:3000,localhost:3001,127.0.0.1:3000,127.0.0.1:3001"
        allowed_domains_env = os.getenv("BROWSER_ALLOWED_DOMAINS", default_domains)
        allowed_domains = [domain.strip() for domain in allowed_domains_env.split(",") if domain.strip()]
        logger.info(f"[_setup_browser_tools] Allowed domains: {allowed_domains}")

        try:
            logger.info("[_setup_browser_tools] Initializing browser security config...")
            self.browser_security = BrowserSecurityConfig.from_env(allowed_domains)
            logger.info("[_setup_browser_tools] Creating browser session manager...")
            self.browser_sessions = BrowserSessionManager(self.browser_security)
            logger.info("[_setup_browser_tools] Browser tools initialized successfully")
        except Exception as exc:  # pragma: no cover - defensive
            logger.error(f"[_setup_browser_tools] Failed to initialize browser tools: {exc}", exc_info=True)
            self.browser_sessions = None
            self.browser_security = None

    def _build_tool_resources(self) -> Dict[str, Any]:
        resources: Dict[str, Any] = {
            "backend_base_url": self.backend_base_url,
            "default_headers": self._default_tool_headers(),
        }

        factories: List[Callable[[], Any]] = []
        if self.browser_sessions:
            factories.extend(
                [
                    lambda sessions=self.browser_sessions: BrowserNavigationTool(sessions),
                    lambda sessions=self.browser_sessions: BrowserInteractionTool(sessions),
                    lambda sessions=self.browser_sessions: BrowserExtractionTool(sessions),
                    lambda sessions=self.browser_sessions: BrowserScreenshotTool(sessions),
                ]
            )

        resources["browser_tool_factories"] = factories
        resources["browser_session_manager"] = self.browser_sessions
        return resources

    def _extract_crew_output(self, result: Any) -> str:
        if isinstance(result, dict):
            for key in ("output", "result", "response"):
                if key in result and result[key]:
                    return str(result[key])
            return json.dumps(result, default=str)
        return str(result)

# === MAIN FUNCTION FOR TESTING ===
async def main():
    """Main function for testing the hybrid AI architecture"""
    try:
        # Initialize service
        ai_service = DellSystemAIService()
        
        # Test basic functionality
        print("🧪 Testing Hybrid AI Architecture...")
        
        # Test layout optimization
        layout_result = await ai_service.handle_layout_optimization(
            user_id="test_user",
            user_tier="paid_user",
            layout_data={"panels": [{"id": "P001", "dimensions": "40x100"}]}
        )
        print(f"Layout optimization result: {layout_result}")
        
        # Test document analysis
        doc_result = await ai_service.handle_document_analysis(
            user_id="test_user",
            user_tier="paid_user",
            document_path="/test/document.pdf",
            analysis_type="qc_data"
        )
        print(f"Document analysis result: {doc_result}")
        
        print("✅ Hybrid AI Architecture test completed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    import datetime
    asyncio.run(main()) 
