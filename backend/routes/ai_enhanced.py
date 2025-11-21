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
        prompt = f"{extraction_prompt}\n\nDocument: {document_text}\n\nPlease provide the extracted data in JSON format."
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500
        )
        result = response.choices[0].message.content
        
        # Try to parse JSON from response
        try:
            parsed_result = json.loads(result)
            return jsonify({"result": parsed_result, "success": True})
        except json.JSONDecodeError:
            return jsonify({"result": result, "success": True, "note": "Result is not in JSON format"})
            
    except Exception as e:
        logger.error(f"Document extraction failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@ai_enhanced_bp.route('/api/ai/qc/analyze', methods=['POST'])
@cross_origin()
async def analyze_qc_data():
    """Analyze QC data using OpenAI for pattern recognition and anomaly detection"""
    try:
        data = request.get_json()
        qc_data = data.get('qc_data', [])
        analysis_type = data.get('analysis_type', 'comprehensive')
        
        if not qc_data:
            return jsonify({"error": "No QC data provided", "success": False}), 400
        
        # Define analysis prompts based on type
        analysis_prompts = {
            'comprehensive': "Analyze this QC data comprehensively. Look for patterns, trends, anomalies, and provide insights about data quality, consistency, and potential issues.",
            'anomalies': "Identify anomalies and outliers in this QC data. Highlight any values that seem unusual or outside expected ranges.",
            'trends': "Analyze trends in this QC data over time. Identify any patterns, seasonal variations, or systematic changes.",
            'quality': "Assess the overall quality of this QC data. Identify any data integrity issues, missing values, or inconsistencies."
        }
        
        analysis_prompt = analysis_prompts.get(analysis_type, analysis_prompts['comprehensive'])
        
        # Convert QC data to readable format
        qc_data_text = json.dumps(qc_data, indent=2)
        
        # Use OpenAI for analysis
        prompt = f"{analysis_prompt}\n\nQC Data:\n{qc_data_text}\n\nPlease provide a detailed analysis with specific findings and recommendations."
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000
        )
        result = response.choices[0].message.content
        
        return jsonify({"result": result, "success": True})
    except Exception as e:
        logger.error(f"QC analysis failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@ai_enhanced_bp.route('/api/ai/projects/recommendations', methods=['POST'])
@cross_origin()
async def generate_recommendations():
    """Generate project recommendations using OpenAI based on project data and requirements"""
    try:
        data = request.get_json()
        project_data = data.get('project_data', {})
        recommendation_type = data.get('recommendation_type', 'general')
        
        if not project_data:
            return jsonify({"error": "No project data provided", "success": False}), 400
        
        # Define recommendation prompts based on type
        recommendation_prompts = {
            'general': "Based on this project data, provide general recommendations for project planning, risk mitigation, and best practices.",
            'materials': "Analyze the project requirements and provide specific material recommendations, including alternatives and cost optimization strategies.",
            'timeline': "Based on the project scope and constraints, provide timeline recommendations and critical path analysis.",
            'quality': "Provide quality assurance and quality control recommendations based on the project specifications and requirements.",
            'safety': "Analyze the project for potential safety considerations and provide safety recommendations and best practices."
        }
        
        recommendation_prompt = recommendation_prompts.get(recommendation_type, recommendation_prompts['general'])
        
        # Convert project data to readable format
        project_data_text = json.dumps(project_data, indent=2)
        
        # Use OpenAI for recommendations
        prompt = f"{recommendation_prompt}\n\nProject Data:\n{project_data_text}\n\nPlease provide specific, actionable recommendations with rationale."
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000
        )
        result = response.choices[0].message.content
        
        return jsonify({"result": result, "success": True})
    except Exception as e:
        logger.error(f"Recommendation generation failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@ai_enhanced_bp.route('/api/ai/models', methods=['GET'])
@cross_origin()
async def get_available_models():
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
                "gpt-4o": {
                    "name": "GPT-4o",
                    "capabilities": ["text_analysis", "reasoning", "document_processing", "vision"],
                    "max_tokens": 128000,
                    "cost_per_1k_tokens": 0.015
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

@ai_enhanced_bp.route('/api/ai/health', methods=['GET'])
@cross_origin()
async def health_check():
    """Health check for AI service"""
    try:
        # Test OpenAI connection
        try:
            response = openai.ChatCompletion.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=5
            )
            openai_status = "connected"
        except Exception as e:
            openai_status = f"error: {str(e)}"
        
        health_status = {
            "status": "healthy",
            "timestamp": str(datetime.datetime.now()),
            "services": {
                "openai": openai_status,
                "document_processing": "available",
                "qc_analysis": "available"
            }
        }
        
        return jsonify(health_status)
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

# === ERROR HANDLERS ===
@ai_enhanced_bp.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found", "success": False}), 404

@ai_enhanced_bp.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error", "success": False}), 500

# === REGISTRATION FUNCTION ===
def register_ai_enhanced_routes(app):
    """Register all AI enhanced routes with the Flask app"""
    app.register_blueprint(ai_enhanced_bp)
    
    # Add a test route to verify integration
    @app.route('/test/ai')
    def test_ai():
        return jsonify({
            "message": "AI Enhanced Routes are working!",
            "endpoints": [
                "/api/ai/panels/optimize",
                "/api/ai/documents/analyze",
                "/api/ai/documents/extract",
                "/api/ai/qc/analyze",
                "/api/ai/projects/recommendations",
                "/api/ai/models",
                "/api/ai/health"
            ]
        })

# Import datetime for health check
import datetime 