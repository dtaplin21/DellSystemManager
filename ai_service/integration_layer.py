# Integration Layer: Connects Hybrid AI Architecture with Existing System
# This bridges the gap between the AI service and your existing components

import asyncio
import json
import logging
from typing import Dict, Any, Optional
from pathlib import Path
from hybrid_ai_architecture import DellSystemAIService
from crewai import Task, Crew

logger = logging.getLogger(__name__)

class FrontendIntegration:
    """Integrates AI service with React frontend components"""
    
    def __init__(self, ai_service: DellSystemAIService):
        self.ai_service = ai_service
    
    async def handle_panel_ai_chat(self, user_id: str, user_tier: str, message: str, panel_context: Dict) -> Dict:
        """Handle chat messages from PanelAIChat.tsx"""
        try:
            # Enhance context with panel-specific information
            enhanced_context = {
                **panel_context,
                "component": "PanelAIChat",
                "user_id": user_id,
                "timestamp": asyncio.get_event_loop().time()
            }
            
            result = await self.ai_service.handle_chat_message(
                user_id=user_id,
                user_tier=user_tier,
                message=message,
                context=enhanced_context
            )
            
            return {
                "success": True,
                "response": result.get("response", ""),
                "cost": result.get("cost", 0),
                "status": result.get("status", "success")
            }
        except Exception as e:
            logger.error(f"Panel AI chat failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "I'm sorry, I'm having trouble processing your request right now."
            }
    
    async def handle_auto_optimizer(self, user_id: str, user_tier: str, layout_data: Dict) -> Dict:
        """Handle auto-optimization requests from auto-optimizer.tsx"""
        try:
            result = await self.ai_service.handle_layout_optimization(
                user_id=user_id,
                user_tier=user_tier,
                layout_data=layout_data
            )
            
            if result.get("status") == "success":
                return {
                    "success": True,
                    "optimized_layout": result.get("result", {}),
                    "cost": result.get("cost", 0),
                    "agents_used": result.get("agents_used", [])
                }
            else:
                return {
                    "success": False,
                    "error": result.get("error", "Optimization failed"),
                    "optimized_layout": layout_data  # Return original as fallback
                }
        except Exception as e:
            logger.error(f"Auto optimization failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "optimized_layout": layout_data
            }
    
    async def handle_document_analyzer(self, user_id: str, user_tier: str, document_path: str, analysis_type: str) -> Dict:
        """Handle document analysis from DocumentAnalyzer.tsx"""
        try:
            result = await self.ai_service.handle_document_analysis(
                user_id=user_id,
                user_tier=user_tier,
                document_path=document_path,
                analysis_type=analysis_type
            )
            
            return {
                "success": result.get("status") == "success",
                "analysis_result": result.get("result", {}),
                "cost": result.get("cost", 0),
                "error": result.get("error")
            }
        except Exception as e:
            logger.error(f"Document analysis failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "analysis_result": {}
            }

class BackendIntegration:
    """Integrates AI service with existing backend APIs"""
    
    def __init__(self, ai_service: DellSystemAIService):
        self.ai_service = ai_service
    
    async def enhance_panel_api(self, user_id: str, user_tier: str, action: str, panel_data: Dict) -> Dict:
        """Enhance existing panel API with AI capabilities"""
        try:
            # First, perform the standard panel operation
            # This would call your existing panel_api.py functions
            
            # Then, enhance with AI if needed
            if action == "create" and user_tier in ["paid_user", "enterprise"]:
                # Suggest optimizations for new panels
                optimization_result = await self.ai_service.handle_layout_optimization(
                    user_id=user_id,
                    user_tier=user_tier,
                    layout_data={"panels": [panel_data]}
                )
                
                return {
                    "panel_created": True,
                    "panel_data": panel_data,
                    "ai_suggestions": optimization_result.get("result", {}),
                    "cost": optimization_result.get("cost", 0)
                }
            
            elif action == "update":
                # Check for potential issues with updated panel
                qc_result = await self._check_panel_quality(user_id, user_tier, panel_data)
                
                return {
                    "panel_updated": True,
                    "panel_data": panel_data,
                    "quality_check": qc_result
                }
            
            else:
                return {
                    "panel_operation": action,
                    "panel_data": panel_data
                }
                
        except Exception as e:
            logger.error(f"Panel API enhancement failed: {e}")
            return {
                "error": str(e),
                "panel_operation": action,
                "panel_data": panel_data
            }
    
    async def _check_panel_quality(self, user_id: str, user_tier: str, panel_data: Dict) -> Dict:
        """Check panel quality using AI"""
        try:
            orchestrator = self.ai_service.get_orchestrator(user_id, user_tier)
            
            qc_task = Task(
                description=f"Check quality of panel: {panel_data}",
                agent=orchestrator.qc_agent
            )
            
            crew = Crew(
                agents=[orchestrator.qc_agent],
                tasks=[qc_task],
                verbose=True
            )
            
            result = crew.kickoff()
            return {"quality_check": result, "status": "success"}
        except Exception as e:
            logger.error(f"Quality check failed: {e}")
            return {"error": str(e), "status": "error"}

