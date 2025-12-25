"""
Form Review and Layout Automation Workflow

Multi-agent CrewAI workflow for reviewing uploaded forms and automatically
creating panels, patches, or destructive tests in optimal locations.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from hybrid_ai_architecture import (
    WorkflowBlueprint,
    AgentProfile,
    WorkflowTaskTemplate,
    TaskComplexity,
    Process
)


def get_form_review_workflow() -> WorkflowBlueprint:
    """
    Define the multi-agent workflow for form review and layout automation.
    
    This workflow uses 5 specialized agents:
    1. Form Reviewer - Validates form data quality and completeness
    2. Placement Analyst - Determines optimal placement using form data and layout analysis
    3. Layout Navigator - Handles browser navigation and tab switching
    4. Item Creator - Executes browser automation to create items
    5. Validation Agent - Verifies created items and checks for conflicts
    """
    
    return WorkflowBlueprint(
        id="form_review_and_placement",
        name="Form Review and Layout Automation",
        description="Review uploaded forms, analyze placement requirements, and automatically create panels, patches, or destructive tests in optimal locations",
        process=Process.sequential,
        agents={
            "form_reviewer": AgentProfile(
                name="Form Reviewer",
                role="Form Data Quality Analyst",
                goal="Validate form data completeness, check required fields, identify form type, and assess data quality",
                backstory="Experienced quality control specialist who reviews hundreds of as-built forms daily. Expert at identifying missing data, inconsistencies, and form type classification.",
                complexity=TaskComplexity.MODERATE,
                tools=[],  # No browser tools needed for data validation
                allow_delegation=True,
            ),
            "placement_analyst": AgentProfile(
                name="Placement Analyst",
                role="Spatial Layout Specialist",
                goal="Analyze form location data, existing panel layout, and determine optimal x,y coordinates for item placement",
                backstory="Geospatial analyst with expertise in panel layout optimization. Specializes in interpreting location descriptions, analyzing spatial relationships, and finding optimal placement positions.",
                complexity=TaskComplexity.COMPLEX,
                tools=[
                    "browser_extract",  # To get existing layout data
                    "browser_screenshot",  # To analyze visual layout
                ],
                allow_delegation=True,
            ),
            "layout_navigator": AgentProfile(
                name="Layout Navigator",
                role="Browser Navigation Coordinator",
                goal="Navigate to panel layout page, switch to correct tab (Panels/Patches/Destructs), and verify page readiness",
                backstory="Expert browser automation specialist focused on reliable navigation and UI state management. Ensures the correct page and tab are active before item creation.",
                complexity=TaskComplexity.MODERATE,
                tools=[
                    "browser_navigate",
                    "browser_interact",  # For tab switching
                    "browser_screenshot",  # To verify page state
                ],
                allow_delegation=True,
            ),
            "item_creator": AgentProfile(
                name="Item Creator",
                role="Form Automation Specialist",
                goal="Fill form modals with extracted data, submit item creation, and handle field mapping for panels, patches, and destructive tests",
                backstory="Automation engineer specializing in form filling and UI interaction. Expert at mapping form data to UI fields and handling different form types.",
                complexity=TaskComplexity.COMPLEX,
                tools=[
                    "browser_interact",  # For clicking buttons and filling forms
                    "browser_extract",  # To verify form state
                    "browser_screenshot",  # To capture form state
                ],
                allow_delegation=True,
            ),
            "validation_agent": AgentProfile(
                name="Validation Agent",
                role="Quality Assurance Validator",
                goal="Extract created item data, verify placement coordinates, check for conflicts (duplicate IDs, overlapping items), and validate item was created correctly",
                backstory="Quality assurance specialist focused on validation and error detection. Ensures all created items meet quality standards and don't conflict with existing items.",
                complexity=TaskComplexity.MODERATE,
                tools=[
                    "browser_extract",  # To extract created item data
                    "browser_screenshot",  # To verify visual placement
                ],
                allow_delegation=True,
            ),
        },
        tasks=[
            WorkflowTaskTemplate(
                id="review-form-data",
                description="Review the uploaded form data. Validate that all required fields are present, check data quality, identify the form type (panel_placement, repairs, destructive, etc.), and assess if the form is ready for automation.",
                agent="form_reviewer",
                expected_output="Form validation report with completeness status, identified form type, missing fields (if any), and readiness assessment",
                context_keys=["form_record", "payload"],
            ),
                WorkflowTaskTemplate(
                    id="analyze-placement",
                    description="Analyze the form data to determine optimal placement coordinates. Extract location hints from form fields (locationDescription, locationNote, typeDetailLocation, panelNumbers). Consider cardinal directions (North/South/East/West) mentioned in location descriptions. Query existing layout to find gaps or optimal positions. Use AI to interpret location descriptions with cardinal direction context and suggest x,y coordinates with confidence score.",
                    agent="placement_analyst",
                    expected_output="Placement analysis report with recommended x,y coordinates, confidence score, placement strategy used, and reasoning",
                    context_keys=["form_record", "project_id", "existing_layout", "cardinal_direction"],
                ),
            WorkflowTaskTemplate(
                id="navigate-to-layout",
                description="Navigate to the panel layout page for the project. Switch to the appropriate tab based on item type (Panels tab for panels, Patches tab for patches, Destructive Tests tab for destructive tests). Verify the page loaded correctly and the correct tab is active.",
                agent="layout_navigator",
                expected_output="Navigation confirmation with page URL, active tab name, and page readiness status",
                context_keys=["project_id", "item_type", "panel_layout_url"],
            ),
            WorkflowTaskTemplate(
                id="create-item",
                description="Click the 'Add' button to open the creation modal. Fill all form fields with data from the form record, including coordinates from placement analysis. Handle different field types (text, number, date, select, textarea). Submit the form and wait for confirmation.",
                agent="item_creator",
                expected_output="Item creation report with success status, filled fields, and any errors encountered",
                context_keys=["form_record", "placement_coordinates", "item_type"],
            ),
            WorkflowTaskTemplate(
                id="validate-creation",
                description="Extract the newly created item data from the page. Verify the item was created with correct coordinates, check for duplicate IDs or overlapping items, and validate all fields match the form data. Generate a validation report.",
                agent="validation_agent",
                expected_output="Validation report with item ID, verified coordinates, conflict check results, and overall validation status",
                context_keys=["form_record", "item_type", "expected_coordinates"],
            ),
        ],
        allow_real_time_collaboration=True,
    )

