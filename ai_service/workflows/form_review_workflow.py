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
    
    This workflow uses 6 specialized agents:
    1. Form Reviewer - Validates form data quality and completeness
    2. Placement Analyst - Determines optimal placement using form data and layout analysis
    3. Layout Navigator - Handles browser navigation and tab switching
    4. Item Creator - Executes browser automation to create items
    5. Validation Agent - Verifies created items and checks for conflicts
    6. Correction Agent - Reviews reflection results and autonomously corrects UI issues
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
                goal="Fill form modals with extracted data, submit item creation, and handle field mapping for panels, patches, and destructive tests. Use canvas coordinate clicking for precise placement when coordinates are available.",
                backstory="Automation engineer specializing in form filling and UI interaction. Expert at mapping form data to UI fields, handling different form types, and using canvas coordinate clicking for accurate item placement.",
                complexity=TaskComplexity.COMPLEX,
                tools=[
                    "browser_interact",  # For clicking buttons, filling forms, and canvas coordinate clicking
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
            "correction_agent": AgentProfile(
                name="Autonomous Correction Agent",
                role="Quality Correction Specialist",
                goal="Review reflection results from all workflow agents, identify issues requiring UI corrections, navigate to affected UI elements, and autonomously make corrections to fix placement errors, data inconsistencies, or validation failures",
                backstory="""Senior quality control engineer with expertise in autonomous error correction. 
                Specializes in reviewing agent outputs, identifying discrepancies between intended and actual results, 
                and autonomously navigating UI to make precise corrections. Expert at:
                - Analyzing reflection reports from multiple agents
                - Identifying root causes of placement errors
                - Navigating complex UI hierarchies
                - Making precise corrections without disrupting existing work
                - Validating corrections before completing tasks""",
                complexity=TaskComplexity.COMPLEX,
                tools=[
                    "browser_navigate",      # Navigate to UI elements
                    "browser_interact",      # Click, edit, move items
                    "browser_extract",       # Read current state
                    "browser_screenshot",    # Visual verification
                    "browser_vision_analyze" # Analyze visual placement
                ],
                allow_delegation=True,
            ),
        },
        tasks=[
            WorkflowTaskTemplate(
                id="review-form-data",
                description="Review the uploaded form data. Validate that all required fields are present, check data quality, identify the form type (panel_placement, repairs, destructive, etc.), and assess if the form is ready for automation. CRITICAL: For repair forms (repairs domain) and destructive test forms (destructive domain), verify that ALL structured location fields are present: placementType (single_panel or seam), locationDistance (numeric, feet), locationDirection (north/south/east/west), and panelNumbers (comma-separated panel identifiers). If any of these fields are missing, mark the form as NOT ready for automation and provide a clear error message listing the missing fields.",
                agent="form_reviewer",
                expected_output="Form validation report with completeness status, identified form type, missing fields (if any), readiness assessment, and validation of structured location fields for patch-creating forms",
                context_keys=["form_record", "payload"],
            ),
                WorkflowTaskTemplate(
                    id="analyze-placement",
                    description="Analyze the form data to determine optimal placement coordinates. PRIORITY: Use structured location fields if available (placementType, locationDistance, locationDirection, panelNumbers) to calculate precise x,y coordinates. For structured data: extract placementType ('single_panel' or 'seam'), locationDistance (feet), locationDirection ('north', 'south', 'east', 'west'), and panelNumbers. Calculate coordinates by finding referenced panel(s) in layout, then applying distance offset in the specified direction. For seam placement, place between two panels. For single panel, place relative to panel center/edge. If structured fields unavailable, fall back to extracting location hints from text fields (locationDescription, locationNote, typeDetailLocation). Consider cardinal directions (North/South/East/West) and project cardinal_direction setting. Query existing layout to find gaps or optimal positions. Return x,y coordinates with confidence score (structured data = high confidence 0.9, text parsing = lower confidence 0.6-0.8).",
                    agent="placement_analyst",
                    expected_output="Placement analysis report with recommended x,y coordinates, confidence score, placement strategy used (structured_location_calculation or ai_interpretation), reasoning, and structured_fields_used metadata if applicable",
                    context_keys=["form_record", "project_id", "existing_layout", "cardinal_direction", "structured_location"],
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
                description="Click the 'Add' button to open the creation modal. Fill all form fields with data from the form record, including coordinates from placement analysis. VALIDATION: Before creating patches, verify that structured location data is present (placementType, locationDistance, locationDirection, panelNumbers). If missing, do not create the patch and return an error. OPTION 1 (Preferred): Use click_canvas_coordinates action to click at the calculated x,y coordinates on the canvas, then fill the modal that appears. OPTION 2: Fill form fields including x and y coordinate inputs directly. Map structured location fields: placementType, locationDistance, locationDirection to form fields if supported. Map calculated x,y coordinates to coordinate inputs. Map locationDescription to description/notes field. Handle different field types (text, number, date, select, textarea). For patches: include repairId, vboxPassFail. For destructive tests: include sampleId, passFail. Submit the form and wait for confirmation.",
                agent="item_creator",
                expected_output="Item creation report with success status, filled fields, coordinates used, placement method (canvas_click or form_input), validation status of structured location data, and any errors encountered",
                context_keys=["form_record", "placement_coordinates", "item_type", "structured_location"],
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


def get_async_reflection_tasks() -> Dict[str, WorkflowTaskTemplate]:
    """
    Define async reflection tasks that run in parallel with main workflow.
    These tasks review agent outputs and identify issues for potential correction.
    """
    return {
        "async-reflect-form-review": WorkflowTaskTemplate(
            id="async-reflect-form-review",
            description="""Review the form validation results from the Form Reviewer agent. 
            Analyze the validation report for:
            1. Any inconsistencies or edge cases that might have been missed
            2. Confidence level of the validation (high >= 0.9, medium 0.7-0.9, low < 0.7)
            3. Potential issues that could cause problems in later steps
            4. Recommendations for refinement if confidence is low
            
            This reflection runs asynchronously and does not block the workflow.
            Focus on identifying issues that would require UI corrections if the workflow proceeds.""",
            agent="form_reviewer",
            expected_output="Reflection report with confidence score (0-1), identified issues, refinement recommendations, and flag indicating if UI correction may be needed",
            context_keys=["review-form-data"],
        ),
        "async-reflect-placement": WorkflowTaskTemplate(
            id="async-reflect-placement",
            description="""Review the placement analysis results from the Placement Analyst agent.
            Analyze the placement report for:
            1. Confidence score - is it high enough to proceed? (threshold: 0.8)
            2. Coordinate accuracy - do the calculated coordinates make sense?
            3. Potential conflicts - will this placement overlap with existing items?
            4. Edge cases - are there any unusual scenarios that weren't handled?
            5. Structured vs parsed data - was structured data used (higher confidence) or text parsing (lower confidence)?
            
            This reflection runs asynchronously and does not block the workflow.
            Flag any issues that would require moving or recreating the item.""",
            agent="placement_analyst",
            expected_output="Reflection report with confidence assessment, coordinate validation, conflict warnings, and flag indicating if placement correction may be needed",
            context_keys=["analyze-placement"],
        ),
    }


def get_correction_task() -> WorkflowTaskTemplate:
    """
    Define the autonomous correction task that runs after workflow completes.
    This agent reviews all reflection results and makes UI corrections as needed.
    """
    return WorkflowTaskTemplate(
        id="autonomous-correction",
        description="""Review all reflection results from previous agents and the final validation results. 
        
        CRITICAL TASKS:
        1. Analyze reflection reports from Form Reviewer and Placement Analyst
        2. Compare intended results (from form data) vs actual results (from validation)
        3. Identify any discrepancies requiring UI corrections:
           - Placement coordinates incorrect (item created at wrong location)
           - Item created in wrong location (should be moved)
           - Missing or incorrect form fields (field values don't match form data)
           - Validation failures (item created but doesn't meet requirements)
           - Wrong item type (patch created instead of destructive test, etc.)
        
        4. For each identified issue:
           a. Navigate to the affected UI element (panel layout page, correct tab)
           b. Extract current state (screenshot + data extraction)
           c. Determine correction needed (move, edit, delete and recreate)
           d. Execute correction autonomously:
              - If placement wrong: Use browser_interact to move item to correct coordinates
              - If field missing/incorrect: Click edit button, fill correct field, submit
              - If wrong item type: Delete incorrect item, switch to correct tab, recreate
              - If validation failed: Fix the issue (move, edit, or recreate as needed)
           e. Verify correction was successful (extract and validate)
        
        5. If corrections were made, re-validate the corrected item
        
        AUTONOMOUS OPERATION:
        - You have full authority to make corrections
        - Navigate anywhere in the panel layout UI
        - Edit, move, or delete items as needed
        - Only correct issues identified in reflections - don't make unnecessary changes
        - Be precise and careful - verify each correction before moving to the next
        
        PRIORITY ORDER:
        1. Critical issues (wrong location, wrong item type) - fix immediately
        2. Data inconsistencies (missing fields) - fix if validation flagged them
        3. Low confidence placements - only fix if reflection indicates high risk of error""",
        agent="correction_agent",
        expected_output="Correction report with list of issues found, corrections made (with before/after states), final validation status, and confirmation that all identified issues were addressed",
        context_keys=[
            "review-form-data",           # Original form review
            "async-reflect-form-review",   # Reflection results
            "analyze-placement",           # Placement analysis
            "async-reflect-placement",     # Placement reflection
            "validate-creation",           # Final validation
            "form_record",                 # Original form data for comparison
            "project_id",                 # For navigation
            "panel_layout_url"            # For navigation
        ],
    )

