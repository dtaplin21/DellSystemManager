"""
Visualization module for panel layout system

This module provides visualization and export functions for the panel layout system,
including contour maps, CAD exports, and other visual representations.
"""

import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import matplotlib.cm as cm
import numpy as np
import io
import base64
import os
import ezdxf
from typing import List, Dict, Any, Tuple, Optional
from .geometry import Panel, TerrainGrid


def generate_contour_visualization(terrain_grid: TerrainGrid, include_panels: List[Panel] = None) -> Dict[str, Any]:
    """
    Generate a contour visualization of the terrain grid
    
    Args:
        terrain_grid: TerrainGrid object to visualize
        include_panels: Optional list of panels to include in the visualization
        
    Returns:
        Dictionary with visualization data
    """
    # Create figure
    fig, ax = plt.subplots(figsize=(10, 8))
    
    # Create X, Y grid for plotting
    x = np.linspace(0, terrain_grid.width, terrain_grid.grid_size)
    y = np.linspace(0, terrain_grid.length, terrain_grid.grid_size)
    X, Y = np.meshgrid(x, y)
    
    # Create elevation array
    Z = terrain_grid.elevation_data.copy()
    
    # Generate contour plot
    contour = ax.contourf(X, Y, Z, cmap='terrain', levels=15, alpha=0.7)
    contour_lines = ax.contour(X, Y, Z, colors='black', linestyles='solid', linewidths=0.5, alpha=0.5)
    
    # Add contour labels
    plt.clabel(contour_lines, inline=True, fontsize=8, fmt='%1.1f')
    
    # Plot panels if provided
    if include_panels:
        for panel in include_panels:
            corners = panel.get_corners()
            # Extract x and y coordinates
            x_coords = [p[0] for p in corners]
            y_coords = [p[1] for p in corners]
            
            # Close the polygon
            x_coords.append(x_coords[0])
            y_coords.append(y_coords[0])
            
            # Calculate color based on elevation adjustment
            if abs(panel.elevation_adjustment) < 1:
                color = 'green'
                alpha = 0.3
            elif abs(panel.elevation_adjustment) < 3:
                color = 'orange'
                alpha = 0.4
            else:
                color = 'red'
                alpha = 0.5
                
            # Draw panel
            ax.fill(x_coords, y_coords, color=color, alpha=alpha)
            ax.plot(x_coords, y_coords, color='black', linewidth=1)
            
            # Add panel ID
            center_x = sum(x_coords[:-1]) / len(x_coords[:-1])
            center_y = sum(y_coords[:-1]) / len(y_coords[:-1])
            ax.text(center_x, center_y, panel.id, ha='center', va='center')
    
    # Add color bar and labels
    cbar = plt.colorbar(contour, ax=ax)
    cbar.set_label('Elevation (ft)')
    ax.set_xlabel('Width (ft)')
    ax.set_ylabel('Length (ft)')
    ax.set_title('Site Elevation Contour Map')
    
    # Add grid
    ax.grid(True, linestyle='--', alpha=0.3)
    
    # Set axis limits
    ax.set_xlim(0, terrain_grid.width)
    ax.set_ylim(0, terrain_grid.length)
    
    # Convert to base64 image for web display
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    
    return {
        'imageData': img_str,
        'gridData': Z.tolist(),
        'xValues': x.tolist(),
        'yValues': y.tolist()
    }


