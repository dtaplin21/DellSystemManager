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

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5001))
    app.run(host='0.0.0.0', port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
