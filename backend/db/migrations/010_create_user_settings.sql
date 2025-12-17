-- Migration: Create User Settings Table
-- Stores user preferences including auto-creation from forms setting

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  auto_create_from_forms BOOLEAN DEFAULT false,
  auto_create_project_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key to users table
  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_auto_create ON user_settings(auto_create_from_forms);

-- Add comments for documentation
COMMENT ON TABLE user_settings IS 'User preferences and settings including automation preferences';
COMMENT ON COLUMN user_settings.user_id IS 'Foreign key to users table - one settings record per user';
COMMENT ON COLUMN user_settings.auto_create_from_forms IS 'Global toggle: enable/disable auto-creation from approved forms';
COMMENT ON COLUMN user_settings.auto_create_project_ids IS 'Array of project IDs where auto-creation is enabled (project-specific override)';

