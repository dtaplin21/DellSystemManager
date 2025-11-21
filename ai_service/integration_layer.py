# AI Service Integration Layer
# Connects the hybrid AI architecture with the Flask app

import os
import logging
import asyncio
from typing import Dict, List, Optional, Any
from flask import current_app
import json

logger = logging.getLogger(__name__)

# Import the hybrid AI architecture
try:
    from hybrid_ai_architecture import DellSystemAIService
    logger.debug(f"DellSystemAIService imported: {DellSystemAIService}")
except ImportError as e:
    # Fallback if hybrid architecture is not available
    logger.warning(f"⚠️ Failed to import hybrid AI architecture (ImportError): {e}")
    DellSystemAIService = None
except Exception as e:
    # Catch any other errors during import (e.g., initialization errors)
    logger.error(f"❌ Error importing hybrid AI architecture: {e}", exc_info=True)
    DellSystemAIService = None

class AIServiceIntegration:
    """Integration layer between Flask app and hybrid AI architecture"""
    
    def __init__(self, redis_host: str = None, redis_port: int = 6379):
        self.redis_host = redis_host or os.getenv('REDIS_HOST', 'localhost')
        self.redis_port = redis_port
        self.ai_service = None
        self._initialize_ai_service()
    
    def _initialize_ai_service(self):
        """Initialize the AI service with fallback handling"""
        try:
            if DellSystemAIService:
                # Create Redis client first
                import redis
                try:
                    redis_client = redis.Redis(
                        host=self.redis_host,
                        port=self.redis_port,
                        decode_responses=True,
                        socket_connect_timeout=5,
                        socket_timeout=5
                    )
                    # Test connection
                    redis_client.ping()
                    logger.info(f"✅ Redis connected to {self.redis_host}:{self.redis_port}")
                except Exception as redis_error:
                    logger.warning(f"⚠️ Redis connection failed ({redis_error})")
                    logger.warning("⚠️ Attempting to initialize AI service without Redis (some features may be limited)")
                    # Try to create a minimal Redis client that will fail gracefully
                    # For now, we'll still try to initialize but Redis-dependent features won't work
                    try:
                        # Create a fake Redis client that will raise errors when used
                        # but allows the service to initialize
                        class FakeRedis:
                            def ping(self): raise redis.ConnectionError("Redis not available")
                            def get(self, *args): return None
                            def set(self, *args): return False
                            def delete(self, *args): return 0
                        redis_client = FakeRedis()
                        logger.warning("⚠️ Using fallback Redis client - Redis features disabled")
                    except:
                        redis_client = None
                
                if redis_client:
                    try:
                        self.ai_service = DellSystemAIService(redis_client=redis_client)
                        logger.info("✅ Hybrid AI Architecture initialized successfully")
                    except Exception as init_error:
                        logger.error(f"❌ Failed to initialize DellSystemAIService: {init_error}", exc_info=True)
                        self.ai_service = None
                else:
                    logger.error("❌ Cannot initialize AI service - Redis connection required")
                    self.ai_service = None
            else:
                logger.warning("⚠️ Hybrid AI Architecture not available, using fallback")
                self.ai_service = None
        except Exception as e:
            logger.error(f"❌ Failed to initialize AI service: {e}", exc_info=True)
            self.ai_service = None
    
    def is_hybrid_ai_available(self) -> bool:
        """Check if hybrid AI architecture is available"""
        return self.ai_service is not None
    
    async def analyze_documents_hybrid(self, documents: List[str], question: str, 
                                     user_id: str = "default", user_tier: str = "paid_user") -> Dict:
        """Analyze documents using hybrid AI architecture"""
        if not self.is_hybrid_ai_available():
            return {"error": "Hybrid AI architecture not available"}
        
        try:
            # Use the first document for analysis (can be extended for multiple)
            document_path = documents[0] if documents else None
            
            if not document_path:
                return {"error": "No document path provided"}
            
            # Determine analysis type based on question
            analysis_type = self._determine_analysis_type(question)
            
            # Execute document analysis workflow
            result = await self.ai_service.handle_document_analysis(
                user_id=user_id,
                user_tier=user_tier,
                document_path=document_path,
                analysis_type=analysis_type
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Document analysis failed: {e}")
            return {"error": str(e)}
    
    async def optimize_panels_hybrid(self, panels: List[Dict], strategy: str, 
                                   site_config: Dict, user_id: str = "default", 
                                   user_tier: str = "paid_user") -> Dict:
        """Optimize panels using hybrid AI architecture"""
        if not self.is_hybrid_ai_available():
            return {"error": "Hybrid AI architecture not available"}
        
        try:
            layout_data = {
                "panels": panels,
                "strategy": strategy,
                "site_config": site_config
            }
            
            result = await self.ai_service.handle_layout_optimization(
                user_id=user_id,
                user_tier=user_tier,
                layout_data=layout_data
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Panel optimization failed: {e}")
            return {"error": str(e)}
    
    async def setup_new_project_hybrid(self, project_data: Dict, user_id: str = "default", 
                                     user_tier: str = "paid_user") -> Dict:
        """Setup new project using hybrid AI architecture"""
        if not self.is_hybrid_ai_available():
            return {"error": "Hybrid AI architecture not available"}
        
        try:
            result = await self.ai_service.handle_new_project(
                user_id=user_id,
                user_tier=user_tier,
                project_data=project_data
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Project setup failed: {e}")
            return {"error": str(e)}
    
    async def chat_message_hybrid(self, message: str, context: Dict = None, 
                                user_id: str = "default", user_tier: str = "paid_user") -> Dict:
        """Handle chat messages using hybrid AI architecture"""
        if not self.is_hybrid_ai_available():
            return {"error": "Hybrid AI architecture not available"}
        
        try:
            context = context or {}
            result = await self.ai_service.handle_chat_message(
                user_id=user_id,
                user_tier=user_tier,
                message=message,
                context=context
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Chat message handling failed: {e}")
            return {"error": str(e)}
    
    def _determine_analysis_type(self, question: str) -> str:
        """Determine the type of analysis based on the question"""
        question_lower = question.lower()
        
        if any(word in question_lower for word in ['qc', 'quality', 'control', 'data']):
            return "qc_data"
        elif any(word in question_lower for word in ['panel', 'layout', 'optimization']):
            return "panel_layout"
        elif any(word in question_lower for word in ['requirement', 'specification', 'technical']):
            return "technical_requirements"
        else:
            return "general_analysis"
    
    def get_service_status(self) -> Dict:
        """Get the current status of the AI service"""
        return {
            "hybrid_ai_available": self.is_hybrid_ai_available(),
            "redis_connected": self._check_redis_connection(),
            "service_health": "healthy" if self.ai_service else "degraded"
        }
    
    def _check_redis_connection(self) -> bool:
        """Check if Redis connection is available"""
        try:
            if self.ai_service and self.ai_service.redis:
                self.ai_service.redis.ping()
                return True
            return False
        except:
            return False

# Async wrapper for Flask compatibility
def run_async(coro):
    """Run async coroutine in Flask context"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(coro)

# Global integration instance
ai_integration = None

def get_ai_integration() -> AIServiceIntegration:
    """Get the global AI integration instance"""
    global ai_integration
    if ai_integration is None:
        ai_integration = AIServiceIntegration()
    return ai_integration
