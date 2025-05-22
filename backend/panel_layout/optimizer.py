"""
Panel Layout Optimizer

This module contains optimization algorithms for panel placement on 
geosynthetic liner projects, taking into account terrain, material efficiency,
and installation logistics.
"""

import numpy as np
import math
from typing import List, Dict, Any, Tuple, Optional, Union
from .geometry import Panel, TerrainGrid
import copy


class PanelLayout:
    """
    Manages a collection of panels in a layout
    """
    
    def __init__(self, width: float, length: float):
        """
        Initialize a panel layout
        
        Args:
            width: Width of the layout area in feet
            length: Length of the layout area in feet
        """
        self.width = width
        self.length = length
        self.panels = []
        self.no_go_zones = []
    
    def add_panel(self, panel: Panel) -> bool:
        """
        Add a panel to the layout if it's valid
        
        Args:
            panel: Panel to add
            
        Returns:
            True if panel was added, False if invalid
        """
        if self.is_valid_placement(panel):
            self.panels.append(panel)
            return True
        return False
    
    def remove_panel(self, panel_id: str) -> bool:
        """
        Remove a panel from the layout
        
        Args:
            panel_id: ID of the panel to remove
            
        Returns:
            True if panel was removed, False if not found
        """
        for i, panel in enumerate(self.panels):
            if panel.id == panel_id:
                self.panels.pop(i)
                return True
        return False
    
    def clear(self):
        """Clear all panels from the layout"""
        self.panels = []
    
    def is_valid_placement(self, panel: Panel) -> bool:
        """
        Check if a panel placement is valid
        
        Args:
            panel: Panel to check
            
        Returns:
            True if placement is valid, False otherwise
        """
        # Check if panel is within layout boundaries
        min_x, min_y, max_x, max_y = panel.get_bounds()
        if min_x < 0 or min_y < 0 or max_x > self.width or max_y > self.length:
            return False
        
        # Check for overlap with other panels
        for existing_panel in self.panels:
            if existing_panel.id != panel.id and panel.intersects(existing_panel):
                return False
        
        # Check for overlap with no-go zones
        for zone in self.no_go_zones:
            zone_polygon = zone.get('polygon', None)
            if zone_polygon and panel.polygon.intersects(zone_polygon):
                return False
        
        return True
    
    def get_panel_by_id(self, panel_id: str) -> Optional[Panel]:
        """
        Get a panel by its ID
        
        Args:
            panel_id: ID of the panel to find
            
        Returns:
            Panel object or None if not found
        """
        for panel in self.panels:
            if panel.id == panel_id:
                return panel
        return None
    
    def get_total_area(self) -> float:
        """
        Calculate the total area of all panels
        
        Returns:
            Total area in square feet
        """
        return sum(panel.get_area() for panel in self.panels)
    
    def get_utilization(self) -> float:
        """
        Calculate the utilization percentage of the layout area
        
        Returns:
            Utilization percentage (0-100)
        """
        total_area = self.get_total_area()
        layout_area = self.width * self.length
        return (total_area / layout_area) * 100 if layout_area > 0 else 0
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the layout to a dictionary
        
        Returns:
            Dictionary representation of the layout
        """
        return {
            'width': self.width,
            'length': self.length,
            'panels': [panel.to_dict() for panel in self.panels],
            'noGoZones': self.no_go_zones,
            'totalArea': self.get_total_area(),
            'utilization': self.get_utilization()
        }


class PanelOptimizer:
    """
    Optimizes panel placement for geosynthetic liner installations
    using various strategies and accounting for site topography.
    """
    
    def __init__(self, site_config: Dict[str, Any], terrain_grid: TerrainGrid):
        """
        Initialize the panel optimizer
        
        Args:
            site_config: Dictionary containing site dimensions and constraints
            terrain_grid: TerrainGrid object with elevation data
        """
        self.site_width = site_config.get('width', 1000)
        self.site_length = site_config.get('length', 1000)
        self.terrain_grid = terrain_grid
        self.no_go_zones = site_config.get('noGoZones', [])
        
        # Initialize layout
        self.layout = PanelLayout(self.site_width, self.site_length)
        
        # Set no-go zones
        self.layout.no_go_zones = self.no_go_zones
    
    def optimize(self, panels: List[Dict[str, Any]], strategy: str = 'balanced') -> Dict[str, Any]:
        """
        Run the optimization algorithm based on the selected strategy
        
        Args:
            panels: List of panel dictionaries with dimensions and properties
            strategy: Optimization strategy ('material', 'labor', or 'balanced')
            
        Returns:
            Dictionary containing optimized panel placements and summary
        """
        print(f"Starting optimization with {strategy} strategy...")
        
        # Create Panel objects
        panel_objects = []
        for panel_dict in panels:
            panel_id = panel_dict.get('id', f"P{len(panel_objects)+1}")
            width = panel_dict.get('width', 15)
            length = panel_dict.get('length', 100)
            material = panel_dict.get('material', 'HDPE 60 mil')
            
            panel = Panel(
                panel_id=panel_id,
                width=width,
                length=length,
                material=material
            )
            panel_objects.append(panel)
        
        # Reset layout
        self.layout.clear()
        
        # Apply the selected optimization strategy
        if strategy == 'material':
            placements = self.optimize_material_efficiency(panel_objects)
        elif strategy == 'labor':
            placements = self.optimize_labor_efficiency(panel_objects)
        else:
            # Default to balanced approach
            placements = self.optimize_balanced(panel_objects)
        
        # Generate summary of the optimization
        summary = self.generate_summary(strategy)
        
        return {
            'placements': [panel.to_dict() for panel in self.layout.panels],
            'summary': summary
        }
    
    def optimize_material_efficiency(self, panels: List[Panel]) -> List[Panel]:
        """
        Optimize for material efficiency (minimize waste)
        This prioritizes using full panels and minimizing cuts
        
        Args:
            panels: List of Panel objects
            
        Returns:
            List of placed panels
        """
        print('Optimizing for material efficiency...')
        
        # Sort panels by area (largest first) to maximize material usage
        sorted_panels = sorted(panels, key=lambda p: p.get_area(), reverse=True)
        
        # Clear existing layout
        self.layout.clear()
        
        # Place panels using a grid pattern, largest panels first
        row = 0
        col = 0
        spacing = 5  # 5 ft spacing between panels
        
        # Ensure we have at least one panel to work with
        if not sorted_panels:
            return []
            
        # Find max width to determine columns
        max_width = max(panel.width for panel in sorted_panels)
        max_cols = max(1, math.floor((self.site_width - 100) / (max_width + spacing)))
        
        for panel in sorted_panels:
            # Try to find a valid position using grid placement
            placed = False
            attempts = 0
            max_attempts = 50  # Prevent infinite loop
            
            while not placed and attempts < max_attempts:
                # Calculate position based on grid
                x = 50 + col * (max_width + spacing)  # 50 ft margin from edge
                y = 50 + row * (panel.length + spacing)  # 50 ft margin from edge
                
                # Set panel position
                panel.set_position(x, y)
                
                # Check if position is valid
                if self.layout.is_valid_placement(panel):
                    # Calculate elevation adjustment based on terrain
                    elevation_adjustment = self.terrain_grid.calculate_panel_elevation_adjustment(panel)
                    panel.elevation_adjustment = elevation_adjustment
                    
                    # Add to layout
                    self.layout.add_panel(panel)
                    placed = True
                else:
                    # Try next position
                    col += 1
                    if col >= max_cols:
                        col = 0
                        row += 1
                
                attempts += 1
            
            # Move to next position for next panel
            col += 1
            if col >= max_cols:
                col = 0
                row += 1
        
        return self.layout.panels
    
    def optimize_labor_efficiency(self, panels: List[Panel]) -> List[Panel]:
        """
        Optimize for labor efficiency (minimize installation time)
        This prioritizes placing panels in a sequence that minimizes movement
        
        Args:
            panels: List of Panel objects
            
        Returns:
            List of placed panels
        """
        print('Optimizing for labor efficiency...')
        
        # Sort panels by ID (assumes IDs represent logical installation sequence)
        sorted_panels = sorted(panels, key=lambda p: p.id)
        
        # Clear existing layout
        self.layout.clear()
        
        # Use a spiral pattern starting from the center for installation efficiency
        center_x = self.site_width / 2
        center_y = self.site_length / 2
        spiral_spacing = 15  # ft
        
        for idx, panel in enumerate(sorted_panels):
            # Try to place panel in spiral pattern
            placed = False
            angle_step = 0.5
            start_angle = 0.5 * idx
            radius_step = spiral_spacing / (2 * math.pi)
            
            max_attempts = 50  # Prevent infinite loop
            attempts = 0
            current_angle = start_angle
            
            while not placed and attempts < max_attempts:
                # Calculate position based on spiral pattern
                radius = radius_step * current_angle
                
                x = center_x + radius * math.cos(current_angle) - panel.width / 2
                y = center_y + radius * math.sin(current_angle) - panel.length / 2
                
                # Determine if rotation helps with installation
                # For labor efficiency, we alternate to create a pattern that's easy to follow
                rotation = 0 if idx % 2 == 0 else 90
                
                # Set panel position and rotation
                panel.set_position(x, y)
                panel.set_rotation(rotation)
                
                # Check if position is valid
                if self.layout.is_valid_placement(panel):
                    # Calculate elevation adjustment based on terrain
                    elevation_adjustment = self.terrain_grid.calculate_panel_elevation_adjustment(panel)
                    panel.elevation_adjustment = elevation_adjustment
                    
                    # Add to layout
                    self.layout.add_panel(panel)
                    placed = True
                else:
                    # Try next position in spiral
                    current_angle += angle_step
                    attempts += 1
        
        return self.layout.panels
    
    def optimize_balanced(self, panels: List[Panel]) -> List[Panel]:
        """
        Balanced optimization approach
        This balances material efficiency and labor efficiency
        
        Args:
            panels: List of Panel objects
            
        Returns:
            List of placed panels
        """
        print('Optimizing with balanced approach...')
        
        # Sort panels by area with some consideration for installation sequence
        def sort_key(panel):
            # Primary sort by area
            area = panel.get_area()
            # Extract numeric part of ID for sorting (e.g., 'P12' -> 12)
            id_num = ''.join(filter(str.isdigit, panel.id))
            id_value = int(id_num) if id_num else 0
            return (-area, id_value)  # Negative area for descending sort
            
        sorted_panels = sorted(panels, key=sort_key)
        
        # Clear existing layout
        self.layout.clear()
        
        # Use quadrant-based placement (divides site into 4 quadrants)
        # This allows for efficient material use while keeping installation sequential
        quadrants = [
            {'x': self.site_width * 0.25, 'y': self.site_length * 0.25},  # Q1
            {'x': self.site_width * 0.75, 'y': self.site_length * 0.25},  # Q2
            {'x': self.site_width * 0.25, 'y': self.site_length * 0.75},  # Q3
            {'x': self.site_width * 0.75, 'y': self.site_length * 0.75},  # Q4
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
            
            # Calculate base position in quadrant (centered on quadrant center)
            quad_center_x = quadrant['x']
            quad_center_y = quadrant['y']
            
            # Start position for this panel
            x = quad_center_x - self.site_width * 0.1 + col_in_quad * (panel.width + spacing)
            y = quad_center_y - self.site_length * 0.1 + row_in_quad * (panel.length + spacing)
            
            # Determine if rotation helps with fit
            rotation = 0 if quadrant_index % 2 == 0 else 90
            
            # Set panel position and rotation
            panel.set_position(x, y)
            panel.set_rotation(rotation)
            
            # Check if position is valid and search nearby if not
            if not self.layout.is_valid_placement(panel):
                # Try to find a nearby valid position
                placed = self.find_nearby_valid_position(panel)
                if not placed:
                    continue  # Skip this panel if we can't place it
            
            # Calculate elevation adjustment based on terrain
            elevation_adjustment = self.terrain_grid.calculate_panel_elevation_adjustment(panel)
            panel.elevation_adjustment = elevation_adjustment
            
            # Add to layout
            self.layout.add_panel(panel)
        
        return self.layout.panels
    
    def find_nearby_valid_position(self, panel: Panel, max_distance: float = 50.0, steps: int = 10) -> bool:
        """
        Find a valid position for a panel near its current position
        
        Args:
            panel: Panel to place
            max_distance: Maximum distance to search
            steps: Number of steps in each direction
            
        Returns:
            True if a valid position was found and panel was placed
        """
        original_x, original_y = panel.position
        original_rotation = panel.rotation_angle
        
        # Try different positions in a spiral pattern
        step_size = max_distance / steps
        
        for radius in np.linspace(step_size, max_distance, steps):
            for angle in np.linspace(0, 2 * math.pi, 16, endpoint=False):
                # Calculate new position
                new_x = original_x + radius * math.cos(angle)
                new_y = original_y + radius * math.sin(angle)
                
                # Set new position
                panel.set_position(new_x, new_y)
                
                # Try both rotations
                for rotation in [original_rotation, (original_rotation + 90) % 180]:
                    panel.set_rotation(rotation)
                    
                    if self.layout.is_valid_placement(panel):
                        return True
        
        # Restore original position and rotation if no valid position found
        panel.set_position(original_x, original_y)
        panel.set_rotation(original_rotation)
        return False
    
    def generate_summary(self, strategy: str) -> Dict[str, Any]:
        """
        Generate a summary of the optimization results
        
        Args:
            strategy: Optimization strategy used
            
        Returns:
            Dictionary containing summary statistics
        """
        # Count panels with significant elevation adjustment
        elevated_panels = sum(1 for p in self.layout.panels if abs(p.elevation_adjustment) > 1)
        total_panels = len(self.layout.panels)
        
        # Calculate average elevation adjustment
        if total_panels > 0:
            avg_elevation = sum(abs(p.elevation_adjustment) for p in self.layout.panels) / total_panels
        else:
            avg_elevation = 0.0
        
        # Calculate site utilization percentage
        utilization = self.layout.get_utilization()
        
        # Generate slope impact summary
        slope_impact = self.generate_slope_impact_summary(elevated_panels, total_panels, avg_elevation)
        
        return {
            'strategy': strategy,
            'totalPanels': total_panels,
            'elevatedPanels': elevated_panels,
            'averageElevationAdjustment': round(avg_elevation, 1),
            'siteUtilization': f"{round(utilization, 1)}%",
            'slopeImpact': slope_impact,
            'totalArea': round(self.layout.get_total_area()),
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
        if elevated_panels == 0 or total_panels == 0:
            return "No significant slope constraints affected panel placement."
            
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