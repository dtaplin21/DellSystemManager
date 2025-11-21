from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import sys
from pathlib import Path

# Add AI service to path
sys.path.append(str(Path(__file__).parent.parent.parent / "ai_service"))
from ai_service.integration_layer import APIRoutesIntegration
from ai_service.hybrid_ai_architecture import DellSystemAIService

app = FastAPI(title="AI Enhanced API", description="AI-enhanced endpoints migrated from Flask to FastAPI.", version="1.0.0")

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("ai_enhanced_fastapi")

# Initialize AI service
ai_service = DellSystemAIService()
api_integration = APIRoutesIntegration(ai_service)

@app.get("/api/ai/health")
async def health_check():
    """Health check for AI services"""
    try:
        health_status = {
            "ai_service": "healthy",
            "redis_connection": "unknown",
            "available_models": []
        }
        try:
            ai_service.redis_client.ping()
            health_status["redis_connection"] = "healthy"
        except:
            health_status["redis_connection"] = "unhealthy"
        health_status["available_models"] = ["llama3:8b", "gpt-4o", "gpt-4-turbo"]
        return health_status
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/panels/optimize")
async def optimize_panels(request: Request):
    try:
        data = await request.json()
        user_id = data.get('user_id', 'anonymous')
        user_tier = data.get('user_tier', 'free_user')
        layout_data = data.get('layout_data', {})
        result = await api_integration.handle_ai_route(
            route_type="optimize",
            user_id=user_id,
            user_tier=user_tier,
            data={"layout_data": layout_data}
        )
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Panel optimization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/panels/enhance")
async def enhance_panel_operation(request: Request):
    try:
        data = await request.json()
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
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Panel enhancement failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/chat")
async def ai_chat(request: Request):
    try:
        data = await request.json()
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
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"AI chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/documents/analyze")
async def analyze_document(request: Request):
    try:
        data = await request.json()
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
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Document analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/projects/create")
async def create_project_with_ai(request: Request):
    try:
        data = await request.json()
        user_id = data.get('user_id', 'anonymous')
        user_tier = data.get('user_tier', 'free_user')
        project_data = data.get('project_data', {})
        result = await ai_service.handle_new_project(
            user_id=user_id,
            user_tier=user_tier,
            project_data=project_data
        )
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Project creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/costs/{user_id}")
async def get_user_costs(user_id: str, user_tier: str = 'free_user'):
    try:
        cost_optimizer = ai_service.cost_optimizer
        usage = cost_optimizer._get_user_usage(user_tier)
        return {
            "user_id": user_id,
            "user_tier": user_tier,
            "current_usage": usage,
            "cost_threshold": cost_optimizer.cost_thresholds.get(user_tier, 0.01)
        }
    except Exception as e:
        logger.error(f"Cost tracking failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/models")
async def get_available_models():
    try:
        from ai_service.hybrid_ai_architecture import MODEL_CONFIGS
        models_info = {}
        for key, config in MODEL_CONFIGS.items():
            models_info[key] = {
                "name": config.name,
                "tier": config.tier.value,
                "cost_per_1k_tokens": config.cost_per_1k_tokens,
                "max_context": config.max_context,
                "specialized_for": config.specialized_for
            }
        return models_info
    except Exception as e:
        logger.error(f"Model info failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 