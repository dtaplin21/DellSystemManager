"""
Panel Optimizer API Service

This module provides a Flask API for the panel optimizer, allowing the frontend
to access the Python-based optimization functions.
"""

from flask import Flask, request, jsonify
import sys
import os
import json

# Add the backend directory to the path so we can import the panel optimizer
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.panel_optimizer import (
    PanelOptimizer, 
    create_sample_elevation_grid, 
    generate_contour_data,
    export_to_dxf,
    export_to_excel
)

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok"})

@app.route('/api/optimize-panels', methods=['POST'])
def optimize_panels():
    """
    Optimize panel layout based on provided site config and panels
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        site_config = data.get('siteConfig')
        panels = data.get('panels')
        strategy = data.get('strategy', 'balanced')
        
        if not site_config:
            return jsonify({"error": "Site configuration is required"}), 400
        
        if not panels:
            return jsonify({"error": "Panel definitions are required"}), 400
        
        # Add elevation grid if not provided
        if 'elevation_grid' not in site_config:
            site_config['elevation_grid'] = create_sample_elevation_grid(
                site_config['width'], 
                site_config['length']
            )
        
        # Run optimization
        optimizer = PanelOptimizer(site_config, panels, strategy)
        result = optimizer.optimize()
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in optimize_panels: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-contours', methods=['POST'])
def generate_contours():
    """
    Generate contour visualization for the site topography
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        site_config = data.get('siteConfig')
        
        if not site_config:
            return jsonify({"error": "Site configuration is required"}), 400
        
        # Get or create elevation grid
        elevation_grid = site_config.get('elevation_grid')
        if not elevation_grid:
            elevation_grid = create_sample_elevation_grid(
                site_config['width'], 
                site_config['length']
            )
        
        # Generate contour data
        contour_data = generate_contour_data(
            elevation_grid,
            site_config['width'],
            site_config['length']
        )
        
        return jsonify(contour_data)
        
    except Exception as e:
        print(f"Error in generate_contours: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/export-layout', methods=['POST'])
def export_layout():
    """
    Export panel layout to DXF or Excel format
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        format_type = data.get('format', 'dxf')
        placements = data.get('placements')
        panels = data.get('panels')
        summary = data.get('summary')
        
        if not placements:
            return jsonify({"error": "Panel placements are required"}), 400
        
        if not panels:
            return jsonify({"error": "Panel definitions are required"}), 400
        
        # Export to requested format
        if format_type.lower() == 'dxf':
            result = export_to_dxf(placements, panels)
        elif format_type.lower() in ['excel', 'csv']:
            if not summary:
                summary = {}
            result = export_to_excel(placements, panels, summary)
        else:
            return jsonify({"error": f"Unsupported export format: {format_type}"}), 400
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in export_layout: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run the Flask app
    app.run(host='0.0.0.0', port=8001, debug=True)