"""
Hybrid AI Architecture for Dell System Manager
Optimized for production SaaS with multi-cloud routing and intelligent model selection
"""

import asyncio
import copy
import json
import logging
import os
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Literal

import redis
import requests
from crewai import Agent, Crew, Process, Task
from crewai.tools import BaseTool
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field, PrivateAttr, ValidationError

from browser_tools import (
    BrowserExtractionTool,
    BrowserInteractionTool,
    BrowserNavigationTool,
    BrowserScreenshotTool,
    BrowserVisionAnalysisTool,
    BrowserRealtimeTool,
    BrowserPerformanceTool,
    BrowserSecurityConfig,
    BrowserSessionManager,
)
from openai_service import OpenAIService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CRITICAL: Configure LiteLLM to use GPT-4o (CrewAI uses LiteLLM internally)
# Set environment variable that LiteLLM respects
os.environ.setdefault("LITELLM_MODEL", "gpt-4o")
os.environ.setdefault("OPENAI_MODEL", "gpt-4o")

try:
    import litellm
    # Force LiteLLM to use GPT-4o and disable cost optimization
    litellm.drop_params = True  # Don't drop model parameter
    litellm.suppress_debug_info = False  # Show debug info
    # Disable LiteLLM's automatic model selection
    litellm.set_verbose = True  # Enable verbose logging
    logger.info("[hybrid_ai_architecture] LiteLLM configured - environment variables set: LITELLM_MODEL=gpt-4o, OPENAI_MODEL=gpt-4o")
except ImportError:
    logger.warning("[hybrid_ai_architecture] LiteLLM not directly imported (CrewAI uses it internally)")
except Exception as e:
    logger.warning(f"[hybrid_ai_architecture] Could not configure LiteLLM: {e}")

class ModelProvider(Enum):
    """Available AI model providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    AZURE = "azure"

class TaskComplexity(Enum):
    """Task complexity levels for model routing"""
    SIMPLE = "simple"       # Basic queries, simple tasks
    MODERATE = "moderate"   # Standard analysis, document processing
    COMPLEX = "complex"     # Multi-step reasoning, optimization
    EXPERT = "expert"       # Advanced analysis, optimization, planning


@dataclass
class AgentProfile:
    """Represents an agent that can participate in a workflow"""

    name: str
    role: str
    goal: str
    backstory: str
    complexity: TaskComplexity
    tools: List[str]
    allow_delegation: bool = True
    model_hint: Optional[str] = None


@dataclass
class WorkflowTaskTemplate:
    """Template describing a task inside a workflow"""

    id: str
    description: str
    agent: str
    expected_output: str
    context_keys: Optional[List[str]] = None


@dataclass
class WorkflowBlueprint:
    """Describes a collaborative workflow composed of multiple agents"""

    id: str
    name: str
    description: str
    agents: Dict[str, AgentProfile]
    tasks: List[WorkflowTaskTemplate]
    process: Process = Process.sequential
    allow_real_time_collaboration: bool = True


class CollaborationChannel:
    """Lightweight pub/sub channel used by agents to exchange updates"""

    def __init__(self) -> None:
        self._events: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()

    async def publish(self, agent: str, message: str, payload: Optional[Dict[str, Any]] = None) -> None:
        async with self._lock:
            self._events.append(
                {
                    "agent": agent,
                    "message": message,
                    "payload": payload or {},
                    "timestamp": time.time(),
                }
            )

    async def snapshot(self) -> List[Dict[str, Any]]:
        async with self._lock:
            return list(self._events)


class SharedContextStore:
    """Persists workflow context across executions so agents can share state"""

    def __init__(self, redis_client: redis.Redis, namespace: str = "dsm:ai:shared-context") -> None:
        self.redis = redis_client
        self.namespace = namespace

    def _key(self, user_id: str) -> str:
        return f"{self.namespace}:{user_id}"

    def _load_sync(self, user_id: str) -> Dict[str, Any]:
        payload = self.redis.get(self._key(user_id))
        if payload:
            try:
                return json.loads(payload)
            except json.JSONDecodeError:
                logger.warning("Corrupted shared context for %s - resetting", user_id)
        return {"history": [], "artifacts": {}, "lastWorkflow": None}

    def _save_sync(self, user_id: str, context: Dict[str, Any]) -> None:
        self.redis.setex(self._key(user_id), 60 * 60 * 24 * 7, json.dumps(context))

    async def load(self, user_id: str) -> Dict[str, Any]:
        return await asyncio.to_thread(self._load_sync, user_id)

    async def save(self, user_id: str, context: Dict[str, Any]) -> None:
        await asyncio.to_thread(self._save_sync, user_id, context)

    async def append_history(self, user_id: str, entry: Dict[str, Any]) -> Dict[str, Any]:
        context = await self.load(user_id)
        context.setdefault("history", []).append(entry)
        context["lastWorkflow"] = entry.get("workflowId")
        await self.save(user_id, context)
        return context


class CrewAgentExecutor:
    """Wraps a CrewAI agent so it can be awaited within async flows"""

    def __init__(self, agent: Agent, process: Process = Process.sequential, tools: Optional[List[BaseTool]] = None, requires_browser_tools: bool = False):
        self.agent = agent
        self.process = process
        self.tools = tools or []
        self.requires_browser_tools = requires_browser_tools

    def _detect_fake_answer(self, response: str) -> bool:
        """Detect if agent is describing actions instead of executing them"""
        fake_indicators = [
            "i need to", "i would", "i should", "i will", "i'll",
            "let me", "i can", "i could", "i might",
            "to navigate", "to take a screenshot", "to extract",
            "would navigate", "would take", "would extract",
            "should navigate", "should take", "should extract",
            "need to navigate", "need to take", "need to extract",
            "will navigate", "will take", "will extract"
        ]
        response_lower = response.lower()
        fake_count = sum(1 for indicator in fake_indicators if indicator in response_lower)
        return fake_count >= 2  # Multiple indicators = likely fake

    async def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> str:
        # Build task description with enforcement for browser tools
        if self.requires_browser_tools:
            task_description = f"""CRITICAL INSTRUCTIONS - YOU MUST EXECUTE BROWSER TOOLS:

{query}

🚨 MANDATORY REQUIREMENTS:
1. You MUST execute browser tools (browser_navigate, browser_screenshot, browser_extract)
2. DO NOT describe what you would do - ACTUALLY DO IT
3. DO NOT say "I need to navigate" - ACTUALLY CALL browser_navigate
4. DO NOT say "I would take a screenshot" - ACTUALLY CALL browser_screenshot
5. Your response MUST include actual results from tool execution, not descriptions

If you describe actions instead of executing them, your response will be rejected.
You MUST use the available browser tools to complete this task."""
            
            expected_output = """A response that includes:
