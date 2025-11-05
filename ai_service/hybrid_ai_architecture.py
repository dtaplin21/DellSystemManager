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

from .browser_tools import (
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
from .openai_service import OpenAIService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

    def __init__(self, agent: Agent, process: Process = Process.sequential, tools: Optional[List[BaseTool]] = None):
        self.agent = agent
        self.process = process
        self.tools = tools or []

    async def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> str:
        task = Task(
            description=f"Respond to the following request with actionable insight: {query}",
            agent=self.agent,
            expected_output="A concise, domain specific response",
            tools=self.tools,
        )

        crew = Crew(
            agents=[self.agent],
            tasks=[task],
            process=self.process,
            verbose=False,
            share_crew=True,
        )

        result = await asyncio.to_thread(
            crew.kickoff,
            {"user_context": context or {}, "query": query},
        )

        if isinstance(result, dict) and "output" in result:
            return result["output"]
        return str(result)

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
            "gpt-3.5-turbo": ModelConfig(
                name="gpt-3.5-turbo",
                provider=ModelProvider.OPENAI,
                cost_per_1k_tokens=0.002,
                max_tokens=4096,
                capabilities=["text", "reasoning"]
            ),
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
    
    def select_optimal_model(self, complexity: TaskComplexity, user_tier: str) -> str:
        """Select optimal model based on complexity and user tier"""
        if user_tier == "free_user":
            return "gpt-3.5-turbo"
        elif complexity in [TaskComplexity.SIMPLE, TaskComplexity.MODERATE]:
            return "gpt-3.5-turbo"
        elif complexity == TaskComplexity.COMPLEX:
            return "gpt-4o"
        else:  # EXPERT
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
            
            # Select optimal model
            optimal_model = self.cost_optimizer.select_optimal_model(complexity, user_tier)
            
            # Create appropriate agent for the task
            agent = self._create_agent_for_task(optimal_model, complexity)
            
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
                "estimated_cost": estimated_cost
            }
            
        except Exception as e:
            logger.error(f"Error handling query: {e}")
            return {"error": str(e), "fallback": True}

    def _create_agent_for_task(self, model_name: str, complexity: TaskComplexity):
        """Create an appropriate agent for the given task complexity"""
        tools = list(self.tools.values())

        try:
            llm = ChatOpenAI(model=model_name, temperature=0)
            agent = Agent(
                role=f"{complexity.value.title()} Task Specialist",
                goal="Deliver precise, context-aware assistance",
                backstory="Veteran GeoSynth QC assistant trained on Dell System playbooks.",
                allow_delegation=True,
                verbose=False,
                llm=llm,
                tools=tools,
            )

            process = Process.hierarchical if complexity in (TaskComplexity.COMPLEX, TaskComplexity.EXPERT) else Process.sequential
            return CrewAgentExecutor(agent, process=process, tools=tools)
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
        shared_context = await self.context_store.load(self.user_id)
        collaboration = CollaborationChannel()
        await collaboration.publish("system", "Workflow kickoff", {"workflowId": workflow_id})

        agents: Dict[str, Agent] = {}
        fallback: Dict[str, MockAgent] = {}
        models_used: Dict[str, str] = {}

        for key, profile in blueprint.agents.items():
            model_name = profile.model_hint or self.cost_optimizer.select_optimal_model(profile.complexity, self.user_tier)
            try:
                llm = ChatOpenAI(model=model_name, temperature=0)
                agent = Agent(
                    role=profile.role,
                    goal=profile.goal,
                    backstory=profile.backstory,
                    allow_delegation=profile.allow_delegation,
                    verbose=False,
                    llm=llm,
                    tools=[self.tools[name] for name in profile.tools if name in self.tools],
                )
                agents[key] = agent
                models_used[key] = model_name
                await collaboration.publish(profile.name, "Ready to collaborate", {"model": model_name})
            except Exception as error:
                logger.warning("Falling back to mock agent for %s: %s", key, error)
                fallback[key] = MockAgent(model_name, profile.complexity)
                await collaboration.publish(profile.name, "Operating in mock mode", {"model": model_name})

        result: Dict[str, Any] = {}
        collaboration_log: List[Dict[str, Any]]

        try:
            if fallback:
                # Run a lightweight collaborative simulation when real agents are unavailable
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
