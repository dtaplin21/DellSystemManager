-- Migration: Create Plan Geometry Model and Compliance Operations Tables
-- Creates tables for Plan Geometry Model (PGM), layout registration transforms,
-- compliance operations with approval workflow, and compliance validation results

-- Create enum for transform methods
DO $$ BEGIN
  CREATE TYPE transform_method AS ENUM (
    'anchor_points',
    'boundary_fit',
    'manual'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for operation risk levels
DO $$ BEGIN
  CREATE TYPE operation_risk_level AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for operation status
DO $$ BEGIN
  CREATE TYPE operation_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'applied',
    'rolled_back'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Plan Geometry Model table
CREATE TABLE IF NOT EXISTS plan_geometry_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  
  -- Site boundary (polygon as JSONB array of points)
  site_boundary JSONB NOT NULL, -- [{x, y}, {x, y}, ...]
  
  -- Reference points/anchors
  reference_points JSONB DEFAULT '[]'::jsonb, -- [{id, x, y, label, type}, ...]
  
  -- Dimensions
  site_width DECIMAL NOT NULL,
  site_height DECIMAL NOT NULL,
  units VARCHAR(20) DEFAULT 'feet', -- feet, meters, etc.
  scale_factor DECIMAL, -- e.g., "1 inch = 50 feet" -> 50
  
  -- Constraints
  no_go_zones JSONB DEFAULT '[]'::jsonb, -- [{polygon, label, type}, ...]
  key_features JSONB DEFAULT '[]'::jsonb, -- [{type, location, description}, ...]
  
  -- Panel requirements
  panel_map_requirements JSONB DEFAULT '{}'::jsonb, -- {
    --   orientation_rules: {...},
    --   naming_conventions: {...},
    --   allowed_tolerances: {...},
    --   expected_panel_types: [...]
    -- }
  
  -- Metadata
  confidence_score DECIMAL(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  extraction_method VARCHAR(50), -- 'ai_vision', 'text_parsing', 'manual'
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(project_id, document_id)
);

-- Layout Registration Transforms table
CREATE TABLE IF NOT EXISTS layout_transforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  plan_geometry_model_id UUID NOT NULL REFERENCES plan_geometry_models(id) ON DELETE CASCADE,
  
  -- Transform parameters (affine transform: translation + rotation + scale)
  translation_x DECIMAL DEFAULT 0,
  translation_y DECIMAL DEFAULT 0,
  rotation_degrees DECIMAL DEFAULT 0,
  scale_x DECIMAL DEFAULT 1,
  scale_y DECIMAL DEFAULT 1,
  skew_x DECIMAL DEFAULT 0,
  skew_y DECIMAL DEFAULT 0,
  
  -- Registration method
  method transform_method NOT NULL,
  
  -- Anchors used (if anchor_points method)
  anchor_points JSONB DEFAULT '[]'::jsonb, -- [{plan_point: {x,y}, layout_point: {x,y}}, ...]
  
  -- Quality metrics
  confidence_score DECIMAL(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  residual_error DECIMAL, -- RMS error in world units
  max_error DECIMAL, -- Maximum error at any point
  
  -- Validation results
  scale_delta_percent DECIMAL, -- % difference from expected scale
  is_uniform_scale BOOLEAN DEFAULT true, -- scale_x == scale_y
  tolerance_pass BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  applied_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(project_id, plan_geometry_model_id, is_active) WHERE is_active = true
);

-- Compliance Operations table (tracks all operations with approval workflow)
CREATE TABLE IF NOT EXISTS compliance_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Operation details
  operation_type VARCHAR(50) NOT NULL, -- 'EXTRACT_PLAN_GEOMETRY', 'REGISTER_LAYOUT', 'APPLY_TRANSFORM', etc.
  operation_data JSONB NOT NULL, -- Operation-specific parameters
  
  -- Risk and approval
  risk_level operation_risk_level NOT NULL,
  status operation_status DEFAULT 'pending',
  requires_approval BOOLEAN DEFAULT true,
  
  -- Change plan (before applying)
  change_plan JSONB, -- {description, affected_items, before_state, after_state, evidence}
  
  -- Execution results
  execution_result JSONB, -- {success, errors, warnings, affected_count}
  before_snapshot JSONB, -- Full state before operation
  after_snapshot JSONB, -- Full state after operation
  
  -- Approval workflow
  proposed_by UUID REFERENCES users(id), -- NULL if agent-proposed
  proposed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Rollback
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  rolled_back_by UUID REFERENCES users(id),
  rollback_reason TEXT,
  
  -- Audit trail
  evidence_references JSONB DEFAULT '[]'::jsonb, -- [{type, id, description}, ...]
  agent_run_id UUID, -- Link to agent execution
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compliance Validation Results table (stores validation check results)
CREATE TABLE IF NOT EXISTS compliance_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  plan_geometry_model_id UUID REFERENCES plan_geometry_models(id) ON DELETE SET NULL,
  layout_transform_id UUID REFERENCES layout_transforms(id) ON DELETE SET NULL,
  
  -- Validation type
  validation_type VARCHAR(50) NOT NULL, -- 'scale', 'boundary', 'shape', 'registration'
  
  -- Results
  passed BOOLEAN NOT NULL,
  compliance_score DECIMAL(5,2) CHECK (compliance_score >= 0 AND compliance_score <= 1),
  
  -- Details
  issues JSONB DEFAULT '[]'::jsonb, -- [{type, severity, description, item_id, location}, ...]
  warnings JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  
  -- Metrics
  scale_delta_percent DECIMAL,
  boundary_violations_count INTEGER DEFAULT 0,
  shape_mismatches_count INTEGER DEFAULT 0,
  
  -- Timestamp
  validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  validated_by UUID REFERENCES users(id), -- NULL if agent-validated
  
  UNIQUE(project_id, validation_type, validated_at)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pgm_project ON plan_geometry_models(project_id);
CREATE INDEX IF NOT EXISTS idx_pgm_document ON plan_geometry_models(document_id);
CREATE INDEX IF NOT EXISTS idx_layout_transform_project ON layout_transforms(project_id);
CREATE INDEX IF NOT EXISTS idx_layout_transform_pgm ON layout_transforms(plan_geometry_model_id);
CREATE INDEX IF NOT EXISTS idx_layout_transform_active ON layout_transforms(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_compliance_ops_project ON compliance_operations(project_id);
CREATE INDEX IF NOT EXISTS idx_compliance_ops_status ON compliance_operations(status);
CREATE INDEX IF NOT EXISTS idx_compliance_ops_risk ON compliance_operations(risk_level);
CREATE INDEX IF NOT EXISTS idx_compliance_ops_type ON compliance_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_compliance_validations_project ON compliance_validations(project_id);
CREATE INDEX IF NOT EXISTS idx_compliance_validations_type ON compliance_validations(validation_type);
CREATE INDEX IF NOT EXISTS idx_compliance_validations_passed ON compliance_validations(passed);

-- Comments
COMMENT ON TABLE plan_geometry_models IS 'Stores extracted plan geometry models from construction documents';
COMMENT ON TABLE layout_transforms IS 'Stores coordinate system transforms between plan and layout';
COMMENT ON TABLE compliance_operations IS 'Tracks all compliance operations with approval workflow and audit trail';
COMMENT ON TABLE compliance_validations IS 'Stores results of compliance validation checks';

