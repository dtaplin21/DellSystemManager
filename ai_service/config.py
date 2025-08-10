# AI Service Configuration
import os
from typing import Dict, Any

class AIServiceConfig:
    """Configuration class for the AI service"""
    
    # Environment variables
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
    
    # Service settings
    SERVICE_PORT = int(os.getenv("PORT", 5001))
    SERVICE_HOST = os.getenv("HOST", "0.0.0.0")
    DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"
    
    # AI Model settings
    DEFAULT_MODEL = os.getenv("DEFAULT_AI_MODEL", "gpt-4o")
    FALLBACK_MODEL = os.getenv("FALLBACK_AI_MODEL", "gpt-3.5-turbo")
    
    # Cost optimization settings
    ENABLE_COST_OPTIMIZATION = os.getenv("ENABLE_COST_OPTIMIZATION", "true").lower() == "true"
    MAX_COST_PER_REQUEST = float(os.getenv("MAX_COST_PER_REQUEST", "0.10"))
    
    # User tier settings
    USER_TIERS = {
        "free_user": {
            "max_cost_per_request": 0.01,
            "max_requests_per_day": 10,
            "available_models": ["gpt-3.5-turbo", "llama3_8b"]
        },
        "paid_user": {
            "max_cost_per_request": 0.10,
            "max_requests_per_day": 100,
            "available_models": ["gpt-3.5-turbo", "gpt-4o", "claude_3_haiku", "llama3_8b", "llama3_70b"]
        },
        "enterprise": {
            "max_cost_per_request": 1.00,
            "max_requests_per_day": 1000,
            "available_models": ["gpt-3.5-turbo", "gpt-4o", "claude_3_sonnet", "llama3_8b", "llama3_70b"]
        }
    }
    
    # Hybrid AI settings
    ENABLE_HYBRID_AI = os.getenv("ENABLE_HYBRID_AI", "true").lower() == "true"
    ENABLE_LOCAL_MODELS = os.getenv("ENABLE_LOCAL_MODELS", "true").lower() == "true"
    OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    
    # Workflow settings
    MAX_WORKFLOW_AGENTS = int(os.getenv("MAX_WORKFLOW_AGENTS", "5"))
    WORKFLOW_TIMEOUT = int(os.getenv("WORKFLOW_TIMEOUT", "300"))  # 5 minutes
    
    # Logging settings
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT = os.getenv("LOG_FORMAT", "json")
    
    @classmethod
    def get_redis_config(cls) -> Dict[str, Any]:
        """Get Redis configuration"""
        config = {
            "host": cls.REDIS_HOST,
            "port": cls.REDIS_PORT,
            "decode_responses": True
        }
        
        if cls.REDIS_PASSWORD:
            config["password"] = cls.REDIS_PASSWORD
            
        return config
    
    @classmethod
    def get_user_tier_config(cls, user_tier: str) -> Dict[str, Any]:
        """Get configuration for a specific user tier"""
        return cls.USER_TIERS.get(user_tier, cls.USER_TIERS["free_user"])
    
    @classmethod
    def is_feature_enabled(cls, feature: str) -> bool:
        """Check if a specific feature is enabled"""
        feature_map = {
            "hybrid_ai": cls.ENABLE_HYBRID_AI,
            "local_models": cls.ENABLE_LOCAL_MODELS,
            "cost_optimization": cls.ENABLE_COST_OPTIMIZATION
        }
        
        return feature_map.get(feature, False)
    
    @classmethod
    def validate_config(cls) -> bool:
        """Validate the configuration"""
        required_vars = ["OPENAI_API_KEY"]
        
        for var in required_vars:
            if not getattr(cls, var):
                print(f"❌ Missing required environment variable: {var}")
                return False
        
        print("✅ Configuration validation passed")
        return True

# Global config instance
config = AIServiceConfig()
