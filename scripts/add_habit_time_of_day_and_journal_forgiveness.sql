-- =====================================================
-- MIGRATION: Add time_of_day to habits and forgiveness to daily_journal
-- =====================================================
-- Execute in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: Add time_of_day to habits table
-- =====================================================

-- Add time_of_day column to habits
-- Values: 'morning', 'afternoon', 'evening', 'anytime' (default)
ALTER TABLE habits
ADD COLUMN IF NOT EXISTS time_of_day TEXT DEFAULT 'anytime'
CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'anytime'));

-- Add comment for documentation
COMMENT ON COLUMN habits.time_of_day IS 'When the habit should be done: morning, afternoon, evening, or anytime (default)';

-- =====================================================
-- PART 2: Add forgiveness array to daily_journal
-- =====================================================

-- Add forgiveness as JSONB array (similar to wins and gratitudes)
-- Each item: {id, text, type} where type can be 'self', 'other', 'situation'
ALTER TABLE daily_journal
ADD COLUMN IF NOT EXISTS forgiveness_items JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN daily_journal.forgiveness_items IS 'Array of forgiveness items: [{id, text, type}] where type: self, other, situation';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify habits column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'habits'
AND column_name = 'time_of_day';

-- Verify daily_journal column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'daily_journal'
AND column_name = 'forgiveness_items';
