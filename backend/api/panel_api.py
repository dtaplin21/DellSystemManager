"""
Panel Optimizer API Service

This module provides a Flask API for the panel optimizer, allowing the frontend
to access the Python-based optimization functions.
"""

import os
import sys
import tempfile
import json
from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
import numpy as np

# Add the parent directory to the path to import panel_layout modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from panel_layout.geometry import Panel, TerrainGrid
    from panel_layout.optimizer import PanelOptimizer
    from panel_layout.visualization import (
        generate_contour_visualization, 
        generate_3d_visualization,
        export_to_dxf, 
        export_to_excel
    )
    print("Successfully imported panel layout modules")
except Exception as e:
    print(f"Error importing panel layout modules: {e}")
    # Create placeholders for failing gracefully if imports fail
    class Panel:
        @classmethod
        def from_dict(cls, data): 
            return None
    class TerrainGrid:
        def __init__(self, width=0, length=0, grid_size=5): pass
        def generate_sloped_terrain(self): pass
    class PanelOptimizer:
        def __init__(self, site_config, terrain_grid): pass
        def optimize(self, panels, strategy): 
            return {"placements": [], "summary": {}}
    def generate_contour_visualization(terrain_grid, panels=None):
        return {"imageData": ""}
    def generate_3d_visualization(terrain_grid, panels=None):
        return {"imageData": ""}
    def export_to_dxf(panels, terrain_grid=None, output_path=None):
        return {"success": False, "message": "Export failed"}
    def export_to_excel(panels, summary=None, output_path=None):
        return {"success": False, "message": "Export failed"}

# Create Flask app
app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok"})

@app.route('/api/panel-layout/optimize', methods=['POST'])
def optimize_panels():
    """
    Optimize panel layout based on provided site config and panels
    """
    try:
        data = request.json
        
        # Extract request data
        site_config = data.get('siteConfig', {})
        panels_data = data.get('panels', [])
        strategy = data.get('strategy', 'balanced')
        
        # Create terrain grid
        terrain_grid = TerrainGrid(
            width=site_config.get('width', 1000),
            length=site_config.get('length', 1000),
            grid_size=5
        )
        
        # Generate sample terrain
        terrain_grid.generate_sloped_terrain()
        
        # Create optimizer
        optimizer = PanelOptimizer(
            site_config=site_config,
            terrain_grid=terrain_grid
        )
        
        # Run optimization
        result = optimizer.optimize(
            panels=panels_data,
            strategy=strategy
        )
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/panel-layout/visualize-terrain', methods=['POST'])
def visualize_terrain():
    """
    Generate contour visualization for the site topography
    """
    try:
        data = request.json
        
        # Create terrain grid
        terrain_grid = TerrainGrid(
            width=data.get('width', 1000),
            length=data.get('length', 1000),
            grid_size=5
        )
        
        # Generate sample terrain
        terrain_grid.generate_sloped_terrain()
        
        # Generate visualization
        visualization = generate_contour_visualization(terrain_grid)
        
        return jsonify(visualization)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/panel-layout/visualize-3d', methods=['POST'])
def visualize_3d():
    """
    Generate 3D visualization for the site and panels
    """
    try:
        data = request.json
        site_config = data.get('siteConfig', {})
        panels_data = data.get('panels', None)
        
        # Create terrain grid
        terrain_grid = TerrainGrid(
            width=site_config.get('width', 1000),
            length=site_config.get('length', 1000),
            grid_size=5
        )
        
        # Generate sample terrain
        terrain_grid.generate_sloped_terrain()
        
        # Convert panels if provided
        panel_objects = None
        if panels_data:
            panel_objects = []
            for panel_dict in panels_data:
                panel = Panel.from_dict(panel_dict)
                if panel:  # Only add if panel creation succeeded
                    panel_objects.append(panel)
        
        # Generate visualization
        visualization = generate_3d_visualization(terrain_grid, panel_objects)
        
        return jsonify(visualization)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/panel-layout/export', methods=['POST'])
def export_layout():
    """
    Export panel layout to DXF or Excel format
    """
    try:
        data = request.json
        export_format = data.get('format', 'dxf').lower()
        panels_data = data.get('panels', [])
        summary = data.get('summary', None)
        
        # Convert panels
        panel_objects = []
        for panel_dict in panels_data:
            panel = Panel.from_dict(panel_dict)
            if panel:  # Only add if panel creation succeeded
                panel_objects.append(panel)
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(suffix=f".{export_format}", delete=False) as temp_file:
            temp_path = temp_file.name
        
        # Export based on format
        if export_format == 'dxf':
            # Create terrain grid for elevation data
            terrain_grid = TerrainGrid(
                width=1000,  # Default width
                length=1000,  # Default length
                grid_size=5
            )
            terrain_grid.generate_sloped_terrain()
            
            result = export_to_dxf(panel_objects, terrain_grid, temp_path)
        else:  # csv/excel
            result = export_to_excel(panel_objects, summary, temp_path)
        
        if not result.get('success', False):
            return jsonify({"error": result.get('message', 'Export failed')}), 500
        
        # Create content type based on format
        content_type = "application/dxf" if export_format == 'dxf' else "text/csv"
        
        # Return the file
        return send_file(
            temp_path,
            as_attachment=True,
            download_name=f"panel_layout.{export_format}",
            mimetype=content_type
        )
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Get port from environment or use default
    port = int(os.environ.get('PORT', 8001))
    
    # Run Flask app
    app.run(debug=True, host='0.0.0.0', port=port)