from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
import tempfile
import json
import traceback
import asyncio
from document_processor import DocumentProcessor
from openai_service import OpenAIService
from hybrid_ai_architecture import DellSystemAIService
from utils import setup_logging, save_temp_file

# Set up logging
setup_logging()
logger = logging.getLogger(__name__)

# Initialize app
app = Flask(__name__)
CORS(app)

# Initialize services
openai_service = OpenAIService(api_key=os.getenv("OPENAI_API_KEY"))
document_processor = DocumentProcessor(openai_service)
hybrid_ai_service = DellSystemAIService(
    redis_host=os.getenv("REDIS_HOST", "localhost"),
    redis_port=int(os.getenv("REDIS_PORT", 6379))
)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

@app.route('/analyze', methods=['POST'])
def analyze_documents():
    """Analyze documents with AI"""
    try:
        data = request.json
        
        if not data or 'documents' not in data:
            return jsonify({'error': 'No documents provided'}), 400
        
        documents = data['documents']
        question = data.get('question', 'Provide a comprehensive analysis of these documents')
        
        logger.info(f"Analyzing {len(documents)} documents with question: {question}")
        
        # Save documents to temporary files if they have a path
        temp_files = []
        for doc in documents:
            if 'path' in doc and os.path.exists(doc['path']):
                temp_files.append(doc['path'])
        
        # Process documents and generate analysis
        analysis_result = document_processor.analyze_documents(
            temp_files, 
            question=question
        )
        
        return jsonify(analysis_result), 200
    
    except Exception as e:
        logger.error(f"Error analyzing documents: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/extract', methods=['POST'])
def extract_data():
    """Extract structured data from documents"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Empty file name'}), 400
        
        # Save file to a temporary location
        temp_file_path = save_temp_file(file)
        
        # Extract data using document processor
        extraction_type = request.form.get('type', 'auto')
        extracted_data = document_processor.extract_data(temp_file_path, extraction_type)
        
        # Clean up temporary file
        os.unlink(temp_file_path)
        
        return jsonify(extracted_data), 200
    
    except Exception as e:
        logger.error(f"Error extracting data: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/analyze_qc_data', methods=['POST'])
def analyze_qc_data():
    """Analyze QC data to find patterns and anomalies"""
    try:
        data = request.json
        
        if not data or 'qcData' not in data:
            return jsonify({'error': 'No QC data provided'}), 400
        
        qc_data = data['qcData']
        
        logger.info(f"Analyzing {len(qc_data)} QC data records")
        
        # Convert QC data to JSON string for analysis
        qc_data_json = json.dumps(qc_data)
        
        # Generate analysis using OpenAI
        analysis = openai_service.analyze_qc_data(qc_data_json)
        
        return jsonify({'analysis': analysis}), 200
    
    except Exception as e:
        logger.error(f"Error analyzing QC data: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# === HYBRID AI ARCHITECTURE ENDPOINTS ===

@app.route('/api/ai/panels/optimize', methods=['POST'])
def optimize_panels():
    """Optimize panel layouts using hybrid AI architecture"""
    try:
        data = request.json
        panels = data.get('panels', [])
        strategy = data.get('strategy', 'balanced')
        site_config = data.get('site_config', {})
        user_id = data.get('user_id', 'default_user')
        user_tier = data.get('user_tier', 'paid_user')
        
        if not panels:
            return jsonify({'error': 'No panels provided', 'success': False}), 400
        
        # Use hybrid AI service for optimization
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                hybrid_ai_service.handle_layout_optimization(
                    user_id=user_id,
                    user_tier=user_tier,
                    layout_data={
                        'panels': panels,
                        'strategy': strategy,
                        'site_config': site_config
                    }
                )
            )
            
            if result.get('success'):
                return jsonify({
                    'result': result.get('result', 'Optimization completed'),
                    'success': True,
                    'cost': result.get('cost', 0),
                    'workflow': result.get('workflow', 'layout_optimization')
                })
            else:
                return jsonify({
                    'error': result.get('error', 'Optimization failed'),
                    'success': False
                }), 500
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Panel optimization failed: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/ai/documents/analyze', methods=['POST'])
def analyze_document():
    """Analyze documents using hybrid AI architecture"""
    try:
        data = request.json
        document_text = data.get('document_text', '')
        question = data.get('question', 'Provide a comprehensive analysis of this document')
        user_id = data.get('user_id', 'default_user')
        user_tier = data.get('user_tier', 'paid_user')
        
        if not document_text:
            return jsonify({'error': 'No document text provided', 'success': False}), 400
        
        # Use hybrid AI service for document analysis
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                hybrid_ai_service.handle_document_analysis(
                    user_id=user_id,
                    user_tier=user_tier,
                    document_path='text_input',
                    analysis_type='comprehensive'
                )
            )
            
            if result.get('success'):
                return jsonify({
                    'result': result.get('result', 'Analysis completed'),
                    'success': True,
                    'cost': result.get('cost', 0)
                })
            else:
                return jsonify({
                    'error': result.get('error', 'Analysis failed'),
                    'success': False
                }), 500
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Document analysis failed: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/ai/documents/extract', methods=['POST'])
def extract_document_data():
    """Extract structured data from documents using hybrid AI architecture"""
    try:
        data = request.json
        document_text = data.get('document_text', '')
        extraction_type = data.get('extraction_type', 'qc_data')
        user_id = data.get('user_id', 'default_user')
        user_tier = data.get('user_tier', 'paid_user')
        
        if not document_text:
            return jsonify({'error': 'No document text provided', 'success': False}), 400
        
        # Use hybrid AI service for data extraction
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                hybrid_ai_service.handle_document_analysis(
                    user_id=user_id,
                    user_tier=user_tier,
                    document_path='text_input',
                    analysis_type=extraction_type
                )
            )
            
            if result.get('success'):
                return jsonify({
                    'result': result.get('result', 'Extraction completed'),
                    'success': True,
                    'cost': result.get('cost', 0)
                })
            else:
                return jsonify({
                    'error': result.get('error', 'Extraction failed'),
                    'success': False
                }), 500
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Document extraction failed: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/ai/qc/analyze', methods=['POST'])
def analyze_qc_data_hybrid():
    """Analyze QC data using hybrid AI architecture"""
    try:
        data = request.json
        qc_data = data.get('qc_data', [])
        analysis_type = data.get('analysis_type', 'comprehensive')
        user_id = data.get('user_id', 'default_user')
        user_tier = data.get('user_tier', 'paid_user')
        
        if not qc_data:
            return jsonify({'error': 'No QC data provided', 'success': False}), 400
        
        # Use hybrid AI service for QC analysis
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Create a mock document path for QC data analysis
            qc_document = f"qc_data_{len(qc_data)}_records"
            
            result = loop.run_until_complete(
                hybrid_ai_service.handle_document_analysis(
                    user_id=user_id,
                    user_tier=user_tier,
                    document_path=qc_document,
                    analysis_type=analysis_type
                )
            )
            
            if result.get('success'):
                return jsonify({
                    'result': result.get('result', 'QC analysis completed'),
                    'success': True,
                    'cost': result.get('cost', 0)
                })
            else:
                return jsonify({
                    'error': result.get('error', 'QC analysis failed'),
                    'success': False
                }), 500
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"QC analysis failed: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/ai/projects/recommendations', methods=['POST'])
def generate_recommendations():
    """Generate project recommendations using hybrid AI architecture"""
    try:
        data = request.json
        project_data = data.get('project_data', {})
        recommendation_type = data.get('recommendation_type', 'general')
        user_id = data.get('user_id', 'default_user')
        user_tier = data.get('user_tier', 'paid_user')
        
        if not project_data:
            return jsonify({'error': 'No project data provided', 'success': False}), 400
        
        # Use hybrid AI service for project recommendations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                hybrid_ai_service.handle_new_project(
                    user_id=user_id,
                    user_tier=user_tier,
                    project_data={
                        'project_data': project_data,
                        'recommendation_type': recommendation_type
                    }
                )
            )
            
            if result.get('success'):
                return jsonify({
                    'result': result.get('result', 'Recommendations generated'),
                    'success': True,
                    'cost': result.get('cost', 0),
                    'workflow': result.get('workflow', 'new_project_setup')
                })
            else:
                return jsonify({
                    'error': result.get('error', 'Recommendations failed'),
                    'success': False
                }), 500
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Recommendation generation failed: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/ai/models', methods=['GET'])
def get_available_models():
    """Get available AI models and their capabilities"""
    try:
        models = {
            "openai": {
                "gpt-4o": {
                    "name": "GPT-4 Omni",
                    "capabilities": ["text_analysis", "reasoning", "document_processing", "code_generation"],
                    "max_tokens": 128000,
                    "cost_per_1k_tokens": 0.005
                },
                "gpt-4-turbo": {
                    "name": "GPT-4 Turbo",
                    "capabilities": ["text_analysis", "reasoning", "document_processing"],
                    "max_tokens": 128000,
                    "cost_per_1k_tokens": 0.03
                },
                "gpt-3.5-turbo": {
                    "name": "GPT-3.5 Turbo",
                    "capabilities": ["text_analysis", "basic_reasoning", "document_processing"],
                    "max_tokens": 16384,
                    "cost_per_1k_tokens": 0.002
                }
            },
            "local": {
                "llama3:8b": {
                    "name": "Llama 3 8B",
                    "capabilities": ["text_analysis", "basic_reasoning"],
                    "max_tokens": 8192,
                    "cost_per_1k_tokens": 0.0
                }
            }
        }
        
        return jsonify({"models": models, "success": True})
    except Exception as e:
        logger.error(f"Failed to get models: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/api/ai/health', methods=['GET'])
def health_check_hybrid():
    """Health check for hybrid AI service"""
    try:
        # Test OpenAI connection
        try:
            openai_test = openai_service.analyze_qc_data("test")
            openai_status = "connected"
        except Exception as e:
            openai_status = f"error: {str(e)}"
        
        # Test hybrid AI service
        try:
            hybrid_status = "available"
        except Exception as e:
            hybrid_status = f"error: {str(e)}"
        
        health_status = {
            "status": "healthy" if openai_status == "connected" else "degraded",
            "timestamp": str(datetime.datetime.now()),
            "services": {
                "openai": openai_status,
                "hybrid_ai": hybrid_status,
                "document_processing": "available",
                "qc_analysis": "available"
            }
        }
        
        return jsonify(health_status)
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

@app.route('/api/ai/chat', methods=['POST'])
def chat_message():
    """Handle chat messages using hybrid AI architecture"""
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
        
        # Use hybrid AI service for chat
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                hybrid_ai_service.handle_chat_message(
                    user_id=user_id,
                    user_tier=user_tier,
                    message=message,
                    context=context
                )
            )
            
            if result.get('success'):
                return jsonify({
                    'reply': result.get('response', 'No response generated'),  # Map response to reply for frontend compatibility
                    'response': result.get('response', 'No response generated'),
                    'success': True,
                    'user_id': result.get('user_id', user_id),
                    'timestamp': result.get('timestamp', '')
                })
            else:
                return jsonify({
                    'error': result.get('error', 'Chat failed'),
                    'success': False
                }), 500
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Chat message failed: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

if __name__ == '__main__':
    import datetime
    port = int(os.getenv("PORT", 5001))
    app.run(host='0.0.0.0', port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
