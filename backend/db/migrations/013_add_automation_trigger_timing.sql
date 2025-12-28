-- Migration: Add automation trigger timing setting
-- Allows users to choose when automation triggers: 'upload' or 'approval'

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS automation_trigger_timing VARCHAR(20) DEFAULT 'approval';

-- Add constraint to ensure valid values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_automation_trigger_timing'
  ) THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT check_automation_trigger_timing 
      CHECK (automation_trigger_timing IN ('upload', 'approval'));
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN user_settings.automation_trigger_timing IS 'When to trigger automation: upload (auto-approve and trigger) or approval (manual approval required)';

