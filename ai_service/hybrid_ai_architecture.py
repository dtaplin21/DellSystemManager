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
from typing import Any, Dict, List, Optional

import redis
from crewai import Agent, Crew, Process, Task
from crewai.tools import BaseTool
from langchain_openai import ChatOpenAI

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
    
    def track_usage(self, user_id: str, model: str, tokens: int, cost: float):
        """Track usage for cost optimization"""
        # Implementation for usage tracking
        pass

# === TOOL DEFINITIONS ===
class BaseTool:
    """Base class for all AI tools"""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
    
    async def execute(self, **kwargs) -> Dict:
        """Execute the tool - to be implemented by subclasses"""
        raise NotImplementedError

class PanelLayoutOptimizer(BaseTool):
    """Tool for optimizing panel layouts"""
    
    def __init__(self):
        super().__init__(
            name="panel_layout_optimizer",
            description="Optimizes panel layouts for maximum efficiency and coverage"
        )
    
    async def execute(self, panel_data: Dict, constraints: Dict) -> Dict:
        """Optimize panel layout based on constraints"""
        # Mock implementation - replace with actual optimization logic
        return {
            "optimized_layout": panel_data,
            "efficiency_score": 0.85,
            "recommendations": ["Consider rotating panels 45 degrees for better coverage"]
        }

class DocumentAnalyzer(BaseTool):
    """Tool for analyzing documents and extracting insights"""
    
    def __init__(self):
        super().__init__(
            name="document_analyzer",
            description="Analyzes documents to extract key information and insights"
        )
    
    async def execute(self, document_content: str, analysis_type: str) -> Dict:
        """Analyze document content"""
        # Mock implementation - replace with actual document analysis
        return {
            "analysis_type": analysis_type,
            "key_insights": ["Document contains technical specifications", "Multiple panel types identified"],
            "confidence_score": 0.92
        }

class ProjectConfigAgent(BaseTool):
    """Tool for configuring new projects"""
    
    def __init__(self):
        super().__init__(
            name="project_config_agent",
            description="Configures new projects with optimal settings and workflows"
        )
    
    async def execute(self, project_requirements: Dict) -> Dict:
        """Configure project based on requirements"""
        # Mock implementation - replace with actual project configuration
        return {
            "project_config": {
                "workflow": "standard_optimization",
                "quality_checks": ["panel_alignment", "coverage_analysis"],
                "estimated_duration": "2-3 hours"
            }
        }

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
        """Initialize available tools"""
        tools = {
            "panel_optimizer": PanelLayoutOptimizer(),
            "document_analyzer": DocumentAnalyzer(),
            "project_config": ProjectConfigAgent(),
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

            process = Process.hierarchical if complexity in (TaskComplexity.COMPLEX, TaskComplexity.EXPERT) else Process.sequential
            return CrewAgentExecutor(agent, process=process, tools=tools, requires_browser_tools=requires_browser_tools)
        except Exception as error:
            logger.warning("Falling back to mock agent for %s: %s", model_name, error)
            return MockAgent(model_name, complexity)

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
            
            # Create agent with proper configuration
            logger.info(f"[handle_chat_message] Creating agent with model: {optimal_model}, requires_browser_tools: {requires_browser_tools}")
            agent = self._create_agent_for_task(optimal_model, complexity, requires_browser_tools)
            logger.info(f"[handle_chat_message] Agent created with {len(agent.tools)} tools")
            logger.info(f"[handle_chat_message] Agent tools: {[tool.name if hasattr(tool, 'name') else str(tool) for tool in agent.tools]}")
            
            # Build enhanced context with pre-flight results
            enhanced_context = copy.deepcopy(context)
            enhanced_context["preflight_automation"] = {
                "success": preflight_success,
                "error": preflight_error,
                "details": automation_details
            }
            enhanced_context["frontendUrl"] = frontend_url
            enhanced_context["frontend_url"] = frontend_url
            
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
                        tools=["project_config"],
                    ),
                    "qa": AgentProfile(
                        name="Quality Analyst",
                        role="Quality and Compliance Analyst",
                        goal="Ensure every configured step satisfies compliance requirements",
                        backstory="Meticulous auditor focused on specification adherence.",
                        complexity=TaskComplexity.COMPLEX,
                        tools=["document_analyzer"],
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
                process=Process.parallel,
                agents={
                    "optimizer": AgentProfile(
                        name="Layout Optimizer",
                        role="Panel Layout Optimizer",
                        goal="Design the highest efficiency layout respecting constraints",
                        backstory="Geometric optimization specialist",
                        complexity=TaskComplexity.COMPLEX,
                        tools=["panel_optimizer"],
                    ),
                    "compliance": AgentProfile(
                        name="Compliance Partner",
                        role="Specification Compliance Officer",
                        goal="Ensure optimized layout respects specifications",
                        backstory="Expert in specification governance",
                        complexity=TaskComplexity.MODERATE,
                        tools=["document_analyzer"],
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
