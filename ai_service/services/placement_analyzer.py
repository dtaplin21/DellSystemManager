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
            # Normalize panel numbers to consistent format (ensure P- prefix if missing)
            normalized_panel_numbers = []
            for pn in panel_numbers:
                # If it's just a number, add P- prefix
                if pn.isdigit():
                    normalized_panel_numbers.append(f"P-{pn}")
                # If it already has P- prefix or similar, keep as is
                elif pn.upper().startswith("P-") or pn.upper().startswith("P"):
                    # Normalize to P-{number} format
                    number_part = pn.upper().replace("P-", "").replace("P", "").strip()
                    if number_part.isdigit():
                        normalized_panel_numbers.append(f"P-{number_part}")
                    else:
                        normalized_panel_numbers.append(pn)  # Keep original if can't normalize
                else:
                    normalized_panel_numbers.append(pn)  # Keep original format
            panel_numbers = normalized_panel_numbers
        elif form_data.get("panelNumber"):
            pn = str(form_data["panelNumber"]).strip()
            # Normalize single panel number
            if pn.isdigit():
                panel_numbers = [f"P-{pn}"]
            elif pn.upper().startswith("P-") or pn.upper().startswith("P"):
                number_part = pn.upper().replace("P-", "").replace("P", "").strip()
                if number_part.isdigit():
                    panel_numbers = [f"P-{number_part}"]
                else:
                    panel_numbers = [pn]
            else:
                panel_numbers = [pn]
        
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
    
    def _get_panel_coordinates(self, panel_number: str, existing_layout: Dict[str, Any]) -> Optional[Dict[str, float]]:
        """
        Get panel coordinates from layout by panel number.
        
        Args:
            panel_number: Panel number/ID to find
            existing_layout: Existing layout data
            
        Returns:
            Dictionary with x, y, width, height, center_x, center_y, or None if not found
        """
        panels = existing_layout.get("panels", [])
        for panel in panels:
            panel_num = str(panel.get("panelNumber", "")).strip()
            panel_id = str(panel.get("id", "")).strip()
            
            # Try multiple matching strategies
            if (panel_num == panel_number or 
                panel_num.endswith(panel_number.replace("P-", "")) or
                panel_id == panel_number or
                panel_number in panel_num):
                x = float(panel.get("x", 0))
                y = float(panel.get("y", 0))
                width = float(panel.get("width", 0))
                height = float(panel.get("height", 0))
                
                return {
                    "x": x,
                    "y": y,
                    "width": width,
                    "height": height,
                    "center_x": x + width / 2,
                    "center_y": y + height / 2,
                    "left": x,
                    "right": x + width,
                    "top": y,
                    "bottom": y + height
                }
        return None
    
    def _apply_cardinal_direction_offset(
        self,
        base_x: float,
        base_y: float,
        distance: float,
        direction: str,
        cardinal_direction: str = 'north'
    ) -> Tuple[float, float]:
        """
        Apply cardinal direction offset to base coordinates.
        
        Args:
            base_x: Base x coordinate
            base_y: Base y coordinate
            distance: Distance in feet to offset
            direction: Cardinal direction ('north', 'south', 'east', 'west')
            cardinal_direction: Project cardinal direction setting
            
        Returns:
            Tuple of (new_x, new_y) coordinates
        """
        # Normalize direction
        direction = direction.lower()
        
        # Convert feet to canvas units (assuming 1 foot = 1 canvas unit, adjust if needed)
        canvas_distance = distance
        
        # Calculate offset based on direction
        # Canvas coordinate system: origin at top-left, x increases right, y increases down
        # North = up = negative y, South = down = positive y
        # East = right = positive x, West = left = negative x
        offset_x = 0.0
        offset_y = 0.0
        
        if direction == 'north':
            offset_y = -canvas_distance  # Up (negative y)
        elif direction == 'south':
            offset_y = canvas_distance  # Down (positive y)
        elif direction == 'east':
            offset_x = canvas_distance  # Right (positive x)
        elif direction == 'west':
            offset_x = -canvas_distance  # Left (negative x)
        
        return (base_x + offset_x, base_y + offset_y)
    
    def _calculate_coordinates_from_structured(
        self,
        panel_numbers: List[str],
        distance: float,
        direction: str,
        placement_type: str,
        existing_layout: Dict[str, Any],
        cardinal_direction: str = 'north'
    ) -> Dict[str, Any]:
        """
        Calculate x,y coordinates from structured location data.
        
        Args:
            panel_numbers: List of panel numbers/IDs
            distance: Distance in feet from reference point
            direction: Cardinal direction ('north', 'south', 'east', 'west')
            placement_type: 'single_panel' or 'seam'
            existing_layout: Existing layout data
            cardinal_direction: Project cardinal direction setting
            
        Returns:
            Dictionary with x, y coordinates, confidence, strategy, and reasoning
        """
        if not panel_numbers or not existing_layout.get("panels"):
            return {
                "x": 2000,
                "y": 2000,
                "confidence": 0.3,
                "strategy": "fallback_center",
                "reasoning": "No panel references found for structured placement"
            }
        
        # Find panels in layout
        found_panels = []
        for panel_num in panel_numbers:
            panel_coords = self._get_panel_coordinates(panel_num, existing_layout)
            if panel_coords:
                found_panels.append(panel_coords)
        
        if not found_panels:
            return {
                "x": 2000,
                "y": 2000,
                "confidence": 0.3,
                "strategy": "fallback_center",
                "reasoning": f"Panels {panel_numbers} not found in layout"
            }
        
        # Calculate base position based on placement type
        if placement_type == "seam" and len(found_panels) >= 2:
            # For seams: place between two panels
            panel1 = found_panels[0]
            panel2 = found_panels[1]
            
            # Calculate midpoint between panels
            base_x = (panel1["center_x"] + panel2["center_x"]) / 2
            base_y = (panel1["center_y"] + panel2["center_y"]) / 2
            
            reasoning = f"Seam placement between {panel_numbers[0]} and {panel_numbers[1]}"
        else:
            # For single panel: use panel center or edge based on direction
            panel = found_panels[0]
            
            # Use panel center as base
            base_x = panel["center_x"]
            base_y = panel["center_y"]
            
            reasoning = f"Single panel placement relative to {panel_numbers[0]}"
        
        # Apply cardinal direction offset
        final_x, final_y = self._apply_cardinal_direction_offset(
            base_x, base_y, distance, direction, cardinal_direction
        )
        
        reasoning += f", {distance} feet {direction}"
        
        return {
            "x": final_x,
            "y": final_y,
            "confidence": 0.9,  # High confidence for structured data
            "strategy": "structured_location_calculation",
            "reasoning": reasoning,
            "structured_fields_used": {
                "placement_type": placement_type,
                "distance": distance,
                "direction": direction,
                "panel_numbers": panel_numbers
            }
        }
    
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
        Prioritizes structured location fields (placementType, locationDistance, locationDirection)
        over text parsing for better accuracy.
        
        Args:
            form_data: Form mapped_data dictionary
            existing_layout: Existing layout data
            item_type: Type of item ('panel', 'patch', 'destructive_test')
            project_id: Optional project ID for context
            cardinal_direction: Project cardinal direction setting ('north', 'south', 'east', 'west')
            
        Returns:
            Dictionary with x, y coordinates, confidence score, and strategy
        """
        # First, try to extract location hints from form
        location_hints = self.analyze_form_location(form_data)
        
        # PRIORITY 1: If explicit coordinates found, use them
        if location_hints.get("coordinates"):
            coords = location_hints["coordinates"]
            return {
                "x": coords["x"],
                "y": coords["y"],
                "confidence": 0.95,
                "strategy": coords["source"],
                "reasoning": "Explicit coordinates found in form data"
            }
        
        # PRIORITY 2: Use structured location fields if available
        placement_type = location_hints.get("placement_type")
        location_distance = location_hints.get("location_distance")
        location_direction = location_hints.get("location_direction")
        panel_references = location_hints.get("panel_references", [])
        
        if placement_type and location_distance is not None and location_direction and panel_references:
            # Calculate coordinates from structured data
            structured_result = self._calculate_coordinates_from_structured(
                panel_numbers=panel_references,
                distance=location_distance,
                direction=location_direction,
                placement_type=placement_type,
                existing_layout=existing_layout,
                cardinal_direction=cardinal_direction
            )
            
            # Only use structured result if confidence is high enough
            if structured_result.get("confidence", 0) >= 0.5:
                logger.info(f"Using structured location data for placement: {structured_result.get('reasoning')}")
                return structured_result
        
        # PRIORITY 3: If panel references found with cardinal directions, try to locate related panels
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
                offset_distance = location_hints.get("location_distance", 150)  # Use structured distance if available
                
                cardinal_dirs = location_hints.get("cardinal_directions", [])
                if cardinal_dirs:
                    # Use the first cardinal direction found
                    direction = cardinal_dirs[0]
                    # Use helper method for consistent offset calculation
                    final_x, final_y = self._apply_cardinal_direction_offset(
                        avg_x, avg_y, offset_distance, direction, cardinal_direction
                    )
                    offset_x = final_x - avg_x
                    offset_y = final_y - avg_y
                
                # If no cardinal direction, use default offset
                if offset_x == 0 and offset_y == 0:
                    offset_x = offset_distance
                    offset_y = offset_distance
                
                reasoning = f"Placed near referenced panels: {', '.join(location_hints['panel_references'])}"
                if cardinal_dirs:
                    reasoning += f", {offset_distance} feet {cardinal_dirs[0]} of panels"
                
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

