from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
import tempfile
import json
import traceback
from document_processor import DocumentProcessor
from openai_service import OpenAIService
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

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'ai_service': 'OpenAI GPT-4o',
        'available_features': [
            'document_analysis',
            'handwriting_ocr',
            'panel_optimization',
            'qc_data_extraction'
        ]
    }), 200

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
        data = request.json
        
        if not data or 'document_path' not in data:
            return jsonify({'error': 'Document path required'}), 400
        
        document_path = data['document_path']
        extraction_type = data.get('extraction_type', 'qc_data')
        
        logger.info(f"Extracting {extraction_type} from document: {document_path}")
        
        # Extract data using document processor
        extraction_result = document_processor.extract_data(
            document_path, 
            extraction_type=extraction_type
        )
        
        return jsonify(extraction_result), 200
    
    except Exception as e:
        logger.error(f"Error extracting data: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/optimize-panels', methods=['POST'])
def optimize_panels():
    """Optimize panel layout using AI"""
    try:
        data = request.json
        
        if not data or 'panels' not in data:
            return jsonify({'error': 'Panel data required'}), 400
        
        panels = data['panels']
        strategy = data.get('strategy', 'balanced')
        site_config = data.get('site_config', {})
        
        logger.info(f"Optimizing {len(panels)} panels with {strategy} strategy")
        
        # Use OpenAI to generate optimization recommendations
        optimization_result = openai_service.optimize_panel_layout(
            panels, 
            strategy=strategy, 
            site_config=site_config
        )
        
        return jsonify(optimization_result), 200
    
    except Exception as e:
        logger.error(f"Error optimizing panels: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
