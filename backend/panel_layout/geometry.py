"""
Geometry module for panel layout system

This module provides geometric primitives and operations for working with panels,
leveraging the Shapely library for robust spatial operations.
"""

import numpy as np
from shapely.geometry import Polygon, Point, LineString
from shapely.affinity import rotate, translate
from typing import List, Tuple, Dict, Any, Optional, Union


class Panel:
    """
    Represents a geosynthetic panel with geometry and material properties
    """
    
    def __init__(self, 
                 panel_id: str,
                 width: float, 
                 length: float, 
                 material: str = "HDPE 60 mil",
                 position: Tuple[float, float] = (0, 0),
                 rotation: float = 0,
                 corners: Optional[List[Tuple[float, float]]] = None):
        """
        Initialize a panel
        
        Args:
            panel_id: Unique identifier for the panel
            width: Width of the panel in feet
            length: Length of the panel in feet
            material: Material type
            position: (x, y) coordinates of the panel's bottom-left corner
            rotation: Rotation angle in degrees
            corners: Optional list of corner coordinates for arbitrary polygons
        """
        self.id = panel_id
        self.width = float(width)
        self.length = float(length)
        self.material = material
        self.position = position
        self.rotation_angle = rotation
        self.elevation_adjustment = 0.0  # Will be calculated based on terrain
        self.custom_corners = corners is not None  # Flag to indicate custom shape
        
        # Store original corners if provided
        self.original_corners = corners
        
        # Create the panel geometry
        self._update_geometry()
    
    def _update_geometry(self):
        """Update the panel's geometry based on position, size, and rotation"""
        if self.custom_corners and self.original_corners:
            # Use custom polygon corners if provided
            self.corners = self.original_corners
            
            # Create a Shapely polygon directly from corners
            self.polygon = Polygon(self.corners)
            
            # If position is not (0,0), translate the polygon
            if self.position != (0, 0):
                x, y = self.position
                self.polygon = translate(self.polygon, xoff=x, yoff=y)
                # Update corners after translation
                self.corners = [(p[0] + x, p[1] + y) for p in self.corners]
        else:
            # Create a rectangle for standard panels
            x, y = self.position
            
            # Create a rectangle representing the panel
            self.corners = [
                (x, y),  # Bottom left
                (x + self.width, y),  # Bottom right
                (x + self.width, y + self.length),  # Top right
                (x, y + self.length)  # Top left
            ]
            
            # Create a Shapely polygon
            self.polygon = Polygon(self.corners)
        
        # Apply rotation if needed
        if self.rotation_angle != 0:
            # Calculate center for rotation
            bounds = self.polygon.bounds
            center_x = (bounds[0] + bounds[2]) / 2
            center_y = (bounds[1] + bounds[3]) / 2
            
            # Rotate around the panel's center
            self.polygon = rotate(self.polygon, self.rotation_angle, 
                                 origin=(center_x, center_y))
            
            # Update corners after rotation
            self.corners = list(self.polygon.exterior.coords)[:-1]  # Exclude the closing point
    
    def move(self, dx: float, dy: float):
        """
        Move the panel by the specified amount
        
        Args:
            dx: Distance to move in x direction
            dy: Distance to move in y direction
        """
        new_x = self.position[0] + dx
        new_y = self.position[1] + dy
        self.position = (new_x, new_y)
        self._update_geometry()
    
    def set_position(self, x: float, y: float):
        """
        Set the panel's position to specific coordinates
        
        Args:
            x: New x coordinate
            y: New y coordinate
        """
        self.position = (x, y)
        self._update_geometry()
    
    def set_rotation(self, angle: float):
        """
        Set the panel's rotation angle
        
        Args:
            angle: Rotation angle in degrees
        """
        self.rotation_angle = angle
        self._update_geometry()
    
    def resize(self, new_width: float, new_length: float):
        """
        Resize the panel
        
        Args:
            new_width: New width in feet
            new_length: New length in feet
        """
        self.width = new_width
        self.length = new_length
        self._update_geometry()
    
    def intersects(self, other_panel: 'Panel') -> bool:
        """
        Check if this panel intersects with another panel
        
        Args:
            other_panel: Another panel to check intersection with
            
        Returns:
            True if panels intersect, False otherwise
        """
        return self.polygon.intersects(other_panel.polygon)
    
    def get_area(self) -> float:
        """
        Get the area of the panel in square feet
        
        Returns:
            Area in square feet
        """
        return self.width * self.length
    
    def get_corners(self) -> List[Tuple[float, float]]:
        """
        Get the corners of the panel
        
        Returns:
            List of (x, y) coordinates for the corners
        """
        return self.corners
    
    def get_bounds(self) -> Tuple[float, float, float, float]:
        """
        Get the bounding box of the panel
        
        Returns:
            Tuple of (minx, miny, maxx, maxy)
        """
        return self.polygon.bounds
    
    def contains_point(self, x: float, y: float) -> bool:
        """
        Check if the panel contains the specified point
        
        Args:
            x: x coordinate
            y: y coordinate
            
        Returns:
            True if the point is within the panel, False otherwise
        """
        return self.polygon.contains(Point(x, y))
    
    def distance_to(self, other_panel: 'Panel') -> float:
        """
        Calculate the minimum distance to another panel
        
        Args:
            other_panel: Another panel
            
        Returns:
            Minimum distance between the panels
        """
        return self.polygon.distance(other_panel.polygon)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the panel to a dictionary representation
        
        Returns:
            Dictionary with panel properties
        """
        result = {
            'id': self.id,
            'width': self.width,
            'length': self.length,
            'material': self.material,
            'x': self.position[0],
            'y': self.position[1],
            'rotation': self.rotation_angle,
            'elevationAdjustment': self.elevation_adjustment,
            'corners': self.corners
        }
        
        # Include original corners if this is a custom shape
        if self.custom_corners and self.original_corners:
            result['originalCorners'] = self.original_corners
            
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Panel':
        """
        Create a panel from a dictionary
        
        Args:
            data: Dictionary with panel properties
            
        Returns:
            Panel object
        """
        # Check if corners are provided for custom shape
        corners = None
        if 'corners' in data and isinstance(data['corners'], list) and len(data['corners']) >= 3:
            # Convert corners to tuples if they're lists
            if isinstance(data['corners'][0], list):
                corners = [(float(p[0]), float(p[1])) for p in data['corners']]
            elif isinstance(data['corners'][0], tuple):
                corners = data['corners']
        
        panel = cls(
            panel_id=data['id'],
            width=data.get('width', 10),
            length=data.get('length', 10),
            material=data.get('material', 'HDPE 60 mil'),
            position=(data.get('x', 0), data.get('y', 0)),
            rotation=data.get('rotation', 0),
            corners=corners
        )
        
        panel.elevation_adjustment = data.get('elevationAdjustment', 0.0)
        return panel


class TerrainGrid:
    """
    Represents a terrain grid with elevation data
    """
    
    def __init__(self, width: float, length: float, grid_size: int = 5):
        """
        Initialize a terrain grid
        
        Args:
            width: Width of the terrain in feet
            length: Length of the terrain in feet
            grid_size: Number of cells in each dimension
        """
        # Check for "5acre" special value and convert to square feet
        # 5 acres = 217,800 square feet, so each side ≈ 1,043.6 feet
        import math
        if width == "5acre" or length == "5acre":
            # 1 acre = 43,560 square feet
            acre_size = 5 * 43560
            # Make it a square site
            width = length = math.sqrt(acre_size)
            
        self.width = float(width)
        self.length = float(length)
        self.grid_size = grid_size
        
        # Calculate cell size
        self.cell_width = self.width / grid_size
        self.cell_length = self.length / grid_size
        
        # Initialize elevation grid
        self.elevation_data = np.zeros((grid_size, grid_size))
        self.grid_cells = []
        
        # Create grid cells
        self._initialize_grid()
    
    def _initialize_grid(self):
        """Initialize the grid cells"""
        self.grid_cells = []
        
        for row in range(self.grid_size):
            for col in range(self.grid_size):
                x = col * self.cell_width
                y = row * self.cell_length
                
                cell = {
                    'x': x,
                    'y': y,
                    'width': self.cell_width,
                    'height': self.cell_length,
                    'elevation': self.elevation_data[row, col]
                }
                
                self.grid_cells.append(cell)
    
    def set_elevation(self, elevation_array: np.ndarray):
        """
        Set the elevation data from a 2D numpy array
        
        Args:
            elevation_array: 2D array of elevation values
        """
        if elevation_array.shape != (self.grid_size, self.grid_size):
            raise ValueError(f"Elevation array must be shape {self.grid_size}x{self.grid_size}")
        
        self.elevation_data = elevation_array.copy()
        
        # Update grid cells with new elevation data
        for row in range(self.grid_size):
            for col in range(self.grid_size):
                cell_index = row * self.grid_size + col
                self.grid_cells[cell_index]['elevation'] = self.elevation_data[row, col]
    
    def generate_sloped_terrain(self, max_elevation: float = 16.0, 
                              direction: str = 'SW_to_NE',
                              random_variance: float = 0.75):
        """
        Generate a sloped terrain with random variance
        
        Args:
            max_elevation: Maximum elevation in feet
            direction: Direction of the slope ('SW_to_NE', 'NW_to_SE', etc.)
            random_variance: Maximum random variance in feet
        """
        # Create base elevation grid
        elevation = np.zeros((self.grid_size, self.grid_size))
        
        for row in range(self.grid_size):
            for col in range(self.grid_size):
                # Base elevation depends on direction
                if direction == 'SW_to_NE':
                    # Southwest (0,0) is lowest, Northeast is highest
                    base_elevation = (row + col) * (max_elevation / (2 * (self.grid_size - 1)))
                elif direction == 'NW_to_SE':
                    # Northwest is lowest, Southeast is highest
                    base_elevation = ((self.grid_size - 1 - row) + col) * (max_elevation / (2 * (self.grid_size - 1)))
                elif direction == 'SE_to_NW':
                    # Southeast is lowest, Northwest is highest
                    base_elevation = (row + (self.grid_size - 1 - col)) * (max_elevation / (2 * (self.grid_size - 1)))
                elif direction == 'NE_to_SW':
                    # Northeast is lowest, Southwest is highest
                    base_elevation = ((self.grid_size - 1 - row) + (self.grid_size - 1 - col)) * (max_elevation / (2 * (self.grid_size - 1)))
                else:
                    # Default to SW_to_NE
                    base_elevation = (row + col) * (max_elevation / (2 * (self.grid_size - 1)))
                
                # Add random variance
                if random_variance > 0:
                    variance = np.random.uniform(-random_variance, random_variance)
                    elevation[row, col] = base_elevation + variance
                else:
                    elevation[row, col] = base_elevation
        
        # Set the elevation data
        self.set_elevation(elevation)
        return self.grid_cells
    
    def get_cell_at_position(self, x: float, y: float) -> Optional[Dict[str, Any]]:
        """
        Get the grid cell at the specified position
        
        Args:
            x: x coordinate
            y: y coordinate
            
        Returns:
            Grid cell dictionary or None if outside the terrain
        """
        if x < 0 or x >= self.width or y < 0 or y >= self.length:
            return None
        
        col = int(x / self.cell_width)
        row = int(y / self.cell_length)
        
        # Ensure indices are within bounds
        col = max(0, min(col, self.grid_size - 1))
        row = max(0, min(row, self.grid_size - 1))
        
        cell_index = row * self.grid_size + col
        return self.grid_cells[cell_index]
    
    def calculate_elevation_at_point(self, x: float, y: float) -> float:
        """
        Calculate the elevation at a specific point using bilinear interpolation
        
        Args:
            x: x coordinate
            y: y coordinate
            
        Returns:
            Interpolated elevation value
        """
        if x < 0 or x >= self.width or y < 0 or y >= self.length:
            return 0.0
        
        # Calculate the grid cell coordinates
        col_float = x / self.cell_width
        row_float = y / self.cell_length
        
        col0 = int(col_float)
        row0 = int(row_float)
        
        # Ensure indices are within bounds
        col0 = max(0, min(col0, self.grid_size - 2))
        row0 = max(0, min(row0, self.grid_size - 2))
        
        col1 = col0 + 1
        row1 = row0 + 1
        
        # Calculate interpolation weights
        wx = col_float - col0
        wy = row_float - row0
        
        # Get elevation values at the four corners
        e00 = self.elevation_data[row0, col0]
        e01 = self.elevation_data[row0, col1]
        e10 = self.elevation_data[row1, col0]
        e11 = self.elevation_data[row1, col1]
        
        # Bilinear interpolation
        elevation = (e00 * (1 - wx) * (1 - wy) +
                    e01 * wx * (1 - wy) +
                    e10 * (1 - wx) * wy +
                    e11 * wx * wy)
        
        return elevation
    
    def calculate_panel_elevation_adjustment(self, panel: Panel) -> float:
        """
        Calculate the elevation adjustment needed for a panel based on terrain
        
        Args:
            panel: Panel object
            
        Returns:
            Elevation adjustment value
        """
        # Sample the elevation at multiple points under the panel
        sample_points = []
        
        # Get panel corners in world coordinates
        corners = panel.get_corners()
        
        # Add corners
        sample_points.extend(corners)
        
        # Add center
        min_x, min_y, max_x, max_y = panel.get_bounds()
        center_x = (min_x + max_x) / 2
        center_y = (min_y + max_y) / 2
        sample_points.append((center_x, center_y))
        
        # Calculate elevations at sample points
        elevations = [self.calculate_elevation_at_point(x, y) for x, y in sample_points]
        
        # Calculate the average elevation
        if elevations:
            avg_elevation = sum(elevations) / len(elevations)
            
            # Round to 1 decimal place
            return round(avg_elevation, 1)
        else:
            return 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the terrain grid to a dictionary
        
        Returns:
            Dictionary representation of the terrain grid
        """
        return {
            'width': self.width,
            'length': self.length,
            'gridSize': self.grid_size,
            'elevationGrid': self.grid_cells,
            'elevationData': self.elevation_data.tolist()
        }