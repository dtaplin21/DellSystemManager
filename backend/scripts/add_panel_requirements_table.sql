-- Create panel layout requirements table
CREATE TABLE IF NOT EXISTS panel_layout_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  panel_specifications JSONB,
  material_requirements JSONB,
  roll_inventory JSONB,
  installation_notes JSONB,
  site_dimensions JSONB,
  confidence_score DECIMAL(5,2),
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_panel_requirements_project_id ON panel_layout_requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_panel_requirements_confidence ON panel_layout_requirements(confidence_score);

-- Add comments for documentation
COMMENT ON TABLE panel_layout_requirements IS 'Dedicated storage for panel layout generation requirements, separate from general project data';
COMMENT ON COLUMN panel_layout_requirements.panel_specifications IS 'JSON object containing panel specifications (dimensions, materials, etc.)';
COMMENT ON COLUMN panel_layout_requirements.material_requirements IS 'JSON object containing material specifications and seam requirements';
COMMENT ON COLUMN panel_layout_requirements.roll_inventory IS 'JSON object containing roll inventory information';
COMMENT ON COLUMN panel_layout_requirements.installation_notes IS 'JSON object containing installation requirements and notes';
COMMENT ON COLUMN panel_layout_requirements.site_dimensions IS 'JSON object containing site dimensions and layout constraints';
COMMENT ON COLUMN panel_layout_requirements.confidence_score IS 'AI confidence score (0-100) for panel generation based on available data'; 