-- Create panel_layouts table if it doesn't exist
CREATE TABLE IF NOT EXISTS panel_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  panels TEXT NOT NULL DEFAULT '[]',
  width DECIMAL NOT NULL DEFAULT 4000,
  height DECIMAL NOT NULL DEFAULT 4000,
  scale DECIMAL NOT NULL DEFAULT 1.0,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_panel_layouts_project_id ON panel_layouts(project_id);
CREATE INDEX IF NOT EXISTS idx_panel_layouts_last_updated ON panel_layouts(last_updated);

-- Add comments for documentation
COMMENT ON TABLE panel_layouts IS 'Stores panel layout data for each project';
COMMENT ON COLUMN panel_layouts.panels IS 'JSON string containing array of panel objects';
COMMENT ON COLUMN panel_layouts.width IS 'Layout width in project units';
COMMENT ON COLUMN panel_layouts.height IS 'Layout height in project units';
COMMENT ON COLUMN panel_layouts.scale IS 'Layout scale factor';
COMMENT ON COLUMN panel_layouts.last_updated IS 'Timestamp of last panel update';

-- Verify table creation
SELECT 'panel_layouts table created successfully' as status;
