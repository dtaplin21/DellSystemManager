"""
API module for the panel layout system

This module provides FastAPI routes for interacting with the panel layout system.
"""

from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os
import tempfile
import json
import numpy as np

from .geometry import Panel, TerrainGrid
from .optimizer import PanelOptimizer
from .visualization import (
    generate_contour_visualization, 
    generate_3d_visualization,
    export_to_dxf, 
    export_to_excel
)


class PanelDefinition(BaseModel):
    """Panel definition model"""
    id: str
    width: float
    length: float
    material: Optional[str] = "HDPE 60 mil"


class SiteConfig(BaseModel):
    """Site configuration model"""
    width: float
    length: float
    noGoZones: Optional[List[Dict[str, Any]]] = []


class OptimizationRequest(BaseModel):
    """Optimization request model"""
    siteConfig: SiteConfig
    panels: List[PanelDefinition]
    strategy: Optional[str] = "balanced"


class ExportRequest(BaseModel):
    """Export request model"""
    format: str
    panels: List[Dict[str, Any]]
    summary: Optional[Dict[str, Any]] = None


def create_panel_api(app: FastAPI):
    """
    Create FastAPI routes for the panel layout system
    
    Args:
        app: FastAPI application
    """
    
    @app.post("/api/panel-layout/optimize")
    async def optimize_panel_layout(request: OptimizationRequest):
        """Optimize panel layout"""
        try:
            # Create terrain grid
            terrain_grid = TerrainGrid(
                width=request.siteConfig.width,
                length=request.siteConfig.length,
                grid_size=5
            )
            
            # Generate sample terrain
            terrain_grid.generate_sloped_terrain()
            
            # Create optimizer
            optimizer = PanelOptimizer(
                site_config=request.siteConfig.dict(),
                terrain_grid=terrain_grid
            )
            
            # Run optimization
            result = optimizer.optimize(
                panels=[panel.dict() for panel in request.panels],
                strategy=request.strategy
            )
            
            return JSONResponse(content=result)
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/panel-layout/visualize-terrain")
    async def visualize_terrain(site_config: SiteConfig = Body(...)):
        """Generate terrain visualization"""
        try:
            # Create terrain grid
            terrain_grid = TerrainGrid(
                width=site_config.width,
                length=site_config.length,
                grid_size=5
            )
            
            # Generate sample terrain
            terrain_grid.generate_sloped_terrain()
            
            # Generate visualization
            visualization = generate_contour_visualization(terrain_grid)
            
            return JSONResponse(content=visualization)
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/panel-layout/visualize-3d")
    async def visualize_3d(
        site_config: SiteConfig = Body(...),
        panels: Optional[List[Dict[str, Any]]] = Body(None)
    ):
        """Generate 3D visualization"""
        try:
            # Create terrain grid
            terrain_grid = TerrainGrid(
                width=site_config.width,
                length=site_config.length,
                grid_size=5
            )
            
            # Generate sample terrain
            terrain_grid.generate_sloped_terrain()
            
            # Convert panels if provided
            panel_objects = None
            if panels:
                panel_objects = []
                for panel_dict in panels:
                    panel = Panel.from_dict(panel_dict)
                    panel_objects.append(panel)
            
            # Generate visualization
            visualization = generate_3d_visualization(terrain_grid, panel_objects)
            
            return JSONResponse(content=visualization)
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/panel-layout/export")
    async def export_layout(request: ExportRequest):
        """Export panel layout"""
        try:
            # Convert panels
            panel_objects = []
            for panel_dict in request.panels:
                panel = Panel.from_dict(panel_dict)
                panel_objects.append(panel)
            
            # Create a temporary file
            fd, temp_path = tempfile.mkstemp(suffix=f".{request.format.lower()}")
            os.close(fd)
            
            # Export based on format
            if request.format.lower() == 'dxf':
                # Create terrain grid for elevation data
                terrain_grid = TerrainGrid(
                    width=1000,  # Default width
                    length=1000,  # Default length
                    grid_size=5
                )
                terrain_grid.generate_sloped_terrain()
                
                result = export_to_dxf(panel_objects, terrain_grid, temp_path)
            else:  # csv/excel
                result = export_to_excel(panel_objects, request.summary, temp_path)
            
            if not result['success']:
                raise Exception(result['message'])
            
            # Create a response with the file
            content_type = "application/dxf" if request.format.lower() == 'dxf' else "text/csv"
            filename = f"panel_layout.{request.format.lower()}"
            
            return FileResponse(
                path=temp_path,
                media_type=content_type,
                filename=filename
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))