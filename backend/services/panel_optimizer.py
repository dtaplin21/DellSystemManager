"""
GeoQC Panel Layout Optimizer

This module provides advanced panel placement optimization for geosynthetic liner projects,
taking into account site boundaries, elevation changes, and slope constraints.
"""

import numpy as np
import json
import math
import os
from typing import List, Dict, Any, Optional, Tuple


class PanelOptimizer:
    """
    Optimizes panel placement for geosynthetic liner installations
    using various strategies and accounting for site topography.
    """
    
    def __init__(self, site_config: Dict[str, Any], panels: List[Dict[str, Any]], strategy: str = 'balanced'):
        """
        Initialize the panel optimizer with site configuration and panels.
        
        Args:
            site_config: Dictionary containing site dimensions and constraints
            panels: List of panel definitions with dimensions and properties
            strategy: Optimization strategy ('material', 'labor', or 'balanced')
        """
        self.site_config = site_config
        self.panels = panels
        self.strategy = strategy
        self.placements = []
        self.no_go_zones = site_config.get('no_go_zones', [])
        self.elevation_grid = site_config.get('elevation_grid', [])
    
    def optimize(self) -> Dict[str, Any]:
        """
        Run the optimization algorithm based on the selected strategy.
        
        Returns:
            Dictionary containing optimized panel placements and summary
        """
        print(f"Starting optimization with {self.strategy} strategy...")
        
        # Reset placements
        self.placements = []
        
        # Apply the selected optimization strategy
        if self.strategy == 'material':
            self.optimize_material_efficiency()
        elif self.strategy == 'labor':
            self.optimize_labor_efficiency()
        else:
            # Default to balanced approach
            self.optimize_balanced()
        
        # Generate summary of the optimization
        summary = self.generate_summary()
        
        return {
            'placements': self.placements,
            'summary': summary
        }
    
    def optimize_material_efficiency(self) -> None:
        """
        Optimize for material efficiency (minimize waste)
        This prioritizes using full panels and minimizing cuts
        """
        print('Optimizing for material efficiency...')
        
        # Sort panels by area (largest first) to maximize material usage
        sorted_panels = sorted(self.panels, key=lambda p: p['width'] * p['length'], reverse=True)
        
        # Place panels using a grid pattern, largest panels first
        row = 0
        col = 0
        spacing = 5  # 5 ft spacing between panels
        
        # Ensure we have at least one panel to work with
        if not sorted_panels:
            return
            
        max_cols = math.floor(self.site_config['width'] / (sorted_panels[0]['width'] + spacing))
        
        for idx, panel in enumerate(sorted_panels):
            # Calculate position based on grid
            col = idx % max_cols
            row = math.floor(idx / max_cols)
            
            x = col * (panel['width'] + spacing) + 50  # 50 ft margin from edge
            y = row * (panel['length'] + spacing) + 50  # 50 ft margin from edge
            
            # Check if position is valid within site boundaries
            if self.is_valid_position(x, y, panel['width'], panel['length']):
                # Calculate elevation adjustment based on grid
                elevation_adjustment = self.calculate_elevation_adjustment(x, y, panel['width'], panel['length'])
                
                # Add to placements
                self.placements.append({
                    'id': panel['id'],
                    'x': x,
                    'y': y,
                    'rotation': 0,  # No rotation for material efficiency
                    'elevationAdjustment': elevation_adjustment
                })
    
    def optimize_labor_efficiency(self) -> None:
        """
        Optimize for labor efficiency (minimize installation time)
        This prioritizes placing panels in a sequence that minimizes movement
        """
        print('Optimizing for labor efficiency...')
        
        # Sort panels by ID (assumes IDs represent logical installation sequence)
        sorted_panels = sorted(self.panels, key=lambda p: p['id'])
        
        # Use a spiral pattern starting from the center for installation efficiency
        center_x = self.site_config['width'] / 2
        center_y = self.site_config['length'] / 2
        spiral_spacing = 10  # ft
        
        for idx, panel in enumerate(sorted_panels):
            # Calculate position based on spiral pattern
            # This creates a pattern where crews can work continuously without jumping around
            angle = 0.5 * idx
            radius = spiral_spacing * angle / (2 * math.pi)
            
            x = center_x + radius * math.cos(angle) - panel['width'] / 2
            y = center_y + radius * math.sin(angle) - panel['length'] / 2
            
            # Determine if rotation helps with installation
            rotation = 0 if idx % 2 == 0 else 90
            
            # Calculate actual dimensions based on rotation
            actual_width = panel['length'] if rotation == 90 else panel['width']
            actual_length = panel['width'] if rotation == 90 else panel['length']
            
            if self.is_valid_position(x, y, actual_width, actual_length):
                # Calculate elevation adjustment based on topography
                elevation_adjustment = self.calculate_elevation_adjustment(x, y, actual_width, actual_length)
                
                # Add to placements
                self.placements.append({
                    'id': panel['id'],
                    'x': x,
                    'y': y, 
                    'rotation': rotation,
                    'elevationAdjustment': elevation_adjustment
                })
    
    def optimize_balanced(self) -> None:
        """
        Balanced optimization approach
        This balances material efficiency and labor efficiency
        """
        print('Optimizing with balanced approach...')
        
        # Sort panels by area but with some consideration for installation sequence
        def sort_key(panel):
            # Primary sort by area
            area = panel['width'] * panel['length']
            # If areas are similar, sort by ID for installation sequence
            # Extract numeric part of ID for sorting (e.g., 'P12' -> 12)
            id_num = ''.join(filter(str.isdigit, panel['id']))
            id_value = int(id_num) if id_num else 0
            return (-area, id_value)
            
        sorted_panels = sorted(self.panels, key=sort_key)
        
        # Use quadrant-based placement (divides site into 4 quadrants)
        # This allows for efficient material use while keeping installation somewhat sequential
        quadrants = [
            {'x': self.site_config['width'] * 0.25, 'y': self.site_config['length'] * 0.25},  # Q1
            {'x': self.site_config['width'] * 0.75, 'y': self.site_config['length'] * 0.25},  # Q2
            {'x': self.site_config['width'] * 0.25, 'y': self.site_config['length'] * 0.75},  # Q3
            {'x': self.site_config['width'] * 0.75, 'y': self.site_config['length'] * 0.75},  # Q4
        ]
        
        # Place panels in quadrants, alternating between them
        for idx, panel in enumerate(sorted_panels):
            quadrant = quadrants[idx % 4]
            quadrant_index = idx % 4
            
            # Calculate position within quadrant
            pos_in_quadrant = math.floor(idx / 4)
            quadrant_cols = 3
            
            col_in_quad = pos_in_quadrant % quadrant_cols
            row_in_quad = math.floor(pos_in_quadrant / quadrant_cols)
            
            spacing = 10  # 10 ft spacing between panels
            
            # Calculate base position in quadrant
            quad_base_x = quadrant['x'] - (self.site_config['width'] * 0.25)
            quad_base_y = quadrant['y'] - (self.site_config['length'] * 0.25)
            
            # Position within quadrant grid
            x = quad_base_x + col_in_quad * (panel['width'] + spacing)
            y = quad_base_y + row_in_quad * (panel['length'] + spacing)
            
            # Determine if rotation helps with fit
            rotation = 0 if quadrant_index % 2 == 0 else 90
            
            # Calculate actual dimensions based on rotation
            actual_width = panel['length'] if rotation == 90 else panel['width']
            actual_length = panel['width'] if rotation == 90 else panel['length']
            
            if self.is_valid_position(x, y, actual_width, actual_length):
                # Calculate elevation adjustment based on topography
                elevation_adjustment = self.calculate_elevation_adjustment(x, y, actual_width, actual_length)
                
                # Add to placements
                self.placements.append({
                    'id': panel['id'],
                    'x': x,
                    'y': y,
                    'rotation': rotation,
                    'elevationAdjustment': elevation_adjustment
                })
    
    def is_valid_position(self, x: float, y: float, width: float, length: float) -> bool:
        """
        Check if a position is valid within site boundaries and doesn't overlap no-go zones
        or other already placed panels.
        
        Args:
            x: X coordinate of panel position
            y: Y coordinate of panel position
            width: Width of panel
            length: Length of panel
            
        Returns:
            Boolean indicating if position is valid
        """
        # Check site boundaries
        if (x < 0 or y < 0 or 
            x + width > self.site_config['width'] or 
            y + length > self.site_config['length']):
            return False
        
        # Check no-go zones for overlap
        for zone in self.no_go_zones:
            # Simple rectangular collision detection
            if not (x + width < zone['x'] or x > zone['x'] + zone['width'] or
                  y + length < zone['y'] or y > zone['y'] + zone['height']):
                return False
        
        # Check for overlap with existing placements
        for placement in self.placements:
            panel = self.get_panel_by_id(placement['id'])
            if not panel:
                continue
                
            # Calculate dimensions based on rotation
            placement_width = panel['length'] if placement['rotation'] == 90 else panel['width']
            placement_length = panel['width'] if placement['rotation'] == 90 else panel['length']
            
            # Rectangular collision detection
            if not (x + width < placement['x'] or x > placement['x'] + placement_width or
                  y + length < placement['y'] or y > placement['y'] + placement_length):
                return False
        
        return True
    
    def calculate_elevation_adjustment(self, x: float, y: float, width: float, length: float) -> float:
        """
        Calculate elevation adjustment based on slope for a panel at the given position.
        
        Args:
            x: X coordinate of panel position
            y: Y coordinate of panel position
            width: Width of panel
            length: Length of panel
            
        Returns:
            Elevation adjustment value
        """
        if not self.elevation_grid:
            return 0.0  # No elevation data available
        
        # Use average elevation under the panel
        total_elevation = 0.0
        grid_points = 0
        
        # Sample the grid at multiple points under the panel
        sample_points = [
            (x, y),  # Southwest corner
            (x + width, y),  # Southeast corner
            (x, y + length),  # Northwest corner
            (x + width, y + length),  # Northeast corner
            (x + width/2, y + length/2)  # Center
        ]
        
        for point_x, point_y in sample_points:
            # Find the grid cell containing this point
            grid_cell = self.find_grid_cell(point_x, point_y)
            if grid_cell:
                total_elevation += grid_cell['elevation']
                grid_points += 1
        
        if grid_points == 0:
            return 0.0
        
        # Average elevation adjustment
        return round(total_elevation / grid_points, 1)
    
    def find_grid_cell(self, x: float, y: float) -> Optional[Dict[str, Any]]:
        """
        Find the grid cell containing a specific point
        
        Args:
            x: X coordinate
            y: Y coordinate
            
        Returns:
            Grid cell dictionary or None if not found
        """
        for cell in self.elevation_grid:
            if (x >= cell['x'] and x < cell['x'] + cell['width'] and
                y >= cell['y'] and y < cell['y'] + cell['height']):
                return cell
        return None
    
    def get_panel_by_id(self, panel_id: str) -> Optional[Dict[str, Any]]:
        """
        Get panel definition by ID
        
        Args:
            panel_id: Panel identifier
            
        Returns:
            Panel dictionary or None if not found
        """
        for panel in self.panels:
            if panel['id'] == panel_id:
                return panel
        return None
    
    def generate_summary(self) -> Dict[str, Any]:
        """
        Generate a summary of the optimization results
        
        Returns:
            Dictionary containing summary statistics
        """
        # Count panels with significant elevation adjustment
        elevated_panels = sum(1 for p in self.placements if abs(p['elevationAdjustment']) > 1)
        total_panels = len(self.placements)
        
        # Calculate average elevation adjustment
        if total_panels > 0:
            avg_elevation = sum(abs(p['elevationAdjustment']) for p in self.placements) / total_panels
        else:
            avg_elevation = 0.0
        
        # Calculate total area covered
        total_area = 0.0
        for p in self.placements:
            panel = self.get_panel_by_id(p['id'])
            if panel:
                total_area += panel['width'] * panel['length']
        
        # Calculate site utilization percentage
        site_area = self.site_config['width'] * self.site_config['length']
        utilization = (total_area / site_area * 100) if site_area > 0 else 0
        
        return {
            'strategy': self.strategy,
            'totalPanels': total_panels,
            'elevatedPanels': elevated_panels,
            'averageElevationAdjustment': round(avg_elevation, 1),
            'siteUtilization': f"{round(utilization, 1)}%",
            'slopeImpact': self.generate_slope_impact_summary(elevated_panels, total_panels, avg_elevation)
        }
    
    def generate_slope_impact_summary(self, elevated_panels: int, total_panels: int, avg_elevation: float) -> str:
        """
        Generate a human-readable summary of how slopes affected placement
        
        Args:
            elevated_panels: Number of panels with significant elevation adjustment
            total_panels: Total number of panels placed
            avg_elevation: Average elevation adjustment across all panels
            
        Returns:
            String with human-readable summary
        """
        if elevated_panels == 0:
            return "No significant slope constraints affected panel placement."
        
        if total_panels == 0:
            return "No panels were placed."
            
        impact_percentage = (elevated_panels / total_panels) * 100
        
        if impact_percentage > 50:
            return (f"Significant slope constraints affected {int(impact_percentage)}% of panels. "
                   f"Average elevation adjustment of {round(avg_elevation, 1)} ft required across the site. "
                   f"Special mounting considerations recommended.")
        elif impact_percentage > 20:
            return (f"Moderate slope constraints affected {int(impact_percentage)}% of panels. "
                   f"Average elevation adjustment of {round(avg_elevation, 1)} ft required for affected areas.")
        else:
            return (f"Minor slope constraints affected {int(impact_percentage)}% of panels. "
                   f"Average elevation adjustment of {round(avg_elevation, 1)} ft required in isolated areas.")


