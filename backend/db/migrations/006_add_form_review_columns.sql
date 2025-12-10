-- Migration: Add Form Review and Source Tracking Columns
-- Adds columns for form review workflow and tracking form source (mobile/web/import)

-- Create enum for form status (if it doesn't exist)
DO $$ BEGIN
  CREATE TYPE form_status AS ENUM (
    'pending',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for form source (if it doesn't exist)
DO $$ BEGIN
  CREATE TYPE form_source AS ENUM (
    'mobile',
    'web',
    'import'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to asbuilt_records table
ALTER TABLE asbuilt_records
  ADD COLUMN IF NOT EXISTS status form_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS source form_source DEFAULT 'import',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_asbuilt_status ON asbuilt_records(status);
CREATE INDEX IF NOT EXISTS idx_asbuilt_source ON asbuilt_records(source);
CREATE INDEX IF NOT EXISTS idx_asbuilt_project_status ON asbuilt_records(project_id, status);
CREATE INDEX IF NOT EXISTS idx_asbuilt_project_source ON asbuilt_records(project_id, source);
CREATE INDEX IF NOT EXISTS idx_asbuilt_project_source_status ON asbuilt_records(project_id, source, status);
CREATE INDEX IF NOT EXISTS idx_asbuilt_approved_by ON asbuilt_records(approved_by);

-- Add comments for documentation
COMMENT ON COLUMN asbuilt_records.status IS 'Form review status: pending, approved, or rejected';
COMMENT ON COLUMN asbuilt_records.source IS 'Source of form submission: mobile, web, or import';
COMMENT ON COLUMN asbuilt_records.approved_by IS 'User ID who approved the form';
COMMENT ON COLUMN asbuilt_records.approved_at IS 'Timestamp when form was approved';
COMMENT ON COLUMN asbuilt_records.rejection_reason IS 'Reason for rejection if form was rejected';
COMMENT ON COLUMN asbuilt_records.review_notes IS 'Review notes or comments added during review';

-- Update existing records to have default status
UPDATE asbuilt_records SET status = 'pending' WHERE status IS NULL;
UPDATE asbuilt_records SET source = 'import' WHERE source IS NULL;

