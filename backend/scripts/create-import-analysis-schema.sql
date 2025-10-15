-- Create import analysis tables for enhanced duplicate detection and AI analysis

-- Import sessions table
CREATE TABLE IF NOT EXISTS import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  file_id UUID,
  session_id VARCHAR(100) NOT NULL,
  total_records INTEGER DEFAULT 0,
  duplicates_found INTEGER DEFAULT 0,
  conflicts_resolved INTEGER DEFAULT 0,
  ai_analysis_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Import analyses table
CREATE TABLE IF NOT EXISTS import_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_session_id UUID NOT NULL,
  project_id UUID NOT NULL,
  ai_summary TEXT NOT NULL,
  data_quality_score DECIMAL(3,2) DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  confidence_score DECIMAL(3,2) DEFAULT 0,
  recommendations JSONB DEFAULT '[]',
  insights JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Import duplicates table
CREATE TABLE IF NOT EXISTS import_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_session_id UUID NOT NULL,
  panel_number VARCHAR(50) NOT NULL,
  domain VARCHAR(50) NOT NULL,
  duplicate_reason VARCHAR(100) NOT NULL,
  existing_record_id UUID,
  new_record_data JSONB,
  resolution_action VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraints
ALTER TABLE import_sessions 
ADD CONSTRAINT fk_import_sessions_project 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE import_sessions 
ADD CONSTRAINT fk_import_sessions_file 
FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE SET NULL;

ALTER TABLE import_sessions 
ADD CONSTRAINT fk_import_sessions_analysis 
FOREIGN KEY (ai_analysis_id) REFERENCES import_analyses(id) ON DELETE SET NULL;

ALTER TABLE import_analyses 
ADD CONSTRAINT fk_import_analyses_session 
FOREIGN KEY (import_session_id) REFERENCES import_sessions(id) ON DELETE CASCADE;

ALTER TABLE import_analyses 
ADD CONSTRAINT fk_import_analyses_project 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE import_duplicates 
ADD CONSTRAINT fk_import_duplicates_session 
FOREIGN KEY (import_session_id) REFERENCES import_sessions(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_import_sessions_project_id ON import_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_created_at ON import_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_import_analyses_session_id ON import_analyses(import_session_id);
CREATE INDEX IF NOT EXISTS idx_import_analyses_project_id ON import_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_import_duplicates_session_id ON import_duplicates(import_session_id);
CREATE INDEX IF NOT EXISTS idx_import_duplicates_panel_number ON import_duplicates(panel_number);

-- Add RLS policies
ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_duplicates ENABLE ROW LEVEL SECURITY;

-- RLS policies for import_sessions
CREATE POLICY "Users can view import sessions for their projects" ON import_sessions
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert import sessions for their projects" ON import_sessions
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS policies for import_analyses
CREATE POLICY "Users can view import analyses for their projects" ON import_analyses
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert import analyses for their projects" ON import_analyses
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS policies for import_duplicates
CREATE POLICY "Users can view import duplicates for their projects" ON import_duplicates
  FOR SELECT USING (
    import_session_id IN (
      SELECT id FROM import_sessions WHERE project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert import duplicates for their projects" ON import_duplicates
  FOR INSERT WITH CHECK (
    import_session_id IN (
      SELECT id FROM import_sessions WHERE project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

-- Add comments for documentation
COMMENT ON TABLE import_sessions IS 'Tracks import sessions with metadata and AI analysis references';
COMMENT ON TABLE import_analyses IS 'Stores AI-generated analysis and insights for import sessions';
COMMENT ON TABLE import_duplicates IS 'Tracks duplicate records found during import with resolution actions';

COMMENT ON COLUMN import_sessions.session_id IS 'Unique identifier for the import session';
COMMENT ON COLUMN import_analyses.ai_summary IS 'AI-generated summary of the import process';
COMMENT ON COLUMN import_analyses.data_quality_score IS 'Data quality score from 0-100';
COMMENT ON COLUMN import_duplicates.duplicate_reason IS 'Reason why the record was considered a duplicate';
COMMENT ON COLUMN import_duplicates.resolution_action IS 'Action taken to resolve the duplicate (skip, replace, merge, etc.)';
