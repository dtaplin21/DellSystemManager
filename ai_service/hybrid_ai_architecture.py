# Hybrid AI Architecture: Combining Framework + Practical Implementation
# This merges the cost-efficient, scalable framework with direct file integration

import asyncio
import os
import json
import logging
from typing import Dict, List, Optional, Union, Any
from dataclasses import dataclass
from enum import Enum
from abc import ABC, abstractmethod
import redis
from crewai import Agent, Task, Crew
from langchain.tools import BaseTool
from langchain.llms import OpenAI
import ollama
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
            self.redis.setex(f"usage:{user_tier}", 3600, str(new_usage))  # 1 hour expiry
        except Exception as e:
            logger.error(f"Failed to track usage: {e}")

# === PRACTICAL LAYER (User's Implementation) ===
# Direct integration with existing files using CrewAI

class LayoutOptimizerTool(BaseTool):
    """Tool that connects to your existing geometry.py"""
    name = "layout_optimizer"
    description = "Optimizes panel layouts using existing geometry calculations"
    
    def _run(self, panels: str, constraints: str) -> str:
        try:
            # Import your existing code
            import sys
            sys.path.append(str(Path(__file__).parent.parent / "backend" / "panel_layout"))
            from geometry import optimize_layout
            
            # Convert string inputs to proper format
            panel_data = json.loads(panels) if isinstance(panels, str) else panels
            constraint_data = json.loads(constraints) if isinstance(constraints, str) else constraints
            
            # Call your existing optimization function
            result = optimize_layout(panel_data, constraint_data)
            return json.dumps(result)
        except Exception as e:
            logger.error(f"Layout optimization failed: {e}")
            return json.dumps({"error": str(e)})
    
    async def _arun(self, panels: str, constraints: str) -> str:
        return self._run(panels, constraints)

class DocumentProcessorTool(BaseTool):
    """Tool that connects to your existing document_processor.py"""
    name = "document_processor"
    description = "Processes documents using existing OCR and analysis"
    
    def _run(self, document_path: str, analysis_type: str) -> str:
        try:
            # Import your existing code
            import sys
            sys.path.append(str(Path(__file__).parent))
            from document_processor import process_document
            
            # Call your existing document processing
            result = process_document(document_path, analysis_type)
            return json.dumps(result)
        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            return json.dumps({"error": str(e)})
    
    async def _arun(self, document_path: str, analysis_type: str) -> str:
        return self._run(document_path, analysis_type)

class PanelAPITool(BaseTool):
    """Tool that connects to your existing panel_api.py"""
    name = "panel_api"
    description = "Manages panels using existing API functions"
    
    def _run(self, action: str, panel_data: str) -> str:
        try:
            # Import your existing code
            import sys
            sys.path.append(str(Path(__file__).parent.parent / "backend" / "api"))
            from panel_api import create_panel, update_panel, get_panel
            
            data = json.loads(panel_data) if isinstance(panel_data, str) else panel_data
            
            if action == "create":
                result = create_panel(data)
            elif action == "update":
                result = update_panel(data)
            elif action == "get":
                result = get_panel(data)
            else:
                result = {"error": f"Unknown action: {action}"}
            
            return json.dumps(result)
        except Exception as e:
            logger.error(f"Panel API operation failed: {e}")
            return json.dumps({"error": str(e)})
    
    async def _arun(self, action: str, panel_data: str) -> str:
        return self._run(action, panel_data)

class QCDataTool(BaseTool):
    """Tool that connects to your existing QC data analysis"""
    name = "qc_data_analyzer"
    description = "Analyzes QC data and identifies anomalies"
    
    def _run(self, qc_data: str, analysis_type: str = "outliers") -> str:
        try:
            # Import your existing QC analysis code
            import sys
            sys.path.append(str(Path(__file__).parent.parent / "frontend" / "src" / "components" / "qc-data"))
            from auto_analysis import analyze_qc_data
            
            data = json.loads(qc_data) if isinstance(qc_data, str) else qc_data
            
            # Call your existing QC analysis
            result = analyze_qc_data(data, analysis_type)
            return json.dumps(result)
        except Exception as e:
            logger.error(f"QC analysis failed: {e}")
            return json.dumps({"error": str(e)})
    
    async def _arun(self, qc_data: str, analysis_type: str) -> str:
        return self._run(qc_data, analysis_type)

