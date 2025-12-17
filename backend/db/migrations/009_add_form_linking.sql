-- Migration: Add Form Linking to Panels, Patches, and Destructive Tests
-- Adds asbuilt_record_id and panel_id fields to link items to forms
-- Note: Forms already link to panels via panel_id in asbuilt_records table

-- The asbuilt_record_id and panel_id fields are stored within the JSONB structure
-- of panels, patches, and destructive_tests arrays in panel_layouts table.
-- This migration adds comments and ensures indexes exist for efficient queries.

-- Create indexes for efficient form lookups (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_asbuilt_project_panel ON asbuilt_records(project_id, panel_id);
CREATE INDEX IF NOT EXISTS idx_asbuilt_project_domain ON asbuilt_records(project_id, domain);
CREATE INDEX IF NOT EXISTS idx_asbuilt_panel_id ON asbuilt_records(panel_id);

-- Add comments for documentation
COMMENT ON INDEX idx_asbuilt_project_panel IS 'Index for sidebar queries: fetch all forms for a panel';
COMMENT ON INDEX idx_asbuilt_project_domain IS 'Index for domain filtering: fetch forms by domain type';
COMMENT ON INDEX idx_asbuilt_panel_id IS 'Index for panel-based form lookups';

-- Note: The actual asbuilt_record_id and panel_id fields are stored within
-- the JSONB objects in panels[], patches[], and destructive_tests[] arrays.
-- No schema changes needed - these are application-level fields in the JSONB structure.

