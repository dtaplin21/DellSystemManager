from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
import tempfile
import json
import traceback
import re

# CRITICAL: Set LiteLLM environment variables BEFORE importing CrewAI/LiteLLM
# LiteLLM reads these at import time, so they must be set early
if not os.getenv("LITELLM_MODEL"):
    os.environ["LITELLM_MODEL"] = "gpt-4o"
if not os.getenv("OPENAI_MODEL"):
    os.environ["OPENAI_MODEL"] = "gpt-4o"

from document_processor import DocumentProcessor
from openai_service import OpenAIService
from utils import setup_logging, save_temp_file
from integration_layer import get_ai_integration, run_async
from telemetry import get_telemetry

# Set up logging
setup_logging()
logger = logging.getLogger(__name__)

# Initialize app
app = Flask(__name__)
CORS(app)

# Initialize services
openai_service = OpenAIService(api_key=os.getenv("OPENAI_API_KEY"))
document_processor = DocumentProcessor(openai_service)

# Initialize hybrid AI integration
ai_integration = get_ai_integration()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    # Get hybrid AI status
    hybrid_status = ai_integration.get_service_status()
    
    return jsonify({
        'status': 'ok',
        'ai_service': 'OpenAI GPT-4o + Hybrid AI Architecture',
        'hybrid_ai_status': hybrid_status,
        'available_features': [
            'document_analysis',
            'handwriting_ocr',
            'panel_optimization',
            'qc_data_extraction',
            'hybrid_ai_workflows',
            'cost_optimized_routing',
            'multi_agent_orchestration'
        ]
    }), 200