# === HYBRID AGENT IMPLEMENTATION ===
class HybridAgentFactory:
    """Factory that creates CrewAI agents with cost optimization"""
    
    def __init__(self, cost_optimizer: CostOptimizer):
        self.cost_optimizer = cost_optimizer
    
    def create_layout_optimizer_agent(self, user_tier: str = "paid_user") -> Agent:
        """Creates layout optimizer agent with cost-optimized model selection"""
        
        # Select model based on typical complexity for layout tasks
        model_config = self.cost_optimizer.select_model("simple", user_tier, "layout")
        
        # Create LLM instance based on selected model
        llm = self._create_llm(model_config)
        
        return Agent(
            role="Layout Optimization Specialist",
            goal="Optimize panel layouts for maximum efficiency and minimal waste",
            backstory="Expert in geometric optimization and panel arrangement with deep knowledge of construction constraints",
            verbose=True,
            allow_delegation=False,
            llm=llm,
            tools=[LayoutOptimizerTool()]
        )
    
    def create_document_intelligence_agent(self, user_tier: str = "paid_user") -> Agent:
        """Creates document processor agent with intelligent model routing"""
        
        # Document analysis typically needs more complex reasoning
        model_config = self.cost_optimizer.select_model("complex", user_tier, "document")
        
        llm = self._create_llm(model_config)
        
        return Agent(
            role="Document Analysis Specialist",
            goal="Extract and analyze technical specifications from documents",
            backstory="Expert in OCR, technical document analysis, and data extraction with construction industry knowledge",
            verbose=True,
            allow_delegation=False,
            llm=llm,
            tools=[DocumentProcessorTool()]
        )
    
    def create_assistant_agent(self, user_tier: str = "paid_user") -> Agent:
        """Creates conversational assistant with escalation capabilities"""
        
        # Start with simple model, escalate if needed
        model_config = self.cost_optimizer.select_model("simple", user_tier, "assistant")
        
        llm = self._create_llm(model_config)
        
        return Agent(
            role="AI Assistant Guide",
            goal="Provide helpful guidance and answer user questions about panels and layouts",
            backstory="Friendly AI assistant specialized in construction panel management and layout optimization",
            verbose=True,
            allow_delegation=True,  # Can delegate to other agents
            llm=llm,
            tools=[PanelAPITool()]
        )
    
    def create_project_config_agent(self, user_tier: str = "paid_user") -> Agent:
        """Creates project configuration agent"""
        
        model_config = self.cost_optimizer.select_model("simple", user_tier, "project")
        
        llm = self._create_llm(model_config)
        
        return Agent(
            role="Project Configuration Specialist",
            goal="Set up optimal project templates and configurations",
            backstory="Expert in project setup, template creation, and configuration optimization",
            verbose=True,
            allow_delegation=False,
            llm=llm,
            tools=[PanelAPITool()]
        )
    
    def create_qc_analysis_agent(self, user_tier: str = "paid_user") -> Agent:
        """Creates QC analysis agent with local model preference"""
        
        # QC analysis can often use local models for cost efficiency
        model_config = self.cost_optimizer.select_model("simple", user_tier, "qc_analysis")
        
        llm = self._create_llm(model_config)
        
        return Agent(
            role="Quality Control Analyst",
            goal="Analyze QC data, identify outliers, and suggest improvements",
            backstory="Statistical analysis expert with deep knowledge of construction quality standards",
            verbose=True,
            allow_delegation=False,
            llm=llm,
            tools=[QCDataTool()]
        )
    
    def create_personalization_agent(self, user_tier: str = "paid_user") -> Agent:
        """Creates personalization agent"""
        
        model_config = self.cost_optimizer.select_model("simple", user_tier, "personalization")
        
        llm = self._create_llm(model_config)
        
        return Agent(
            role="Personalization Specialist",
            goal="Customize user experience based on preferences and behavior",
            backstory="UX specialist focused on adaptive interfaces and user behavior analysis",
            verbose=True,
            allow_delegation=False,
            llm=llm,
            tools=[]  # Would connect to user preference functions
        )
    
    def _create_llm(self, model_config: ModelConfig):
        """Creates LLM instance based on model configuration"""
        if model_config.tier == ModelTier.LOCAL:
            return self._create_ollama_llm(model_config.name)
        else:
            # Check if API key is available
            if model_config.api_key_env and not os.getenv(model_config.api_key_env):
                logger.warning(f"API key not found for {model_config.name}, falling back to local model")
                return self._create_ollama_llm("llama3:8b")
            
            if "claude" in model_config.name:
                from langchain_anthropic import ChatAnthropic
                return ChatAnthropic(model=model_config.name, temperature=0.1)
            else:
                return OpenAI(model_name=model_config.name, temperature=0.1)
    
    def _create_ollama_llm(self, model_name: str):
        """Creates Ollama LLM instance for local models"""
        try:
            # Test if Ollama is available
            response = ollama.list()
            available_models = [model['name'] for model in response['models']]
            
            if model_name not in available_models:
                logger.warning(f"Model {model_name} not available, using llama3:8b")
                model_name = "llama3:8b"
            
            class OllamaLLM:
                def __init__(self, model_name):
                    self.model_name = model_name
                
                def __call__(self, prompt: str) -> str:
                    try:
                        response = ollama.generate(model=self.model_name, prompt=prompt)
                        return response['response']
                    except Exception as e:
                        logger.error(f"Ollama generation failed: {e}")
                        return "I apologize, but I'm having trouble processing your request right now."
            
            return OllamaLLM(model_name)
        except Exception as e:
            logger.error(f"Ollama not available: {e}")
            # Fallback to a simple mock LLM
            class MockLLM:
                def __call__(self, prompt: str) -> str:
                    return "I'm currently in offline mode. Please check your Ollama installation."
            
            return MockLLM()

