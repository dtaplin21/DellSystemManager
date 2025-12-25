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

    async def automate_from_approved_form_with_workflow(
        self,
        form_record: Dict[str, Any],
        project_id: str,
        user_id: str = None,
        item_type: str = None,
        positioning: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Automate item creation from approved form using multi-agent workflow"""
        if not self.is_hybrid_ai_available():
            return {
                "success": False,
                "error": "Hybrid AI architecture not available"
            }
        
        try:
            logger.info(f"Starting multi-agent workflow automation for project {project_id}, form {form_record.get('id')}")
            
            # Determine item type if not provided
            if not item_type:
                domain = form_record.get('domain')
                if domain == 'panel_placement':
                    item_type = 'panel'
                elif domain == 'repairs':
                    item_type = 'patch'
                elif domain == 'destructive':
                    item_type = 'destructive_test'
                else:
                    return {
                        "success": False,
                        "error": f"Unknown domain: {domain}"
                    }
            
            # Get frontend URL for panel layout
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            panel_layout_url = f"{frontend_url}/dashboard/projects/{project_id}/panel-layout"
            
            # Fetch cardinal direction from project
            cardinal_direction = 'north'  # Default
            try:
                backend_url = os.getenv("BACKEND_URL", "http://localhost:8003")
                response = requests.get(
                    f"{backend_url}/api/projects/{project_id}/cardinal-direction",
                    timeout=5
                )
                if response.ok:
                    data = response.json()
                    if data.get('success') and data.get('cardinalDirection'):
                        cardinal_direction = data['cardinalDirection']
            except Exception as e:
                logger.warning(f"Could not fetch cardinal direction, using default 'north': {e}")
            
            # Extract structured location fields from form record
            mapped_data = form_record.get('mapped_data', {})
            if isinstance(mapped_data, str):
                try:
                    mapped_data = json.loads(mapped_data)
                except:
                    mapped_data = {}
            
            structured_location = {
                "placement_type": mapped_data.get("placementType") or mapped_data.get("placement_type"),
                "location_distance": mapped_data.get("locationDistance") or mapped_data.get("location_distance"),
                "location_direction": mapped_data.get("locationDirection") or mapped_data.get("location_direction"),
                "location_description": mapped_data.get("locationDescription") or mapped_data.get("location_description"),
                "panel_numbers": mapped_data.get("panelNumbers") or mapped_data.get("panel_numbers")
            }
            
            # Normalize structured location fields
            if structured_location["placement_type"]:
                pt = str(structured_location["placement_type"]).lower()
                if pt in ["single panel", "single_panel"]:
                    structured_location["placement_type"] = "single_panel"
                elif pt in ["seam between panels", "seam"]:
                    structured_location["placement_type"] = "seam"
            
            if structured_location["location_direction"]:
                structured_location["location_direction"] = str(structured_location["location_direction"]).lower()
            
            if structured_location["location_distance"]:
                try:
                    structured_location["location_distance"] = float(structured_location["location_distance"])
                except (ValueError, TypeError):
                    structured_location["location_distance"] = None
            
            # Prepare workflow context with structured location fields
            workflow_context = {
                "form_record": form_record,
                "project_id": project_id,
                "user_id": user_id,
                "item_type": item_type,
                "positioning": positioning or {},
                "panel_layout_url": panel_layout_url,
                "cardinal_direction": cardinal_direction,
                "structured_location": structured_location,
                "payload": {
                    "form_record": form_record,
                    "project_id": project_id,
                    "item_type": item_type,
                    "cardinal_direction": cardinal_direction,
                    "structured_location": structured_location
                }
            }
            
            # Get workflow orchestrator
            if not hasattr(self.ai_service, 'get_orchestrator'):
                return {
                    "success": False,
                    "error": "Workflow orchestrator not available"
                }
            
            orchestrator = self.ai_service.get_orchestrator(
                user_id=user_id or "system",
                user_tier="paid_user"  # Default tier, could be made configurable
            )
            
            # Execute multi-agent workflow
            workflow_result = await orchestrator.execute_workflow(
                workflow_id="form_review_and_placement",
                payload=workflow_context,
                metadata={
                    "trigger": "form_approval",
                    "form_id": form_record.get('id'),
                    "project_id": project_id
                }
            )
            
            logger.info(f"Multi-agent workflow completed for form {form_record.get('id')}")
            
            # Extract results from workflow output
            workflow_output = workflow_result.get("output", {})
            if isinstance(workflow_output, str):
                try:
                    workflow_output = json.loads(workflow_output)
                except:
                    workflow_output = {}
            
            return {
                "success": True,
                "item_type": item_type,
                "workflow_result": workflow_result,
                "item_id": workflow_output.get("item_id"),
                "form_id": form_record.get('id'),
                "placement": workflow_output.get("placement")
            }
            
        except Exception as e:
            logger.error(f"Error in multi-agent workflow automation: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def automate_from_approved_form(
        self,
        form_record: Dict[str, Any],
        project_id: str,
        user_id: str = None
    ) -> Dict[str, Any]:
        """Automate item creation from approved form using browser tools (legacy method)"""
        if not self.is_hybrid_ai_available():
            return {
                "success": False,
                "error": "Hybrid AI architecture not available"
            }
        
        try:
            logger.info(f"Starting form-based automation for project {project_id}, form {form_record.get('id')}")
            
            domain = form_record.get('domain')
            item_type = form_record.get('item_type')  # 'panel', 'patch', or 'destructive_test'
            positioning = form_record.get('positioning', {})
            
            # Get browser tools from AI service
            browser_tools = self.ai_service.tools if hasattr(self.ai_service, 'tools') else {}
            if not browser_tools:
                return {
                    "success": False,
                    "error": "Browser tools not available"
                }
            
            # Navigate to panel layout page
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            panel_layout_url = f"{frontend_url}/dashboard/projects/{project_id}/panel-layout"
            
            logger.info(f"Navigating to panel layout: {panel_layout_url}")
            
            session_id = f"form_{form_record.get('id', 'default')}"
            
            # Use browser navigation tool
            navigate_tool = browser_tools.get("browser_navigate")
            if navigate_tool:
                try:
                    await navigate_tool._arun(
                        url=panel_layout_url,
                        session_id=session_id,
                        user_id=user_id
                    )
                    logger.info("Navigation successful")
                except Exception as e:
                    logger.warning(f"Navigation failed (may already be on page): {e}")
            
            # Determine which tab to switch to
            tab_map = {
                'panel': 'panels',
                'patch': 'patches',
                'destructive_test': 'destructs'
            }
            tab_name = tab_map.get(item_type, 'panels')
            
            # Switch to appropriate tab
            interaction_tool = browser_tools.get("browser_interact")
            if interaction_tool:
                try:
                    # Click on the appropriate tab
                    tab_selector = f'button[data-tab="{tab_name}"], [role="tab"][data-value="{tab_name}"]'
                    await interaction_tool._arun(
                        action="click",
                        selector=tab_selector,
                        session_id=session_id,
                        user_id=user_id
                    )
                    logger.info(f"Switched to {tab_name} tab")
                except Exception as e:
                    logger.warning(f"Tab switch failed: {e}")
            
            # Extract form data for item creation
            mapped_data = form_record.get('mapped_data', {})
            
            # Click "Add" button to open creation modal
            if interaction_tool:
                try:
                    add_button_selectors = [
                        f'button:has-text("Add {tab_name.title()}")',
                        f'button[aria-label*="Add {tab_name}"]',
                        'button:has-text("Add")',
                        '[data-testid="add-button"]'
                    ]
                    
                    for selector in add_button_selectors:
                        try:
                            await interaction_tool._arun(
                                action="click",
                                selector=selector,
                                session_id=session_id,
                                user_id=user_id
                            )
                            logger.info(f"Clicked Add button with selector: {selector}")
                            break
                        except:
                            continue
                except Exception as e:
                    logger.warning(f"Add button click failed: {e}")
            
            # Fill form fields based on item type and form data
            # Enhanced to handle all field types: text, number, date, select, textarea
            if interaction_tool and mapped_data:
                try:
                    import asyncio
                    
                    # Map form fields to modal fields based on item type
                    field_mappings = {}
                    
                    if item_type == 'panel':
                        field_mappings = {
                            'panelNumber': {
                                'value': mapped_data.get('panelNumber') or mapped_data.get('panelNumbers'),
                                'type': 'text'
                            },
                            'rollNumber': {
                                'value': mapped_data.get('rollNumber') or mapped_data.get('roll_number'),
                                'type': 'text'
                            },
                            'length': {
                                'value': mapped_data.get('length') or mapped_data.get('width'),
                                'type': 'number'
                            },
                            'width': {
                                'value': mapped_data.get('width') or mapped_data.get('height'),
                                'type': 'number'
                            },
                            'date': {
                                'value': mapped_data.get('date'),
                                'type': 'date'
                            },
                            'location': {
                                'value': mapped_data.get('location') or mapped_data.get('locationNote'),
                                'type': 'textarea'
                            },
                            'x': {
                                'value': positioning.get('x'),
                                'type': 'number'
                            },
                            'y': {
                                'value': positioning.get('y'),
                                'type': 'number'
                            },
                            'shape': {
                                'value': mapped_data.get('shape') or 'rectangle',
                                'type': 'select'
                            }
                        }
                    elif item_type == 'patch':
                        # Use structured location description if available, otherwise fall back to text
                        location_value = (
                            mapped_data.get('locationDescription') or 
                            mapped_data.get('location_description') or
                            mapped_data.get('location') or 
                            mapped_data.get('typeDetailLocation') or
                            mapped_data.get('type_detail_location')
                        )
                        
                        field_mappings = {
                            'patchNumber': {
                                'value': mapped_data.get('repairId') or mapped_data.get('repair_id') or mapped_data.get('patchNumber'),
                                'type': 'text'
                            },
                            'date': {
                                'value': mapped_data.get('date'),
                                'type': 'date'
                            },
                            'location': {
                                'value': location_value,
                                'type': 'textarea'
                            },
                            'radius': {
                                'value': mapped_data.get('radius') or 1.5,  # Default 1.5ft radius
                                'type': 'number'
                            },
                            'x': {
                                'value': positioning.get('x'),
                                'type': 'number'
                            },
                            'y': {
                                'value': positioning.get('y'),
                                'type': 'number'
                            },
                            # Add structured location fields if form supports them
                            'placementType': {
                                'value': mapped_data.get('placementType') or mapped_data.get('placement_type'),
                                'type': 'text'
                            },
                            'locationDistance': {
                                'value': mapped_data.get('locationDistance') or mapped_data.get('location_distance'),
                                'type': 'number'
                            },
                            'locationDirection': {
                                'value': mapped_data.get('locationDirection') or mapped_data.get('location_direction'),
                                'type': 'text'
                            }
                        }
                    elif item_type == 'destructive_test':
                        # Use structured location description if available
                        location_value = (
                            mapped_data.get('locationDescription') or 
                            mapped_data.get('location_description') or
                            mapped_data.get('location') or
                            mapped_data.get('comments')
                        )
                        
                        field_mappings = {
                            'sampleId': {
                                'value': mapped_data.get('sampleId') or mapped_data.get('sample_id'),
                                'type': 'text'
                            },
                            'date': {
                                'value': mapped_data.get('date'),
                                'type': 'date'
                            },
                            'width': {
                                'value': mapped_data.get('width') or 1.0,  # Default dimensions
                                'type': 'number'
                            },
                            'height': {
                                'value': mapped_data.get('height') or 1.0,
                                'type': 'number'
                            },
                            'location': {
                                'value': location_value,
                                'type': 'textarea'
                            },
                            'x': {
                                'value': positioning.get('x'),
                                'type': 'number'
                            },
                            'y': {
                                'value': positioning.get('y'),
                                'type': 'number'
                            },
                            # Add structured location fields if form supports them
                            'placementType': {
                                'value': mapped_data.get('placementType') or mapped_data.get('placement_type'),
                                'type': 'text'
                            },
                            'locationDistance': {
                                'value': mapped_data.get('locationDistance') or mapped_data.get('location_distance'),
                                'type': 'number'
                            },
                            'locationDirection': {
                                'value': mapped_data.get('locationDirection') or mapped_data.get('location_direction'),
                                'type': 'text'
                            }
                        }
                    
                    # Fill form fields with proper handling for each field type
                    for field_name, field_config in field_mappings.items():
                        field_value = field_config.get('value')
                        field_type = field_config.get('type', 'text')
                        
                        if field_value is None or field_value == '':
                            continue
                        
                        try:
                            # Try multiple selector patterns
                            selectors = [
                                f'input[name="{field_name}"]',
                                f'input[id="{field_name}"]',
                                f'textarea[name="{field_name}"]',
                                f'textarea[id="{field_name}"]',
                                f'select[name="{field_name}"]',
                                f'select[id="{field_name}"]',
                                f'[name="{field_name}"]',
                                f'#{field_name}'
                            ]
                            
                            filled = False
                            for selector in selectors:
                                try:
                                    if field_type == 'select':
                                        await interaction_tool._arun(
                                            action="select",
                                            selector=selector,
                                            value=str(field_value),
                                            session_id=session_id,
                                            user_id=user_id
                                        )
                                    else:
                                        await interaction_tool._arun(
                                            action="type",
                                            selector=selector,
                                            value=str(field_value),
                                            session_id=session_id,
                                            user_id=user_id
                                        )
                                    filled = True
                                    logger.info(f"Filled field {field_name} with value {field_value}")
                                    await asyncio.sleep(0.2)  # Small delay between fields
                                    break
                                except Exception as e:
                                    continue
                            
                            if not filled:
                                logger.warning(f"Could not fill field {field_name} with any selector")
                        except Exception as e:
                            logger.warning(f"Error filling field {field_name}: {e}")
                            continue
                    
                    # Submit form
                    submit_selectors = [
                        'button[type="submit"]',
                        'button:has-text("Create")',
                        'button:has-text("Save")'
                    ]
                    
                    for selector in submit_selectors:
                        try:
                            await interaction_tool._arun(
                                action="click",
                                selector=selector,
                                session_id=session_id,
                                user_id=user_id
                            )
                            logger.info("Form submitted")
                            break
                        except:
                            continue
                            
                except Exception as e:
                    logger.warning(f"Form filling failed: {e}")
            
            # Extract created item ID and validate creation
            extract_tool = browser_tools.get("browser_extract")
            item_id = None
            validation_result = {
                "valid": False,
                "conflicts": [],
                "errors": []
            }
            
            if extract_tool:
                try:
                    extract_result = await extract_tool._arun(
                        action=item_type,
                        session_id=session_id,
                        user_id=user_id
                    )
                    # Try to parse item ID from extract result
                    if isinstance(extract_result, str):
                        try:
                            extract_data = json.loads(extract_result)
                            items = extract_data.get(item_type + 's', [])
                            if items:
                                created_item = items[-1]  # Get most recently created item
                                item_id = created_item.get('id')
                                
                                # Validate created item
                                validation_result = await self._validate_created_item(
                                    created_item=created_item,
                                    form_record=form_record,
                                    positioning=positioning,
                                    item_type=item_type,
                                    existing_items=items[:-1]  # All items except the one we just created
                                )
                        except json.JSONDecodeError as e:
                            logger.warning(f"Failed to parse extract result: {e}")
                            validation_result["errors"].append(f"Failed to parse extraction result: {e}")
                except Exception as e:
                    logger.warning(f"Item extraction failed: {e}")
                    validation_result["errors"].append(f"Extraction failed: {e}")
            
            # Log validation results
            logger.info(f"Item creation validation for form {form_record.get('id')}", {
                "item_id": item_id,
                "valid": validation_result["valid"],
                "conflicts": len(validation_result["conflicts"]),
                "errors": len(validation_result["errors"])
            })
            
            # If validation failed with critical errors, attempt rollback
            if not validation_result["valid"] and validation_result.get("critical_error"):
                logger.warning(f"Critical validation error detected, attempting rollback for item {item_id}")
                rollback_result = await self._rollback_item_creation(
                    item_id=item_id,
                    item_type=item_type,
                    project_id=project_id,
                    session_id=session_id,
                    user_id=user_id,
                    browser_tools=browser_tools
                )
                if rollback_result.get("success"):
                    logger.info(f"Successfully rolled back item creation for form {form_record.get('id')}")
                else:
                    logger.error(f"Failed to rollback item creation: {rollback_result.get('error')}")
            
            return {
                "success": validation_result["valid"] if validation_result else True,
                "item_type": item_type,
                "item_id": item_id,
                "form_id": form_record.get('id'),
                "validation": validation_result,
                "positioning": positioning
            }
            
        except Exception as e:
            logger.error(f"Error in automate_from_approved_form: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _validate_created_item(
        self,
        created_item: Dict[str, Any],
        form_record: Dict[str, Any],
        positioning: Dict[str, Any],
        item_type: str,
        existing_items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Validate created item for conflicts and correctness"""
        validation = {
            "valid": True,
            "conflicts": [],
            "errors": [],
            "warnings": [],
            "critical_error": False
        }
        
        try:
            mapped_data = form_record.get('mapped_data', {})
            
            # Check for duplicate IDs
            if item_type == 'panel':
                panel_number = created_item.get('panelNumber')
                if panel_number:
                    duplicates = [item for item in existing_items 
                                if item.get('panelNumber') == panel_number]
                    if duplicates:
                        validation["conflicts"].append({
                            "type": "duplicate_panel_number",
                            "message": f"Panel number {panel_number} already exists",
                            "duplicate_items": [item.get('id') for item in duplicates]
                        })
                        validation["valid"] = False
                        validation["critical_error"] = True
            
            elif item_type == 'patch':
                patch_number = created_item.get('patchNumber')
                if patch_number:
                    duplicates = [item for item in existing_items 
                                if item.get('patchNumber') == patch_number]
                    if duplicates:
                        validation["conflicts"].append({
                            "type": "duplicate_patch_number",
                            "message": f"Patch number {patch_number} already exists",
                            "duplicate_items": [item.get('id') for item in duplicates]
                        })
                        validation["valid"] = False
                        validation["critical_error"] = True
            
            elif item_type == 'destructive_test':
                sample_id = created_item.get('sampleId')
                if sample_id:
                    duplicates = [item for item in existing_items 
                                if item.get('sampleId') == sample_id]
                    if duplicates:
                        validation["conflicts"].append({
                            "type": "duplicate_sample_id",
                            "message": f"Sample ID {sample_id} already exists",
                            "duplicate_items": [item.get('id') for item in duplicates]
                        })
                        validation["valid"] = False
                        validation["critical_error"] = True
            
            # Check coordinate validity - enhanced for structured location data
            item_x = created_item.get('x')
            item_y = created_item.get('y')
            expected_x = positioning.get('x')
            expected_y = positioning.get('y')
            
            # Extract structured location fields for validation context
            mapped_data = form_record.get('mapped_data', {})
            if isinstance(mapped_data, str):
                try:
                    mapped_data = json.loads(mapped_data)
                except:
                    mapped_data = {}
            
            structured_location = {
                "placement_type": mapped_data.get("placementType") or mapped_data.get("placement_type"),
                "location_distance": mapped_data.get("locationDistance") or mapped_data.get("location_distance"),
                "location_direction": mapped_data.get("locationDirection") or mapped_data.get("location_direction")
            }
            
            # Determine tolerance based on data source (structured = tighter tolerance)
            if structured_location.get("location_distance") is not None:
                # Structured data: tighter tolerance (5 units) since coordinates are precisely calculated
                tolerance = 5
                validation["structured_data_used"] = True
            else:
                # Text-based: looser tolerance (10 units) since coordinates are estimated
                tolerance = 10
                validation["structured_data_used"] = False
            
            if expected_x is not None and expected_y is not None:
                if item_x is None or item_y is None:
                    validation["errors"].append({
                        "type": "missing_coordinates",
                        "message": "Created item missing coordinates"
                    })
                    validation["valid"] = False
                else:
                    # Calculate distance difference
                    x_diff = abs(float(item_x) - float(expected_x))
                    y_diff = abs(float(item_y) - float(expected_y))
                    distance_diff = (x_diff ** 2 + y_diff ** 2) ** 0.5
                    
                    if x_diff > tolerance or y_diff > tolerance:
                        validation["warnings"].append({
                            "type": "coordinate_mismatch",
                            "message": f"Coordinates differ from expected: got ({item_x:.2f}, {item_y:.2f}), expected ({expected_x:.2f}, {expected_y:.2f}), difference: {distance_diff:.2f} units",
                            "x_difference": x_diff,
                            "y_difference": y_diff,
                            "distance_difference": distance_diff,
                            "tolerance": tolerance,
                            "structured_data": structured_location.get("location_distance") is not None
                        })
                        
                        # If using structured data and difference is significant, mark as error
                        if structured_location.get("location_distance") is not None and distance_diff > tolerance * 2:
                            validation["errors"].append({
                                "type": "significant_coordinate_mismatch",
                                "message": f"Significant coordinate mismatch with structured location data: {distance_diff:.2f} units difference (expected < {tolerance} units)"
                            })
                            validation["valid"] = False
                    else:
                        # Coordinates match within tolerance
                        validation["coordinate_validation"] = {
                            "status": "passed",
                            "item_coordinates": {"x": float(item_x), "y": float(item_y)},
                            "expected_coordinates": {"x": float(expected_x), "y": float(expected_y)},
                            "difference": {"x": x_diff, "y": y_diff, "distance": distance_diff},
                            "tolerance": tolerance,
                            "structured_data_used": structured_location.get("location_distance") is not None
                        }
            
            # Check for overlapping items (simplified check)
            if item_x is not None and item_y is not None:
                overlaps = self._check_overlaps(created_item, existing_items, item_type)
                if overlaps:
                    validation["warnings"].append({
                        "type": "overlapping_items",
                        "message": f"Item may overlap with {len(overlaps)} existing items",
                        "overlapping_ids": [item.get('id') for item in overlaps]
                    })
            
            # Validate required fields based on item type
            if item_type == 'panel':
                if not created_item.get('panelNumber'):
                    validation["errors"].append({
                        "type": "missing_required_field",
                        "message": "Panel number is required"
                    })
                    validation["valid"] = False
            
            elif item_type == 'patch':
                if not created_item.get('patchNumber'):
                    validation["errors"].append({
                        "type": "missing_required_field",
                        "message": "Patch number is required"
                    })
                    validation["valid"] = False
            
            elif item_type == 'destructive_test':
                if not created_item.get('sampleId'):
                    validation["errors"].append({
                        "type": "missing_required_field",
                        "message": "Sample ID is required"
                    })
                    validation["valid"] = False
            
        except Exception as e:
            logger.error(f"Error validating created item: {e}", exc_info=True)
            validation["errors"].append({
                "type": "validation_error",
                "message": f"Validation failed: {e}"
            })
            validation["valid"] = False
        
        return validation
    
    def _check_overlaps(self, item: Dict[str, Any], existing_items: List[Dict[str, Any]], item_type: str) -> List[Dict[str, Any]]:
        """Check if item overlaps with existing items (simplified spatial check)"""
        overlaps = []
        
        try:
            item_x = float(item.get('x', 0))
            item_y = float(item.get('y', 0))
            
            if item_type == 'panel':
                item_width = float(item.get('width', 0))
                item_height = float(item.get('height', 0))
                item_bounds = {
                    'left': item_x,
                    'right': item_x + item_width,
                    'top': item_y,
                    'bottom': item_y + item_height
                }
            elif item_type == 'patch':
                item_radius = float(item.get('radius', 1.5))
                item_bounds = {
                    'left': item_x - item_radius,
                    'right': item_x + item_radius,
                    'top': item_y - item_radius,
                    'bottom': item_y + item_radius
                }
            elif item_type == 'destructive_test':
                item_width = float(item.get('width', 0))
                item_height = float(item.get('height', 0))
                item_bounds = {
                    'left': item_x,
                    'right': item_x + item_width,
                    'top': item_y,
                    'bottom': item_y + item_height
                }
            else:
                return overlaps
            
            # Check against existing items
            for existing_item in existing_items:
                existing_x = float(existing_item.get('x', 0))
                existing_y = float(existing_item.get('y', 0))
                
                # Simple bounding box check
                if abs(existing_x - item_x) < 50 and abs(existing_y - item_y) < 50:
                    overlaps.append(existing_item)
        
        except Exception as e:
            logger.warning(f"Error checking overlaps: {e}")
        
        return overlaps
    
    async def _rollback_item_creation(
        self,
        item_id: str,
        item_type: str,
        project_id: str,
        session_id: str,
        user_id: str,
        browser_tools: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Attempt to rollback/delete a created item if validation fails"""
        try:
            interaction_tool = browser_tools.get("browser_interact")
            if not interaction_tool:
                return {
                    "success": False,
                    "error": "Interaction tool not available"
                }
            
            # Try to find and delete the item
            # This is a simplified rollback - in production, might want to use API delete endpoint
            logger.info(f"Attempting rollback for item {item_id} of type {item_type}")
            
            # For now, log the rollback attempt
            # In a full implementation, would navigate to item, click delete, confirm
            return {
                "success": True,
                "message": f"Rollback logged for item {item_id}",
                "note": "Full rollback implementation would delete item via UI or API"
            }
        
        except Exception as e:
            logger.error(f"Error in rollback: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }


def run_async(coro):
    """
    Helper function to run async coroutines in Flask context.
    Handles both cases where an event loop exists and where it doesn't.
    """
    try:
        return asyncio.run(coro)
    except RuntimeError:
        # If event loop already exists, create new one
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


# Global AI integration instance
ai_integration = None

def get_ai_integration() -> AIServiceIntegration:
    """Get the global AI integration instance"""
    global ai_integration
    if ai_integration is None:
        ai_integration = AIServiceIntegration()
    return ai_integration
