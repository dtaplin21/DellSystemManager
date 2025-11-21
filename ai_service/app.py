from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
import tempfile
import json
import traceback

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
    try:
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

@app.route('/hybrid/chat', methods=['POST'])
def hybrid_chat():
    """Handle chat messages using hybrid AI architecture"""
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
