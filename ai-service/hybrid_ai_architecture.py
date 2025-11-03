# Hybrid AI Architecture: Combining Framework + Practical Implementation
# This merges the cost-efficient, scalable framework with direct file integration

import asyncio
import datetime
import json
import logging
import os
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple, Literal

import redis
import requests
from crewai import Agent, Crew, Task
from langchain.tools import BaseTool
from pydantic import BaseModel, Field, ValidationError

# Configure logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to import OpenAI LLM - handle both old and new langchain versions
try:
    from langchain_openai import OpenAI
except ImportError:
    try:
        from langchain.llms import OpenAI
    except ImportError:
        try:
            from langchain_community.llms import OpenAI
        except ImportError:
            logger.warning("OpenAI LLM not available - using fallback")
            OpenAI = None

import ollama

BROWSER_TOOLS_AVAILABLE = False

try:
    from ai_service.browser_tools import (
        BrowserExtractionTool,
        BrowserInteractionTool,
        BrowserNavigationTool,
        BrowserScreenshotTool,
        BrowserSecurityConfig,
        BrowserSessionManager,
    )

    BROWSER_TOOLS_AVAILABLE = True
except Exception as browser_import_error:  # pragma: no cover - optional dependency
    logger.warning(
        "Browser tools not available: %s", getattr(browser_import_error, "detail", browser_import_error)
    )
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
            usage = self.redis.get(f"usage:{user_tier}")
            return float(usage) if usage else 0.0
        except:
            return 0.0
    
    def track_usage(self, user_tier: str, cost: float):
        """Track usage for cost optimization"""
        try:
            current_usage = self._get_user_usage(user_tier)
            new_usage = current_usage + cost
            self.redis.set(f"usage:{user_tier}", new_usage)
            self.usage_tracking[user_tier] = new_usage
        except Exception as e:
            logger.error(f"Failed to track usage: {e}")

