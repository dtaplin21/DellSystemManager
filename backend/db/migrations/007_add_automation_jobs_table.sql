-- Migration: Add Automation Jobs Table
-- Tracks browser automation jobs created from mobile app form uploads

-- Create automation_jobs table
CREATE TABLE IF NOT EXISTS automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id VARCHAR(255) UNIQUE NOT NULL,  -- Bull queue job ID
  asbuilt_record_id UUID REFERENCES asbuilt_records(id) ON DELETE SET NULL,
  project_id UUID NOT NULL,
  upload_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',  -- 'queued', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),   -- 0-100
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB  -- Store additional job metadata
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_jobs_record ON automation_jobs(asbuilt_record_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_status ON automation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_project ON automation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_job_id ON automation_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_created ON automation_jobs(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE automation_jobs IS 'Tracks browser automation jobs for panel layout updates from mobile app form submissions';
COMMENT ON COLUMN automation_jobs.job_id IS 'Unique job ID from Bull queue';
COMMENT ON COLUMN automation_jobs.asbuilt_record_id IS 'Reference to the asbuilt record that triggered this job';
COMMENT ON COLUMN automation_jobs.status IS 'Current job status: queued, processing, completed, or failed';
COMMENT ON COLUMN automation_jobs.progress IS 'Job progress percentage (0-100)';
COMMENT ON COLUMN automation_jobs.result IS 'Job result data (panels created, etc.)';
COMMENT ON COLUMN automation_jobs.error_message IS 'Error message if job failed';

