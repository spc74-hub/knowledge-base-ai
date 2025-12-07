-- Add is_completed column to standalone_notes for action type notes
-- This allows tracking completion status of action items

ALTER TABLE standalone_notes
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- Create index for filtering completed/pending actions
CREATE INDEX IF NOT EXISTS idx_standalone_notes_is_completed
ON standalone_notes(is_completed)
WHERE note_type = 'action';

-- Comment for documentation
COMMENT ON COLUMN standalone_notes.is_completed IS 'Completion status for action type notes';
