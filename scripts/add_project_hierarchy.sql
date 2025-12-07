-- =====================================================
-- Add project hierarchy support (subprojects)
-- =====================================================
-- Run this in Supabase SQL Editor

-- Add parent_project_id column for hierarchy
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create index for efficient hierarchy queries
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id);

-- Create index for root projects (parent is null)
CREATE INDEX IF NOT EXISTS idx_projects_root ON projects(user_id) WHERE parent_project_id IS NULL;

-- Verify column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name = 'parent_project_id';