# === TOOL INTEGRATIONS ===
class LayoutOptimizerTool(BaseTool):
    """Tool that connects to your existing geometry.py"""
    name = "layout_optimizer"
    description = "Optimizes panel layouts using existing geometry calculations"
    
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
    name = "document_processor"
    description = "Processes documents using existing OCR and analysis"
    
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

    name = "panel_manipulation"
    description = (
        "Execute panel layout operations via API. Use this tool when users request operations such as moving, "
        "reordering, or retrieving panels. Supported actions: 'get_panels', 'move_panel', 'batch_move', "
        "'reorder_panels_numerically'."
    )
    args_schema = PanelManipulationInput

    def __init__(
        self,
        base_url: Optional[str] = None,
        default_headers: Optional[Dict[str, str]] = None,
        project_id: Optional[str] = None,
        auth_token: Optional[str] = None,
    ):
        super().__init__()
        self.base_url = (base_url or "http://localhost:8003").rstrip("/")
        self.default_headers = dict(default_headers or {})
        if "x-dev-bypass" not in self.default_headers and os.getenv("DISABLE_DEV_BYPASS") != "1":
            self.default_headers["x-dev-bypass"] = "true"
        self.project_id = project_id
        self.auth_token = auth_token
        self.session = requests.Session()
        self.timeout = 15

    def with_context(
        self,
        project_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> "PanelManipulationTool":
        """Return a copy of the tool bound to a specific project/auth context."""

        headers = dict(self.default_headers)
        if extra_headers:
            headers.update(extra_headers)

        return PanelManipulationTool(
            base_url=self.base_url,
            default_headers=headers,
            project_id=project_id or self.project_id,
            auth_token=auth_token or self.auth_token,
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

        summary = {
            "projectId": project_id,
            "moves_executed": len(operations),
            "operations": operations,
            "response": response,
            "message": f"Successfully reordered {len(operations)} panels numerically",
        }

        if include_layout:
            summary["layout"] = self._get_layout(project_id)

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
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = dict(self.default_headers)

        if self.auth_token:
            headers.setdefault("Authorization", f"Bearer {self.auth_token}")

        logger.info(f"[PanelManipulationTool] {method} {url} (headers: {list(headers.keys())})")
        if json_payload:
            logger.debug(f"[PanelManipulationTool] Payload keys: {list(json_payload.keys())}")

        try:
            response = self.session.request(
                method=method.upper(),
                url=url,
                json=json_payload,
                params=params,
                headers=headers,
                timeout=self.timeout,
            )
            logger.info(f"[PanelManipulationTool] Response status: {response.status_code}")
        except requests.RequestException as exc:
            logger.error(f"[PanelManipulationTool] Request exception: {exc}")
            raise ValueError(f"Panel manipulation request failed: {exc}") from exc

        if response.status_code == 401:
            logger.error(f"[PanelManipulationTool] Unauthorized (401) for {url}")
            raise ValueError("Panel manipulation request was unauthorized. Verify authentication headers.")

        if not response.ok:
            try:
                error_payload = response.json()
            except ValueError:
                error_payload = response.text
            logger.error(f"[PanelManipulationTool] Request failed ({response.status_code}): {error_payload}")
            raise ValueError(f"Panel manipulation request failed ({response.status_code}): {error_payload}")

        try:
            result = response.json()
            logger.debug(f"[PanelManipulationTool] Response keys: {list(result.keys()) if isinstance(result, dict) else 'not a dict'}")
            return result
        except ValueError as exc:
            logger.error(f"[PanelManipulationTool] JSON parse error: {exc}, response text: {response.text[:200]}")
            raise ValueError(f"Panel manipulation response could not be parsed: {exc}") from exc

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
    name = "qc_data_analyzer"
    description = "Analyzes QC data and identifies anomalies"
    
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

        panel_tool = self._build_panel_tool(tool_context)
        if panel_tool:
            tools_list.append(panel_tool)
            logger.info(f"[AgentFactory] PanelManipulationTool added - name: {panel_tool.name}, project_id: {panel_tool.project_id}")
        else:
            logger.warning("[AgentFactory] PanelManipulationTool NOT created!")

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
        
        if model_config.tier == ModelTier.LOCAL:
            llm = self._create_ollama_llm(model_config.name)
            logger.info(f"[_create_llm] Using local Ollama LLM: {model_config.name}")
            return llm
        elif model_config.api_key_env and os.getenv(model_config.api_key_env):
            if "gpt" in model_config.name:
                # Use ChatOpenAI for better tool support if available, fallback to OpenAI
                try:
                    # Try multiple import paths for compatibility
                    try:
                        from langchain_openai import ChatOpenAI  # type: ignore
                    except ImportError:
                        from langchain.chat_models import ChatOpenAI  # type: ignore
                    
                    llm = ChatOpenAI(
                        openai_api_key=os.getenv(model_config.api_key_env),
                        model=model_config.name,
                        temperature=0
                    )
                    logger.info(f"[_create_llm] Using ChatOpenAI: {model_config.name} (better tool support)")
                    return llm
                except (ImportError, Exception) as e:
                    logger.warning(f"[_create_llm] ChatOpenAI not available ({e}), falling back to OpenAI")
                    if OpenAI is None:
                        raise ImportError("OpenAI LLM not available - please install langchain-community or langchain-openai")
                    llm = OpenAI(api_key=os.getenv(model_config.api_key_env), model_name=model_config.name)
                    logger.info(f"[_create_llm] Using OpenAI (legacy): {model_config.name}")
                    return llm
            elif "claude" in model_config.name:
                # Implement Claude integration
                logger.warning(f"[_create_llm] Claude not fully implemented, using GPT fallback")
                return OpenAI(api_key=os.getenv(model_config.api_key_env), model_name="gpt-3.5-turbo")
        else:
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
        base_url = self.tool_resources.get("backend_base_url")
        default_headers = dict(self.tool_resources.get("default_headers", {}))

        if not base_url:
            base_url = "http://localhost:8003"

        logger.info(f"[_build_panel_tool] Creating tool with base_url: {base_url}")
        logger.debug(f"[_build_panel_tool] Tool context: {tool_context}")

        tool = PanelManipulationTool(
            base_url=base_url,
            default_headers=default_headers,
        )

        if not tool_context:
            logger.info(f"[_build_panel_tool] Tool created without context - project_id: {tool.project_id}")
            return tool

        contexted_tool = tool.with_context(
            project_id=tool_context.get("project_id"),
            auth_token=tool_context.get("auth_token"),
            extra_headers=tool_context.get("headers"),
        )
        logger.info(f"[_build_panel_tool] Tool created with context - project_id: {contexted_tool.project_id}")
        return contexted_tool

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
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            self.redis = None
        
        self.backend_base_url = self._determine_backend_base_url()
        self.browser_security: Optional[BrowserSecurityConfig] = None
        self.browser_sessions: Optional[BrowserSessionManager] = None
        self._setup_browser_tools()
        self.tool_resources = self._build_tool_resources()
    
    def get_orchestrator(self, user_id: str, user_tier: str) -> HybridWorkflowOrchestrator:
        """Get workflow orchestrator for specific user"""
        return HybridWorkflowOrchestrator(self.redis, user_tier, self.tool_resources)
    
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
            logger.debug(f"[handle_chat_message] Context keys: {list(context.keys())}")
            
            orchestrator = self.get_orchestrator(user_id, user_tier)
            project_id = context.get("projectId") or context.get("project_id")
            auth_token = context.get("authToken") or context.get("auth_token")
            extra_headers = context.get("headers") or context.get("authHeaders")

            logger.info(f"[handle_chat_message] Extracted - project_id: {project_id}, has_auth_token: {bool(auth_token)}, has_headers: {bool(extra_headers)}")

            tool_context: Dict[str, Any] = {}
            if project_id:
                tool_context["project_id"] = project_id
            if auth_token:
                tool_context["auth_token"] = auth_token
            if isinstance(extra_headers, dict):
                tool_context["headers"] = extra_headers

            logger.info(f"[handle_chat_message] Tool context: {list(tool_context.keys())}")

            assistant_agent = orchestrator.agent_factory.create_assistant_agent(
                user_tier,
                tool_context=tool_context if tool_context else None,
            )
            
            logger.info(f"[handle_chat_message] Agent created with {len(assistant_agent.tools)} tools")
            if assistant_agent.tools:
                logger.info(f"[handle_chat_message] Agent tools: {[tool.name for tool in assistant_agent.tools]}")

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
            panel_layout_url = f"{frontend_base_url}/dashboard/projects/{project_id}/panel-layout" if project_id else None
            
            visual_instructions = ""
            if is_visual_layout_question and panel_layout_url:
                visual_instructions = f"""
YOU MUST USE BROWSER AUTOMATION TOOLS TO ANSWER THIS QUESTION. DO NOT USE BACKEND API DATA.

STEP 1: Navigate to the panel layout page
- Tool: browser_navigate
- Parameters: action='navigate', url='{panel_layout_url}', user_id='{user_id}', wait_for='canvas'
- This MUST be done first. Wait for confirmation before proceeding.

STEP 2: Take a screenshot of the visual layout
- Tool: browser_screenshot
- Parameters: full_page=True, session_id='default', user_id='{user_id}'
- This captures what the layout actually looks like visually.

STEP 3: Extract visual data from the page
- Tool: browser_extract
- Parameters: action='text', selector='canvas', user_id='{user_id}'
- This gets the actual panel arrangement as displayed.

YOU CANNOT ANSWER WITHOUT PERFORMING THESE THREE STEPS FIRST.
Do not use backend API data - you MUST check the visual layout using these tools.
After completing all three steps, then answer based on what you observed visually.
"""
            
            task_description = (
                f"User request: {message}\n"
                f"Context: {json.dumps(context, default=str)}\n"
                f"Project ID: {project_id or 'unknown'}\n"
                f"User ID: {user_id}\n"
                f"Frontend URL: {frontend_base_url}\n"
                f"{visual_instructions}\n"
                "IMPORTANT: If the user asks you to perform actions (move, arrange, reorder panels), "
                "you MUST use the available tools (PanelManipulationTool or browser tools) to execute the "
                "actions, not merely describe them. For visual layout questions, use browser automation tools "
                "to check the actual visual representation on the frontend. When using browser tools, "
                f"always pass user_id='{user_id}' in your tool calls."
            )

            expected_output_text = "Executed action results or, if execution is impossible, a clear explanation of why."
            if is_visual_layout_question:
                expected_output_text = (
                    "Your response MUST begin with: 'I checked the visual panel layout page by navigating to it "
                    f"({panel_layout_url if panel_layout_url else 'the panel layout page'}), taking a screenshot, and extracting visual data. "
                    "Here's what I observed visually: [describe what you saw in the screenshot/extracted data]. "
                    "After analyzing the visual layout, I found: [panel order/arrangement based on visual observations].' "
                    "If you did not use browser tools (browser_navigate, browser_screenshot, browser_extract), "
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
            detected_tools = [tool for tool in browser_tool_names if tool in str(result).lower() or tool in response_text.lower()]
            
            if detected_tools:
                logger.info(f"[handle_chat_message] Browser automation tools detected in response: {detected_tools}")
            
            # Add explicit indicator if visual layout question was asked
            if is_visual_layout_question and detected_tools:
                response_text = f"🔍 [Visual Analysis Used]\n\n{response_text}"
                logger.info("[handle_chat_message] Added visual analysis indicator to response")
            elif is_visual_layout_question and not detected_tools:
                logger.warning("[handle_chat_message] Visual layout question detected but no browser tools appear to have been used!")
                response_text = f"⚠️ [Note: Using backend data - visual check may not have been performed]\n\n{response_text}"
            
            logger.info(f"[handle_chat_message] Extracted response length: {len(response_text)} characters")
            logger.debug(f"[handle_chat_message] Response preview: {response_text[:200]}...")

            return {
                "success": True,
                "response": response_text,
                "user_id": user_id,
                "timestamp": str(datetime.datetime.now()),
                "status": "completed",
                "browser_automation_used": bool(detected_tools),
                "tools_used": detected_tools,
            }
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
        if not BROWSER_TOOLS_AVAILABLE:
            logger.error("[_setup_browser_tools] Browser tools not available - BROWSER_TOOLS_AVAILABLE=False")
            logger.error("[_setup_browser_tools] Check if playwright is installed: pip install playwright && playwright install")
            return

        allowed_domains_env = os.getenv("BROWSER_ALLOWED_DOMAINS", "localhost:3000")
        allowed_domains = [domain.strip() for domain in allowed_domains_env.split(",") if domain.strip()]

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
