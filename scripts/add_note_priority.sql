-- Migration: Add priority field to notes
-- Priority values: 'important', 'urgent', 'A', 'B', 'C', NULL (no priority)

-- Add priority column to standalone_notes table
ALTER TABLE standalone_notes
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT NULL;

-- Add check constraint for valid priority values
ALTER TABLE standalone_notes
DROP CONSTRAINT IF EXISTS standalone_notes_priority_check;

ALTER TABLE standalone_notes
ADD CONSTRAINT standalone_notes_priority_check
CHECK (priority IS NULL OR priority IN ('important', 'urgent', 'A', 'B', 'C'));

-- Create index for filtering by priority
CREATE INDEX IF NOT EXISTS idx_standalone_notes_priority
ON standalone_notes(priority) WHERE priority IS NOT NULL;

-- Create index for sorting by priority (with order)
CREATE INDEX IF NOT EXISTS idx_standalone_notes_user_priority
ON standalone_notes(user_id, priority, created_at DESC);

-- Add priority column to contents table (for Full Notes)
ALTER TABLE contents
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT NULL;

-- Add check constraint for valid priority values on contents
ALTER TABLE contents
DROP CONSTRAINT IF EXISTS contents_priority_check;

ALTER TABLE contents
ADD CONSTRAINT contents_priority_check
CHECK (priority IS NULL OR priority IN ('important', 'urgent', 'A', 'B', 'C'));

-- Create index for filtering by priority on contents
CREATE INDEX IF NOT EXISTS idx_contents_priority
ON contents(priority) WHERE priority IS NOT NULL;

-- Create index for notes with priority
CREATE INDEX IF NOT EXISTS idx_contents_user_priority
ON contents(user_id, priority, created_at DESC) WHERE type = 'note';

-- Comment to document the priority field
COMMENT ON COLUMN standalone_notes.priority IS 'Note priority: important, urgent, A, B, C, or NULL';
COMMENT ON COLUMN contents.priority IS 'Content priority: important, urgent, A, B, C, or NULL';
