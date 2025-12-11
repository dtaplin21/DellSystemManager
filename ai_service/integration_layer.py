# AI Service Integration Layer
# Connects the hybrid AI architecture with the Flask app

import os
import logging
import asyncio
import uuid
from typing import Dict, List, Optional, Any
from flask import current_app
import json
from datetime import datetime

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
    
    async def automate_panel_population_from_defects(
        self,
        project_id: str,
        defect_data: Dict[str, Any],
        user_id: str = None,
        upload_id: str = None
    ) -> Dict[str, Any]:
        """Automate panel layout population using browser tools based on defect data"""
        if not self.is_hybrid_ai_available():
            return {
                "success": False,
                "error": "Hybrid AI architecture not available"
            }
        
        try:
            logger.info(f"Starting panel population automation for project {project_id}")
            
            # Get defects from defect_data
            defects = defect_data.get("defects", [])
            if not defects:
                return {
                    "success": True,
                    "message": "No defects found, no panels to create",
                    "panels_created": 0
                }
            
            # Get browser tools from AI service
            browser_tools = self.ai_service.tools if hasattr(self.ai_service, 'tools') else {}
            if not browser_tools:
                return {
                    "success": False,
                    "error": "Browser tools not available"
                }
            
            # Get panel manipulation tool (if available)
            panel_tool = None
            for tool_name, tool in browser_tools.items():
                if hasattr(tool, 'name') and tool.name == 'panel_manipulation':
                    panel_tool = tool
                    break
            
            # Navigate to panel layout page
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            panel_layout_url = f"{frontend_url}/dashboard/projects/{project_id}/panel-layout"
            
            logger.info(f"Navigating to panel layout: {panel_layout_url}")
            
            # Use browser navigation tool
            navigate_tool = browser_tools.get("browser_navigate")
            if navigate_tool:
                try:
                    navigate_result = await navigate_tool._arun(
                        url=panel_layout_url,
                        session_id=f"mobile_{upload_id}" if upload_id else "mobile_default",
                        user_id=user_id
                    )
                    logger.info(f"Navigation result: {navigate_result}")
                except Exception as e:
                    logger.warning(f"Navigation failed (may already be on page): {e}")
            
            # Extract current panels
            extract_tool = browser_tools.get("browser_extract")
            current_panels = []
            if extract_tool:
                try:
                    extract_result = await extract_tool._arun(
                        action="panels",
                        session_id=f"mobile_{upload_id}" if upload_id else "mobile_default",
                        user_id=user_id
                    )
                    # Parse extract result
                    if isinstance(extract_result, str):
                        try:
                            extract_data = json.loads(extract_result)
                            if extract_data.get("success") and extract_data.get("panels"):
                                current_panels = extract_data["panels"]
                        except:
                            pass
                    logger.info(f"Current panels extracted: {len(current_panels)}")
                except Exception as e:
                    logger.warning(f"Panel extraction failed: {e}")
            
            session_id = f"mobile_{upload_id}" if upload_id else "mobile_default"
            interaction_tool = browser_tools.get("browser_interact")
            screenshot_tool = browser_tools.get("browser_screenshot")
            
            if not interaction_tool:
                return {
                    "success": False,
                    "error": "Browser interaction tool not available"
                }
            
            async def perform_interaction(action: str, selector: str, value: Optional[str] = None) -> str:
                result = await interaction_tool._arun(
                    action=action,
                    selector=selector,
                    value=value,
                    session_id=session_id,
                    user_id=user_id
                )
                if isinstance(result, str) and result.lower().startswith("error"):
                    raise RuntimeError(result)
                return result
            
            async def click_with_fallback(selectors: List[str]) -> None:
                last_error = None
                for selector in selectors:
                    try:
                        await perform_interaction("click", selector)
                        return
                    except Exception as interaction_error:
                        last_error = interaction_error
                        logger.debug(f"Selector {selector} click failed: {interaction_error}")
                if last_error:
                    raise last_error
            
            initial_panel_count = len(current_panels)
            panels_created = 0
            created_panel_numbers: List[str] = []
            
            for index, defect in enumerate(defects, start=1):
                try:
                    severity = (defect.get("severity") or "").lower()
                    if severity == "severe":
                        length_ft, width_ft = (140, 70)
                    elif severity == "moderate":
                        length_ft, width_ft = (110, 55)
                    else:
                        length_ft, width_ft = (90, 45)
                    
                    estimated = defect.get("estimated_position", {}) or {}
                    x_percent = estimated.get("x_percent", 50)
                    y_percent = estimated.get("y_percent", 50)
                    
                    location_desc = defect.get("location") or f"{x_percent:.0f}% / {y_percent:.0f}% of canvas"
                    defect_description = defect.get("description", "").strip() or defect.get("type", "Detected defect")
                    panel_number = str(
                        defect.get("panel_number")
                        or defect.get("panelNumber")
                        or f"P-{index:03d}"
                    )
                    roll_number = defect.get("roll_number") or defect.get("rollNumber") or f"ROLL-{index:03d}"
                    form_notes = f"{defect_description} | severity: {defect.get('severity', 'n/a')}"
                    date_value = datetime.utcnow().strftime("%Y-%m-%d")
                    
                    # Ensure we're on the Panels tab (not Patches or Destructs)
                    # The panel layout now has tabs: Panels, Patches, Destructive Tests
                    # We should be on Panels tab by default, but verify if needed
                    
                    await click_with_fallback([
                        "button:has-text(\"Add Panel\")",
                        "text=Add Panel"
                    ])
                    await asyncio.sleep(0.5)
                    
                    await perform_interaction("type", "input[name=\"panelNumber\"]", panel_number)
                    await perform_interaction("type", "input[name=\"rollNumber\"]", roll_number)
                    await perform_interaction("type", "input[name=\"length\"]", f"{length_ft}")
                    await perform_interaction("type", "input[name=\"width\"]", f"{width_ft}")
                    await perform_interaction("type", "input[name=\"date\"]", date_value)
                    await perform_interaction("type", "textarea[name=\"location\"]", f"{location_desc} — {form_notes}")
                    await perform_interaction("select", "select[name=\"shape\"]", "rectangle")
                    
                    await click_with_fallback([
                        "button:has-text(\"Create Panel\")",
                        "text=Create Panel"
                    ])
                    
                    # Note: For patches, use the Patches tab and "Add Patch" button
                    # For destructive tests, use the Destructs tab and "Add Destructive Test" button
                    
                    await asyncio.sleep(1)
                    panels_created += 1
                    created_panel_numbers.append(panel_number)
                    logger.info(f"✅ Created panel via browser automation for defect {defect.get('id')}")
                except Exception as defect_error:
                    logger.error(f"Failed to create panel for defect {defect.get('id')}: {defect_error}")
                    continue
            
            verification_panels = current_panels
            verification_details = {
                "initial_count": initial_panel_count,
                "final_count": initial_panel_count + panels_created,
                "created_panel_numbers": created_panel_numbers
            }
            if extract_tool:
                try:
                    post_extract = await extract_tool._arun(
                        action="panels",
                        session_id=session_id,
                        user_id=user_id
                    )
                    if isinstance(post_extract, str):
                        try:
                            parsed = json.loads(post_extract)
                            if parsed.get("success"):
                                verification_panels = parsed.get("panels", verification_panels)
                                verification_details["final_count"] = len(verification_panels)
                                verification_details["new_panels_detected"] = [
                                    panel for panel in verification_panels
                                    if panel.get("panelNumber") in created_panel_numbers
                                ]
                        except json.JSONDecodeError as decode_error:
                            logger.debug(f"Panel verification JSON parse failed: {decode_error}")
                except Exception as verify_error:
                    logger.warning(f"Post-creation extraction failed: {verify_error}")
            
            screenshot_base64 = None
            if screenshot_tool:
                try:
                    screenshot_result = await screenshot_tool._arun(
                        session_id=session_id,
                        user_id=user_id,
                        full_page=True
                    )
                    if isinstance(screenshot_result, str) and not screenshot_result.lower().startswith("error"):
                        screenshot_base64 = screenshot_result
                except Exception as screenshot_error:
                    logger.warning(f"Screenshot capture failed: {screenshot_error}")
            
            return {
                "success": panels_created > 0,
                "message": f"Created {panels_created} panels from {len(defects)} defects",
                "panels_created": panels_created,
                "defects_processed": len(defects),
                "verification": verification_details,
                "screenshot": screenshot_base64
            }
            
        except Exception as e:
            logger.error(f"Error automating panel population: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }

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
