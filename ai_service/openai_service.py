import logging
import json
import asyncio
import requests
from typing import Dict, List, Any, Union
import openai

logger = logging.getLogger(__name__)

class OpenAIService:
    def __init__(self, api_key: str):
        """
        Initialize the OpenAI service with API key
        """
        self.api_key = api_key
        openai.api_key = api_key
    
    def analyze_document_content(self, text: str, question: str) -> str:
        """
        Analyze document content using OpenAI
        
        Args:
            text: Document text content
            question: Question to ask about the document
            
        Returns:
            Analysis text response
        """
        try:
            # If text is too long, truncate it to fit within model limits
            max_tokens = 16000  # Safe limit for gpt-4o
            if len(text) > max_tokens * 3:  # Rough character to token conversion
                logger.warning(f"Document text too long ({len(text)} chars), truncating...")
                text = text[:max_tokens * 3]
            
            # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": 
                        """You are an expert in geosynthetic materials, quality control, and construction documentation.
                        You provide detailed, accurate, and technical analysis of geosynthetic project documents.
                        Focus on welding parameters, material specifications, and quality control results.
                        Identify any potential issues, anomalies, or non-compliant results in the data.
                        Provide your response in a structured format with headlines and bullets where appropriate."""
                    },
                    {"role": "user", "content": 
                        f"Analyze the following document content. {question}\n\nDOCUMENT CONTENT:\n{text}"
                    }
                ],
                temperature=0,
                max_tokens=4000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error in analyze_document_content: {str(e)}")
            return f"Error analyzing document: {str(e)}"
    
    def extract_structured_data(self, text: str, extraction_prompt: str) -> Dict[str, Any]:
        """
        Extract structured data from document text
        
        Args:
            text: Document text content
            extraction_prompt: Prompt defining what data to extract
            
        Returns:
            Dictionary of extracted structured data
        """
        try:
            # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": 
                        """You are a precision data extraction system specialized in geosynthetic QC documents.
                        Extract only the factual information requested.
                        Format your output as a valid JSON object with appropriate fields.
                        Use null for missing values. Be extremely precise in formatting numbers and dates."""
                    },
                    {"role": "user", "content": 
                        f"{extraction_prompt}\n\nDOCUMENT CONTENT:\n{text}"
                    }
                ],
                temperature=0,
                response_format={"type": "json_object"},
                max_tokens=2000
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Parse the JSON response
            try:
                result_json = json.loads(result_text)
                return result_json
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON from OpenAI response: {result_text}")
                return {"error": "Invalid JSON response from extraction", "text": result_text}
            
        except Exception as e:
            logger.error(f"Error in extract_structured_data: {str(e)}")
            return {"error": f"Error extracting data: {str(e)}"}
    
    def optimize_panel_layout(self, panels: List[Dict[str, Any]], strategy: str = "balanced", site_config: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Optimize panel layout using AI
        
        Args:
            panels: List of panel dictionaries with dimensions and properties
            strategy: Optimization strategy ('material', 'labor', or 'balanced')
            site_config: Site configuration including dimensions and constraints
            
        Returns:
            Dictionary containing optimized panel placements and recommendations
        """
        try:
            # Convert panels to JSON for analysis
            panels_json = json.dumps(panels, indent=2)
            site_config_json = json.dumps(site_config or {}, indent=2)
            
            # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": 
                        """You are an expert geosynthetic engineer specializing in panel layout optimization.
                        Analyze the provided panel data and site configuration to generate optimal panel placements.
                        
                        Consider:
                        1. Material efficiency (minimize waste)
                        2. Labor efficiency (minimize installation time)
                        3. Site constraints and terrain
                        4. Industry best practices
                        5. Safety and accessibility requirements
                        
                        Provide specific placement recommendations with coordinates, rotations, and reasoning.
                        Format your response as a JSON object with optimized placements and analysis."""
                    },
                    {"role": "user", "content": 
                        f"""Optimize panel layout with {strategy} strategy.
                        
                        PANELS:
                        {panels_json}
                        
                        SITE CONFIGURATION:
                        {site_config_json}
                        
                        Please provide optimized panel placements with:
                        - x, y coordinates for each panel
                        - rotation angles (0, 90, 180, 270 degrees)
                        - reasoning for each placement decision
                        - overall efficiency metrics
                        - any special considerations or warnings"""
                    }
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
                max_tokens=3000
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Parse the JSON response
            try:
                result_json = json.loads(result_text)
                return result_json
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON from OpenAI response: {result_text}")
                return {"error": "Invalid JSON response from optimization", "text": result_text}
            
        except Exception as e:
            logger.error(f"Error in optimize_panel_layout: {str(e)}")
            return {"error": f"Error optimizing panel layout: {str(e)}"}
    
    async def analyze_image(self, image_base64: str, prompt: str) -> str:
        """
        Analyze a base64 encoded screenshot using a vision-capable model.
        """
        if not image_base64:
            raise ValueError('image_base64 is required for vision analysis')

        def _call() -> str:
            try:
                response = openai.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": f"data:image/png;base64,{image_base64}"}
                            ],
                        }
                    ],
                    max_tokens=600,
                    temperature=0,
                )
                return response.choices[0].message.content.strip()
            except Exception as exc:  # pragma: no cover - network dependent
                logger.error(f"Error analyzing image: {exc}")
                raise

        return await asyncio.to_thread(_call)

    def analyze_qc_data(self, qc_data: str) -> str:
        """
        Analyze QC data to find patterns and anomalies
        
        Args:
            qc_data: QC data in JSON string format
            
        Returns:
            Analysis text response
        """
        try:
            # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": 
                        """You are an expert quality control analyst for geosynthetic materials.
                        Analyze QC data to identify patterns, anomalies, and potential issues.
                        Focus on:
                        - Test result trends and patterns
                        - Out-of-specification results
                        - Equipment calibration issues
                        - Material quality concerns
                        - Process improvement opportunities
                        
                        Provide actionable insights and recommendations."""
                    },
                    {"role": "user", "content": 
                        f"Analyze this QC data for patterns and anomalies:\n\n{qc_data}"
                    }
                ],
                temperature=0.1,
                max_tokens=3000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error in analyze_qc_data: {str(e)}")
            return f"Error analyzing QC data: {str(e)}"
    
    def generate_project_recommendations(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate project recommendations based on project data
        
        Args:
            project_data: Project information and data
            
        Returns:
            Dictionary containing recommendations
        """
        try:
            # Convert to JSON for API call
            project_data_json = json.dumps(project_data)
            
            # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": 
                        """You are an expert consultant in geosynthetic installation and quality control.
                        Based on the provided project data, generate professional recommendations to improve:
                        
                        1. QC testing procedures and frequency
                        2. Equipment settings and calibration
                        3. Panel layout optimization
                        4. Personnel training needs
                        5. Documentation improvements
                        
                        Provide specific, actionable recommendations based on industry standards and best practices.
                        Format your response as a JSON object with recommendation categories as keys.
                        Each category should contain an array of specific recommendations.
                        """
                    },
                    {"role": "user", "content": 
                        f"Generate recommendations for this geosynthetic project:\n\n{project_data_json}"
                    }
                ],
                temperature=0.2,  # Slight randomness for creativity in recommendations
                response_format={"type": "json_object"},
                max_tokens=2500
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Parse the JSON response
            try:
                result_json = json.loads(result_text)
                return result_json
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON from OpenAI response: {result_text}")
                return {"error": "Invalid JSON response from recommendations", "text": result_text}
            
        except Exception as e:
            logger.error(f"Error in generate_project_recommendations: {str(e)}")
            return {"error": f"Error generating recommendations: {str(e)}"}
    
    async def detect_defects_in_image(self, image_base64: str, project_id: str = None) -> Dict[str, Any]:
        """
        Detect defects in geosynthetic material images using GPT-4o vision model.
        
        Args:
            image_base64: Base64 encoded image
            project_id: Optional project ID for context
            
        Returns:
            Dictionary containing detected defects, locations, severity, and recommendations
        """
        if not image_base64:
            raise ValueError('image_base64 is required for defect detection')

        defect_detection_prompt = """You are an expert geosynthetic quality control inspector specializing in defect detection.

Analyze this geosynthetic material image and detect ALL defects present. Look for:

DEFECT TYPES TO DETECT:
1. **Tears/Holes**: Any rips, punctures, or holes in the material
2. **Seam Defects**: Welding issues, incomplete seams, seam separation
3. **Surface Damage**: Scratches, abrasions, surface contamination
4. **Edge Damage**: Fraying, edge tears, edge contamination
5. **Material Degradation**: Discoloration, UV damage, chemical damage
6. **Contamination**: Foreign materials, stains, oil/grease spots
7. **Dimensional Issues**: Wrinkles, folds, misalignment
8. **Installation Defects**: Improper overlap, gaps, misplacement

FOR EACH DEFECT FOUND, provide:
- **Type**: Specific defect category
- **Location**: Describe position (e.g., "top-left quadrant", "center-right", "bottom edge")
- **Size**: Estimate dimensions (e.g., "5cm x 2cm", "approximately 10cm diameter")
- **Severity**: minor / moderate / severe
- **Confidence**: How certain you are (high/medium/low)
- **Recommended Action**: repair_required / monitor / replace_panel / document_only

Return your analysis as a JSON object with this exact structure:
{
  "defects": [
    {
      "id": 1,
      "type": "tear",
      "location": "center-right quadrant",
      "size": "5cm x 2cm",
      "severity": "moderate",
      "confidence": "high",
      "description": "Horizontal tear approximately 5cm long",
      "action": "repair_required",
      "estimated_position": {
        "x_percent": 75,
        "y_percent": 50
      }
    }
  ],
  "overall_assessment": "Overall condition assessment",
  "total_defects": 0,
  "critical_defects": 0,
  "recommendations": ["List of recommendations"]
}

IMPORTANT:
- Be thorough - examine the entire image carefully
- If no defects are found, return empty defects array
- Provide accurate size estimates based on visible reference points
- Use x_percent and y_percent (0-100) for approximate position mapping
- Be conservative with severity ratings - when in doubt, choose lower severity"""

        def _call() -> Dict[str, Any]:
            try:
                response = openai.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a precision defect detection system. Always return valid JSON."
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": defect_detection_prompt},
                                {"type": "image_url", "image_url": f"data:image/png;base64,{image_base64}"}
                            ],
                        }
                    ],
                    max_tokens=3000,  # Higher limit for detailed defect analysis
                    temperature=0,  # Zero temperature for consistent detection
                    response_format={"type": "json_object"},  # Force JSON output
                )
                
                result_text = response.choices[0].message.content.strip()
                
                # Parse JSON response
                try:
                    result_json = json.loads(result_text)
                    return result_json
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON from defect detection: {result_text}")
                    # Fallback: try to extract JSON from text if wrapped
                    import re
                    json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
                    if json_match:
                        try:
                            return json.loads(json_match.group())
                        except:
                            pass
                    return {
                        "error": "Invalid JSON response from defect detection",
                        "raw_response": result_text,
                        "defects": []
                    }
                    
            except Exception as exc:
                logger.error(f"Error detecting defects: {exc}")
                raise

        return await asyncio.to_thread(_call)