def create_sample_elevation_grid(site_width: float, site_length: float, grid_size: int = 5) -> List[Dict[str, Any]]:
    """
    Create a sample elevation grid for testing and visualization
    
    Args:
        site_width: Width of the site in feet
        site_length: Length of the site in feet
        grid_size: Number of grid cells in each dimension
        
    Returns:
        List of grid cell dictionaries with elevation data
    """
    cell_width = site_width / grid_size
    cell_height = site_length / grid_size
    
    elevation_grid = []
    
    # Create a 5x5 grid with varying elevations
    # Southwest corner is lowest, northeast is highest
    for row in range(grid_size):
        for col in range(grid_size):
            # Base elevation increases from southwest to northeast
            base_elevation = (row + col) * 2  # 0 to 16 ft elevation change
            
            # Add some random variation
            variation = np.random.uniform(-0.75, 0.75)  # -0.75 to +0.75 ft
            
            elevation_grid.append({
                'x': col * cell_width,
                'y': row * cell_height,
                'width': cell_width,
                'height': cell_height,
                'elevation': base_elevation + variation
            })
    
    return elevation_grid


def generate_contour_data(elevation_grid: List[Dict[str, Any]], site_width: float, site_length: float) -> Dict[str, Any]:
    """
    Generate contour data for visualizing elevation changes
    
    Args:
        elevation_grid: List of grid cells with elevation data
        site_width: Width of the site in feet
        site_length: Length of the site in feet
        
    Returns:
        Dictionary with contour visualization data
    """
    import matplotlib.pyplot as plt
    from matplotlib.colors import LightSource
    import io
    import base64
    
    # Extract data from grid
    grid_size = int(math.sqrt(len(elevation_grid)))
    x = np.linspace(0, site_width, grid_size)
    y = np.linspace(0, site_length, grid_size)
    
    # Create meshgrid
    X, Y = np.meshgrid(x, y)
    
    # Create elevation array
    Z = np.zeros((grid_size, grid_size))
    for cell in elevation_grid:
        col = int(cell['x'] / site_width * (grid_size - 1))
        row = int(cell['y'] / site_length * (grid_size - 1))
        Z[row, col] = cell['elevation']
    
    # Create plot
    fig, ax = plt.subplots(figsize=(10, 8))
    
    # Create contour plot
    contour = ax.contourf(X, Y, Z, cmap='terrain', levels=15)
    ax.contour(X, Y, Z, colors='black', linestyles='solid', linewidths=0.5, alpha=0.5)
    
    # Add color bar
    cbar = plt.colorbar(contour, ax=ax)
    cbar.set_label('Elevation (ft)')
    
    # Set labels
    ax.set_xlabel('Width (ft)')
    ax.set_ylabel('Length (ft)')
    ax.set_title('Site Elevation Contour Map')
    
    # Save to base64 string
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    
    return {
        'imageData': img_str,
        'gridData': Z.tolist(),
        'xValues': x.tolist(),
        'yValues': y.tolist()
    }


