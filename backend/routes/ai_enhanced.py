# Enhanced AI Routes: Integrates Hybrid AI Architecture with Existing Backend
# This extends your existing routes with AI capabilities

import asyncio
import json
import logging
from typing import Dict, Any, Optional
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import sys
from pathlib import Path

# Add AI service to path
sys.path.append(str(Path(__file__).parent.parent.parent / "ai-service"))
from integration_layer import APIRoutesIntegration
from hybrid_ai_architecture import DellSystemAIService

logger = logging.getLogger(__name__)

# Create blueprint
ai_enhanced_bp = Blueprint('ai_enhanced', __name__)

# Initialize AI service
ai_service = DellSystemAIService()
api_integration = APIRoutesIntegration(ai_service)

# === ENHANCED PANEL ROUTES ===
@ai_enhanced_bp.route('/api/ai/panels/optimize', methods=['POST'])
@cross_origin()
async def optimize_panels():
    """Enhanced panel optimization with AI"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'anonymous')
        user_tier = data.get('user_tier', 'free_user')
        layout_data = data.get('layout_data', {})
        
        result = await api_integration.handle_ai_route(
            route_type="optimize",
            user_id=user_id,
            user_tier=user_tier,
            data={"layout_data": layout_data}
        )
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Panel optimization failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@ai_enhanced_bp.route('/api/ai/panels/enhance', methods=['POST'])
@cross_origin()
async def enhance_panel_operation():
    """Enhance panel operations with AI suggestions"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'anonymous')
        user_tier = data.get('user_tier', 'free_user')
        action = data.get('action', 'create')
        panel_data = data.get('panel_data', {})
        
        result = await api_integration.handle_ai_route(
            route_type="enhance_panel",
            user_id=user_id,
            user_tier=user_tier,
            data={"action": action, "panel_data": panel_data}
        )
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Panel enhancement failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === ENHANCED CHAT ROUTES ===
@ai_enhanced_bp.route('/api/ai/chat', methods=['POST'])
@cross_origin()
async def ai_chat():
    """Enhanced AI chat with context awareness"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'anonymous')
        user_tier = data.get('user_tier', 'free_user')
        message = data.get('message', '')
        context = data.get('context', {})
        
        result = await api_integration.handle_ai_route(
            route_type="chat",
            user_id=user_id,
            user_tier=user_tier,
            data={"message": message, "context": context}
        )
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"AI chat failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === ENHANCED DOCUMENT ANALYSIS ROUTES ===
@ai_enhanced_bp.route('/api/ai/documents/analyze', methods=['POST'])
@cross_origin()
async def analyze_document():
    """Enhanced document analysis with AI"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'anonymous')
        user_tier = data.get('user_tier', 'free_user')
        document_path = data.get('document_path', '')
        analysis_type = data.get('analysis_type', 'general')
        
        result = await api_integration.handle_ai_route(
            route_type="analyze_document",
            user_id=user_id,
            user_tier=user_tier,
            data={"document_path": document_path, "analysis_type": analysis_type}
        )
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Document analysis failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === PROJECT WORKFLOW ROUTES ===
@ai_enhanced_bp.route('/api/ai/projects/create', methods=['POST'])
@cross_origin()
async def create_project_with_ai():
    """Create new project with AI assistance"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'anonymous')
        user_tier = data.get('user_tier', 'free_user')
        project_data = data.get('project_data', {})
        
        result = await ai_service.handle_new_project(
            user_id=user_id,
            user_tier=user_tier,
            project_data=project_data
        )
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Project creation failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === WEBSOCKET ROUTES ===
@ai_enhanced_bp.route('/api/ai/websocket', methods=['POST'])
@cross_origin()
async def websocket_ai_handler():
    """Handle WebSocket AI messages"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'anonymous')
        user_tier = data.get('user_tier', 'free_user')
        message = data.get('message', {})
        
        result = await api_integration.websocket_integration.handle_websocket_message(
            user_id=user_id,
            user_tier=user_tier,
            message=message
        )
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"WebSocket AI handling failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === COST TRACKING ROUTES ===
@ai_enhanced_bp.route('/api/ai/costs/<user_id>', methods=['GET'])
@cross_origin()
async def get_user_costs(user_id):
    """Get AI usage costs for user"""
    try:
        user_tier = request.args.get('user_tier', 'free_user')
        
        # Get cost optimizer to check usage
        cost_optimizer = ai_service.cost_optimizer
        usage = cost_optimizer._get_user_usage(user_tier)
        
        return jsonify({
            "user_id": user_id,
            "user_tier": user_tier,
            "current_usage": usage,
            "cost_threshold": cost_optimizer.cost_thresholds.get(user_tier, 0.01)
        })
    except Exception as e:
        logger.error(f"Cost tracking failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === HEALTH CHECK ROUTES ===
@ai_enhanced_bp.route('/api/ai/health', methods=['GET'])
@cross_origin()
async def ai_health_check():
    """Health check for AI services"""
    try:
        # Check if AI service is available
        health_status = {
            "ai_service": "healthy",
            "redis_connection": "unknown",
            "available_models": []
        }
        
        # Check Redis connection
        try:
            ai_service.redis_client.ping()
            health_status["redis_connection"] = "healthy"
        except:
            health_status["redis_connection"] = "unhealthy"
        
        # Check available models (simplified)
        health_status["available_models"] = ["llama3:8b", "gpt-3.5-turbo", "gpt-4-turbo"]
        
        return jsonify(health_status)
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({"error": str(e), "success": False}), 500

# === UTILITY ROUTES ===
@ai_enhanced_bp.route('/api/ai/models', methods=['GET'])
@cross_origin()
async def get_available_models():
    """Get available AI models and their configurations"""
    try:
        from hybrid_ai_architecture import MODEL_CONFIGS
        
        models_info = {}
        for key, config in MODEL_CONFIGS.items():
            models_info[key] = {
                "name": config.name,
                "tier": config.tier.value,
                "cost_per_1k_tokens": config.cost_per_1k_tokens,
                "max_context": config.max_context,
                "specialized_for": config.specialized_for
            }
        
        return jsonify(models_info)
    except Exception as e:
        logger.error(f"Model info failed: {e}")
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