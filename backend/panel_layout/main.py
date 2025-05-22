"""
Main entry point for the panel layout system

This module provides a FastAPI application for the panel layout system.
"""

import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .api import create_panel_api

# Create FastAPI application
app = FastAPI(
    title="Panel Layout API",
    description="API for the panel layout system",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
create_panel_api(app)

# Add root endpoint
@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "Panel Layout API is running",
        "version": "1.0.0"
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    # Get port from environment or use default
    port = int(os.environ.get("PORT", 8001))
    
    # Run FastAPI server
    uvicorn.run(app, host="0.0.0.0", port=port)