def export_to_dxf(placements: List[Dict[str, Any]], panels: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Export panel layout to DXF format for CAD programs
    
    Args:
        placements: Panel placement data
        panels: Panel definitions
        
    Returns:
        Dictionary with export status
    """
    try:
        # In a real implementation, this would use a DXF library like dxfwrite
        # For demonstration, we'll just create a simple text representation
        dxf_content = []
        dxf_content.append("AutoCAD DXF Export - GeoQC Panel Layout")
        dxf_content.append("PANELS:")
        
        for placement in placements:
            panel = next((p for p in panels if p['id'] == placement['id']), None)
            if panel:
                # Calculate dimensions based on rotation
                width = panel['length'] if placement['rotation'] == 90 else panel['width']
                length = panel['width'] if placement['rotation'] == 90 else panel['length']
                
                # Add panel details
                dxf_content.append(f"Panel {placement['id']}: Position ({placement['x']}, {placement['y']}), "
                                 f"Size: {width} x {length}, Rotation: {placement['rotation']}, "
                                 f"Elevation Adj: {placement['elevationAdjustment']}")
        
        # Save to file
        output_path = os.path.join(os.getcwd(), 'panel_layout.dxf')
        with open(output_path, 'w') as f:
            f.write('\n'.join(dxf_content))
        
        return {
            'success': True,
            'message': "DXF export generated successfully",
            'path': output_path
        }
    except Exception as e:
        return {
            'success': False,
            'message': f"Error generating DXF: {str(e)}"
        }


def export_to_excel(placements: List[Dict[str, Any]], panels: List[Dict[str, Any]], 
                   summary: Dict[str, Any]) -> Dict[str, Any]:
    """
    Export panel layout to Excel/CSV format
    
    Args:
        placements: Panel placement data
        panels: Panel definitions
        summary: Optimization summary
        
    Returns:
        Dictionary with export status
    """
    try:
        # Create CSV content
        csv_lines = ["ID,X,Y,Rotation,Elevation Adjustment,Width,Length,Material"]
        
        for placement in placements:
            panel = next((p for p in panels if p['id'] == placement['id']), None)
            if panel:
                # Get panel details
                width = panel.get('width', 0)
                length = panel.get('length', 0)
                material = panel.get('material', 'HDPE 60 mil')
                
                # Add line to CSV
                csv_lines.append(f"{placement['id']},{placement['x']},{placement['y']},"
                              f"{placement['rotation']},{placement['elevationAdjustment']},"
                              f"{width},{length},{material}")
        
        # Add summary section
        csv_lines.append("")
        csv_lines.append("Summary:")
        csv_lines.append(f"Strategy,{summary.get('strategy', 'unknown')}")
        csv_lines.append(f"Total Panels,{summary.get('totalPanels', 0)}")
        csv_lines.append(f"Elevated Panels,{summary.get('elevatedPanels', 0)}")
        csv_lines.append(f"Average Elevation Adjustment,{summary.get('averageElevationAdjustment', 0)}")
        csv_lines.append(f"Site Utilization,{summary.get('siteUtilization', '0%')}")
        
        # Save to file
        output_path = os.path.join(os.getcwd(), 'panel_layout.csv')
        with open(output_path, 'w') as f:
            f.write('\n'.join(csv_lines))
        
        return {
            'success': True,
            'message': "Excel/CSV export generated successfully",
            'path': output_path
        }
    except Exception as e:
        return {
            'success': False,
            'message': f"Error generating Excel/CSV: {str(e)}"
        }


if __name__ == "__main__":
    # Sample usage
    site_config = {
        'width': 1043.6,  # 5 acre square site width in feet
        'length': 1043.6,  # 5 acre square site length in feet
        'no_go_zones': [
            # Example no-go zone
            {'x': 500, 'y': 500, 'width': 100, 'height': 100}
        ]
    }
    
    # Create sample elevation grid
    site_config['elevation_grid'] = create_sample_elevation_grid(
        site_config['width'], 
        site_config['length']
    )
    
    # Sample panels
    panels = [
        {'id': 'P1', 'width': 15, 'length': 100, 'material': 'HDPE 60 mil'},
        {'id': 'P2', 'width': 15, 'length': 100, 'material': 'HDPE 60 mil'},
        {'id': 'P3', 'width': 15, 'length': 100, 'material': 'HDPE 60 mil'},
        {'id': 'P4', 'width': 15, 'length': 100, 'material': 'HDPE 60 mil'},
        {'id': 'P5', 'width': 15, 'length': 100, 'material': 'HDPE 60 mil'},
    ]
    
    # Create optimizer
    optimizer = PanelOptimizer(site_config, panels, 'balanced')
    
    # Run optimization
    result = optimizer.optimize()
    
    # Print results
    print(json.dumps(result, indent=2))
    
    # Generate contour visualization
    contour_data = generate_contour_data(
        site_config['elevation_grid'],
        site_config['width'],
        site_config['length']
    )
    
    # Export to DXF and Excel
    dxf_result = export_to_dxf(result['placements'], panels)
    excel_result = export_to_excel(result['placements'], panels, result['summary'])
    
    print(f"DXF Export: {dxf_result['message']}")
    print(f"Excel Export: {excel_result['message']}")