1. Confirmation of browser tool execution (e.g., "Navigation successful", "Screenshot captured")
2. Actual data extracted from browser tools (not descriptions)
3. Results based on visual analysis performed via tools
4. NO descriptions of what you would do - only what you actually did"""
        else:
            task_description = f"Respond to the following request with actionable insight: {query}"
            expected_output = "A concise, domain specific response"
        
        task = Task(
            description=task_description,
            agent=self.agent,
            expected_output=expected_output,
            tools=self.tools,
        )

        crew = Crew(
            agents=[self.agent],
            tasks=[task],
            process=self.process,
            verbose=True,  # Enable verbose to see tool calls
            share_crew=True,
        )

        result = await asyncio.to_thread(
            crew.kickoff,
            {"user_context": context or {}, "query": query},
        )

        response = result["output"] if isinstance(result, dict) and "output" in result else str(result)
        
        # Validate response for browser tool tasks
        if self.requires_browser_tools:
            if self._detect_fake_answer(response):
                logger.warning("[CrewAgentExecutor] Detected fake answer - agent described actions instead of executing")
                # Check if tools were actually called by examining crew result
                if isinstance(result, dict):
                    # Look for tool execution evidence
                    has_tool_calls = any(
                        "browser_navigate" in str(result).lower() or
                        "browser_screenshot" in str(result).lower() or
                        "browser_extract" in str(result).lower()
                        for key in result.keys()
                    )
                    if not has_tool_calls:
                        error_msg = "ERROR: You described actions instead of executing browser tools. You MUST actually call browser_navigate, browser_screenshot, and browser_extract tools. Do not describe what you would do - execute the tools now."
                        logger.error(f"[CrewAgentExecutor] {error_msg}")
                        return error_msg
        
        return response

@dataclass
class ModelConfig:
    name: str
    provider: ModelProvider
    cost_per_1k_tokens: float
    max_tokens: int
    capabilities: List[str]

class CostOptimizer:
    """Optimizes AI model usage based on cost and capability requirements"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.models = {
            "gpt-4o": ModelConfig(
                name="gpt-4o",
                provider=ModelProvider.OPENAI,
                cost_per_1k_tokens=0.015,
                max_tokens=128000,
                capabilities=["text", "vision", "reasoning", "analysis"]
            ),
            "claude-3-sonnet": ModelConfig(
                name="claude-3-sonnet",
                provider=ModelProvider.ANTHROPIC,
                cost_per_1k_tokens=0.003,
                max_tokens=200000,
                capabilities=["text", "reasoning", "analysis"]
            )
        }
    
    def analyze_task_complexity(self, query: str, context: Dict = None) -> TaskComplexity:
        """Analyze task complexity based on query and context"""
        query_lower = query.lower()
        
        # Detect browser tool requirements - these MUST use GPT-4o
        browser_tool_keywords = [
            "visual", "layout", "panel layout", "screenshot", "navigate", 
            "browser", "frontend", "page", "canvas", "ui", "interface",
            "see", "look", "display", "shown", "arrange", "position"
        ]
        requires_browser_tools = any(keyword in query_lower for keyword in browser_tool_keywords)
        
        # Check context for browser tool indicators
        if context:
            context_str = str(context).lower()
            if any(keyword in context_str for keyword in browser_tool_keywords + ["panel_layout_url", "visual_analysis"]):
                requires_browser_tools = True
        
        # If browser tools are required, mark as COMPLEX to force GPT-4o
        if requires_browser_tools:
            logger.info(f"[CostOptimizer] Browser tools required - forcing COMPLEX complexity")
            return TaskComplexity.COMPLEX
        
        # Simple tasks
        if any(word in query_lower for word in ["hello", "help", "status", "simple"]):
            return TaskComplexity.SIMPLE
        
        # Complex tasks
        if any(word in query_lower for word in ["analyze", "optimize", "generate", "complex", "multiple"]):
            return TaskComplexity.COMPLEX
        
        # Expert tasks
        if any(word in query_lower for word in ["workflow", "orchestrate", "collaborate", "multi-agent"]):
            return TaskComplexity.EXPERT
        
        # Default to moderate
        return TaskComplexity.MODERATE
    
    def select_optimal_model(self, complexity: TaskComplexity, user_tier: str, requires_browser_tools: bool = False) -> str:
        """Select optimal model based on complexity and user tier
        
        Args:
            complexity: Task complexity level
            user_tier: User subscription tier
            requires_browser_tools: Whether browser tools are required (forces GPT-4o)
        """
        # Always use GPT-4o for all tasks
        logger.info(f"[CostOptimizer] Selecting GPT-4o (browser_tools={requires_browser_tools}, complexity={complexity.value}, user_tier={user_tier})")
        return "gpt-4o"
    
    async def track_usage(self, user_id: str, model: str, tokens: int, cost: float):
        """Track usage for cost optimization"""
        # Implementation for usage tracking
        pass

