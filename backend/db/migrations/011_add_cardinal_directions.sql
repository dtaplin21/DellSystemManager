-- Migration: Add Cardinal Directions and Location Description
-- Adds cardinal direction support to projects and panel layouts, and location description to asbuilt_records

-- Create enum for cardinal directions (if it doesn't exist)
DO $$ BEGIN
  CREATE TYPE cardinal_direction AS ENUM (
    'north',
    'south',
    'east',
    'west'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add cardinal_direction column to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS cardinal_direction cardinal_direction DEFAULT 'north';

-- Add cardinal_direction column to panel_layouts table
ALTER TABLE panel_layouts
  ADD COLUMN IF NOT EXISTS cardinal_direction cardinal_direction;

-- Add location_description column to asbuilt_records table
ALTER TABLE asbuilt_records
  ADD COLUMN IF NOT EXISTS location_description TEXT;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_projects_cardinal_direction ON projects(cardinal_direction);
CREATE INDEX IF NOT EXISTS idx_panel_layouts_cardinal_direction ON panel_layouts(cardinal_direction);
CREATE INDEX IF NOT EXISTS idx_asbuilt_location_description ON asbuilt_records USING gin(to_tsvector('english', location_description));

-- Add comments for documentation
COMMENT ON COLUMN projects.cardinal_direction IS 'Cardinal direction orientation for the project (north, south, east, west). Defaults to north.';
COMMENT ON COLUMN panel_layouts.cardinal_direction IS 'Cardinal direction orientation for the panel layout. Inherits from project if not set.';
COMMENT ON COLUMN asbuilt_records.location_description IS 'Location description text from forms, may include cardinal direction references (e.g., "North of Panel P-5, between P-5 and P-6")';

-- Update panel_layouts to inherit cardinal_direction from projects if not set
UPDATE panel_layouts pl
SET cardinal_direction = p.cardinal_direction
FROM projects p
WHERE pl.project_id = p.id
  AND pl.cardinal_direction IS NULL
  AND p.cardinal_direction IS NOT NULL;

