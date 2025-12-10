-- Add is_day_completed column to daily_journal table
-- Run this script in Supabase SQL Editor

ALTER TABLE public.daily_journal
ADD COLUMN IF NOT EXISTS is_day_completed BOOLEAN DEFAULT FALSE;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'daily_journal'
AND column_name = 'is_day_completed';
