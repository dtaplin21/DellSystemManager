-- Migration: Create file_metadata table for tracking imported files
-- This table tracks imported Excel files and their metadata

CREATE TABLE IF NOT EXISTS file_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- 'excel', 'pdf', 'image'
  file_size INTEGER NOT NULL,
  project_id UUID NOT NULL,
  uploaded_by UUID,
  domain VARCHAR(50),
  panel_id UUID, -- Can be null for project-wide files
  metadata JSONB, -- Additional metadata like import stats
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_metadata_project_id ON file_metadata(project_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_panel_id ON file_metadata(panel_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_domain ON file_metadata(domain);
CREATE INDEX IF NOT EXISTS idx_file_metadata_created_at ON file_metadata(created_at);

-- Add comments for documentation
COMMENT ON TABLE file_metadata IS 'Tracks metadata for imported files in as-built system';
COMMENT ON COLUMN file_metadata.file_name IS 'Original filename of the imported file';
COMMENT ON COLUMN file_metadata.file_type IS 'Type of file (excel, pdf, image)';
COMMENT ON COLUMN file_metadata.file_size IS 'Size of file in bytes';
COMMENT ON COLUMN file_metadata.project_id IS 'Project this file belongs to';
COMMENT ON COLUMN file_metadata.uploaded_by IS 'User who uploaded the file';
COMMENT ON COLUMN file_metadata.domain IS 'Domain category for the file content';
COMMENT ON COLUMN file_metadata.panel_id IS 'Specific panel ID (null for project-wide files)';
COMMENT ON COLUMN file_metadata.metadata IS 'Additional metadata like import statistics';
