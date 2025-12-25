"""
Placement Analysis Service

Analyzes form data and existing layout to determine optimal placement
coordinates for panels, patches, and destructive tests.
"""

import json
import logging
import os
import re
from typing import Dict, List, Optional, Any, Tuple
import requests
from openai import OpenAI

logger = logging.getLogger(__name__)


class PlacementAnalyzer:
    """Analyzes placement requirements and determines optimal coordinates"""
    
    def __init__(self, openai_api_key: str = None, backend_url: str = None):
        self.openai_client = OpenAI(api_key=openai_api_key or os.getenv("OPENAI_API_KEY"))
        self.backend_url = backend_url or os.getenv("BACKEND_URL", "http://localhost:8003")
    
    def analyze_form_location(self, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract location hints from form data, including cardinal direction references.
        Prioritizes structured location fields (placementType, locationDistance, locationDirection)
        over text parsing for better accuracy.
        
        Args:
            form_data: Form mapped_data dictionary
            
        Returns:
            Dictionary with location hints and extracted information
        """
        hints = {
            "coordinates": None,
            "panel_references": [],
            "location_description": None,
            "spatial_references": [],
            "cardinal_directions": [],
            "placement_type": None,
            "location_distance": None,
            "location_direction": None
        }
        
        # PRIORITY 1: Check for structured location fields (preferred method)
        placement_type = form_data.get("placementType") or form_data.get("placement_type")
        location_distance = form_data.get("locationDistance") or form_data.get("location_distance")
        location_direction = form_data.get("locationDirection") or form_data.get("location_direction")
        
        if placement_type or location_distance or location_direction:
            # Normalize placement_type
            if placement_type:
                if placement_type.lower() in ["single panel", "single_panel"]:
                    hints["placement_type"] = "single_panel"
                elif placement_type.lower() in ["seam between panels", "seam"]:
                    hints["placement_type"] = "seam"
                else:
                    hints["placement_type"] = placement_type.lower().replace(" ", "_")
            
            # Store structured fields
            if location_distance:
                try:
                    hints["location_distance"] = float(location_distance)
                except (ValueError, TypeError):
                    pass
            
            if location_direction:
                # Normalize direction to lowercase
                direction = str(location_direction).lower()
                if direction in ["north", "south", "east", "west"]:
                    hints["location_direction"] = direction
                    hints["cardinal_directions"].append(direction)
                elif direction in ["n", "s", "e", "w"]:
                    direction_map = {"n": "north", "s": "south", "e": "east", "w": "west"}
                    hints["location_direction"] = direction_map[direction]
                    hints["cardinal_directions"].append(direction_map[direction])
        
        # PRIORITY 2: Check for explicit coordinates in locationDescription, locationNote, or typeDetailLocation
        location_fields = [
            form_data.get("locationDescription"),
            form_data.get("locationNote"),
            form_data.get("typeDetailLocation"),
            form_data.get("location"),
            form_data.get("notes")
        ]
        
        for field_value in location_fields:
            if not field_value:
                continue
                
            field_str = str(field_value).lower()
            
            # Try to extract coordinates (x, y) or (x,y) patterns
            coord_patterns = [
                r'\((\d+),\s*(\d+)\)',  # (100, 200)
                r'x:\s*(\d+),\s*y:\s*(\d+)',  # x: 100, y: 200
                r'coord[inates]*:\s*(\d+),\s*(\d+)',  # coordinates: 100, 200
            ]
            
            for pattern in coord_patterns:
                match = re.search(pattern, field_str)
                if match:
                    hints["coordinates"] = {
                        "x": int(match.group(1)),
                        "y": int(match.group(2)),
                        "source": "explicit_coordinates"
                    }
                    break
            
            if hints["coordinates"]:
                break
            
            # Extract panel references
            panel_patterns = [
                r'panel\s*#?\s*(\d+)',
                r'panel\s*(\d+)',
                r'p-(\d+)',
                r'pn\s*(\d+)'
            ]
            
            for pattern in panel_patterns:
                matches = re.findall(pattern, field_str)
                hints["panel_references"].extend([f"P-{m}" for m in matches])
            
            # Extract cardinal direction references
            cardinal_patterns = [
                r'\b(north|south|east|west)\b',
                r'\b(n|s|e|w)\b',  # Single letter abbreviations
                r'\b(northern|southern|eastern|western)\b'
            ]
            
            for pattern in cardinal_patterns:
                matches = re.findall(pattern, field_str, re.IGNORECASE)
                for match in matches:
                    direction = match.lower()
                    # Normalize to standard directions
                    if direction in ['n', 'northern']:
                        hints["cardinal_directions"].append('north')
                    elif direction in ['s', 'southern']:
                        hints["cardinal_directions"].append('south')
                    elif direction in ['e', 'eastern']:
                        hints["cardinal_directions"].append('east')
                    elif direction in ['w', 'western']:
                        hints["cardinal_directions"].append('west')
                    elif direction in ['north', 'south', 'east', 'west']:
                        hints["cardinal_directions"].append(direction)
            
            # Store location description for AI interpretation
            if not hints["location_description"]:
                hints["location_description"] = str(field_value)
        
        # Extract panel numbers from form
        panel_numbers = []
        if form_data.get("panelNumbers"):
            panel_str = str(form_data["panelNumbers"])
            # Handle comma-separated panel numbers
            panel_numbers = [p.strip() for p in panel_str.split(",") if p.strip()]
        elif form_data.get("panelNumber"):
            panel_numbers = [str(form_data["panelNumber"])]
        
        hints["panel_references"].extend(panel_numbers)
        hints["panel_references"] = list(set(hints["panel_references"]))  # Remove duplicates
        
        return hints
    
    async def get_existing_layout(self, project_id: str, auth_token: str = None) -> Dict[str, Any]:
        """
        Query existing layout from backend API.
        
        Args:
            project_id: Project ID
            auth_token: Optional authentication token
            
        Returns:
            Dictionary with panels, patches, and destructive tests
        """
        try:
            headers = {"Content-Type": "application/json"}
            if auth_token:
                headers["Authorization"] = f"Bearer {auth_token}"
            
            # Get panels
            panels_response = requests.get(
                f"{self.backend_url}/api/projects/{project_id}/panels",
                headers=headers,
                timeout=10
            )
            panels = panels_response.json().get("panels", []) if panels_response.ok else []
            
            # Get patches
            patches_response = requests.get(
                f"{self.backend_url}/api/projects/{project_id}/patches",
                headers=headers,
                timeout=10
            )
            patches = patches_response.json().get("patches", []) if patches_response.ok else []
            
            # Get destructive tests
            destructs_response = requests.get(
                f"{self.backend_url}/api/projects/{project_id}/destructive-tests",
                headers=headers,
                timeout=10
            )
            destructive_tests = destructs_response.json().get("destructiveTests", []) if destructs_response.ok else []
            
            return {
                "panels": panels or [],
                "patches": patches or [],
                "destructive_tests": destructive_tests or [],
                "total_items": len(panels) + len(patches) + len(destructive_tests)
            }
        except Exception as e:
            logger.error(f"Error fetching existing layout: {e}")
            return {
                "panels": [],
                "patches": [],
                "destructive_tests": [],
                "total_items": 0
            }
    
    def analyze_layout_gaps(self, existing_layout: Dict[str, Any], item_type: str, item_size: Dict[str, float] = None) -> List[Dict[str, Any]]:
        """
        Find optimal placement areas by analyzing gaps in existing layout.
        
        Args:
            existing_layout: Dictionary with panels, patches, destructive_tests
            item_type: Type of item ('panel', 'patch', 'destructive_test')
            item_size: Optional size dict with width/height or radius
            
        Returns:
            List of potential placement positions with scores
        """
        all_items = []
        
        # Collect all existing items with their bounds
        for panel in existing_layout.get("panels", []):
            all_items.append({
                "type": "panel",
                "x": float(panel.get("x", 0)),
                "y": float(panel.get("y", 0)),
                "width": float(panel.get("width", 0)),
                "height": float(panel.get("height", 0)),
                "bounds": {
                    "left": float(panel.get("x", 0)),
                    "right": float(panel.get("x", 0)) + float(panel.get("width", 0)),
                    "top": float(panel.get("y", 0)),
                    "bottom": float(panel.get("y", 0)) + float(panel.get("height", 0))
                }
            })
        
        for patch in existing_layout.get("patches", []):
            radius = float(patch.get("radius", 10))
            all_items.append({
                "type": "patch",
                "x": float(patch.get("x", 0)),
                "y": float(patch.get("y", 0)),
                "radius": radius,
                "bounds": {
                    "left": float(patch.get("x", 0)) - radius,
                    "right": float(patch.get("x", 0)) + radius,
                    "top": float(patch.get("y", 0)) - radius,
                    "bottom": float(patch.get("y", 0)) + radius
                }
            })
        
        for dt in existing_layout.get("destructive_tests", []):
            all_items.append({
                "type": "destructive_test",
                "x": float(dt.get("x", 0)),
                "y": float(dt.get("y", 0)),
                "width": float(dt.get("width", 0)),
                "height": float(dt.get("height", 0)),
                "bounds": {
                    "left": float(dt.get("x", 0)),
                    "right": float(dt.get("x", 0)) + float(dt.get("width", 0)),
                    "top": float(dt.get("y", 0)),
                    "bottom": float(dt.get("y", 0)) + float(dt.get("height", 0))
                }
            })
        
        # Default canvas size (can be made configurable)
        canvas_width = 4000
        canvas_height = 4000
        
        # Simple gap-finding algorithm: find areas with fewer items
        # For now, return center position if no items exist
        if len(all_items) == 0:
            return [{
                "x": canvas_width / 2,
                "y": canvas_height / 2,
                "confidence": 0.9,
                "strategy": "center_of_empty_canvas"
            }]
        
        # Find average spacing and suggest positions
        # This is a simplified version - could be enhanced with more sophisticated algorithms
        avg_x = sum(item["x"] for item in all_items) / len(all_items)
        avg_y = sum(item["y"] for item in all_items) / len(all_items)
        
        # Suggest positions around the average, avoiding overlaps
        suggestions = []
        spacing = 200  # Default spacing
        
        for offset_x in [-spacing, 0, spacing]:
            for offset_y in [-spacing, 0, spacing]:
                x = avg_x + offset_x
                y = avg_y + offset_y
                
                # Check if position overlaps with existing items
                overlaps = False
                for item in all_items:
                    bounds = item["bounds"]
                    if (bounds["left"] <= x <= bounds["right"] and 
                        bounds["top"] <= y <= bounds["bottom"]):
                        overlaps = True
                        break
                
                if not overlaps and 0 <= x <= canvas_width and 0 <= y <= canvas_height:
                    suggestions.append({
                        "x": x,
                        "y": y,
                        "confidence": 0.7,
                        "strategy": "spatial_average"
                    })
        
        # If no good positions found, use center
        if not suggestions:
            suggestions.append({
                "x": canvas_width / 2,
                "y": canvas_height / 2,
                "confidence": 0.5,
                "strategy": "fallback_center"
            })
        
        return suggestions
    
    def determine_placement(
        self, 
        form_data: Dict[str, Any], 
        existing_layout: Dict[str, Any],
        item_type: str,
        project_id: str = None,
        cardinal_direction: str = 'north'
    ) -> Dict[str, Any]:
        """
        Use AI to determine optimal placement coordinates.
        
        Args:
            form_data: Form mapped_data dictionary
            existing_layout: Existing layout data
            item_type: Type of item ('panel', 'patch', 'destructive_test')
            project_id: Optional project ID for context
            
        Returns:
            Dictionary with x, y coordinates, confidence score, and strategy
        """
        # First, try to extract location hints from form
        location_hints = self.analyze_form_location(form_data)
        
        # If explicit coordinates found, use them
        if location_hints.get("coordinates"):
            coords = location_hints["coordinates"]
            return {
                "x": coords["x"],
                "y": coords["y"],
                "confidence": 0.95,
                "strategy": coords["source"],
                "reasoning": "Explicit coordinates found in form data"
            }
        
        # If panel references found, try to locate related panels
        if location_hints.get("panel_references") and existing_layout.get("panels"):
            related_panels = []
            for panel_ref in location_hints["panel_references"]:
                # Try to find panel by number
                for panel in existing_layout["panels"]:
                    panel_num = str(panel.get("panelNumber", "")).strip()
                    if panel_num == panel_ref or panel_num.endswith(panel_ref.replace("P-", "")):
                        related_panels.append(panel)
                        break
            
            if related_panels:
                # Calculate average position of related panels
                avg_x = sum(float(p.get("x", 0)) for p in related_panels) / len(related_panels)
                avg_y = sum(float(p.get("y", 0)) for p in related_panels) / len(related_panels)
                
                # Apply cardinal direction offset if specified
                offset_x = 0
                offset_y = 0
                offset_distance = 150
                
                cardinal_dirs = location_hints.get("cardinal_directions", [])
                if cardinal_dirs:
                    # Use the first cardinal direction found
                    direction = cardinal_dirs[0]
                    # Adjust offset based on canvas orientation (cardinal_direction parameter)
                    # Default: north is up (negative y), south is down (positive y)
                    # east is right (positive x), west is left (negative x)
                    if direction == 'north':
                        offset_y = -offset_distance
                    elif direction == 'south':
                        offset_y = offset_distance
                    elif direction == 'east':
                        offset_x = offset_distance
                    elif direction == 'west':
                        offset_x = -offset_distance
                
                # If no cardinal direction, use default offset
                if offset_x == 0 and offset_y == 0:
                    offset_x = offset_distance
                    offset_y = offset_distance
                
                reasoning = f"Placed near referenced panels: {', '.join(location_hints['panel_references'])}"
                if cardinal_dirs:
                    reasoning += f", {direction} of panels"
                
                return {
                    "x": avg_x + offset_x,
                    "y": avg_y + offset_y,
                    "confidence": 0.85,
                    "strategy": "near_related_panels_with_direction",
                    "reasoning": reasoning
                }
        
        # Use AI to interpret location description
        if location_hints.get("location_description"):
            try:
                # Use GPT-4o to interpret location description
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "system",
                            "content": """You are a geospatial analyst specializing in panel layout placement. 
                            Analyze location descriptions and suggest x,y coordinates on a 4000x4000 canvas.
                            Consider spatial relationships, proximity to other items, cardinal directions (North/South/East/West), 
                            and common placement patterns.
                            
                            IMPORTANT: The canvas uses a coordinate system where:
                            - North is typically up (negative y direction or top of canvas)
                            - South is typically down (positive y direction or bottom of canvas)
                            - East is typically right (positive x direction or right side of canvas)
                            - West is typically left (negative x direction or left side of canvas)
                            
                            When interpreting cardinal directions:
                            - "North of Panel P-5" means place the item above Panel P-5 (lower y coordinate)
                            - "South of Panel P-5" means place the item below Panel P-5 (higher y coordinate)
                            - "East of Panel P-5" means place the item to the right of Panel P-5 (higher x coordinate)
                            - "West of Panel P-5" means place the item to the left of Panel P-5 (lower x coordinate)
                            - "Between Panel P-5 and P-6" means place the item in the space between these panels
                            
                            Return only a JSON object with x, y, confidence (0-1), and reasoning."""
                        },
                        {
                            "role": "user",
                            "content": f"""Location description: {location_hints['location_description']}
                            
                            Cardinal direction references found: {', '.join(location_hints.get('cardinal_directions', [])) or 'None'}
                            Panel references: {', '.join(location_hints.get('panel_references', [])) or 'None'}
                            
                            Existing layout summary:
                            - Panels: {len(existing_layout.get('panels', []))}
                            - Patches: {len(existing_layout.get('patches', []))}
                            - Destructive tests: {len(existing_layout.get('destructive_tests', []))}
                            
                            Item type: {item_type}
                            Canvas orientation: {cardinal_direction} (this is the project's cardinal direction setting)
                            
                            Suggest optimal placement coordinates (x, y) on a 4000x4000 canvas.
                            Consider cardinal directions mentioned in the location description.
                            Return JSON: {{"x": number, "y": number, "confidence": 0.0-1.0, "reasoning": "string"}}"""
                        }
                    ],
                    temperature=0,
                    response_format={"type": "json_object"}
                )
                
                result = json.loads(response.choices[0].message.content)
                return {
                    "x": float(result.get("x", 2000)),
                    "y": float(result.get("y", 2000)),
                    "confidence": float(result.get("confidence", 0.6)),
                    "strategy": "ai_interpretation",
                    "reasoning": result.get("reasoning", "AI interpretation of location description")
                }
            except Exception as e:
                logger.error(f"Error in AI placement interpretation: {e}")
        
        # Fallback: analyze layout gaps
        gap_suggestions = self.analyze_layout_gaps(existing_layout, item_type)
        if gap_suggestions:
            best = max(gap_suggestions, key=lambda s: s.get("confidence", 0))
            return {
                "x": best["x"],
                "y": best["y"],
                "confidence": best.get("confidence", 0.5),
                "strategy": best.get("strategy", "layout_gap_analysis"),
                "reasoning": f"Placed using {best.get('strategy', 'gap analysis')}"
            }
        
        # Final fallback: center of canvas
        return {
            "x": 2000,
            "y": 2000,
            "confidence": 0.3,
            "strategy": "default_center",
            "reasoning": "No location information available, using canvas center"
        }

