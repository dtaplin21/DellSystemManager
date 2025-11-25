import logging
import json
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
    
    def analyze_qc_data(self, qc_data_json: str) -> Dict[str, Any]:
        """
        Analyze QC data to find patterns, anomalies, and insights
        
        Args:
            qc_data_json: QC data as JSON string
            
        Returns:
            Dictionary containing analysis results
        """
        try:
            # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": 
                        """You are an expert in geosynthetic quality control and statistical analysis.
                        Analyze the provided QC data to identify patterns, anomalies, and insights.
                        Look for trends in test results, potential issues with specific panels, or equipment settings.
                        Format your response as a JSON object with the following sections:
                        - summary: Brief overview of the data and key findings
                        - anomalies: List of identified anomalies or outliers, with specifics
                        - patterns: Identified patterns or correlations
                        - recommendations: Suggested actions based on the analysis
                        - statistics: Basic statistical metrics about the data
                        """
                    },
                    {"role": "user", "content": 
                        f"Analyze the following QC data and provide insights:\n\n{qc_data_json}"
                    }
                ],
                temperature=0,
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
                return {
                    "error": "Invalid JSON response from analysis",
                    "text": result_text,
                    "summary": "Error processing QC data analysis"
                }
            
        except Exception as e:
            logger.error(f"Error in analyze_qc_data: {str(e)}")
            return {"error": f"Error analyzing QC data: {str(e)}"}
    
    def clean_qc_data(self, qc_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Clean and standardize QC data extracted from documents
        
        Args:
            qc_data: List of QC data dictionaries
            
        Returns:
            Cleaned and standardized QC data
        """
        try:
            # Convert to JSON for API call
            qc_data_json = json.dumps(qc_data)
            
            # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": 
                        """You are a data cleaning expert for geosynthetic QC testing data.
                        Your task is to standardize and clean the provided QC data:
                        
                        1. Standardize panel IDs to a consistent format
                        2. Standardize date formats to ISO (YYYY-MM-DD)
                        3. Convert test result values to standard units
                        4. Normalize "Pass/Fail" values to either "Pass" or "Fail"
                        5. Fill in missing fields with reasonable values if possible, otherwise null
                        6. Remove any obvious duplicate entries
                        
                        Return the cleaned data as a JSON array of objects.
                        Maintain all original fields, only cleaning their values.
                        """
                    },
                    {"role": "user", "content": 
                        f"Clean and standardize this QC data:\n\n{qc_data_json}"
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
                # The result should have a "data" field containing the cleaned QC data
                if "data" in result_json and isinstance(result_json["data"], list):
                    return result_json["data"]
                else:
                    return qc_data  # Return original if no proper data field
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON from OpenAI response: {result_text}")
                return qc_data  # Return original on error
            
        except Exception as e:
            logger.error(f"Error in clean_qc_data: {str(e)}")
            return qc_data  # Return original on error
    
    def generate_recommendations(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate automated recommendations based on project data, QC results, and industry standards
        
        Args:
            project_data: Dictionary containing project information, QC data, and panel layout
            
        Returns:
            Dictionary containing recommendations and insights
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
                return {
                    "error": "Invalid JSON response",
                    "general": ["Error generating recommendations. Please check the project data and try again."]
                }
            
        except Exception as e:
            logger.error(f"Error in generate_recommendations: {str(e)}")
            return {"error": f"Error generating recommendations: {str(e)}"}
            
    def auto_generate_report(self, project_data: Dict[str, Any], report_type: str = "summary") -> Dict[str, Any]:
        """
        Automatically generate a project report based on the available data
        
        Args:
            project_data: Dictionary containing project information, QC data, and panel layout
            report_type: Type of report to generate (summary, technical, compliance)
            
        Returns:
            Dictionary containing the generated report sections
        """
        try:
            # Convert to JSON for API call
            project_data_json = json.dumps(project_data)
            
            report_prompts = {
                "summary": "Generate a concise executive summary report for project stakeholders. Focus on overall progress, key findings, and high-level recommendations.",
                "technical": "Generate a detailed technical report for engineering review. Include specific test results, statistical analysis, and technical recommendations.",
                "compliance": "Generate a compliance report showing how the project meets industry standards and specifications. Highlight any areas of non-compliance."
            }
            
            prompt = report_prompts.get(report_type, report_prompts["summary"])
            
            # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": 
                        """You are an expert technical writer specializing in geosynthetic installation reports.
                        Generate a professional report based on the provided project data.
                        Structure your report with clear headings and concise content.
                        Include all relevant data points, statistics, and findings.
                        Format your response as a JSON object with report sections as keys.
                        
                        Include these standard sections:
                        - title: Report title
                        - introduction: Project overview
                        - methodology: Testing and QC procedures
                        - findings: Key results and observations
                        - conclusions: Summary of findings
                        - recommendations: Suggested actions
                        """
                    },
                    {"role": "user", "content": 
                        f"{prompt}\n\nProject Data:\n{project_data_json}"
                    }
                ],
                temperature=0.3,  # Some creativity for report writing
                response_format={"type": "json_object"},
                max_tokens=4000
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Parse the JSON response
            try:
                result_json = json.loads(result_text)
                return result_json
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON from OpenAI response: {result_text}")
                return {
                    "error": "Invalid JSON response",
                    "title": "Error Generating Report",
                    "content": "There was an error generating the report. Please check the project data and try again."
                }
            
        except Exception as e:
            logger.error(f"Error in auto_generate_report: {str(e)}")
            return {"error": f"Error generating report: {str(e)}"}