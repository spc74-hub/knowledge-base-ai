-- =====================================================
-- Add project and mental model links to standalone_notes
-- =====================================================
-- Run this in Supabase SQL Editor

-- Add linked_project_id column
ALTER TABLE public.standalone_notes
ADD COLUMN IF NOT EXISTS linked_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add linked_model_id column (references taxonomy_tags for mental models)
ALTER TABLE public.standalone_notes
ADD COLUMN IF NOT EXISTS linked_model_id UUID REFERENCES public.taxonomy_tags(id) ON DELETE SET NULL;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_standalone_notes_project ON standalone_notes(linked_project_id) WHERE linked_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_standalone_notes_model ON standalone_notes(linked_model_id) WHERE linked_model_id IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'standalone_notes'
AND column_name IN ('linked_project_id', 'linked_model_id');