def generate_3d_visualization(terrain_grid: TerrainGrid, panels: List[Panel] = None) -> Dict[str, Any]:
    """
    Generate a 3D visualization of the terrain and panels
    
    Args:
        terrain_grid: TerrainGrid object to visualize
        panels: Optional list of panels to include in the visualization
        
    Returns:
        Dictionary with visualization data
    """
    from mpl_toolkits.mplot3d import Axes3D
    
    # Create figure
    fig = plt.figure(figsize=(10, 8))
    ax = fig.add_subplot(111, projection='3d')
    
    # Create X, Y grid for plotting
    x = np.linspace(0, terrain_grid.width, terrain_grid.grid_size)
    y = np.linspace(0, terrain_grid.length, terrain_grid.grid_size)
    X, Y = np.meshgrid(x, y)
    
    # Create elevation array
    Z = terrain_grid.elevation_data.copy()
    
    # Plot surface
    surf = ax.plot_surface(X, Y, Z, cmap='terrain', linewidth=0, antialiased=True, alpha=0.7)
    
    # Add panels if provided
    if panels:
        for panel in panels:
            corners = panel.get_corners()
            
            # Extract x and y coordinates
            x_coords = [p[0] for p in corners]
            y_coords = [p[1] for p in corners]
            
            # Calculate z coordinates (elevation)
            z_coords = []
            for x, y in zip(x_coords, y_coords):
                # Calculate elevation at this point
                z = terrain_grid.calculate_elevation_at_point(x, y)
                z_coords.append(z)
            
            # Close the polygon
            x_coords.append(x_coords[0])
            y_coords.append(y_coords[0])
            z_coords.append(z_coords[0])
            
            # Plot panel outline
            ax.plot(x_coords, y_coords, z_coords, 'k-', linewidth=2)
            
            # Add panel ID
            center_x = sum(x_coords[:-1]) / len(x_coords[:-1])
            center_y = sum(y_coords[:-1]) / len(y_coords[:-1])
            center_z = sum(z_coords[:-1]) / len(z_coords[:-1])
            ax.text(center_x, center_y, center_z, panel.id, zdir='z')
    
    # Add color bar
    fig.colorbar(surf, ax=ax, shrink=0.5, aspect=5)
    
    # Set labels and title
    ax.set_xlabel('Width (ft)')
    ax.set_ylabel('Length (ft)')
    ax.set_zlabel('Elevation (ft)')
    ax.set_title('3D Site Terrain Visualization')
    
    # Convert to base64 image for web display
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    
    return {
        'imageData': img_str
    }