# === TOOL DEFINITIONS ===
# Note: All tools now inherit from CrewAI's BaseTool (imported at top of file)
# Mock tools (PanelLayoutOptimizer, DocumentAnalyzer, ProjectConfigAgent) have been removed
# Only browser tools remain, which properly inherit from crewai.tools.BaseTool


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
    browser_base_url: str = Field(
        default="http://localhost:3000",
        description="Base URL for the browser automation/visual extraction service.",
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
    caller_session: Dict[str, Any] = Field(
        default_factory=dict,
        description="Session payload forwarded to downstream services for authenticated requests.",
    )
    _session: requests.Session = PrivateAttr()
    _timeout: int = PrivateAttr(default=15)

    def __init__(
        self,
        base_url: Optional[str] = None,
        default_headers: Optional[Dict[str, str]] = None,
        project_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        caller_session: Optional[Dict[str, Any]] = None,
        browser_base_url: Optional[str] = None,
        browser_service_url: Optional[str] = None,
    ):
        resolved_base_url = (base_url or "http://localhost:8003").rstrip("/")
        resolved_browser_base = (
            browser_service_url
            or browser_base_url
            or os.getenv("BROWSER_SERVICE_URL")
            or resolved_base_url
        )
        headers = dict(default_headers or {})
        if "x-dev-bypass" not in headers and os.getenv("DISABLE_DEV_BYPASS") != "1":
            headers["x-dev-bypass"] = "true"

        init_data: Dict[str, Any] = {
            "base_url": resolved_base_url,
            "browser_base_url": resolved_browser_base.rstrip("/"),
            "default_headers": headers,
            "project_id": project_id,
            "auth_token": auth_token,
            "caller_session": dict(caller_session or {}),
        }

        super().__init__(**init_data)

        # Normalize runtime attributes now that Pydantic validation has completed.
        self.base_url = (self.base_url or "http://localhost:8003").rstrip("/")
        self.browser_base_url = (self.browser_base_url or self.base_url).rstrip("/")
        self.default_headers = dict(self.default_headers or {})
        if "x-dev-bypass" not in self.default_headers and os.getenv("DISABLE_DEV_BYPASS") != "1":
            self.default_headers["x-dev-bypass"] = "true"
        self.caller_session = dict(self.caller_session or {})

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


class DellSystemAIService:
    """Main AI service orchestrator"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.cost_optimizer = CostOptimizer(redis_client)
        allowed_domains_env = os.getenv("BROWSER_ALLOWED_DOMAINS", "")
        allowed_domains = [
            domain.strip() for domain in allowed_domains_env.split(",") if domain.strip()
        ]
        self.browser_security = BrowserSecurityConfig.from_env(allowed_domains)
        self.browser_sessions = BrowserSessionManager(self.browser_security)
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            self.openai_service = OpenAIService(api_key)
        else:
            self.openai_service = None
            logger.warning("OPENAI_API_KEY not set; vision analysis tool is disabled")
        self.tools = self._initialize_tools()
        self.context_store = SharedContextStore(redis_client)
        self._manifest_path = Path(__file__).resolve().parent / "orchestrator_manifest.json"
        self._persist_orchestrator_manifest()

    def _initialize_tools(self) -> Dict[str, BaseTool]:
        """Initialize available tools - only browser tools (all inherit from CrewAI's BaseTool)"""
        tools = {
            "browser_navigate": BrowserNavigationTool(self.browser_sessions),
            "browser_interact": BrowserInteractionTool(self.browser_sessions),
            "browser_extract": BrowserExtractionTool(self.browser_sessions),
            "browser_screenshot": BrowserScreenshotTool(self.browser_sessions),
            "browser_realtime": BrowserRealtimeTool(self.browser_sessions),
            "browser_performance": BrowserPerformanceTool(self.browser_sessions),
        }
        tools["browser_vision_analyze"] = BrowserVisionAnalysisTool(
            self.browser_sessions, self.openai_service
        )
        return tools

    def get_orchestrator(self, user_id: str, user_tier: str):
        """Get workflow orchestrator for the user"""
        return WorkflowOrchestrator(
            user_id,
            user_tier,
            self.cost_optimizer,
            self.tools,
            self.context_store,
        )

    async def handle_query(self, user_id: str, user_tier: str, query: str,
                          context: Dict = None) -> Dict:
        """Handle user queries with intelligent model routing"""
        try:
            # Analyze task complexity
            complexity = self.cost_optimizer.analyze_task_complexity(query, context)
            
            # Detect browser tool requirements
            query_lower = query.lower()
            browser_tool_keywords = [
                "visual", "layout", "panel layout", "screenshot", "navigate", 
                "browser", "frontend", "page", "canvas", "ui", "interface",
                "see", "look", "display", "shown", "arrange", "position"
            ]
            requires_browser_tools = any(keyword in query_lower for keyword in browser_tool_keywords)
            if context:
                context_str = str(context).lower()
                if any(keyword in context_str for keyword in browser_tool_keywords + ["panel_layout_url", "visual_analysis"]):
                    requires_browser_tools = True
            
            # Select optimal model (force GPT-4o for browser tools)
            optimal_model = self.cost_optimizer.select_optimal_model(complexity, user_tier, requires_browser_tools)
            
            # Create appropriate agent for the task
            agent = self._create_agent_for_task(optimal_model, complexity, requires_browser_tools)
            
            # Execute the task
            result = await agent.execute(query, context)
            
            # Track usage
            estimated_tokens = len(query.split()) * 1.3  # Rough estimation
            estimated_cost = self._calculate_cost(optimal_model, estimated_tokens)
            await self.cost_optimizer.track_usage(user_id, optimal_model, estimated_tokens, estimated_cost)
            
            return {
                "response": result,
                "model_used": optimal_model,
                "complexity_level": complexity.value,
                "estimated_cost": estimated_cost,
                "browser_tools_required": requires_browser_tools
            }
            
        except Exception as e:
            logger.error(f"Error handling query: {e}")
            return {"error": str(e), "fallback": True}

    def _create_agent_for_task(self, model_name: str, complexity: TaskComplexity, requires_browser_tools: bool = False):
        """Create an appropriate agent for the given task complexity"""
        tools = list(self.tools.values())

        try:
            # CRITICAL: Force GPT-4o for browser tool tasks
            if requires_browser_tools and model_name != "gpt-4o":
                logger.warning(f"[_create_agent_for_task] Forcing GPT-4o for browser tools (was: {model_name})")
                model_name = "gpt-4o"
            
            # CRITICAL: Always force GPT-4o - never use GPT-3.5
            if model_name != "gpt-4o":
                logger.warning(f"[_create_agent_for_task] ⚠️ Model override: {model_name} -> gpt-4o")
                model_name = "gpt-4o"
            
            logger.info(f"[_create_agent_for_task] Creating LLM with model: {model_name} (requires_browser_tools={requires_browser_tools})")
            
            # CRITICAL: Set LiteLLM environment variables before creating ChatOpenAI (CrewAI uses LiteLLM internally)
            os.environ["LITELLM_MODEL"] = model_name
            os.environ["OPENAI_MODEL"] = model_name
            logger.info(f"[_create_agent_for_task] LiteLLM environment variables set: LITELLM_MODEL={model_name}, OPENAI_MODEL={model_name}")
            
            # Explicitly set model parameter to prevent any override
            llm = ChatOpenAI(
                model=model_name,
                temperature=0,
                openai_api_key=os.getenv("OPENAI_API_KEY")  # Explicit API key to prevent fallback
            )
            
            # CRITICAL: Verify the LLM model after creation
            actual_model = getattr(llm, 'model_name', None) or getattr(llm, 'model', None)
            logger.info(f"[_create_agent_for_task] LLM created - requested: {model_name}, actual: {actual_model}")
            if actual_model and actual_model != model_name:
                logger.error(f"[_create_agent_for_task] ❌ MODEL MISMATCH! Requested {model_name} but got {actual_model}")
                # Force set the model attribute if possible
                if hasattr(llm, 'model_name'):
                    llm.model_name = model_name
                if hasattr(llm, 'model'):
                    llm.model = model_name
            
            # Stronger prompts for browser tool tasks
            if requires_browser_tools:
                role = "Browser Automation Specialist"
                goal = "Execute browser automation tools to gather visual data. NEVER describe actions - ALWAYS execute tools."
                backstory = """You are a browser automation specialist with strict execution requirements.

CRITICAL RULES:
1. When asked about visual layouts, panels, or UI elements, you MUST execute browser tools
2. NEVER say "I need to navigate" - ACTUALLY call browser_navigate
3. NEVER say "I would take a screenshot" - ACTUALLY call browser_screenshot  
4. NEVER say "I should extract" - ACTUALLY call browser_extract
5. Your responses MUST include actual tool execution results, not descriptions

If you describe actions instead of executing tools, you are failing your task.
You MUST execute browser_navigate, browser_screenshot, and browser_extract tools when visual analysis is needed."""
            else:
                role = f"{complexity.value.title()} Task Specialist"
                goal = "Deliver precise, context-aware assistance"
                backstory = "Veteran GeoSynth QC assistant trained on Dell System playbooks."
            
            agent = Agent(
                role=role,
                goal=goal,
                backstory=backstory,
                allow_delegation=True,
                verbose=True,  # Enable verbose for browser tool tasks to see execution
                llm=llm,
                tools=tools,
            )
            
            # CRITICAL: Verify agent's LLM model after Agent creation
            agent_llm = getattr(agent, 'llm', None)
            if agent_llm:
                agent_model = getattr(agent_llm, 'model_name', None) or getattr(agent_llm, 'model', None)
                logger.info(f"[_create_agent_for_task] Agent LLM model after creation: {agent_model}")
                if agent_model and agent_model != model_name:
                    logger.error(f"[_create_agent_for_task] ❌ AGENT MODEL MISMATCH! Expected {model_name} but agent has {agent_model}")
                    # Try to force set the model
                    if hasattr(agent_llm, 'model_name'):
                        agent_llm.model_name = model_name
                    if hasattr(agent_llm, 'model'):
                        agent_llm.model = model_name

            # CRITICAL FIX: NEVER use hierarchical with single agent - always sequential
            # Hierarchical processes REQUIRE multiple agents or manager LLM/agent
            # Single agent + hierarchical = validation error
            process = Process.sequential  # Always sequential for single agent
            logger.info(f"[_create_agent_for_task] Using Process.sequential for single agent (complexity={complexity.value})")
            return CrewAgentExecutor(agent, process=process, tools=tools, requires_browser_tools=requires_browser_tools)
        except Exception as error:
            logger.warning("Falling back to mock agent for %s: %s", model_name, error)
            return MockAgent(model_name, complexity)

    def _extract_requested_actions(self, message: str) -> List[Dict[str, Any]]:
        """Extract user-requested actions from message"""
        message_lower = message.lower()
        actions = []
        
        # Detect move/rearrange requests
        if any(word in message_lower for word in ["move", "rearrange", "reorder", "position"]):
            actions.append({
                "type": "rearrange_panels",
                "description": "User wants to move or rearrange panels"
            })
        
        # Detect click/interaction requests
        if any(word in message_lower for word in ["click", "select", "choose", "press"]):
            actions.append({
                "type": "interact",
                "description": "User wants to click or interact with UI elements"
            })
        
        # Detect form fill requests
        if any(word in message_lower for word in ["fill", "enter", "update", "change"]):
            actions.append({
                "type": "form_fill",
                "description": "User wants to fill or update form fields"
            })
        
        return actions

    def _combine_agent_outputs(self, workflow_result: Dict) -> str:
        """Combine outputs from multiple agents into coherent response"""
        if not isinstance(workflow_result, dict):
            return str(workflow_result)
        
        # Extract outputs from each agent task
        outputs = []
        
        # Navigator output
        if "navigate-to-panel-layout" in workflow_result:
            nav_output = workflow_result["navigate-to-panel-layout"]
            if isinstance(nav_output, dict):
                nav_text = nav_output.get("output", str(nav_output))
            else:
                nav_text = str(nav_output)
            outputs.append(f"✅ Navigation: {nav_text}")
        
        # Visual analyst output
        if "analyze-visual-layout" in workflow_result:
            visual_output = workflow_result["analyze-visual-layout"]
            if isinstance(visual_output, dict):
                visual_text = visual_output.get("output", str(visual_output))
            else:
                visual_text = str(visual_output)
            outputs.append(f"📊 Visual Analysis: {visual_text}")
        
        # Interaction executor output
        if "execute-user-actions" in workflow_result:
            action_output = workflow_result["execute-user-actions"]
            if isinstance(action_output, dict):
                action_text = action_output.get("output", str(action_output))
            else:
                action_text = str(action_output)
            outputs.append(f"⚙️ Actions Executed: {action_text}")
        
        # Validator output
        if "validate-results" in workflow_result:
            validation_output = workflow_result["validate-results"]
            if isinstance(validation_output, dict):
                validation_text = validation_output.get("output", str(validation_output))
            else:
                validation_text = str(validation_output)
            outputs.append(f"✓ Validation: {validation_text}")
        
        # Combine with workflow summary
        if "output" in workflow_result:
            return workflow_result["output"]
        
        return "\n\n".join(outputs) if outputs else "Workflow completed successfully."

    def _calculate_cost(self, model_name: str, tokens: int) -> float:
        """Calculate cost for using a specific model"""
        if model_name in self.cost_optimizer.models:
            config = self.cost_optimizer.models[model_name]
            return (tokens / 1000) * config.cost_per_1k_tokens
        return 0.0

    def _persist_orchestrator_manifest(self) -> None:
        """Write orchestrator capabilities to disk for other services to consume"""
        try:
            orchestrator = WorkflowOrchestrator(
                user_id="system",
                user_tier="system",
                cost_optimizer=self.cost_optimizer,
                tools=self.tools,
                context_store=self.context_store,
            )
            manifest = orchestrator.describe()
            payload = {
                "generatedAt": time.time(),
                "manifest": manifest,
            }
            self._manifest_path.write_text(json.dumps(payload, indent=2))
        except Exception as error:
            logger.warning("Unable to persist orchestrator manifest: %s", error)

    async def handle_chat_message(self, user_id: str, user_tier: str, message: str, context: Dict = None) -> Dict:
        """Handle chat messages with pre-flight automation and intelligent model routing"""
        context = context or {}
        logger.info(f"[handle_chat_message] Processing chat message from user {user_id} (tier: {user_tier})")
        
        try:
            # Analyze task complexity
            complexity = self.cost_optimizer.analyze_task_complexity(message, context)
            
            # Detect browser tool requirements
            message_lower = message.lower()
            context_str = str(context).lower()
            browser_tool_keywords = [
                "visual", "layout", "panel layout", "screenshot", "navigate", 
                "browser", "frontend", "page", "canvas", "ui", "interface",
                "see", "look", "display", "shown", "arrange", "position", "list", "show"
            ]
            requires_browser_tools = any(keyword in message_lower for keyword in browser_tool_keywords)
            if any(keyword in context_str for keyword in browser_tool_keywords + ["panel_layout_url", "visual_analysis", "panelLayoutUrl"]):
                requires_browser_tools = True
            
            logger.info(f"[handle_chat_message] Browser tools required: {requires_browser_tools}, Complexity: {complexity.value}")
            
            # Select optimal model (CRITICAL: Force GPT-4o for browser tools)
            optimal_model = self.cost_optimizer.select_optimal_model(complexity, user_tier, requires_browser_tools)
            logger.info(f"[handle_chat_message] Selected model: {optimal_model}")
            
            # Pre-flight automation for browser tool tasks
            preflight_success = False
            preflight_error = None
            automation_details = {}
            
            if requires_browser_tools:
                logger.info(f"[handle_chat_message] ===== PRE-FLIGHT AUTOMATION START =====")
                
                # Get panel layout URL from context
                panel_layout_url = context.get("panelLayoutUrl") or context.get("panel_layout_url")
                frontend_url = context.get("frontendUrl") or context.get("frontend_url", "http://localhost:3000")
                
                if panel_layout_url and not panel_layout_url.startswith("http"):
                    panel_layout_url = f"{frontend_url}{panel_layout_url}"
                
                if not panel_layout_url:
                    panel_layout_url = f"{frontend_url}/dashboard/projects/{context.get('projectId', 'unknown')}/panel-layout"
                
                logger.info(f"[handle_chat_message] Panel layout URL: {panel_layout_url}")
                
                session_id = f"panel-visual-{context.get('projectId', user_id)}"
                logger.info(f"[handle_chat_message] Session ID: {session_id}, User ID: {user_id}")
                
                try:
                    # STEP 1: Navigation
                    logger.info(f"[handle_chat_message] ═══ STEP 1: NAVIGATION ═══")
                    nav_tool = self.tools.get("browser_navigate")
                    if nav_tool:
                        # Set auth token and frontend URL for navigation
                        auth_token = context.get("auth_token") or context.get("authToken")
                        if hasattr(nav_tool, '_auth_token'):
                            nav_tool._auth_token = auth_token
                        if hasattr(nav_tool, '_frontend_url'):
                            nav_tool._frontend_url = frontend_url
                        
                        navigation_result = await nav_tool._arun(
                            action="navigate",
                            url=panel_layout_url,
                            wait_for="[data-testid='canvas-main']",
                            session_id=session_id,
                            user_id=user_id,
                            tab_id=None
                        )
                        
                        logger.info(f"[handle_chat_message] Navigation result type: {type(navigation_result)}")
                        if isinstance(navigation_result, dict):
                            nav_status = navigation_result.get("status", str(navigation_result))
                        else:
                            nav_status = str(navigation_result)
                        
                        logger.info(f"[handle_chat_message] Navigation status type: {type(nav_status)}, value: {nav_status}")
                        
                        # Check if navigation succeeded (including optional selector messages)
                        nav_success = (
                            "successfully navigated" in nav_status.lower() or
                            "navigation successful" in nav_status.lower() or
                            "optional selector" in nav_status.lower() or
                            "canvas not required" in nav_status.lower()
                        )
                        
                        logger.info(f"[handle_chat_message] {'✅' if nav_success else '❌'} Navigation {'succeeded' if nav_success else 'failed'}: {nav_status}")
                        automation_details["navigation"] = {"success": nav_success, "status": nav_status}
                    else:
                        logger.warning(f"[handle_chat_message] browser_navigate tool not available")
                        nav_success = False
                    
                    # STEP 2: Screenshot
                    logger.info(f"[handle_chat_message] ═══ STEP 2: SCREENSHOT ═══")
                    screenshot_tool = self.tools.get("browser_screenshot")
                    screenshot_success = False
                    if screenshot_tool and nav_success:
                        try:
                            screenshot_result = await screenshot_tool._arun(
                                full_page=True,
                                session_id=session_id,
                                user_id=user_id
                            )
                            screenshot_success = True
                            logger.info(f"[handle_chat_message] ✅ Screenshot successful: {len(str(screenshot_result))} chars")
                            automation_details["screenshot"] = {"success": True, "size": len(str(screenshot_result))}
                        except Exception as screenshot_error:
                            logger.error(f"[handle_chat_message] ❌ Screenshot failed: {screenshot_error}")
                            automation_details["screenshot"] = {"success": False, "error": str(screenshot_error)}
                    else:
                        logger.warning(f"[handle_chat_message] Screenshot skipped (nav_success={nav_success}, tool_available={screenshot_tool is not None})")
                    
                    # STEP 3: Panel Extraction
                    logger.info(f"[handle_chat_message] ═══ STEP 3: PANEL EXTRACTION ═══")
                    extraction_tool = self.tools.get("browser_extract")
                    extraction_success = False
                    if extraction_tool and nav_success:
                        try:
                            panel_result = await extraction_tool._arun(
                                action="panels",
                                session_id=session_id,
                                user_id=user_id
                            )
                            
                            # Check if extraction succeeded
                            if isinstance(panel_result, dict):
                                extraction_success = panel_result.get("success", False)
                            elif isinstance(panel_result, str):
                                try:
                                    import json
                                    parsed = json.loads(panel_result)
                                    extraction_success = parsed.get("success", False)
                                except:
                                    extraction_success = "success" in panel_result.lower() and "error" not in panel_result.lower()
                            
                            if extraction_success:
                                logger.info(f"[handle_chat_message] ✅ Panel extraction successful")
                                automation_details["extraction"] = {"success": True, "data": panel_result}
                            else:
                                logger.error(f"[handle_chat_message] ❌ Panel extraction failed: {panel_result}")
                                automation_details["extraction"] = {"success": False, "error": str(panel_result)}
                                preflight_error = f"Panel extraction failed: {panel_result}"
                        except Exception as extraction_error:
                            logger.error(f"[handle_chat_message] ❌ Panel extraction exception: {extraction_error}")
                            automation_details["extraction"] = {"success": False, "error": str(extraction_error)}
                            preflight_error = f"Panel extraction failed: {extraction_error}"
                    else:
                        logger.warning(f"[handle_chat_message] Panel extraction skipped (nav_success={nav_success}, tool_available={extraction_tool is not None})")
                    
                    # Determine overall pre-flight success
                    preflight_success = nav_success and screenshot_success
                    if not extraction_success:
                        logger.warning(f"[handle_chat_message] ⚠️ Pre-flight automation partially succeeded (navigation OK, but extraction failed)")
                        logger.warning(f"[handle_chat_message] Error details: {preflight_error}")
                    
                    logger.info(f"[handle_chat_message] ===== PRE-FLIGHT AUTOMATION COMPLETE =====")
                    logger.info(f"[handle_chat_message] Summary: nav={nav_success}, screenshot={screenshot_success}, extraction={extraction_success}, error={preflight_error is not None}")
                    
                except Exception as automation_error:
                    logger.error(f"[handle_chat_message] Pre-flight automation error: {automation_error}")
                    preflight_error = str(automation_error)
                    automation_details["error"] = str(automation_error)
            
            # Build enhanced context with pre-flight results
            enhanced_context = copy.deepcopy(context)
            enhanced_context["preflight_automation"] = {
                "success": preflight_success,
                "error": preflight_error,
                "details": automation_details
            }
            enhanced_context["frontendUrl"] = frontend_url
            enhanced_context["frontend_url"] = frontend_url
            
            # Route browser tools to multi-agent workflow
            if requires_browser_tools:
                logger.info(f"[handle_chat_message] Routing browser tool task to multi-agent workflow")
                
                try:
                    orchestrator = self.get_orchestrator(user_id, user_tier)
                    
                    # Extract requested actions from user message
                    requested_actions = self._extract_requested_actions(message)
                    
                    # Build workflow payload
                    workflow_payload = {
                        "panel_layout_url": panel_layout_url,
                        "frontend_url": frontend_url,
                        "user_id": user_id,
                        "session_id": session_id,
                        "user_message": message,
                        "user_context": enhanced_context,
                        "preflight_automation": {
                            "success": preflight_success,
                            "details": automation_details
                        },
                        "requested_actions": requested_actions,
                    }
                    
                    logger.info(f"[handle_chat_message] Executing multi-agent browser automation workflow")
                    workflow_result = await orchestrator.execute_workflow(
                        "multi_agent_browser_automation",
                        payload=workflow_payload,
                        metadata={
                            "trigger": "chat",
                            "source": "unified_ai_panel_workspace",
                            "user_id": user_id,
                            "user_tier": user_tier,
                            "project_id": context.get("projectId"),
                        }
                    )
                    
                    # Extract response from workflow
                    response = workflow_result.get("output", "")
                    if not response:
                        # Fallback: Combine agent outputs
                        response = self._combine_agent_outputs(workflow_result)
                    
                    logger.info(f"[handle_chat_message] Multi-agent workflow completed successfully")
                    
                    # Track usage
                    estimated_tokens = len(message.split()) * 1.3
                    estimated_cost = self._calculate_cost(optimal_model, estimated_tokens)
                    await self.cost_optimizer.track_usage(user_id, optimal_model, estimated_tokens, estimated_cost)
                    
                    return {
                        "reply": response,
                        "response": response,
                        "success": True,
                        "timestamp": time.time(),
                        "user_id": user_id,
                        "model_used": optimal_model,
                        "workflow_used": "multi_agent_browser_automation",
                        "agents_used": ["navigator", "visual_analyst", "interaction_executor", "validator"],
                        "complexity_level": complexity.value,
                        "estimated_cost": estimated_cost,
                        "browser_tools_required": True,
                        "preflight_automation": {
                            "success": preflight_success,
                            "error": preflight_error,
                            "details": automation_details
                        },
                        "workflow_details": workflow_result.get("details", {}),
                    }
                except Exception as workflow_error:
                    logger.error(f"[handle_chat_message] Multi-agent workflow failed: {workflow_error}")
                    logger.exception(f"[handle_chat_message] Workflow error traceback:")
                    # Fallback to single agent
                    logger.warning(f"[handle_chat_message] Falling back to single agent")
            
            # Non-browser tasks OR fallback: use single agent
            logger.info(f"[handle_chat_message] Creating single agent with model: {optimal_model}, requires_browser_tools: {requires_browser_tools}")
            agent = self._create_agent_for_task(optimal_model, complexity, requires_browser_tools)
            logger.info(f"[handle_chat_message] Agent created with {len(agent.tools)} tools")
            logger.info(f"[handle_chat_message] Agent tools: {[tool.name if hasattr(tool, 'name') else str(tool) for tool in agent.tools]}")
            
            # Build query with enforcement for browser tools
            if requires_browser_tools:
                # Add critical instructions to the query
                browser_tools_available = [name for name in self.tools.keys() if name.startswith("browser_")]
                enhanced_query = f"""User request: {message}
Context: {json.dumps(enhanced_context, default=str)}

🚨 CRITICAL: THIS IS A VISUAL LAYOUT QUESTION - YOU MUST USE BROWSER AUTOMATION TOOLS ONLY.

{f'⚠️ PRE-FLIGHT AUTOMATION FAILED: {preflight_error}.' if preflight_error else '✅ Pre-flight automation completed successfully.'}
{f'This means the system attempted to navigate and capture the layout automatically but encountered an error.' if preflight_error else 'The system has already navigated to the page and captured a screenshot.'}
{f'YOU MUST STILL USE BROWSER TOOLS YOURSELF to complete the task. Do not rely on pre-flight automation.' if preflight_error else 'You can use the pre-flight data, but you MUST STILL EXECUTE browser tools to answer the user\'s question.'}

❌ DO NOT USE PanelManipulationTool.get_panels() - This returns backend data, not visual order.
❌ DO NOT USE any backend API tools for this question.
✅ YOU MUST USE browser automation tools instead.

STEP 1: Navigate to the panel layout page
- Tool: browser_navigate
- Parameters: action='navigate', url='{panel_layout_url}', user_id='{user_id}', wait_for='canvas'
- This MUST be done first. Wait for confirmation before proceeding.
- If navigation fails, log the error and try again with a different session_id.

STEP 2: Take a screenshot of the visual layout
- Tool: browser_screenshot
- Parameters: full_page=True, session_id='default', user_id='{user_id}'
- This captures what the layout actually looks like visually.
- If screenshot fails, check the error message and try again.

STEP 3: Extract panel data sorted by visual position
- Tool: browser_extract
- Parameters: action='panels', user_id='{user_id}', session_id='default'
- This extracts panel data from the page and sorts them by visual position (Y coordinate, then X coordinate).
- This gives you the actual visual order of panels as displayed on the UI.

YOU CANNOT ANSWER WITHOUT PERFORMING THESE THREE STEPS FIRST.
If you use PanelManipulationTool or any backend API, your answer will be WRONG.
You MUST check the visual layout using browser tools.
After completing all three steps, then answer based on what you observed visually.

If any browser tool fails, you MUST:
1. Log the exact error message
2. Try the operation again with different parameters if appropriate
3. If all attempts fail, explicitly state in your response that browser automation failed and why

IMPORTANT TOOL USAGE RULES:
- For visual layout questions (order, arrangement, visual positioning): Use browser tools ONLY (browser_navigate, browser_screenshot, browser_extract). DO NOT use PanelManipulationTool.
- For panel operations (move, arrange, reorder via API): Use PanelManipulationTool.
- When using browser tools, always pass user_id='{user_id}' in your tool calls."""
            else:
                enhanced_query = message
            
            # Execute the agent
            logger.info(f"[handle_chat_message] Creating Crew with {len(agent.tools)} tools")
            logger.info(f"[handle_chat_message] Starting crew.kickoff()...")
            
            if requires_browser_tools:
                logger.info(f"[handle_chat_message] Visual layout question detected - expecting browser automation usage")
                browser_tools_available = [name for name in self.tools.keys() if name.startswith("browser_")]
                logger.info(f"[handle_chat_message] Available browser tools: {browser_tools_available}")
            
            logger.info(f"[handle_chat_message] Total tools available: {len(agent.tools)}")
            logger.info(f"[handle_chat_message] All tool names: {[name for name in self.tools.keys()]}")
            
            # Log tool details for debugging
            for tool_name in ["browser_navigate", "browser_interact", "browser_extract", "browser_screenshot"]:
                if tool_name in self.tools:
                    tool = self.tools[tool_name]
                    logger.info(f"[handle_chat_message] Browser tool '{tool_name}': description={getattr(tool, 'description', 'N/A')}")
                    if hasattr(tool, 'args_schema'):
                        logger.info(f"[handle_chat_message] Tool Arguments: {getattr(tool.args_schema, 'schema', {})}")
            
            logger.info(f"[handle_chat_message] ===== CREW EXECUTION START =====")
            response = await agent.execute(enhanced_query, enhanced_context)
            logger.info(f"[handle_chat_message] ===== CREW EXECUTION COMPLETE =====")
            
            # Validate response for browser tool tasks
            if requires_browser_tools:
                response_lower = response.lower()
                browser_tool_indicators = [
                    "browser_navigate", "browser_screenshot", "browser_extract",
                    "navigation successful", "screenshot captured", "extracted panels"
                ]
                has_browser_tools = any(indicator in response_lower for indicator in browser_tool_indicators)
                
                if not has_browser_tools:
                    logger.warning(f"[handle_chat_message] ⚠️ Visual layout question but NO browser tools detected in response!")
                    logger.warning(f"[handle_chat_message] Response preview: {response[:200]}...")
                    logger.warning(f"[handle_chat_message] This suggests the agent may not have used browser tools as instructed.")
                    logger.error(f"[handle_chat_message] ❌ CRITICAL: Visual layout question but browser automation was NOT used!")
                    logger.error(f"[handle_chat_message] Pre-flight automation succeeded: {preflight_success}")
                    logger.error(f"[handle_chat_message] Browser tools detected in response: {has_browser_tools}")
                    logger.error(f"[handle_chat_message] Available browser tools: {browser_tools_available}")
                    logger.warning(f"[handle_chat_message] Browser automation failed: {preflight_error}")
            
            # Track usage
            estimated_tokens = len(message.split()) * 1.3
            estimated_cost = self._calculate_cost(optimal_model, estimated_tokens)
            await self.cost_optimizer.track_usage(user_id, optimal_model, estimated_tokens, estimated_cost)
            
            logger.info(f"[handle_chat_message] Extracted response length: {len(response)} characters")
            
            return {
                "reply": response,
                "response": response,
                "success": True,
                "timestamp": time.time(),
                "user_id": user_id,
                "model_used": optimal_model,
                "complexity_level": complexity.value,
                "estimated_cost": estimated_cost,
                "browser_tools_required": requires_browser_tools,
                "preflight_automation": {
                    "success": preflight_success,
                    "error": preflight_error,
                    "details": automation_details
                }
            }
            
        except Exception as e:
            logger.error(f"[handle_chat_message] Error handling chat message: {e}")
            logger.exception(f"[handle_chat_message] Full traceback:")
            return {
                "reply": f"I encountered an error processing your request: {str(e)}",
                "response": f"I encountered an error processing your request: {str(e)}",
                "success": False,
                "error": str(e),
                "timestamp": time.time(),
                "user_id": user_id
            }

    async def shutdown(self) -> None:
        """Cleanup resources such as browser sessions."""
        await self.browser_sessions.shutdown()

class MockAgent:
    """Mock agent for testing - replace with actual CrewAI agent"""

    def __init__(self, model_name: str, complexity: TaskComplexity):
        self.model_name = model_name
        self.complexity = complexity

    async def execute(self, query: str, context: Dict = None) -> str:
        """Mock execution - replace with actual agent logic"""
        return f"Mock response from {self.model_name} for {self.complexity.value} task: {query}"


class WorkflowOrchestrator:
    """Orchestrates collaborative workflows with multiple agents"""

    _BASE_BLUEPRINTS: Optional[Dict[str, WorkflowBlueprint]] = None

    def __init__(
        self,
        user_id: str,
        user_tier: str,
        cost_optimizer: CostOptimizer,
        tools: Dict[str, BaseTool],
        context_store: SharedContextStore,
    ) -> None:
        self.user_id = user_id
        self.user_tier = user_tier
        self.cost_optimizer = cost_optimizer
        self.tools = tools
        self.context_store = context_store
        self.blueprints: Dict[str, WorkflowBlueprint] = copy.deepcopy(self._ensure_base_blueprints())

    @classmethod
    def _ensure_base_blueprints(cls) -> Dict[str, WorkflowBlueprint]:
        if cls._BASE_BLUEPRINTS is not None:
            return cls._BASE_BLUEPRINTS

        cls._BASE_BLUEPRINTS = {
            "new_project_setup": WorkflowBlueprint(
                id="new_project_setup",
                name="New Project Setup",
                description="Configure a new GeoSynth QC project with quality and documentation guardrails",
                process=Process.hierarchical,
                agents={
                    "config": AgentProfile(
                        name="Configuration Lead",
                        role="Project Configuration Specialist",
                        goal="Assemble an end-to-end QC workflow tailored to project constraints",
                        backstory="Veteran PM who has launched hundreds of geosynthetic projects.",
                        complexity=TaskComplexity.MODERATE,
                        tools=[],
                    ),
                    "qa": AgentProfile(
                        name="Quality Analyst",
                        role="Quality and Compliance Analyst",
                        goal="Ensure every configured step satisfies compliance requirements",
                        backstory="Meticulous auditor focused on specification adherence.",
                        complexity=TaskComplexity.COMPLEX,
                        tools=[],
                    ),
                    "reporter": AgentProfile(
                        name="Communication Specialist",
                        role="Executive Report Author",
                        goal="Translate configuration outcomes into executive summaries",
                        backstory="Former consultant tasked with briefing stakeholders.",
                        complexity=TaskComplexity.SIMPLE,
                        tools=[],
                    ),
                },
                tasks=[
                    WorkflowTaskTemplate(
                        id="gather-requirements",
                        description="Evaluate provided project data and draft a workflow outline",
                        agent="config",
                        expected_output="A workflow outline with recommended automations",
                        context_keys=["project", "payload"],
                    ),
                    WorkflowTaskTemplate(
                        id="quality-review",
                        description="Validate the proposed outline against quality and compliance constraints",
                        agent="qa",
                        expected_output="A list of risks and the mitigations applied",
                        context_keys=["project", "history"],
                    ),
                    WorkflowTaskTemplate(
                        id="executive-brief",
                        description="Summarize the approved plan with stakeholder-ready messaging",
                        agent="reporter",
                        expected_output="Executive summary highlighting automation coverage",
                        context_keys=["history"],
                    ),
                ],
            ),
            "panel_optimization": WorkflowBlueprint(
                id="panel_optimization",
                name="Panel Optimization",
                description="Optimize panel layout with engineering and compliance review",
                process=Process.sequential,  # Changed from Process.parallel (doesn't exist) - agents run sequentially
                agents={
                    "optimizer": AgentProfile(
                        name="Layout Optimizer",
                        role="Panel Layout Optimizer",
                        goal="Design the highest efficiency layout respecting constraints",
                        backstory="Geometric optimization specialist",
                        complexity=TaskComplexity.COMPLEX,
                        tools=[],
                    ),
                    "compliance": AgentProfile(
                        name="Compliance Partner",
                        role="Specification Compliance Officer",
                        goal="Ensure optimized layout respects specifications",
                        backstory="Expert in specification governance",
                        complexity=TaskComplexity.MODERATE,
                        tools=[],
                    ),
                },
                tasks=[
                    WorkflowTaskTemplate(
                        id="generate-optimization",
                        description="Generate an optimized panel layout with key metrics",
                        agent="optimizer",
                        expected_output="Optimized layout proposal with metrics",
                        context_keys=["payload", "shared"],
                    ),
                    WorkflowTaskTemplate(
                        id="compliance-check",
                        description="Review the optimization for specification and constructability issues",
                        agent="compliance",
                        expected_output="Compliance evaluation with recommendations",
                        context_keys=["payload", "history"],
                    ),
                ],
            ),
            "web_automation": WorkflowBlueprint(
                id="web_automation",
                name="Browser Automation",
                description="Automate navigation, interactions, and data capture from approved web applications",
                process=Process.sequential,
                agents={
                    "web_automation": AgentProfile(
                        name="Web Automation Specialist",
                        role="Headless Browser Operator",
                        goal="Safely execute browser interactions to gather data or complete workflows",
                        backstory="Automation engineer trained to work within security guardrails.",
                        complexity=TaskComplexity.MODERATE,
                        tools=[
                            "browser_navigate",
                            "browser_interact",
                            "browser_extract",
                            "browser_screenshot",
                            "browser_vision_analyze",
                            "browser_realtime",
                            "browser_performance",
                        ],
                    ),
                },
                tasks=[
                    WorkflowTaskTemplate(
                        id="navigate-to-target",
                        description="Open the requested page and confirm it matches allowed domains",
                        agent="web_automation",
                        expected_output="Confirmation of navigation with any gating issues",
                        context_keys=["payload"],
                    ),
                    WorkflowTaskTemplate(
                        id="perform-interactions",
                        description="Execute the form fills, clicks, drags, or downloads specified in the request. After each interaction capture a screenshot and run vision analysis to verify UI state and surface errors.",
                        agent="web_automation",
                        expected_output="List of interactions performed with success state and any vision insights",
                        context_keys=["payload", "history"],
                    ),
                    WorkflowTaskTemplate(
                        id="collect-artifacts",
                        description="Extract requested data, capture before/after screenshots, and summarize any console, network, or realtime events relevant to the task",
                        agent="web_automation",
                        expected_output="Extracted data payloads, screenshot references, and notable runtime events",
                        context_keys=["payload"],
                    ),
                ],
            ),
            "multi_agent_browser_automation": WorkflowBlueprint(
                id="multi_agent_browser_automation",
                name="Multi-Agent Browser Automation",
                description="Collaborative browser automation with specialized agents for navigation, analysis, execution, and validation",
                process=Process.sequential,  # Sequential because agents depend on each other
                agents={
                    "navigator": AgentProfile(
                        name="Navigation Specialist",
                        role="Browser Navigation Coordinator",
                        goal="Navigate to target pages, verify page loads, handle redirects and authentication",
                        backstory="Expert browser navigator with deep understanding of web routing, authentication flows, and page load verification. Specializes in getting to the right page reliably.",
                        complexity=TaskComplexity.MODERATE,
                        tools=[
                            "browser_navigate",
                            "browser_screenshot",  # For verification
                        ],
                    ),
                    "visual_analyst": AgentProfile(
                        name="Visual Layout Analyst",
                        role="Visual Layout Specialist",
                        goal="Capture and analyze visual state of panel layouts, extract panel data sorted by visual position",
                        backstory="Visual analysis expert trained to understand spatial layouts, panel arrangements, and UI state. Specializes in extracting meaningful data from visual representations.",
                        complexity=TaskComplexity.COMPLEX,
                        tools=[
                            "browser_screenshot",
                            "browser_vision_analyze",
                            "browser_extract",
                        ],
                    ),
                    "interaction_executor": AgentProfile(
                        name="Interaction Specialist",
                        role="UI Interaction Executor",
                        goal="Execute user-requested actions on the panel layout (move panels, click buttons, fill forms, update positions)",
                        backstory="UI automation specialist with expertise in precise element interaction, drag-and-drop operations, and form manipulation. Ensures actions are executed accurately.",
                        complexity=TaskComplexity.COMPLEX,
                        tools=[
                            "browser_interact",
                            "browser_extract",
                            "browser_screenshot",  # Before/after verification
                        ],
                    ),
                    "validator": AgentProfile(
                        name="Validation Coordinator",
                        role="Quality Assurance Validator",
                        goal="Verify actions completed correctly, validate data integrity, catch errors, and generate validation reports",
                        backstory="QA specialist focused on validation and error detection. Reviews agent outputs, verifies data consistency, and ensures all actions completed successfully.",
                        complexity=TaskComplexity.MODERATE,
                        tools=[
                            "browser_extract",
                            "browser_screenshot",
                            "browser_performance",
                            "browser_realtime",  # For error detection
                        ],
                    ),
                },
                tasks=[
                    WorkflowTaskTemplate(
                        id="navigate-to-panel-layout",
                        description="Navigate to the panel layout page specified in the context. Verify the page loaded successfully, handle any authentication redirects, and confirm the canvas element is present.",
                        agent="navigator",
                        expected_output="Navigation confirmation with page URL, load status, and canvas element verification",
                        context_keys=["payload", "panel_layout_url"],
                    ),
                    WorkflowTaskTemplate(
                        id="analyze-visual-layout",
                        description="Capture a screenshot of the current panel layout, analyze the visual arrangement using vision analysis, and extract panel data sorted by visual position (Y coordinate, then X coordinate).",
                        agent="visual_analyst",
                        expected_output="Screenshot reference, visual analysis results, and extracted panel data with visual positioning",
                        context_keys=["payload", "history"],
                    ),
                    WorkflowTaskTemplate(
                        id="execute-user-actions",
                        description="Execute any user-requested actions on the panel layout (if actions are specified). This includes moving panels, clicking buttons, filling forms, or updating panel positions. Capture before/after screenshots to verify changes.",
                        agent="interaction_executor",
                        expected_output="List of actions performed, before/after screenshots, and updated panel state",
                        context_keys=["payload", "history", "user_message"],
                    ),
                    WorkflowTaskTemplate(
                        id="validate-results",
                        description="Verify all actions completed successfully, validate the extracted panel data for consistency, check for any errors in the browser console or network requests, and generate a comprehensive validation report.",
                        agent="validator",
                        expected_output="Validation report with success status, data integrity checks, error detection, and final panel state",
                        context_keys=["payload", "history"],
                    ),
                ],
            ),
        }
        return cls._BASE_BLUEPRINTS

    def register_workflow(self, blueprint: WorkflowBlueprint, override: bool = False) -> None:
        if blueprint.id in self.blueprints and not override:
            raise ValueError(f"Workflow '{blueprint.id}' already registered")
        self.blueprints[blueprint.id] = blueprint

    async def execute_new_project_workflow(self, project_data: Dict) -> Dict:
        return await self.execute_workflow("new_project_setup", project_data, metadata={"trigger": "api"})

    async def execute_panel_optimization_workflow(self, panel_data: Dict) -> Dict:
        return await self.execute_workflow("panel_optimization", panel_data, metadata={"trigger": "api"})

    async def execute_workflow(self, workflow_id: str, payload: Optional[Dict[str, Any]], metadata: Optional[Dict[str, Any]] = None) -> Dict:
        if workflow_id not in self.blueprints:
            raise ValueError(f"Unknown workflow: {workflow_id}")

        blueprint = self.blueprints[workflow_id]
        logger.info(
            "🚀 [WorkflowOrchestrator] Starting workflow '%s' with tasks: %s",
            workflow_id,
            [task.id for task in blueprint.tasks],
        )
        shared_context = await self.context_store.load(self.user_id)
        collaboration = CollaborationChannel()
        await collaboration.publish("system", "Workflow kickoff", {"workflowId": workflow_id})

        agents: Dict[str, Agent] = {}
        fallback: Dict[str, MockAgent] = {}
        models_used: Dict[str, str] = {}

        for key, profile in blueprint.agents.items():
            # Detect if browser tools are required for this agent
            requires_browser_tools = any(
                tool_name.startswith("browser_") for tool_name in profile.tools
            )
            
            model_name = profile.model_hint or self.cost_optimizer.select_optimal_model(
                profile.complexity, 
                self.user_tier, 
                requires_browser_tools=requires_browser_tools
            )
            
            try:
                # CRITICAL: Always force GPT-4o - never use GPT-3.5
                if model_name != "gpt-4o":
                    logger.warning(f"[WorkflowOrchestrator] ⚠️ Model override: {model_name} -> gpt-4o")
                    model_name = "gpt-4o"
                
                # Explicitly set model parameter to prevent any override
                llm = ChatOpenAI(
                    model=model_name,
                    temperature=0,
                    openai_api_key=os.getenv("OPENAI_API_KEY")  # Explicit API key to prevent fallback
                )
                
                # Strengthen backstory for browser tool agents
                if requires_browser_tools:
                    enhanced_backstory = f"""{profile.backstory}

CRITICAL: You have access to browser automation tools. When tasks require visual analysis or UI interaction:
- ALWAYS execute browser_navigate, browser_screenshot, browser_extract tools
- NEVER describe what you would do - ACTUALLY execute the tools
- Your responses MUST include actual tool execution results"""
                else:
                    enhanced_backstory = profile.backstory
                
                agent = Agent(
                    role=profile.role,
                    goal=profile.goal,
                    backstory=enhanced_backstory,
                    allow_delegation=profile.allow_delegation,
                    verbose=requires_browser_tools,  # Enable verbose for browser tool agents
                    llm=llm,
                    tools=[self.tools[name] for name in profile.tools if name in self.tools],
                )
                agents[key] = agent
                models_used[key] = model_name
                await collaboration.publish(profile.name, "Ready to collaborate", {"model": model_name, "browser_tools": requires_browser_tools})
            except Exception as error:
                logger.warning("Falling back to mock agent for %s: %s", key, error)
                fallback[key] = MockAgent(model_name, profile.complexity)
                await collaboration.publish(profile.name, "Operating in mock mode", {"model": model_name})

        result: Dict[str, Any] = {}
        collaboration_log: List[Dict[str, Any]]

        try:
            if fallback:
                # Run a lightweight collaborative simulation when real agents are unavailable
                logger.info(
                    "🛟 [WorkflowOrchestrator] Using %d fallback agents for workflow %s",
                    len(fallback),
                    workflow_id,
                )
                for task_template in blueprint.tasks:
                    agent_key = task_template.agent
                    agent_profile = blueprint.agents[agent_key]
                    message = f"{task_template.description}\nPayload: {json.dumps(payload or {}, default=str)}"
                    task_result = await fallback[agent_key].execute(message, context=shared_context)
                    result[task_template.id] = {
                        "agent": agent_profile.name,
                        "status": "mock",
                        "output": task_result,
                    }
                    await collaboration.publish(agent_profile.name, "Completed mock task", {"task": task_template.id})
            else:
                crew_tasks: List[Task] = []
                for task_template in blueprint.tasks:
                    agent = agents[task_template.agent]
                    task = Task(
                        description=task_template.description,
                        agent=agent,
                        expected_output=task_template.expected_output,
                        tools=getattr(agent, "tools", None),
                    )
                    crew_tasks.append(task)

                crew = Crew(
                    agents=list(agents.values()),
                    tasks=crew_tasks,
                    process=blueprint.process,
                    verbose=False,
                    share_crew=True,
                )
                logger.info(
                    "🧠 [WorkflowOrchestrator] Executing workflow %s with %d live agents",
                    workflow_id,
                    len(crew.agents),
                )

                crew_inputs = {
                    "payload": payload or {},
                    "shared": shared_context,
                    "metadata": metadata or {},
                }

                crew_result = await asyncio.to_thread(crew.kickoff, crew_inputs)
                if isinstance(crew_result, dict):
                    result = crew_result
                else:
                    result = {"output": crew_result}

            await collaboration.publish("system", "Workflow completed", {"status": "success"})
        except Exception as error:
            await collaboration.publish("system", "Workflow failed", {"error": str(error)})
            logger.error("Workflow %s failed: %s", workflow_id, error)
            raise
        finally:
            collaboration_log = await collaboration.snapshot()

        history_entry = {
            "workflowId": workflow_id,
            "result": result,
            "timestamp": time.time(),
            "metadata": metadata or {},
            "models": models_used,
            "collaboration": collaboration_log,
        }
        logger.info(
            "🏁 [WorkflowOrchestrator] Workflow '%s' finished with outputs: %s",
            workflow_id,
            list(result.keys()) or ["<empty>"],
        )

        updated_context = await self.context_store.append_history(self.user_id, history_entry)

        return {
            "workflowId": workflow_id,
            "name": blueprint.name,
            "description": blueprint.description,
            "status": "completed",
            "result": result,
            "collaboration": collaboration_log,
            "models": models_used,
            "context": updated_context,
            "metadata": metadata or {},
        }

    def describe(self) -> Dict[str, Any]:
        """Return metadata about registered workflows and capabilities"""
        return {
            "capabilities": {
                "multiAgent": True,
                "delegation": True,
                "sharedContext": True,
                "realTimeCollaboration": True,
                "dynamicWorkflows": True,
            },
            "workflows": [
                {
                    "id": blueprint.id,
                    "name": blueprint.name,
                    "description": blueprint.description,
                    "process": blueprint.process.name,
                    "agents": [
                        {
                            "key": key,
                            "name": profile.name,
                            "role": profile.role,
                            "goal": profile.goal,
                            "complexity": profile.complexity.value,
                            "tools": profile.tools,
                            "allowDelegation": profile.allow_delegation,
                        }
                        for key, profile in blueprint.agents.items()
                    ],
                    "tasks": [
                        {
                            "id": task.id,
                            "description": task.description,
                            "agent": task.agent,
                            "expectedOutput": task.expected_output,
                        }
                        for task in blueprint.tasks
                    ],
                }
                for blueprint in self.blueprints.values()
            ],
        }

# Configuration and initialization
def create_ai_service(redis_url: str = "redis://localhost:6379") -> DellSystemAIService:
    """Create and configure the AI service"""
    try:
        redis_client = redis.from_url(redis_url)
        return DellSystemAIService(redis_client)
    except Exception as e:
        logger.error(f"Failed to create AI service: {e}")
        raise
