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
                                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}}
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
    
    async def extract_asbuilt_form_fields(self, image_base64: str, form_type: str, project_id: str = None) -> Dict[str, Any]:
        """
        Extract as-built form fields from image using GPT-4o vision model.
        
        Args:
            image_base64: Base64 encoded image
            form_type: Type of as-built form (panel_placement, panel_seaming, non_destructive, trial_weld, repairs, destructive)
            project_id: Optional project ID for context
            
        Returns:
            Dictionary containing extracted form fields
        """
        if not image_base64:
            raise ValueError('image_base64 is required for form field extraction')
        
        # Define form-type-specific prompts
        form_prompts = {
            'panel_placement': """Extract information from this panel placement as-built form image.

Look for and extract:
- Date & Time (dateTime): Date and time of panel placement
- Panel Number (panelNumber): Panel identifier/number
- Location Note (locationNote): Location description or notes
- Weather Comments (weatherComments): Weather conditions or comments

Return JSON with only the fields you can confidently detect:
{
  "dateTime": "YYYY-MM-DDTHH:mm" or null,
  "panelNumber": "string or null",
  "locationNote": "string or null",
  "weatherComments": "string or null"
}

If a field is not visible or unclear, set it to null. Return valid JSON only.""",
            
            'panel_seaming': """Extract information from this panel seaming as-built form image.

Look for and extract:
- Date & Time (dateTime): Date and time of seaming operation
- Panel Numbers (panelNumbers): Panel identifiers being seamed together
- Seam Length (seamLength): Length of seam in feet (number)
- Seamer Initials (seamerInitials): Initials of person performing seaming
- Machine Number (machineNumber): Seaming machine identifier
- Wedge Temperature (wedgeTemp): Temperature in °F (number)
- Nip Roller Speed (nipRollerSpeed): Speed setting
- Barrel Temperature (barrelTemp): Temperature in °F (number)
- Preheat Temperature (preheatTemp): Temperature in °F (number)
- Track Peel Inside (trackPeelInside): Measurement value (number)
- Track Peel Outside (trackPeelOutside): Measurement value (number)
- Tensile (lbs/in) (tensileLbsPerIn): Tensile strength value (number)
- Tensile Rate (tensileRate): Rate value
- VBox Result (vboxPassFail): "Pass", "Fail", or "N/A"
- Weather Comments (weatherComments): Weather conditions or comments

Return JSON with only the fields you can confidently detect:
{
  "dateTime": "YYYY-MM-DDTHH:mm" or null,
  "panelNumbers": "string or null",
  "seamLength": number or null,
  "seamerInitials": "string or null",
  "machineNumber": "string or null",
  "wedgeTemp": number or null,
  "nipRollerSpeed": "string or null",
  "barrelTemp": number or null,
  "preheatTemp": number or null,
  "trackPeelInside": number or null,
  "trackPeelOutside": number or null,
  "tensileLbsPerIn": number or null,
  "tensileRate": "string or null",
  "vboxPassFail": "Pass" | "Fail" | "N/A" | null,
  "weatherComments": "string or null"
}

If a field is not visible or unclear, set it to null. Return valid JSON only.""",
            
            'non_destructive': """Extract information from this non-destructive testing as-built form image.

Look for and extract:
- Date & Time (dateTime): Date and time of test
- Panel Numbers (panelNumbers): Panel identifiers tested
- Operator Initials (operatorInitials): Initials of test operator
- VBox Result (vboxPassFail): "Pass" or "Fail"
- Notes (notes): Additional notes or comments

Return JSON with only the fields you can confidently detect:
{
  "dateTime": "YYYY-MM-DDTHH:mm" or null,
  "panelNumbers": "string or null",
  "operatorInitials": "string or null",
  "vboxPassFail": "Pass" | "Fail" | null,
  "notes": "string or null"
}

If a field is not visible or unclear, set it to null. Return valid JSON only.""",
            
            'trial_weld': """Extract information from this trial weld as-built form image.

Look for and extract:
- Date & Time (dateTime): Date and time of trial weld
- Seamer Initials (seamerInitials): Initials of person performing weld
- Machine Number (machineNumber): Welding machine identifier
- Wedge Temperature (wedgeTemp): Temperature in °F (number)
- Nip Roller Speed (nipRollerSpeed): Speed setting
- Barrel Temperature (barrelTemp): Temperature in °F (number)
- Preheat Temperature (preheatTemp): Temperature in °F (number)
- Track Peel Inside (trackPeelInside): Measurement value (number)
- Track Peel Outside (trackPeelOutside): Measurement value (number)
- Tensile (lbs/in) (tensileLbsPerIn): Tensile strength value (number)
- Tensile Rate (tensileRate): Rate value
- Result (passFail): "Pass" or "Fail"
- Ambient Temperature (ambientTemp): Temperature in °F (number)
- Comments (comments): Additional comments

Return JSON with only the fields you can confidently detect:
{
  "dateTime": "YYYY-MM-DDTHH:mm" or null,
  "seamerInitials": "string or null",
  "machineNumber": "string or null",
  "wedgeTemp": number or null,
  "nipRollerSpeed": "string or null",
  "barrelTemp": number or null,
  "preheatTemp": number or null,
  "trackPeelInside": number or null,
  "trackPeelOutside": number or null,
  "tensileLbsPerIn": number or null,
  "tensileRate": "string or null",
  "passFail": "Pass" | "Fail" | null,
  "ambientTemp": number or null,
  "comments": "string or null"
}

If a field is not visible or unclear, set it to null. Return valid JSON only.""",
            
            'repairs': """Extract information from this repair as-built form image.

Look for and extract:
- Date (date): Date of repair (YYYY-MM-DD)
- Repair ID (repairId): Repair identifier in format "R-{number}" (e.g., "R-2", "R-15", "R-123")
  IMPORTANT: The repair ID MUST include the "R-" prefix followed by a number.
  Look for patterns like: "R-2", "R-15", "R-123", "R - 5", "r-10" (normalize to "R-{number}")
  If you see just a number without "R-" prefix, it is NOT a valid repair ID.
- Panel Numbers (panelNumbers): Panel identifiers repaired
- Extruder Number (extruderNumber): Extruder machine identifier
- Operator Initials (operatorInitials): Initials of repair operator
- Type/Detail/Location (typeDetailLocation): Description of repair type, detail, and location
- VBox Result (vboxPassFail): "Pass" or "Fail"

EXAMPLES FOR REPAIR ID:
✅ CORRECT: "R-2" → extract as "R-2"
✅ CORRECT: "R-15" → extract as "R-15"
✅ CORRECT: "R - 5" → extract as "R-5" (normalize spaces)
✅ CORRECT: "r-10" → extract as "R-10" (normalize case)
❌ INCORRECT: "2" → do NOT extract (missing R- prefix)
❌ INCORRECT: "Repair 2" → do NOT extract (not in R-{number} format)
❌ INCORRECT: "R2" → do NOT extract (missing hyphen, not in R-{number} format)

Return JSON with only the fields you can confidently detect:
{
  "date": "YYYY-MM-DD" or null,
  "repairId": "string or null",
  "panelNumbers": "string or null",
  "extruderNumber": "string or null",
  "operatorInitials": "string or null",
  "typeDetailLocation": "string or null",
  "vboxPassFail": "Pass" | "Fail" | null
}

If a field is not visible or unclear, set it to null. Return valid JSON only.""",
            
            'destructive': """Extract information from this destructive testing as-built form image.

Look for and extract:
- Date (date): Date of test (YYYY-MM-DD)
- Panel Numbers (panelNumbers): Panel identifiers tested
- Sample ID (sampleId): Sample identifier in format "D-{number}" (e.g., "D-5", "D-12", "D-99")
  IMPORTANT: The sample ID MUST include the "D-" prefix followed by a number.
  Look for patterns like: "D-5", "D-12", "D-99", "D - 3", "d-7" (normalize to "D-{number}")
  If you see just a number without "D-" prefix, it is NOT a valid sample ID.
- Tester Initials (testerInitials): Initials of person performing test
- Machine Number (machineNumber): Testing machine identifier
- Track Peel Inside (trackPeelInside): Measurement value (number)
- Track Peel Outside (trackPeelOutside): Measurement value (number)
- Tensile (lbs/in) (tensileLbsPerIn): Tensile strength value (number)
- Tensile Rate (tensileRate): Rate value
- Result (passFail): "Pass" or "Fail"
- Comments (comments): Additional comments

EXAMPLES FOR SAMPLE ID:
✅ CORRECT: "D-5" → extract as "D-5"
✅ CORRECT: "D-12" → extract as "D-12"
✅ CORRECT: "D - 3" → extract as "D-3" (normalize spaces)
✅ CORRECT: "d-7" → extract as "D-7" (normalize case)
❌ INCORRECT: "5" → do NOT extract (missing D- prefix)
❌ INCORRECT: "Sample 5" → do NOT extract (not in D-{number} format)
❌ INCORRECT: "D5" → do NOT extract (missing hyphen, not in D-{number} format)

Return JSON with only the fields you can confidently detect:
{
  "date": "YYYY-MM-DD" or null,
  "panelNumbers": "string or null",
  "sampleId": "string or null",
  "testerInitials": "string or null",
  "machineNumber": "string or null",
  "trackPeelInside": number or null,
  "trackPeelOutside": number or null,
  "tensileLbsPerIn": number or null,
  "tensileRate": "string or null",
  "passFail": "Pass" | "Fail" | null,
  "comments": "string or null"
}

If a field is not visible or unclear, set it to null. Return valid JSON only."""
        }
        
        # Get prompt for form type, default to panel_placement if unknown
        prompt = form_prompts.get(form_type, form_prompts['panel_placement'])
        
        def _call() -> Dict[str, Any]:
            try:
                response = openai.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "system",
                            "content": """You are an expert at extracting data from as-built quality control forms. Always return valid JSON matching the exact schema requested.

IMPORTANT ID FORMAT RULES:
- Repair IDs must include "R-" prefix (e.g., "R-2", "R-15")
- Destructive test sample IDs must include "D-" prefix (e.g., "D-5", "D-12")
- Always extract the complete ID including the prefix
- Normalize variations (spaces, case) to standard format
- If an ID is missing its required prefix, do not extract it"""
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}}
                            ],
                        }
                    ],
                    max_tokens=2000,
                    temperature=0,
                    response_format={"type": "json_object"},
                )
                
                result_text = response.choices[0].message.content.strip()
                
                # Log raw AI response for debugging
                logger.info(f"[extract_asbuilt_form_fields] Raw AI response for form_type={form_type}: {result_text[:500]}")
                
                # Parse JSON response
                try:
                    result_json = json.loads(result_text)
                    
                    # Log parsed JSON for debugging
                    logger.info(f"[extract_asbuilt_form_fields] Parsed JSON: {json.dumps(result_json, indent=2)}")
                    
                    # Post-process: Validate and normalize ID formats
                    import re
                    
                    # Validate and normalize repair IDs (R-{number} format)
                    if 'repairId' in result_json and result_json['repairId']:
                        repair_id = str(result_json['repairId']).strip()
                        # Check if it matches R-{number} pattern
                        if not re.match(r'^R-\d+$', repair_id, re.IGNORECASE):
                            # Try to normalize: remove spaces, ensure proper format
                            normalized = re.sub(r'[^Rr0-9-]', '', repair_id)
                            # Check if normalized version matches pattern
                            if re.match(r'^[Rr]-\d+$', normalized, re.IGNORECASE):
                                result_json['repairId'] = normalized.upper()
                                logger.info(f"Normalized repair ID: '{repair_id}' -> '{normalized.upper()}'")
                            else:
                                logger.warning(f"Repair ID '{repair_id}' does not match R-{{number}} format, setting to null")
                                result_json['repairId'] = None
                    
                    # Validate and normalize sample IDs (D-{number} format)
                    if 'sampleId' in result_json and result_json['sampleId']:
                        sample_id = str(result_json['sampleId']).strip()
                        # Check if it matches D-{number} pattern
                        if not re.match(r'^D-\d+$', sample_id, re.IGNORECASE):
                            # Try to normalize: remove spaces, ensure proper format
                            normalized = re.sub(r'[^Dd0-9-]', '', sample_id)
                            # Check if normalized version matches pattern
                            if re.match(r'^[Dd]-\d+$', normalized, re.IGNORECASE):
                                result_json['sampleId'] = normalized.upper()
                                logger.info(f"Normalized sample ID: '{sample_id}' -> '{normalized.upper()}'")
                            else:
                                logger.warning(f"Sample ID '{sample_id}' does not match D-{{number}} format, setting to null")
                                result_json['sampleId'] = None
                    
                    return result_json
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error in extract_asbuilt_form_fields: {str(e)}")
                    logger.error(f"Response text: {result_text[:500]}")
                    # Try to extract JSON from text
                    import re
                    match = re.search(r'\{[\s\S]*\}', result_text)
                    if match:
                        try:
                            return json.loads(match.group(0))
                        except json.JSONDecodeError:
                            pass
                    return {}
            except Exception as e:
                logger.error(f"Error in OpenAI API call for form extraction: {str(e)}")
                raise
        
        return await asyncio.to_thread(_call)

    async def create_panels_from_forms(self, forms_data: List[Dict[str, Any]], project_id: str = None) -> Dict[str, Any]:
        """
        Create panels, patches, and destructive tests from form data.
        
        Note: Forms can contain:
        - panel_placement forms -> create Panels
        - repairs forms -> may create Patches (if repair type indicates patch)
        - destructive forms -> create Destructive Tests
        
        The system now has separate tabs for Panels, Patches, and Destructive Tests.
        Browser automation should use the appropriate tab and form.
        """
        """
        Analyze form data and generate intelligent panel creation instructions.
        
        Args:
            forms_data: List of form records with mapped_data
            project_id: Optional project ID for context
            
        Returns:
            Dictionary containing panel creation instructions and recommendations
        """
        if not forms_data or len(forms_data) == 0:
            return {
                "panels": [],
                "repairs": [],
                "recommendations": [],
                "conflicts": []
            }
        
        try:
            # Prepare form data summary for AI analysis
            form_summary = []
            for form in forms_data:
                mapped_data = form.get('mapped_data', {})
                if isinstance(mapped_data, str):
                    mapped_data = json.loads(mapped_data)
                
                form_summary.append({
                    "domain": form.get('domain'),
                    "panelNumber": mapped_data.get('panelNumber') or mapped_data.get('panelNumbers'),
                    "date": mapped_data.get('date') or mapped_data.get('dateTime'),
                    "location": mapped_data.get('locationNote') or mapped_data.get('location'),
                    "repairId": mapped_data.get('repairId'),
                    "formId": form.get('id')
                })
            
            # Use GPT-4o to analyze forms and generate panel creation strategy
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert geosynthetic panel layout designer. Your role is to analyze form data and generate intelligent creation instructions for panels, patches, and destructive tests.