def export_to_dxf(panels: List[Panel], terrain_grid: TerrainGrid = None, 
                output_path: str = None) -> Dict[str, Any]:
    """
    Export panel layout to DXF format for CAD programs
    
    Args:
        panels: List of Panel objects
        terrain_grid: Optional TerrainGrid for elevation data
        output_path: Path to save the DXF file
        
    Returns:
        Dictionary with export result
    """
    try:
        # Create a new DXF document
        doc = ezdxf.new('R2010')  # AutoCAD 2010 format for compatibility
        
        # Add a new modelspace
        msp = doc.modelspace()
        
        # Create layers
        doc.layers.new(name='PANELS', color=1)  # 1 = red
        doc.layers.new(name='PANEL_IDS', color=2)  # 2 = yellow
        doc.layers.new(name='ELEVATIONS', color=3)  # 3 = green
        doc.layers.new(name='TERRAIN_GRID', color=4)  # 4 = cyan
        
        # Add panels
        for panel in panels:
            corners = panel.get_corners()
            
            # Create polyline for panel outline
            points = [(p[0], p[1]) for p in corners]
            points.append(points[0])  # Close the polygon
            
            polyline = msp.add_lwpolyline(points, dxfattribs={'layer': 'PANELS'})
            polyline.close(True)
            
            # Add panel ID
            center_x = sum(p[0] for p in corners) / len(corners)
            center_y = sum(p[1] for p in corners) / len(corners)
            
            msp.add_text(
                panel.id,
                dxfattribs={
                    'layer': 'PANEL_IDS',
                    'height': 5,  # Text height
                }
            ).set_pos((center_x, center_y), align='MIDDLE_CENTER')
            
            # Add elevation text
            if panel.elevation_adjustment != 0:
                elevation_text = f"Elev: {panel.elevation_adjustment:.1f} ft"
                msp.add_text(
                    elevation_text,
                    dxfattribs={
                        'layer': 'ELEVATIONS',
                        'height': 3,  # Text height
                    }
                ).set_pos((center_x, center_y - 8), align='MIDDLE_CENTER')
        
        # Add terrain grid if provided
        if terrain_grid:
            cell_width = terrain_grid.cell_width
            cell_length = terrain_grid.cell_length
            
            for cell in terrain_grid.grid_cells:
                x = cell['x']
                y = cell['y']
                width = cell['width']
                height = cell['height']
                elevation = cell['elevation']
                
                # Draw grid cell outline
                points = [
                    (x, y),
                    (x + width, y),
                    (x + width, y + height),
                    (x, y + height),
                    (x, y)
                ]
                
                msp.add_lwpolyline(points, dxfattribs={'layer': 'TERRAIN_GRID'})
                
                # Add elevation text
                msp.add_text(
                    f"{elevation:.1f}",
                    dxfattribs={
                        'layer': 'TERRAIN_GRID',
                        'height': 2,  # Text height
                    }
                ).set_pos((x + width/2, y + height/2), align='MIDDLE_CENTER')
        
        # Add layout information
        msp.add_text(
            f"Panel Layout - {len(panels)} Panels",
            dxfattribs={
                'height': 10,
            }
        ).set_pos((10, 10))
        
        # Add elevation legend
        legend_y = 50
        msp.add_text(
            "Elevation Legend:",
            dxfattribs={'height': 5}
        ).set_pos((10, legend_y))
        
        legend_y += 10
        msp.add_text(
            "Green: <1 ft adjustment",
            dxfattribs={'height': 4, 'color': 3}  # 3 = green
        ).set_pos((15, legend_y))
        
        legend_y += 8
        msp.add_text(
            "Yellow: 1-3 ft adjustment",
            dxfattribs={'height': 4, 'color': 2}  # 2 = yellow
        ).set_pos((15, legend_y))
        
        legend_y += 8
        msp.add_text(
            "Red: >3 ft adjustment",
            dxfattribs={'height': 4, 'color': 1}  # 1 = red
        ).set_pos((15, legend_y))
        
        # Save the DXF file
        if output_path is None:
            output_path = os.path.join(os.getcwd(), 'panel_layout.dxf')
            
        doc.saveas(output_path)
        
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


def export_to_excel(panels: List[Panel], summary: Dict[str, Any] = None, 
                   output_path: str = None) -> Dict[str, Any]:
    """
    Export panel layout to Excel/CSV format
    
    Args:
        panels: List of Panel objects
        summary: Optional summary dictionary
        output_path: Path to save the file
        
    Returns:
        Dictionary with export result
    """
    try:
        # Create CSV content
        csv_lines = ["ID,X,Y,Rotation,Elevation Adjustment,Width,Length,Material,Area"]
        
        for panel in panels:
            # Get panel details
            area = panel.get_area()
            
            # Add line to CSV
            csv_lines.append(f"{panel.id},{panel.position[0]:.1f},{panel.position[1]:.1f},"
                          f"{panel.rotation_angle:.1f},{panel.elevation_adjustment:.1f},"
                          f"{panel.width:.1f},{panel.length:.1f},{panel.material},{area:.1f}")
        
        # Add summary section if provided
        if summary:
            csv_lines.append("")
            csv_lines.append("Summary:")
            for key, value in summary.items():
                if isinstance(value, (int, float, str)):
                    csv_lines.append(f"{key},{value}")
        
        # Create output path if not provided
        if output_path is None:
            output_path = os.path.join(os.getcwd(), 'panel_layout.csv')
        
        # Save to file
        with open(output_path, 'w') as f:
            f.write('\n'.join(csv_lines))
        
        return {
            'success': True,
            'message': "Excel/CSV export generated successfully",
            'path': output_path,
            'data': '\n'.join(csv_lines)
        }
    except Exception as e:
        return {
            'success': False,
            'message': f"Error generating Excel/CSV: {str(e)}"
        }