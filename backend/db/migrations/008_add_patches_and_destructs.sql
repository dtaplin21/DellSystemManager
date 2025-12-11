-- Migration: Add patches and destructive_tests columns to panel_layouts table
-- This separates patches and destructive tests from panels

-- Add patches column if it doesn't exist
ALTER TABLE panel_layouts 
ADD COLUMN IF NOT EXISTS patches JSONB DEFAULT '[]';

-- Add destructive_tests column if it doesn't exist
ALTER TABLE panel_layouts 
ADD COLUMN IF NOT EXISTS destructive_tests JSONB DEFAULT '[]';

-- Add comments for documentation
COMMENT ON COLUMN panel_layouts.patches IS 'Array of patch objects (circles) stored as JSONB';
COMMENT ON COLUMN panel_layouts.destructive_tests IS 'Array of destructive test objects (rectangles) stored as JSONB';

