-- Migration: Create As-built Records Table
-- Option A: Single table with domain enum for all six domains

-- Create enum for the six domains
CREATE TYPE asbuilt_domain AS ENUM (
  'panel_placement',
  'panel_seaming', 
  'non_destructive',
  'trial_weld',
  'repairs',
  'destructive'
);

-- Create the main asbuilt records table
CREATE TABLE asbuilt_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  panel_id UUID NOT NULL,
  domain asbuilt_domain NOT NULL,
  source_doc_id UUID,
  raw_data JSONB NOT NULL, -- Original Excel data
  mapped_data JSONB NOT NULL, -- Canonical field mapping
  ai_confidence DECIMAL(3,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  requires_review BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  
  -- Ensure unique combinations
  UNIQUE(project_id, panel_id, domain, source_doc_id, created_at)
);

-- Create indexes for performance
CREATE INDEX idx_asbuilt_project_panel ON asbuilt_records(project_id, panel_id);
CREATE INDEX idx_asbuilt_domain ON asbuilt_records(domain);
CREATE INDEX idx_asbuilt_confidence ON asbuilt_records(ai_confidence);
CREATE INDEX idx_asbuilt_requires_review ON asbuilt_records(requires_review);
CREATE INDEX idx_asbuilt_created_at ON asbuilt_records(created_at);

-- Add comments for documentation
COMMENT ON TABLE asbuilt_records IS 'Stores all as-built information across six domains for panels';
COMMENT ON COLUMN asbuilt_records.domain IS 'The domain category for this record (panel_placement, seaming, etc.)';
COMMENT ON COLUMN asbuilt_records.raw_data IS 'Original data as imported from Excel/other sources';
COMMENT ON COLUMN asbuilt_records.mapped_data IS 'Data normalized to canonical field names';
COMMENT ON COLUMN asbuilt_records.ai_confidence IS 'AI confidence score for field mapping (0.0-1.0)';
COMMENT ON COLUMN asbuilt_records.requires_review IS 'Flag for records requiring human review';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_asbuilt_records_updated_at 
    BEFORE UPDATE ON asbuilt_records 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
