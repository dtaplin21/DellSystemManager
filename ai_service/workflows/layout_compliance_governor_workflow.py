"""
Layout Compliance Governor Workflow

Broad AI agent workflow for ensuring Water Board-grade compliance with construction plans,
specifications, and field forms. Monitors, governs, and maintains layout integrity.
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


def get_layout_compliance_governor_workflow() -> WorkflowBlueprint:
    """
    Define the Broad Layout Compliance Governor workflow.
    
    This workflow uses a single comprehensive agent with full system access:
    - Plan↔Layout Scale & Shape Compliance
    - Layout Integrity & Data Quality
    - Cross-Referencing Files + As-Built Reality
    - Continuous Monitoring
    - Autonomous Corrections (with approval gates)
    """
    
    return WorkflowBlueprint(
        id="layout_compliance_governor",
        name="Broad Layout Compliance Governor",
        description="Autonomous project layout manager ensuring Water Board-grade compliance with plans, specifications, and field forms",
        process=Process.sequential,
        agents={
            "compliance_governor": AgentProfile(
                name="Broad Layout Compliance Governor",
                role="Autonomous Project Layout Manager & Compliance Governor",
                goal="Ensure panel layout is accurate, fit-to-scale, and compliant with project plans/specifications and field forms. Continuously detect issues, propose or apply safe corrections, and maintain complete audit trail suitable for regulatory submission.",
                backstory="""Senior construction project manager with decades of experience managing large-scale geosynthetic projects for Water Board compliance.
                Expert in:
                - Reading and interpreting construction plans and specifications
                - Ensuring strict compliance with project requirements (Water Board-grade)
                - Plan↔Layout scale and shape compliance
                - Detecting and correcting deviations
                - Maintaining data integrity across all systems
                - Coordinating between documents, forms, and actual work
                - Autonomous decision-making within project constraints
                - Creating regulatory-ready audit trails
                
                Has full system access to:
                - All database tables (projects, panel_layouts, documents, asbuilt_records, qc_data, etc.)
                - All browser automation tools (navigate, interact, extract, screenshot, vision analysis)
                - All API endpoints (compliance operations, panel operations, form operations)
                - Document analysis capabilities
                - Form pattern analysis
                
                Authority & Boundaries:
                - Read access to all project data
                - Write capabilities only through Operations API (controlled actions)
                - Must produce Change Plans before editing
                - Must classify risk (LOW/MEDIUM/HIGH/CRITICAL)
                - Must require approval for HIGH/CRITICAL changes
                - Must log every action with before/after snapshots and evidence references""",
                complexity=TaskComplexity.COMPLEX,
                tools=[
                    # Browser Tools - Full Access
                    "browser_navigate",
                    "browser_interact",
                    "browser_extract",
                    "browser_screenshot",
                    "browser_vision_analyze",
                    "browser_realtime",
                    "browser_performance",
                    
                    # Operations API Tools (custom - will be implemented as API calls)
                    # These will be called via HTTP requests to /api/compliance/*
                    # "op_extract_plan_geometry",
                    # "op_register_layout_to_plan",
                    # "op_validate_layout_scale",
                    # "op_apply_layout_transform",
                    # "op_validate_boundary_compliance",
                    # "op_clamp_to_boundary",
                    # "op_validate_panel_shapes",
                    # "op_propose_shape_correction",
                    
                    # Database Access Tools (custom - via API or direct DB access)
                    # "db_query",
                    # "db_update",
                    
                    # Document Analysis Tools (custom)
                    # "document_analyze",
                    # "document_extract",
                ],
                allow_delegation=True,
                max_iterations=50,
                memory=True,
            ),
        },
        tasks=[
            WorkflowTaskTemplate(
                id="initialize-requirements",
                description="""Extract PlanGeometryModel and structured requirements from project documents.
                
                Use OP_EXTRACT_PLAN_GEOMETRY (via API call to /api/compliance/extract-plan-geometry) to produce PlanGeometryModel:
                - site boundary polygon
                - reference points/anchors
                - dimensions and scale
                - constraints/no-go zones
                - panel rules and tolerances
                
                Analyze all project documents (plans, specifications, drawings) to extract:
                - Panel specifications (dimensions, materials, roll numbers)
                - Material requirements
                - Roll inventory
                - Installation notes
                - Site dimensions
                
                Store extracted data in panel_layout_requirements and plan_geometry_models tables.
                Build comprehensive project knowledge base from documents and mobile forms.""",
                agent="compliance_governor",
                expected_output="PlanGeometryModel ID, extracted requirements, confidence score, project knowledge base summary",
                context_keys=["project_id", "document_ids"],
            ),
            WorkflowTaskTemplate(
                id="register-layout-to-plan",
                description="""Compute reliable transform between plan coordinates and layout coordinates.
                
                Use OP_REGISTER_LAYOUT_TO_PLAN (via API call to /api/compliance/register-layout) with preferred ANCHOR_POINTS method (2-3 known reference points).
                If anchors unavailable, fallback to BOUNDARY_FIT method (lower confidence, approval required).
                
                Validate transform quality:
                - confidence_score (>= 0.8 for anchor_points, >= 0.6 for boundary_fit)
                - residual_error (RMS error in world units)
                - max_error (maximum error at any point)
                
                Store transform in layout_transforms table with is_active=true.
                Deactivate any existing active transforms for this project.""",
                agent="compliance_governor",
                expected_output="Transform ID, confidence score, residual error, registration method used, quality assessment",
                context_keys=["project_id", "plan_geometry_model_id", "anchor_points"],
            ),
            WorkflowTaskTemplate(
                id="validate-scale-compliance",
                description="""Validate layout scale matches plan scale.
                
                Use OP_VALIDATE_LAYOUT_SCALE (via API call to /api/compliance/validate-scale) to:
                - Detect unit mismatches (feet vs meters vs pixels mistaken as feet)
                - Detect non-uniform scaling (X-scale != Y-scale)
                - Detect distortion
                - Calculate scale delta percentage
                - Determine tolerance pass/fail (within 5% is acceptable)
                
                Generate recommended correction plan if needed:
                - If scale mismatch > 5%: recommend OP_APPLY_LAYOUT_TRANSFORM (HIGH RISK - requires approval)
                - If non-uniform scaling detected: flag as CRITICAL issue
                - If unit mismatch: flag as CRITICAL issue requiring manual intervention
                
                Store validation result in compliance_validations table.""",
                agent="compliance_governor",
                expected_output="Scale validation report: scale_delta_percent, is_uniform_scale, tolerance_pass, recommended_correction (if needed), validation_id",
                context_keys=["project_id", "plan_geometry_model_id", "transform_id"],
            ),
            WorkflowTaskTemplate(
                id="validate-boundary-compliance",
                description="""Ensure all panels and spatial items fit within plan boundaries.
                
                Use OP_VALIDATE_BOUNDARY_COMPLIANCE (via API call to /api/compliance/validate-boundary) to:
                - Check items outside boundary
                - Check boundary crossings
                - Check no-go zone intersections
                - Check edge alignment
                
                Generate violation report with:
                - Item IDs and types (panels, patches, destructive tests)
                - Violation locations
                - Violation types (outside boundary, intersects no-go zone, etc.)
                - Compliance score (0-1)
                
                For each violation, determine correction strategy:
                - Small displacement (< 1-2 ft): OP_CLAMP_TO_BOUNDARY with NEAREST_POINT (MEDIUM risk)
                - Large displacement (> 1-2 ft): OP_CLAMP_TO_BOUNDARY with REJECT_AND_FLAG (HIGH risk - approval required)
                - No-go zone intersection: Flag for manual review (CRITICAL)
                
                Store validation result in compliance_validations table.""",
                agent="compliance_governor",
                expected_output="Boundary compliance report: violations array, compliance score, affected items count, correction recommendations, validation_id",
                context_keys=["project_id", "plan_geometry_model_id", "transform_id"],
            ),
            WorkflowTaskTemplate(
                id="validate-shape-compliance",
                description="""Validate panel shapes match plan rules.
                
                Use OP_VALIDATE_PANEL_SHAPES (via API call to /api/compliance/validate-shapes) to:
                - Check rectangle vs triangle rules from plan
                - Check edge orientation rules
                - Check rotation allowed values (typically 0, 90, 180, 270)
                - Check dimension constraints from plans
                
                Generate shape mismatch report with:
                - Panel IDs with mismatches
                - Mismatch types (invalid shape, invalid rotation, dimension violation)
                - Actual vs expected values
                - Compliance score (0-1)
                
                For each mismatch, create correction proposal:
                - Use OP_PROPOSE_SHAPE_CORRECTION (CRITICAL risk - manual approval required)
                - Include plan rule reference
                - Suggest corrected dimensions/rotation
                
                Store validation result in compliance_validations table.""",
                agent="compliance_governor",
                expected_output="Shape compliance report: mismatches array, compliance score, affected panels count, correction proposals, validation_id",
                context_keys=["project_id", "plan_geometry_model_id"],
            ),
            WorkflowTaskTemplate(
                id="cross-reference-forms",
                description="""Cross-check plan requirements vs as-built reality from mobile forms.
                
                Analyze all asbuilt_records for the project to:
                - Compare plan panel schedules vs layout panel list
                - Compare roll inventory in docs vs roll usage in forms/layout
                - Compare required tests from specs vs actual recorded tests
                - Compare repair/patch records vs layout placements
                
                Identify discrepancies:
                - Panels in layout not in plans
                - Panels in plans not in layout
                - Roll number mismatches
                - Missing required tests
                - Patches not matching repair records
                
                Build evidence references linking:
                - Plan documents to layout items
                - Form submissions to layout items
                - QC records to layout items
                
                Generate cross-reference report with compliance assessment.""",
                agent="compliance_governor",
                expected_output="Cross-reference report: discrepancies array, compliance assessment, evidence links, recommendations",
                context_keys=["project_id", "plan_geometry_model_id", "asbuilt_records"],
            ),
            WorkflowTaskTemplate(
                id="generate-change-plan",
                description="""Create proposed operations for corrections.
                
                Based on validation results, generate change plan with:
                - Operations array, each with:
                  - operation_type (APPLY_LAYOUT_TRANSFORM, CLAMP_TO_BOUNDARY, PROPOSE_SHAPE_CORRECTION, etc.)
                  - operation_data (specific parameters)
                  - risk_level (LOW/MEDIUM/HIGH/CRITICAL)
                  - affected_items (list of item IDs)
                  - before_state (snapshot of current state)
                  - after_state (predicted state after operation)
                  - evidence_references (links to documents, forms, validations)
                
                Risk classification:
                - LOW: Data fixes, minor adjustments (< 1ft), missing field additions
                - MEDIUM: Boundary clamps within tolerance (1-2ft), coordinate normalization
                - HIGH: Global transforms (scale/rotation), significant movement (> 2ft), boundary clamps with large displacement
                - CRITICAL: Shape edits, material/roll changes, conflicting plan vs field evidence
                
                Create before_snapshot of current layout state.
                Estimate after_snapshot for each operation.
                
                Store change plan in compliance_operations table with status='pending'.""",
                agent="compliance_governor",
                expected_output="Change plan: operations array with risk levels, before/after states, evidence references, plan_id",
                context_keys=["validation_results", "compliance_issues", "cross_reference_results"],
            ),
            WorkflowTaskTemplate(
                id="apply-safe-corrections",
                description="""Apply LOW/MEDIUM risk operations automatically.
                
                For HIGH/CRITICAL operations, create pending operations requiring approval.
                
                Execute LOW risk operations immediately:
                - Missing field additions
                - Data type corrections
                - Minor coordinate adjustments
                
                Execute MEDIUM risk operations with validation:
                - Boundary clamps within tolerance
                - Coordinate normalization
                - Grid alignment fixes
                
                For HIGH/CRITICAL operations, use appropriate OP_* functions:
                - OP_APPLY_LAYOUT_TRANSFORM (HIGH/CRITICAL - approval required)
                - OP_CLAMP_TO_BOUNDARY with large displacement (HIGH - approval required)
                - OP_PROPOSE_SHAPE_CORRECTION (CRITICAL - manual required)
                
                Log all operations with:
                - Operation ID
                - Before snapshot
                - After snapshot (after execution)
                - Execution result (success, errors, warnings, affected_count)
                - Evidence references
                - Agent run ID
                
                Update compliance_operations table with execution results.""",
                agent="compliance_governor",
                expected_output="Applied operations report: auto-applied ops (with execution results), pending ops (requiring approval), operation_ids",
                context_keys=["change_plan"],
            ),
            WorkflowTaskTemplate(
                id="verify-compliance",
                description="""Re-run validations after corrections.
                
                Execute all validation operations again:
                - OP_VALIDATE_LAYOUT_SCALE
                - OP_VALIDATE_BOUNDARY_COMPLIANCE
                - OP_VALIDATE_PANEL_SHAPES
                
                Create after_snapshot of final layout state.
                
                Generate Water Board-ready compliance report:
                - Compliance score per rule (scale, boundary, shape, cross-reference)
                - Overall compliance score (weighted average)
                - Pass/fail status per rule
                - Detected issues (with severity)
                - Evidence sources (document references, form references, validation IDs)
                - Change plans and applied operations (with operation IDs)
                - Timestamps and agent run ID
                - Rollback links (if operations were applied)
                
                Report structure:
                {
                  "compliance_scores": {
                    "scale": 0.95,
                    "boundary": 1.0,
                    "shape": 0.9,
                    "cross_reference": 0.85,
                    "overall": 0.925
                  },
                  "pass_fail": {
                    "scale": "pass",
                    "boundary": "pass",
                    "shape": "pass",
                    "cross_reference": "pass"
                  },
                  "detected_issues": [...],
                  "evidence_sources": [...],
                  "applied_operations": [...],
                  "pending_operations": [...],
                  "audit_trail": {
                    "agent_run_id": "...",
                    "started_at": "...",
                    "completed_at": "...",
                    "operations_count": 5,
                    "validations_count": 4
                  }
                }
                
                Store final compliance report in compliance_validations table.
                Create notifications for pending operations requiring approval.""",
                agent="compliance_governor",
                expected_output="Final compliance report: scores, pass/fail per rule, audit trail, Water Board-ready format",
                context_keys=["applied_operations", "validation_results", "change_plan"],
            ),
        ],
        allow_real_time_collaboration=True,
    )


def get_async_reflection_tasks() -> Dict[str, WorkflowTaskTemplate]:
    """
    Define async reflection tasks for compliance governor.
    These run in parallel with main workflow to identify potential issues.
    """
    return {
        "async-reflect-scale-validation": WorkflowTaskTemplate(
            id="async-reflect-scale-validation",
            description="""Review scale validation results.
            Analyze:
            1. Confidence level of scale validation (high >= 0.9, medium 0.7-0.9, low < 0.7)
            2. Scale delta magnitude - is correction necessary?
            3. Non-uniform scaling risk - will this cause distortion?
            4. Unit mismatch possibility - could this be a unit conversion error?
            
            Flag issues that would require UI corrections if scale is applied incorrectly.""",
            agent="compliance_governor",
            expected_output="Reflection report with confidence assessment, risk warnings, correction recommendations",
            context_keys=["validate-scale-compliance"],
        ),
        "async-reflect-boundary-validation": WorkflowTaskTemplate(
            id="async-reflect-boundary-validation",
            description="""Review boundary validation results.
            Analyze:
            1. Violation patterns - are violations clustered or random?
            2. Displacement magnitude - how far are items outside boundary?
            3. No-go zone intersections - are these intentional or errors?
            4. Edge alignment quality - are edge panels properly aligned?
            
            Flag issues that would require moving or recreating items.""",
            agent="compliance_governor",
            expected_output="Reflection report with violation analysis, displacement assessment, correction strategy recommendations",
            context_keys=["validate-boundary-compliance"],
        ),
    }


def get_correction_task() -> WorkflowTaskTemplate:
    """
    Define autonomous correction task for compliance governor.
    Reviews reflection results and makes corrections autonomously when safe.
    """
    return WorkflowTaskTemplate(
        id="autonomous-compliance-correction",
        description="""Review all reflection results and validation results.
        
        CRITICAL TASKS:
        1. Analyze reflection reports from scale and boundary validations
        2. Compare intended results (from plans) vs actual results (from layout)
        3. Identify discrepancies requiring corrections:
           - Scale mismatches requiring transform application
           - Boundary violations requiring item movement
           - Shape mismatches requiring corrections
           - Cross-reference discrepancies requiring data updates
        
        4. For each identified issue:
           a. Determine if correction can be auto-applied (LOW/MEDIUM risk)
           b. For HIGH/CRITICAL issues, create pending operations requiring approval
           c. Execute safe corrections autonomously:
              - Apply transforms if scale mismatch is within tolerance and confidence is high
              - Clamp items to boundary if displacement is small (< 1-2ft)
              - Create proposals for shape corrections (always requires approval)
           d. Verify correction was successful (re-run validation)
        
        5. Generate final compliance report with audit trail
        
        AUTONOMOUS OPERATION:
        - Has authority to apply LOW/MEDIUM risk corrections
        - Must create pending operations for HIGH/CRITICAL corrections
        - Must log all actions with before/after snapshots
        - Must maintain evidence references for audit trail
        
        PRIORITY ORDER:
        1. Critical issues (scale mismatch, unit errors) - create operations immediately
        2. High-risk issues (large boundary violations) - create operations, flag for approval
        3. Medium-risk issues (small boundary violations) - apply if within tolerance
        4. Low-risk issues (data fixes) - apply automatically""",
        agent="compliance_governor",
        expected_output="Correction report with applied corrections, pending operations, final compliance status, audit trail",
        context_keys=[
            "validate-scale-compliance",
            "async-reflect-scale-validation",
            "validate-boundary-compliance",
            "async-reflect-boundary-validation",
            "validate-shape-compliance",
            "cross-reference-forms",
            "generate-change-plan",
            "apply-safe-corrections",
            "verify-compliance"
        ],
    )

