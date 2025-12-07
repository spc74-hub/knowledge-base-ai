-- Add source_content_id to standalone_notes table
-- This allows notes to be created directly from a content detail view

ALTER TABLE standalone_notes
ADD COLUMN IF NOT EXISTS source_content_id UUID REFERENCES contents(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_standalone_notes_source_content_id
ON standalone_notes(source_content_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'standalone_notes' AND column_name = 'source_content_id';
