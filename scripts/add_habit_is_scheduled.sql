-- Migration: Add is_scheduled field to habit_logs
-- This allows tracking habits completed outside their scheduled days
-- Example: A habit scheduled for Mon/Wed/Fri can be completed on Tuesday as "extra"

-- Add is_scheduled column to habit_logs
ALTER TABLE habit_logs
ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT TRUE;

-- Comment explaining the field
COMMENT ON COLUMN habit_logs.is_scheduled IS 'True if the habit was scheduled for this day based on frequency_days, False if completed as an extra/bonus';

-- Update existing logs to have is_scheduled = true (they were created under the old system)
UPDATE habit_logs SET is_scheduled = TRUE WHERE is_scheduled IS NULL;

-- Create index for efficient queries filtering by scheduled status
CREATE INDEX IF NOT EXISTS idx_habit_logs_is_scheduled ON habit_logs(is_scheduled);
