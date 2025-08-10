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

class PanelAPITool(BaseTool):
    """Tool that connects to your existing panel_api.py"""
    name = "panel_api"
    description = "Manages panels using existing API functions"
    
    def _run(self, action: str, panel_data: str) -> str:
        """Execute panel actions using existing backend"""
        try:
            # This would connect to your existing panel_api.py
            # For now, return a structured response
            actions = {
                "create": "Panel created successfully",
                "update": "Panel updated successfully",
                "delete": "Panel deleted successfully",
                "get": "Panel retrieved successfully"
            }
            
            result = actions.get(action, f"Action '{action}' completed")
            return json.dumps({
                "action": action,
                "panel_data": panel_data,
                "result": result,
                "status": "success"
            })
        except Exception as e:
            return f"Panel API action failed: {str(e)}"
    
    async def _arun(self, action: str, panel_data: str) -> str:
        """Async version of panel API actions"""
        return self._run(action, panel_data)

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
    
    def __init__(self, cost_optimizer: CostOptimizer):
        self.cost_optimizer = cost_optimizer
    
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
    
    def create_assistant_agent(self, user_tier: str = "paid_user") -> Agent:
        """Create general assistant agent"""
        model_config = self.cost_optimizer.select_model("simple", user_tier, "assistant")
        llm = self._create_llm(model_config)
        
        return Agent(
            role="AI Assistant",
            goal="Provide helpful assistance and answer user questions",
            backstory="Friendly and knowledgeable AI assistant for the Dell System Manager platform",
            verbose=True,
            allow_delegation=False,
            tools=[],
            llm=llm
        )
    
    def create_project_config_agent(self, user_tier: str = "paid_user") -> Agent:
        """Create agent for project configuration and setup"""
        model_config = self.cost_optimizer.select_model("complex", user_tier, "project_config")
        llm = self._create_llm(model_config)
        
        return Agent(
            role="Project Configuration Specialist",
            goal="Configure and optimize project settings for maximum efficiency",
            backstory="Expert in project setup, configuration optimization, and workflow design",
            verbose=True,
            allow_delegation=False,
            tools=[PanelAPITool()],
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
        if model_config.tier == ModelTier.LOCAL:
            return self._create_ollama_llm(model_config.name)
        elif model_config.api_key_env and os.getenv(model_config.api_key_env):
            if "gpt" in model_config.name:
                return OpenAI(api_key=os.getenv(model_config.api_key_env), model_name=model_config.name)
            elif "claude" in model_config.name:
                # Implement Claude integration
                return OpenAI(api_key=os.getenv(model_config.api_key_env), model_name="gpt-3.5-turbo")
        else:
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

# === WORKFLOW ORCHESTRATOR ===
class HybridWorkflowOrchestrator:
    """Orchestrates complex AI workflows using multiple agents"""
    
    def __init__(self, redis_client, user_tier: str = "paid_user"):
        self.redis = redis_client
        self.user_tier = user_tier
        self.cost_optimizer = CostOptimizer(redis_client)
        self.agent_factory = HybridAgentFactory(self.cost_optimizer)
    
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
    
    def get_orchestrator(self, user_id: str, user_tier: str) -> HybridWorkflowOrchestrator:
        """Get workflow orchestrator for specific user"""
        return HybridWorkflowOrchestrator(self.redis, user_tier)
    
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
            orchestrator = self.get_orchestrator(user_id, user_tier)
            assistant_agent = orchestrator.agent_factory.create_assistant_agent(user_tier)
            
            # Simple chat response
            response = assistant_agent(message)
            
            return {
                "success": True,
                "response": response,
                "user_id": user_id,
                "timestamp": str(datetime.datetime.now())
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