The system has three separate types:
1. **Panels** - Standard panels (rectangles or right-triangles) created in the Panels tab
2. **Patches** - Circular patches created in the Patches tab (always labeled "Patch", never "Panel")
3. **Destructive Tests** - Rectangular test samples created in the Destructive Tests tab (format: D-{number})

Analyze the provided forms and:
1. Identify unique panels that need to be created (from panel_placement forms)
2. Identify patches that need to be created (from repairs forms if repair type indicates patch)
3. Identify destructive tests that need to be created (from destructive forms)
4. Determine optimal placement based on form data
5. Identify repairs that need to be associated with panels
6. Detect conflicts or duplicates
7. Provide recommendations for layout optimization

Return a JSON object with:
- panels: Array of panel creation instructions with optimal positioning (for Panels tab)
- patches: Array of patch creation instructions (for Patches tab, always use "Patch" terminology)
- destructiveTests: Array of destructive test creation instructions (for Destructive Tests tab, format: D-{number})
- repairs: Array of repair records to associate with panels
- recommendations: Array of optimization recommendations
- conflicts: Array of detected conflicts or issues"""
                    },
                    {
                        "role": "user",
                        "content": f"""Analyze these forms and generate panel creation instructions:

Forms Data:
{json.dumps(form_summary, indent=2)}