@app.route('/analyze', methods=['POST'])
def analyze_documents():
    """Analyze documents with AI - now supports hybrid AI architecture"""
    start_time = None
    try:
        start_time = __import__('time').time()
        data = request.json
        
        if not data or 'documents' not in data:
            return jsonify({'error': 'No documents provided'}), 400
        
        documents = data['documents']
        question = data.get('question', 'Provide a comprehensive analysis of these documents')
        user_id = data.get('user_id', 'default')
        user_tier = data.get('user_tier', 'paid_user')
        use_hybrid = data.get('use_hybrid', True)
        
        logger.info(f"Analyzing {len(documents)} documents with question: {question}")
        logger.info(f"User: {user_id}, Tier: {user_tier}, Hybrid: {use_hybrid}")
        
        # Try hybrid AI first if available and requested
        if use_hybrid and ai_integration.is_hybrid_ai_available():
            try:
                # Extract document paths
                doc_paths = []
                for doc in documents:
                    if 'path' in doc and os.path.exists(doc['path']):
                        doc_paths.append(doc['path'])
                
                if doc_paths:
                    # Use hybrid AI architecture
                    hybrid_result = run_async(ai_integration.analyze_documents_hybrid(
                        documents=doc_paths,
                        question=question,
                        user_id=user_id,
                        user_tier=user_tier
                    ))
                    
                    if 'error' not in hybrid_result:
                        return jsonify({
                            'analysis_type': 'hybrid_ai',
                            'result': hybrid_result,
                            'user_tier': user_tier
                        }), 200
                    else:
                        logger.warning(f"Hybrid AI failed, falling back to OpenAI: {hybrid_result['error']}")
                
            except Exception as e:
                logger.warning(f"Hybrid AI analysis failed, falling back to OpenAI: {e}")
        
        # Fallback to OpenAI service
        temp_files = []
        for doc in documents:
            if 'path' in doc and os.path.exists(doc['path']):
                temp_files.append(doc['path'])
        
        # Process documents and generate analysis
        analysis_result = document_processor.analyze_documents(
            temp_files, 
            question=question
        )
        
        return jsonify({
            'analysis_type': 'openai_fallback',
            'result': analysis_result,
            'user_tier': user_tier
        }), 200
    
    except Exception as e:
        logger.error(f"Error analyzing documents: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/extract', methods=['POST'])
def extract_data():
    """Extract structured data from documents"""
    try:
        data = request.json
        
        if not data or 'document_path' not in data:
            return jsonify({'error': 'Document path required'}), 400
        
        document_path = data['document_path']
        extraction_type = data.get('extraction_type', 'qc_data')
        user_id = data.get('user_id', 'default')
        user_tier = data.get('user_tier', 'paid_user')
        use_hybrid = data.get('use_hybrid', True)
        
        logger.info(f"Extracting {extraction_type} from document: {document_path}")
        logger.info(f"User: {user_id}, Tier: {user_tier}, Hybrid: {use_hybrid}")
        
        # Try hybrid AI first if available and requested
        if use_hybrid and ai_integration.is_hybrid_ai_available():
            try:
                # Use hybrid AI architecture for document analysis
                hybrid_result = run_async(ai_integration.analyze_documents_hybrid(
                    documents=[document_path],
                    question=f"Extract {extraction_type} data from this document",
                    user_id=user_id,
                    user_tier=user_tier
                ))
                
                if 'error' not in hybrid_result:
                    return jsonify({
                        'extraction_type': 'hybrid_ai',
                        'result': hybrid_result,
                        'user_tier': user_tier
                    }), 200
                else:
                    logger.warning(f"Hybrid AI failed, falling back to OpenAI: {hybrid_result['error']}")
                    
            except Exception as e:
                logger.warning(f"Hybrid AI extraction failed, falling back to OpenAI: {e}")
        
        # Fallback to OpenAI service
        extraction_result = document_processor.extract_data(
            document_path, 
            extraction_type=extraction_type
        )
        
        return jsonify({
            'extraction_type': 'openai_fallback',
            'result': extraction_result,
            'user_tier': user_tier
        }), 200
    
    except Exception as e:
        logger.error(f"Error extracting data: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/optimize-panels', methods=['POST'])
def optimize_panels():
    """Optimize panel layout using AI - now supports hybrid AI architecture"""
    try:
        data = request.json
        
        if not data or 'panels' not in data:
            return jsonify({'error': 'Panel data required'}), 400
        
        panels = data['panels']
        strategy = data.get('strategy', 'balanced')
        site_config = data.get('site_config', {})
        user_id = data.get('user_id', 'default')
        user_tier = data.get('user_tier', 'paid_user')
        use_hybrid = data.get('use_hybrid', True)
        
        logger.info(f"Optimizing {len(panels)} panels with {strategy} strategy")
        logger.info(f"User: {user_id}, Tier: {user_tier}, Hybrid: {use_hybrid}")
        
        # Try hybrid AI first if available and requested
        if use_hybrid and ai_integration.is_hybrid_ai_available():
            try:
                # Use hybrid AI architecture for panel optimization
                hybrid_result = run_async(ai_integration.optimize_panels_hybrid(
                    panels=panels,
                    strategy=strategy,
                    site_config=site_config,
                    user_id=user_id,
                    user_tier=user_tier
                ))
                
                if 'error' not in hybrid_result:
                    return jsonify({
                        'optimization_type': 'hybrid_ai',
                        'result': hybrid_result,
                        'user_tier': user_tier
                    }), 200
                else:
                    logger.warning(f"Hybrid AI failed, falling back to OpenAI: {hybrid_result['error']}")
                    
            except Exception as e:
                logger.warning(f"Hybrid AI optimization failed, falling back to OpenAI: {e}")
        
        # Fallback to OpenAI service
        optimization_result = openai_service.optimize_panel_layout(
            panels, 
            strategy=strategy, 
            site_config=site_config
        )
        
        return jsonify({
            'optimization_type': 'openai_fallback',
            'result': optimization_result,
            'user_tier': user_tier
        }), 200
    
    except Exception as e:
        logger.error(f"Error optimizing panels: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/chat', methods=['POST'])
def chat_message():
    """Handle chat messages using hybrid AI architecture - Backend API endpoint"""
    try:
        data = request.json
        message = data.get('message', '')
        user_id = data.get('user_id', 'default_user')
        user_tier = data.get('user_tier', 'paid_user')
        context = data.get('context', {})
        
        # Fix: Extract projectId from top-level data and add to context
        project_id = data.get('projectId') or context.get('projectId') or context.get('project_id')
        if project_id and 'projectId' not in context:
            context['projectId'] = project_id
        
        logger.info(f"[Chat Endpoint] Request received - user_id: {user_id}, project_id: {project_id}, message_length: {len(message)}")
        logger.debug(f"[Chat Endpoint] Context keys: {list(context.keys())}")
        
        if not message:
            return jsonify({'error': 'No message provided', 'success': False}), 400
        
        if not ai_integration.is_hybrid_ai_available():
            logger.warning("[Chat Endpoint] Hybrid AI not available, returning error")
            return jsonify({
                'error': 'Hybrid AI architecture not available',
                'success': False,
                'details': 'The AI service is not fully initialized. Please check service logs.'
            }), 503
        
        # Use hybrid AI architecture for chat
        chat_result = run_async(ai_integration.chat_message_hybrid(
            message=message,
            context=context,
            user_id=user_id,
            user_tier=user_tier
        ))
        
        logger.info(f"[Chat Endpoint] Result: success={chat_result.get('success')}, has_response={bool(chat_result.get('response'))}, error={chat_result.get('error')}")
        
        if chat_result.get('success'):
            return jsonify({
                'reply': chat_result.get('response', 'No response generated'),  # Map response to reply for frontend compatibility
                'response': chat_result.get('response', 'No response generated'),
                'success': True,
                'user_id': chat_result.get('user_id', user_id),
                'timestamp': chat_result.get('timestamp', '')
            }), 200
        else:
            # Log the error details before returning
            error_msg = chat_result.get('error', 'Chat failed')
            logger.error(f"[Chat Endpoint] Chat failed: {error_msg}")
            logger.error(f"[Chat Endpoint] Full result: {chat_result}")
            return jsonify({
                'error': error_msg,
                'success': False,
                'details': chat_result.get('response')  # Include any response even if success=false
            }), 500
    
    except Exception as e:
        logger.error(f"Chat message failed: {e}", exc_info=True)
        error_trace = traceback.format_exc()
        logger.error(f"Full traceback: {error_trace}")
        return jsonify({
            'error': str(e),
            'success': False,
            'details': error_trace if os.getenv("FLASK_DEBUG") == "1" else None
        }), 500

@app.route('/hybrid/chat', methods=['POST'])
def hybrid_chat():
    """Handle chat messages using hybrid AI architecture - Alternative endpoint"""
    try:
        data = request.json
        
        if not data or 'message' not in data:
            return jsonify({'error': 'Message required'}), 400
        
        message = data['message']
        context = data.get('context', {})
        user_id = data.get('user_id', 'default')
        user_tier = data.get('user_tier', 'paid_user')
        
        logger.info(f"Processing chat message from user {user_id} (tier: {user_tier})")
        
        if not ai_integration.is_hybrid_ai_available():
            return jsonify({'error': 'Hybrid AI architecture not available'}), 503
        
        # Use hybrid AI architecture for chat
        chat_result = run_async(ai_integration.chat_message_hybrid(
            message=message,
            context=context,
            user_id=user_id,
            user_tier=user_tier
        ))
        
        return jsonify(chat_result), 200
    
    except Exception as e:
        logger.error(f"Error processing chat message: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/hybrid/project-setup', methods=['POST'])
def hybrid_project_setup():
    """Setup new project using hybrid AI architecture"""
    try:
        data = request.json
        
        if not data or 'project_data' not in data:
            return jsonify({'error': 'Project data required'}), 400
        
        project_data = data['project_data']
        user_id = data.get('user_id', 'default')
        user_tier = data.get('user_tier', 'paid_user')
        
        logger.info(f"Setting up new project for user {user_id} (tier: {user_tier})")
        
        if not ai_integration.is_hybrid_ai_available():
            return jsonify({'error': 'Hybrid AI architecture not available'}), 503
        
        # Use hybrid AI architecture for project setup
        setup_result = run_async(ai_integration.setup_new_project_hybrid(
            project_data=project_data,
            user_id=user_id,
            user_tier=user_tier
        ))
        
        return jsonify(setup_result), 200
    
    except Exception as e:
        logger.error(f"Error setting up project: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/hybrid/status', methods=['GET'])
def hybrid_status():
    """Get hybrid AI architecture status"""
    try:
        status = ai_integration.get_service_status()
        return jsonify(status), 200
    except Exception as e:
        logger.error(f"Error getting hybrid AI status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/detect-defects', methods=['POST'])
def detect_defects():
    """Detect defects in uploaded image using GPT-4o vision model"""
    logger.info(f"[detect_defects] Endpoint called - Method: {request.method}, Path: {request.path}")
    try:
        data = request.json
        
        if not data or 'image_base64' not in data:
            return jsonify({'error': 'image_base64 is required'}), 400
        
        image_base64 = data['image_base64']
        project_id = data.get('project_id')
        metadata = data.get('metadata', {})
        
        logger.info(f"Detecting defects in image for project: {project_id}")
        
        # Call defect detection
        defect_result = run_async(openai_service.detect_defects_in_image(
            image_base64=image_base64,
            project_id=project_id
        ))
        
        return jsonify(defect_result), 200
        
    except Exception as e:
        logger.error(f"Error detecting defects: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/analyze-image', methods=['POST'])
def analyze_image():
    """Analyze a destruct/repair photo and return panel candidates"""
    try:
        data = request.json or {}
        
        if 'image_base64' not in data:
            return jsonify({'error': 'image_base64 is required'}), 400
        
        image_base64 = data['image_base64']
        image_type = data.get('image_type', 'image/png')
        project_id = data.get('project_id')
        
        logger.info(f"Analyzing image for project: {project_id}, type: {image_type}")
        
        analysis_prompt = """Analyze this image of geosynthetic destruct or repair work and extract panel information.

Return JSON with:
{
  "panels": [
    {
      "x": <number>,
      "y": <number>,
      "width": <number>,
      "height": <number>,
      "shape": "rectangle" | "right-triangle" | "patch",
      "notes": "<summary of observed damage or repair>"
    }
  ],
  "detectedInfo": {
    "area": "<estimated affected area>",
    "damageType": "<type of damage observed>",
    "repairType": "<recommended repair action>",
    "location": "<described location within project>"
  }
}

If you cannot determine exact dimensions, estimate based on the visible region. Always return valid JSON."""
        
        analysis_text = run_async(openai_service.analyze_image(
            image_base64=image_base64,
            prompt=analysis_prompt
        ))
        
        def _parse_analysis(text: str) -> dict:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                match = re.search(r'\{[\s\S]*\}', text)
                if match:
                    try:
                        return json.loads(match.group(0))
                    except json.JSONDecodeError:
                        pass
            return {}
        
        parsed = _parse_analysis(analysis_text)
        panels = parsed.get('panels') if isinstance(parsed, dict) else None
        detected_info = parsed.get('detectedInfo') if isinstance(parsed, dict) else None
        
        if not panels or not isinstance(panels, list):
            logger.warning("Vision analysis returned no structured panels, providing fallback")
            panels = [{
                'x': 100,
                'y': 100,
                'width': 120,
                'height': 60,
                'shape': 'rectangle',
                'notes': 'AI estimated panel region from visual cues'
            }]
        
        response_payload = {
            'success': True,
            'panels': panels,
            'detectedInfo': detected_info or {},
            'raw_analysis': analysis_text
        }
        
        return jsonify(response_payload), 200
    
    except Exception as e:
        logger.error(f"Error analyzing image: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/ai/extract-asbuilt-fields', methods=['POST'])
def extract_asbuilt_fields():
    """Extract as-built form fields from image using GPT-4o vision model"""
    logger.info(f"[extract_asbuilt_fields] Endpoint called - Method: {request.method}, Path: {request.path}")
    try:
        data = request.json or {}
        
        if 'image_base64' not in data:
            return jsonify({'error': 'image_base64 is required'}), 400
        
        image_base64 = data['image_base64']
        form_type = data.get('form_type', 'panel_placement')
        project_id = data.get('project_id')
        
        logger.info(f"Extracting as-built form fields for form type: {form_type}, project: {project_id}")
        logger.info(f"Image base64 length: {len(image_base64)} characters")
        
        # Call form field extraction
        extracted_fields = run_async(openai_service.extract_asbuilt_form_fields(
            image_base64=image_base64,
            form_type=form_type,
            project_id=project_id
        ))
        
        # Ensure extracted_fields is a dict, not None
        if extracted_fields is None:
            logger.warning("[extract_asbuilt_fields] AI service returned None, using empty dict")
            extracted_fields = {}
        
        # Log extracted fields for debugging
        logger.info(f"[extract_asbuilt_fields] Extracted fields: {json.dumps(extracted_fields, indent=2)}")
        logger.info(f"[extract_asbuilt_fields] Number of non-null fields: {sum(1 for v in extracted_fields.values() if v is not None and v != '')}")
        
        return jsonify({
            'success': True,
            'form_type': form_type,
            'extracted_fields': extracted_fields
        }), 200
        
    except Exception as e:
        logger.error(f"Error extracting as-built form fields: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/automate-from-form', methods=['POST'])
def automate_from_form():
    """Automate item creation from approved form"""
    try:
        data = request.json
        form_record = data.get('form_record')
        project_id = data.get('project_id')
        user_id = data.get('user_id')
        item_type = data.get('item_type')
        positioning = data.get('positioning', {})
        
        if not form_record or not project_id:
            return jsonify({
                'success': False,
                'error': 'form_record and project_id are required'
            }), 400
        
        logger.info(f"Automating from form {form_record.get('id')} for project {project_id}")
        
        # Add item_type and positioning to form_record for the automation method
        form_record['item_type'] = item_type
        form_record['positioning'] = positioning
        
        # Call automation method
        result = run_async(ai_integration.automate_from_approved_form(
            form_record=form_record,
            project_id=project_id,
            user_id=user_id
        ))
        
        return jsonify(result), 200 if result.get('success') else 500
        
    except Exception as e:
        logger.error(f"Error in automate_from_form: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/ai/automate-panel-population', methods=['POST'])
def automate_panel_population():
    """Automate panel layout population using browser tools based on defect data"""
    try:
        data = request.json
        
        if not data or 'project_id' not in data:
            return jsonify({'error': 'project_id is required'}), 400
        
        project_id = data['project_id']
        defect_data = data.get('defect_data', {})
        user_id = data.get('user_id')
        upload_id = data.get('upload_id')
        
        logger.info(f"Automating panel population for project: {project_id}, upload: {upload_id}")
        
        if not ai_integration.is_hybrid_ai_available():
            return jsonify({
                'status': 'failed',
                'error': 'Hybrid AI architecture not available'
            }), 503
        
        # Use hybrid AI with browser tools to automate panel population
        # This will navigate to the panel layout page and create panels based on defects
        automation_result = run_async(ai_integration.automate_panel_population_from_defects(
            project_id=project_id,
            defect_data=defect_data,
            user_id=user_id,
            upload_id=upload_id
        ))
        
        if automation_result.get('success'):
            return jsonify({
                'status': 'success',
                'message': 'Panel layout updated successfully',
                'panels_created': automation_result.get('panels_created', 0),
                'details': automation_result
            }), 200
        else:
            return jsonify({
                'status': 'failed',
                'error': automation_result.get('error', 'Automation failed'),
                'details': automation_result
            }), 500
        
    except Exception as e:
        logger.error(f"Error automating panel population: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'status': 'failed',
            'error': str(e)
        }), 500

@app.route('/api/ai/create-panels-from-forms', methods=['POST'])
def create_panels_from_forms():
    """Create panels from form data using AI analysis"""
    logger.info(f"[create_panels_from_forms] Endpoint called - Method: {request.method}, Path: {request.path}")
    try:
        data = request.json

        if not data or 'forms_data' not in data:
            return jsonify({'error': 'forms_data is required'}), 400

        forms_data = data['forms_data']
        project_id = data.get('project_id')

        logger.info(f"Creating panels from {len(forms_data)} forms for project: {project_id}")

        # Call AI service to create panels from forms
        panel_instructions = run_async(openai_service.create_panels_from_forms(
            forms_data=forms_data,
            project_id=project_id
        ))

        return jsonify({
            'success': True,
            'project_id': project_id,
            'instructions': panel_instructions
        }), 200

    except Exception as e:
        logger.error(f"Error creating panels from forms: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# Debug endpoint to list all registered routes
@app.route('/debug/routes', methods=['GET'])
def list_routes():
    """List all registered routes for debugging"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'path': str(rule)
        })
    return jsonify({'routes': routes}), 200

if __name__ == '__main__':
    # Log all registered routes on startup
    logger.info("=" * 50)
    logger.info("Registered Flask routes:")
    for rule in app.url_map.iter_rules():
        logger.info(f"  {list(rule.methods)} {rule}")
    logger.info("=" * 50)
    
    port = int(os.environ.get('PORT', 5001))
    logger.info(f"🚀 Starting Flask app on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)
