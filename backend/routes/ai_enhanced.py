# Enhanced AI Routes: OpenAI-Only Implementation
# This extends your existing routes with OpenAI-powered AI capabilities

import asyncio
import json
import logging
from typing import Dict, Any, Optional
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import sys
from pathlib import Path
import os
import openai

logger = logging.getLogger(__name__)

# Create blueprint
ai_enhanced_bp = Blueprint('ai_enhanced', __name__)

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

# === ENHANCED PANEL ROUTES ===
@ai_enhanced_bp.route('/api/ai/panels/optimize', methods=['POST'])
@cross_origin()
async def optimize_panels():
    """Enhanced panel optimization with OpenAI"""
    try:
        data = request.get_json()
        panels = data.get('panels', [])
        strategy = data.get('strategy', 'balanced')
        site_config = data.get('site_config', {})
        
        if not panels:
            return jsonify({"error": "No panels provided", "success": False}), 400
        
        # Use OpenAI for optimization
        prompt = f"Optimize panel layout with strategy: {strategy}. Panels: {json.dumps(panels)}. Site config: {json.dumps(site_config)}"
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000
        )
        result = response.choices[0].message.content
        
        return jsonify({"result": result, "success": True})
    except Exception as e:
        logger.error(f"Panel optimization failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === ENHANCED DOCUMENT ANALYSIS ROUTES ===
@ai_enhanced_bp.route('/api/ai/documents/analyze', methods=['POST'])
@cross_origin()
async def analyze_document():
    """Enhanced document analysis with OpenAI"""
    try:
        data = request.get_json()
        document_text = data.get('document_text', '')
        question = data.get('question', 'Provide a comprehensive analysis of this document')
        
        if not document_text:
            return jsonify({"error": "No document text provided", "success": False}), 400
        
        # Use OpenAI for analysis
        prompt = f"Question: {question}\n\nDocument: {document_text}"
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000
        )
        result = response.choices[0].message.content
        
        return jsonify({"result": result, "success": True})
    except Exception as e:
        logger.error(f"Document analysis failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@ai_enhanced_bp.route('/api/ai/documents/extract', methods=['POST'])
@cross_origin()
async def extract_document_data():
    """Extract structured data from documents using OpenAI"""
    try:
        data = request.get_json()
        document_text = data.get('document_text', '')
        extraction_type = data.get('extraction_type', 'qc_data')
        
        if not document_text:
            return jsonify({"error": "No document text provided", "success": False}), 400
        
        # Define extraction prompts based on type
        extraction_prompts = {
            'qc_data': "Extract quality control test data, measurements, and results from this document. Include test dates, values, pass/fail status, and standards referenced.",
            'material_specs': "Extract material specifications, properties, and technical parameters from this document.",
            'site_info': "Extract site information including dimensions, coordinates, soil conditions, and environmental factors.",
            'test_results': "Extract all test results, measurements, and quality assurance data with their corresponding values and units."
        }
        
        extraction_prompt = extraction_prompts.get(extraction_type, extraction_prompts['qc_data'])
        
        # Use OpenAI for extraction
        prompt = f"{extraction_prompt}\n\nDocument: {document_text}"
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000
        )
        result = response.choices[0].message.content
        
        return jsonify({"result": result, "success": True})
    except Exception as e:
        logger.error(f"Document extraction failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === ENHANCED QC ANALYSIS ROUTES ===
@ai_enhanced_bp.route('/api/ai/qc/analyze', methods=['POST'])
@cross_origin()
async def analyze_qc_data():
    """Analyze QC data using OpenAI"""
    try:
        data = request.get_json()
        qc_data = data.get('qc_data', [])
        
        if not qc_data:
            return jsonify({"error": "No QC data provided", "success": False}), 400
        
        # Convert QC data to JSON string for analysis
        qc_data_json = json.dumps(qc_data)
        
        # Use OpenAI for analysis
        prompt = f"Analyze this QC data and provide insights: {qc_data_json}"
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000
        )
        result = response.choices[0].message.content
        
        return jsonify({"result": result, "success": True})
    except Exception as e:
        logger.error(f"QC analysis failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === ENHANCED PROJECT RECOMMENDATIONS ===
@ai_enhanced_bp.route('/api/ai/projects/recommendations', methods=['POST'])
@cross_origin()
async def generate_recommendations():
    """Generate project recommendations using OpenAI"""
    try:
        data = request.get_json()
        project_data = data.get('project_data', {})
        
        if not project_data:
            return jsonify({"error": "No project data provided", "success": False}), 400
        
        # Use OpenAI for recommendations
        prompt = f"Generate project recommendations based on this data: {json.dumps(project_data)}"
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000
        )
        result = response.choices[0].message.content
        
        return jsonify({"result": result, "success": True})
    except Exception as e:
        logger.error(f"Recommendations generation failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === UTILITY ROUTES ===
@ai_enhanced_bp.route('/api/ai/models', methods=['GET'])
@cross_origin()
async def get_available_models():
    """Get available AI models and their configurations"""
    try:
        models_info = {
            "gpt-4o": {
                "name": "gpt-4o",
                "tier": "cloud_premium",
                "cost_per_1k_tokens": 0.005,
                "max_context": 128000,
                "specialized_for": ["document_analysis", "panel_optimization", "qc_analysis", "recommendations"]
            }
        }
        
        return jsonify(models_info)
    except Exception as e:
        logger.error(f"Model info failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@ai_enhanced_bp.route('/api/ai/health', methods=['GET'])
@cross_origin()
async def health_check():
    """Health check for AI services"""
    try:
        health_status = {
            "ai_service": "healthy",
            "provider": "OpenAI",
            "model": "gpt-4o",
            "available_features": [
                "document_analysis",
                "panel_optimization", 
                "qc_analysis",
                "data_extraction",
                "recommendations"
            ]
        }
        return jsonify(health_status)
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === ERROR HANDLERS ===
@ai_enhanced_bp.errorhandler(404)
def not_found(error):
    return jsonify({"error": "AI route not found", "success": False}), 404

@ai_enhanced_bp.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal AI service error", "success": False}), 500

# === REGISTRATION FUNCTION ===
def register_ai_enhanced_routes(app):
    """Register AI enhanced routes with Flask app"""
    app.register_blueprint(ai_enhanced_bp)
    logger.info("AI enhanced routes registered successfully")

# === USAGE EXAMPLE ===
if __name__ == "__main__":
    from flask import Flask
    
    app = Flask(__name__)
    register_ai_enhanced_routes(app)
    
    # Test routes
    @app.route('/test/ai')
    def test_ai():
        return "AI enhanced routes are working!"
    
    app.run(debug=True, port=5001) 