# === WORKFLOW ORCHESTRATION ===
class HybridWorkflowOrchestrator:
    """Orchestrates workflows using CrewAI with cost optimization"""
    
    def __init__(self, redis_client, user_tier: str = "paid_user"):
        self.redis = redis_client
        self.cost_optimizer = CostOptimizer(redis_client)
        self.agent_factory = HybridAgentFactory(self.cost_optimizer)
        self.user_tier = user_tier
        
        # Create agents
        self.layout_agent = self.agent_factory.create_layout_optimizer_agent(user_tier)
        self.document_agent = self.agent_factory.create_document_intelligence_agent(user_tier)
        self.assistant_agent = self.agent_factory.create_assistant_agent(user_tier)
        self.project_agent = self.agent_factory.create_project_config_agent(user_tier)
        self.qc_agent = self.agent_factory.create_qc_analysis_agent(user_tier)
        self.personalization_agent = self.agent_factory.create_personalization_agent(user_tier)
    
    async def execute_new_project_workflow(self, project_data: Dict) -> Dict:
        """Execute new project creation workflow"""
        
        try:
            # Define tasks
            document_analysis_task = Task(
                description=f"Analyze uploaded documents and extract project specifications: {project_data.get('documents', '')}",
                agent=self.document_agent
            )
            
            project_setup_task = Task(
                description=f"Create project configuration based on extracted specs and user requirements: {project_data.get('requirements', '')}",
                agent=self.project_agent
            )
            
            layout_suggestion_task = Task(
                description="Generate initial layout suggestions based on project configuration",
                agent=self.layout_agent
            )
            
            # Create crew
            crew = Crew(
                agents=[self.document_agent, self.project_agent, self.layout_agent],
                tasks=[document_analysis_task, project_setup_task, layout_suggestion_task],
                verbose=True
            )
            
            # Execute workflow
            result = crew.kickoff()
            
            # Track costs
            total_cost = self._calculate_workflow_cost(crew)
            self.cost_optimizer.track_usage(self.user_tier, total_cost)
            
            return {
                "result": result,
                "cost": total_cost,
                "agents_used": ["document_agent", "project_agent", "layout_agent"],
                "status": "success"
            }
        except Exception as e:
            logger.error(f"New project workflow failed: {e}")
            return {
                "error": str(e),
                "status": "error"
            }
    
    async def execute_layout_optimization_workflow(self, layout_data: Dict) -> Dict:
        """Execute layout optimization workflow"""
        
        try:
            optimization_task = Task(
                description=f"Optimize panel layout for maximum efficiency: {layout_data}",
                agent=self.layout_agent
            )
            
            qc_check_task = Task(
                description="Perform quality check on optimized layout",
                agent=self.qc_agent
            )
            
            crew = Crew(
                agents=[self.layout_agent, self.qc_agent],
                tasks=[optimization_task, qc_check_task],
                verbose=True
            )
            
            result = crew.kickoff()
            total_cost = self._calculate_workflow_cost(crew)
            self.cost_optimizer.track_usage(self.user_tier, total_cost)
            
            return {
                "result": result,
                "cost": total_cost,
                "agents_used": ["layout_agent", "qc_agent"],
                "status": "success"
            }
        except Exception as e:
            logger.error(f"Layout optimization workflow failed: {e}")
            return {
                "error": str(e),
                "status": "error"
            }
    
    def _calculate_workflow_cost(self, crew) -> float:
        """Calculate total cost of workflow execution"""
        # This would integrate with your actual cost tracking
        # For now, return estimated cost based on agents used
        base_cost = 0.01  # Base cost per agent
        return base_cost * len(crew.agents)

