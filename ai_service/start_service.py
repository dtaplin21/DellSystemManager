#!/usr/bin/env python3
"""
AI Service Startup Script
Validates configuration and starts the Flask service
"""

import os
import sys
import logging
from pathlib import Path

# Add the current directory to Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from config import config
from app import app

def setup_environment():
    """Setup environment variables and logging"""
    # CRITICAL: Set LiteLLM environment variables BEFORE importing CrewAI/LiteLLM
    # LiteLLM reads these at import time, so they must be set early
    if not os.getenv("LITELLM_MODEL"):
        os.environ["LITELLM_MODEL"] = "gpt-4o"
    if not os.getenv("OPENAI_MODEL"):
        os.environ["OPENAI_MODEL"] = "gpt-4o"
    
    # Set default environment variables if not set
    if not os.getenv("FLASK_ENV"):
        os.environ["FLASK_ENV"] = "development"
    
    if not os.getenv("FLASK_DEBUG"):
        os.environ["FLASK_DEBUG"] = "1" if config.DEBUG_MODE else "0"
    
    # Setup logging
    logging.basicConfig(
        level=getattr(logging, config.LOG_LEVEL),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger(__name__)
    logger.info("🚀 Starting AI Service...")
    
    return logger

def validate_dependencies():
    """Validate that all required dependencies are available"""
    logger = logging.getLogger(__name__)
    
    try:
        # Test OpenAI
        import openai
        logger.info("✅ OpenAI library available")
    except ImportError:
        logger.error("❌ OpenAI library not available")
        return False
    
    try:
        # Test Flask
        import flask
        logger.info("✅ Flask library available")
    except ImportError:
        logger.error("❌ Flask library not available")
        return False
    
    try:
        # Test Redis (optional)
        import redis
        logger.info("✅ Redis library available")
    except ImportError:
        logger.warning("⚠️ Redis library not available - some features may not work")
    
    try:
        # Test CrewAI (optional)
        import crewai
        logger.info("✅ CrewAI library available")
    except ImportError:
        logger.warning("⚠️ CrewAI library not available - hybrid AI features disabled")
    
    try:
        # Test LangChain (optional)
        import langchain
        logger.info("✅ LangChain library available")
    except ImportError:
        logger.warning("⚠️ LangChain library not available - some AI features may not work")
    
    return True

def check_environment():
    """Check environment configuration"""
    logger = logging.getLogger(__name__)
    
    # Check required environment variables
    if not config.OPENAI_API_KEY:
        logger.error("❌ OPENAI_API_KEY environment variable not set")
        return False
    
    logger.info("✅ Environment configuration valid")
    return True

def main():
    """Main startup function"""
    logger = setup_environment()
    
    # Validate configuration
    if not config.validate_config():
        logger.error("❌ Configuration validation failed")
        sys.exit(1)
    
    # Validate dependencies
    if not validate_dependencies():
        logger.error("❌ Dependency validation failed")
        sys.exit(1)
    
    # Check environment
    if not check_environment():
        logger.error("❌ Environment check failed")
        sys.exit(1)
    
    # Print service information
    logger.info("=" * 50)
    logger.info("🤖 Dell System Manager AI Service")
    logger.info("=" * 50)
    logger.info(f"Service Host: {config.SERVICE_HOST}")
    logger.info(f"Service Port: {config.SERVICE_PORT}")
    logger.info(f"Debug Mode: {config.DEBUG_MODE}")
    logger.info(f"Hybrid AI: {'Enabled' if config.ENABLE_HYBRID_AI else 'Disabled'}")
    logger.info(f"Local Models: {'Enabled' if config.ENABLE_LOCAL_MODELS else 'Disabled'}")
    logger.info(f"Cost Optimization: {'Enabled' if config.ENABLE_COST_OPTIMIZATION else 'Disabled'}")
    logger.info(f"LiteLLM Model: {os.getenv('LITELLM_MODEL', 'not set')}")
    logger.info(f"OpenAI Model: {os.getenv('OPENAI_MODEL', 'not set')}")
    logger.info("=" * 50)
    
    try:
        # Log all registered routes before starting
        logger.info("=" * 50)
        logger.info("Registered Flask routes:")
        for rule in app.url_map.iter_rules():
            logger.info(f"  {list(rule.methods)} {rule}")
        logger.info("=" * 50)
        
        # Start the Flask service
        logger.info(f"🚀 Starting Flask service on {config.SERVICE_HOST}:{config.SERVICE_PORT}...")
        app.run(
            host=config.SERVICE_HOST,
            port=config.SERVICE_PORT,
            debug=config.DEBUG_MODE
        )
    except KeyboardInterrupt:
        logger.info("🛑 Service stopped by user")
    except Exception as e:
        logger.error(f"❌ Service failed to start: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