Project ID: {project_id or 'N/A'}

Generate intelligent creation instructions that:
1. Create panels from panel_placement forms (use Panels tab)
2. Create patches from repairs forms if repair type indicates patch (use Patches tab, always label as "Patch")
3. Create destructive tests from destructive forms (use Destructive Tests tab, format: D-{number})
4. Associate repairs with correct panels based on panelNumbers
5. Optimize positioning to avoid overlaps
6. Handle duplicate panel/patch/test numbers appropriately
7. Provide recommendations for layout improvements

Return valid JSON only."""
                    }
                ],
                max_tokens=4000,
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            result_text = response.choices[0].message.content.strip()
            result_json = json.loads(result_text)
            
            logger.info(f"Generated panel creation instructions: {len(result_json.get('panels', []))} panels, {len(result_json.get('repairs', []))} repairs")
            
            return result_json
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in create_panels_from_forms: {str(e)}")
            logger.error(f"Response text: {result_text[:500]}")
            # Return basic structure on error
            return {
                "panels": [],
                "repairs": [],
                "recommendations": [],
                "conflicts": [{"error": "Failed to parse AI response"}]
            }
        except Exception as e:
            logger.error(f"Error in create_panels_from_forms: {str(e)}")
            raise
        
        return await asyncio.to_thread(_call)
    
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
                                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}}
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