class WebSocketIntegration:
    """Handles real-time AI interactions via WebSocket"""
    
    def __init__(self, ai_service: DellSystemAIService):
        self.ai_service = ai_service
        self.active_sessions = {}
    
    async def handle_websocket_message(self, user_id: str, user_tier: str, message: Dict) -> Dict:
        """Handle WebSocket messages for real-time AI interactions"""
        try:
            message_type = message.get("type")
            
            if message_type == "chat":
                return await self._handle_chat_message(user_id, user_tier, message)
            elif message_type == "optimization_request":
                return await self._handle_optimization_request(user_id, user_tier, message)
            elif message_type == "document_analysis":
                return await self._handle_document_analysis(user_id, user_tier, message)
            else:
                return {"error": f"Unknown message type: {message_type}"}
                
        except Exception as e:
            logger.error(f"WebSocket message handling failed: {e}")
            return {"error": str(e)}
    
    async def _handle_chat_message(self, user_id: str, user_tier: str, message: Dict) -> Dict:
        """Handle real-time chat messages"""
        chat_message = message.get("content", "")
        context = message.get("context", {})
        
        result = await self.ai_service.handle_chat_message(
            user_id=user_id,
            user_tier=user_tier,
            message=chat_message,
            context=context
        )
        
        return {
            "type": "chat_response",
            "response": result.get("response", ""),
            "cost": result.get("cost", 0),
            "timestamp": asyncio.get_event_loop().time()
        }
    
    async def _handle_optimization_request(self, user_id: str, user_tier: str, message: Dict) -> Dict:
        """Handle real-time optimization requests"""
        layout_data = message.get("layout_data", {})
        
        result = await self.ai_service.handle_layout_optimization(
            user_id=user_id,
            user_tier=user_tier,
            layout_data=layout_data
        )
        
        return {
            "type": "optimization_response",
            "optimized_layout": result.get("result", {}),
            "cost": result.get("cost", 0),
            "status": result.get("status", "success")
        }
    
    async def _handle_document_analysis(self, user_id: str, user_tier: str, message: Dict) -> Dict:
        """Handle real-time document analysis"""
        document_path = message.get("document_path", "")
        analysis_type = message.get("analysis_type", "general")
        
        result = await self.ai_service.handle_document_analysis(
            user_id=user_id,
            user_tier=user_tier,
            document_path=document_path,
            analysis_type=analysis_type
        )
        
        return {
            "type": "document_analysis_response",
            "analysis_result": result.get("result", {}),
            "cost": result.get("cost", 0),
            "status": result.get("status", "success")
        }

# === API ROUTES INTEGRATION ===
class APIRoutesIntegration:
    """Integrates AI service with existing API routes"""
    
    def __init__(self, ai_service: DellSystemAIService):
        self.ai_service = ai_service
        self.frontend_integration = FrontendIntegration(ai_service)
        self.backend_integration = BackendIntegration(ai_service)
        self.websocket_integration = WebSocketIntegration(ai_service)
    
    async def handle_ai_route(self, route_type: str, user_id: str, user_tier: str, data: Dict) -> Dict:
        """Handle AI-related API routes"""
        try:
            if route_type == "chat":
                return await self.frontend_integration.handle_panel_ai_chat(
                    user_id, user_tier, data.get("message", ""), data.get("context", {})
                )
            elif route_type == "optimize":
                return await self.frontend_integration.handle_auto_optimizer(
                    user_id, user_tier, data.get("layout_data", {})
                )
            elif route_type == "analyze_document":
                return await self.frontend_integration.handle_document_analyzer(
                    user_id, user_tier, data.get("document_path", ""), data.get("analysis_type", "general")
                )
            elif route_type == "enhance_panel":
                return await self.backend_integration.enhance_panel_api(
                    user_id, user_tier, data.get("action", ""), data.get("panel_data", {})
                )
            else:
                return {"error": f"Unknown route type: {route_type}"}
                
        except Exception as e:
            logger.error(f"AI route handling failed: {e}")
            return {"error": str(e)}

# === USAGE EXAMPLE ===
async def setup_integration():
    """Setup the integration layer"""
    
    # Initialize AI service
    ai_service = DellSystemAIService()
    
    # Create integration layer
    api_integration = APIRoutesIntegration(ai_service)
    
    # Example: Handle a chat message
    chat_result = await api_integration.handle_ai_route(
        route_type="chat",
        user_id="user123",
        user_tier="paid_user",
        data={
            "message": "How can I optimize this panel layout?",
            "context": {"current_panels": [{"width": 10, "height": 10}]}
        }
    )
    
    print(f"Chat result: {chat_result}")
    
    # Example: Handle optimization request
    optimization_result = await api_integration.handle_ai_route(
        route_type="optimize",
        user_id="user123",
        user_tier="paid_user",
        data={
            "layout_data": {
                "panels": [{"width": 10, "height": 10, "x": 0, "y": 0}],
                "constraints": {"max_width": 100, "max_height": 100}
            }
        }
    )
    
    print(f"Optimization result: {optimization_result}")

if __name__ == "__main__":
    asyncio.run(setup_integration()) 