# === INTEGRATION WITH YOUR EXISTING STRUCTURE ===
class DellSystemAIService:
    """Main service that integrates with your existing ai-service/app.py"""
    
    def __init__(self, redis_host: str = 'localhost', redis_port: int = 6379):
        try:
            self.redis_client = redis.Redis(host=redis_host, port=redis_port, db=0)
            self.redis_client.ping()  # Test connection
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None
        
        self.orchestrators = {}  # Cache orchestrators per user
    
    def get_orchestrator(self, user_id: str, user_tier: str) -> HybridWorkflowOrchestrator:
        """Get or create orchestrator for user"""
        key = f"{user_id}:{user_tier}"
        if key not in self.orchestrators:
            self.orchestrators[key] = HybridWorkflowOrchestrator(
                self.redis_client, user_tier
            )
        return self.orchestrators[key]
    
    async def handle_layout_optimization(self, user_id: str, user_tier: str, layout_data: Dict) -> Dict:
        """Handle layout optimization request from your frontend"""
        try:
            orchestrator = self.get_orchestrator(user_id, user_tier)
            return await orchestrator.execute_layout_optimization_workflow(layout_data)
        except Exception as e:
            logger.error(f"Layout optimization failed: {e}")
            return {"error": str(e), "status": "error"}
    
    async def handle_new_project(self, user_id: str, user_tier: str, project_data: Dict) -> Dict:
        """Handle new project creation from your frontend"""
        try:
            orchestrator = self.get_orchestrator(user_id, user_tier)
            return await orchestrator.execute_new_project_workflow(project_data)
        except Exception as e:
            logger.error(f"New project creation failed: {e}")
            return {"error": str(e), "status": "error"}
    
    async def handle_chat_message(self, user_id: str, user_tier: str, message: str, context: Dict) -> Dict:
        """Handle chat message from PanelAIChat.tsx"""
        try:
            orchestrator = self.get_orchestrator(user_id, user_tier)
            
            # Simple chat task
            chat_task = Task(
                description=f"Answer user question: {message}. Context: {context}",
                agent=orchestrator.assistant_agent
            )
            
            crew = Crew(
                agents=[orchestrator.assistant_agent],
                tasks=[chat_task],
                verbose=True
            )
            
            result = crew.kickoff()
            orchestrator.cost_optimizer.track_usage(user_tier, 0.01)
            
            return {"response": result, "cost": 0.01, "status": "success"}
        except Exception as e:
            logger.error(f"Chat message handling failed: {e}")
            return {"error": str(e), "status": "error"}
    
    async def handle_document_analysis(self, user_id: str, user_tier: str, document_path: str, analysis_type: str) -> Dict:
        """Handle document analysis request"""
        try:
            orchestrator = self.get_orchestrator(user_id, user_tier)
            
            analysis_task = Task(
                description=f"Analyze document {document_path} with type {analysis_type}",
                agent=orchestrator.document_agent
            )
            
            crew = Crew(
                agents=[orchestrator.document_agent],
                tasks=[analysis_task],
                verbose=True
            )
            
            result = crew.kickoff()
            orchestrator.cost_optimizer.track_usage(user_tier, 0.02)
            
            return {"result": result, "cost": 0.02, "status": "success"}
        except Exception as e:
            logger.error(f"Document analysis failed: {e}")
            return {"error": str(e), "status": "error"}

# === USAGE EXAMPLE ===
async def main():
    """Example of how to use the hybrid system"""
    
    # Initialize the service
    ai_service = DellSystemAIService()
    
    # Example: Handle layout optimization request
    layout_data = {
        "panels": [{"width": 10, "height": 10, "x": 0, "y": 0}],
        "constraints": {"max_width": 100, "max_height": 100}
    }
    
    result = await ai_service.handle_layout_optimization(
        user_id="user123",
        user_tier="paid_user",
        layout_data=layout_data
    )
    
    print(f"Layout optimization result: {result}")
    
    # Example: Handle new project creation
    project_data = {
        "documents": ["blueprint.pdf", "specs.pdf"],
        "requirements": "Commercial building, 1000 sq ft"
    }
    
    result = await ai_service.handle_new_project(
        user_id="user123",
        user_tier="paid_user",
        project_data=project_data
    )
    
    print(f"New project result: {result}")

if __name__ == "__main__":
    asyncio.run(main()) 