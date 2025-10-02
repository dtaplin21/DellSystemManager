-- Migration: Create uploaded_files table for file tracking
-- This table tracks imported Excel files and links them to asbuilt_records

-- Create uploaded_files table to track imported documents
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  domain VARCHAR(50),
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploader_id UUID REFERENCES users(id),
  file_size INTEGER NOT NULL,
  panel_count INTEGER DEFAULT 0,
  record_count INTEGER DEFAULT 0,
  ai_confidence DECIMAL(3,2),
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_uploaded_files_project ON uploaded_files(project_id);
CREATE INDEX idx_uploaded_files_domain ON uploaded_files(domain);
CREATE INDEX idx_uploaded_files_upload_date ON uploaded_files(upload_date);
CREATE INDEX idx_uploaded_files_status ON uploaded_files(status);

-- Add foreign key constraint to asbuilt_records (source_doc_id already exists)
ALTER TABLE asbuilt_records 
ADD CONSTRAINT fk_asbuilt_source_file 
FOREIGN KEY (source_doc_id) REFERENCES uploaded_files(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON TABLE uploaded_files IS 'Tracks imported Excel files for as-built data';
COMMENT ON COLUMN uploaded_files.filename IS 'Generated filename with UUID';
COMMENT ON COLUMN uploaded_files.original_filename IS 'Original filename from user upload';
COMMENT ON COLUMN uploaded_files.file_path IS 'Path to stored file on disk';
COMMENT ON COLUMN uploaded_files.domain IS 'Auto-detected domain from file content';
COMMENT ON COLUMN uploaded_files.panel_count IS 'Number of panels detected in file';
COMMENT ON COLUMN uploaded_files.record_count IS 'Number of records created from file';
COMMENT ON COLUMN uploaded_files.ai_confidence IS 'Overall AI confidence for file processing';
