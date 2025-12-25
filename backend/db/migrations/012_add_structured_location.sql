-- Migration: Add Structured Location Fields
-- Adds structured location fields (placement_type, location_distance, location_direction) to asbuilt_records
-- for better AI placement accuracy and data consistency

-- Add placement_type column to asbuilt_records table
ALTER TABLE asbuilt_records
  ADD COLUMN IF NOT EXISTS placement_type VARCHAR(20);

-- Add location_distance column to asbuilt_records table
ALTER TABLE asbuilt_records
  ADD COLUMN IF NOT EXISTS location_distance DECIMAL;

-- Add location_direction column to asbuilt_records table
ALTER TABLE asbuilt_records
  ADD COLUMN IF NOT EXISTS location_direction VARCHAR(10);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_asbuilt_placement_type ON asbuilt_records(placement_type);
CREATE INDEX IF NOT EXISTS idx_asbuilt_location_direction ON asbuilt_records(location_direction);
CREATE INDEX IF NOT EXISTS idx_asbuilt_location_distance ON asbuilt_records(location_distance);

-- Add comments for documentation
COMMENT ON COLUMN asbuilt_records.placement_type IS 'Type of patch placement: single_panel or seam';
COMMENT ON COLUMN asbuilt_records.location_distance IS 'Distance in feet from reference point (North)';
COMMENT ON COLUMN asbuilt_records.location_direction IS 'Cardinal direction: north, south, east, or west';

