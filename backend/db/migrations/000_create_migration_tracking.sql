-- Migration Tracking System
-- This table tracks which migrations have been applied to prevent duplicate runs

CREATE TABLE IF NOT EXISTS schema_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name VARCHAR(255) UNIQUE NOT NULL,
  migration_file VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_by VARCHAR(100) DEFAULT 'system',
  checksum VARCHAR(64), -- SHA-256 hash of migration file content
  execution_time_ms INTEGER, -- How long the migration took
  success BOOLEAN DEFAULT true,
  error_message TEXT, -- If migration failed
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);

-- Add comments
COMMENT ON TABLE schema_migrations IS 'Tracks database schema migrations to prevent duplicate execution';
COMMENT ON COLUMN schema_migrations.migration_name IS 'Unique identifier for the migration (e.g., 001_create_asbuilt_tables)';
COMMENT ON COLUMN schema_migrations.migration_file IS 'Full filename of the migration file';
COMMENT ON COLUMN schema_migrations.checksum IS 'SHA-256 hash of migration file content for integrity verification';
COMMENT ON COLUMN schema_migrations.success IS 'Whether the migration completed successfully';

