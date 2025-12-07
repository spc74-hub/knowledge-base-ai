-- =====================================================
-- Objectives hierarchy and linkages support
-- =====================================================
-- Run this in Supabase SQL Editor
-- This script ensures all necessary tables exist for objectives

-- =====================================================
-- 1. Junction table for objective-project many-to-many
-- =====================================================
CREATE TABLE IF NOT EXISTS public.objective_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    objective_id UUID NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(objective_id, project_id)
);

-- =====================================================
-- 2. Junction table for objective-content many-to-many
-- =====================================================
CREATE TABLE IF NOT EXISTS public.objective_contents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    objective_id UUID NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(objective_id, content_id)
);

-- =====================================================
-- 3. Junction table for objective-mental_model many-to-many
-- =====================================================
CREATE TABLE IF NOT EXISTS public.objective_mental_models (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    objective_id UUID NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
    mental_model_id UUID NOT NULL REFERENCES public.mental_models(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(objective_id, mental_model_id)
);

-- =====================================================
-- 4. Junction table for objective-standalone_notes many-to-many
-- =====================================================
CREATE TABLE IF NOT EXISTS public.objective_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    objective_id UUID NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES public.standalone_notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(objective_id, note_id)
);

-- =====================================================
-- 5. Create indexes for junction tables
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_objective_projects_objective ON objective_projects(objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_projects_project ON objective_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_objective_contents_objective ON objective_contents(objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_contents_content ON objective_contents(content_id);
CREATE INDEX IF NOT EXISTS idx_objective_mental_models_objective ON objective_mental_models(objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_mental_models_model ON objective_mental_models(mental_model_id);
CREATE INDEX IF NOT EXISTS idx_objective_notes_objective ON objective_notes(objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_notes_note ON objective_notes(note_id);

-- =====================================================
-- 6. Create index for hierarchy queries (parent_id)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_objectives_parent ON objectives(parent_id);
CREATE INDEX IF NOT EXISTS idx_objectives_root ON objectives(user_id) WHERE parent_id IS NULL;

-- =====================================================
-- 7. RLS Policies for junction tables
-- =====================================================

-- objective_projects policies
ALTER TABLE public.objective_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own objective_projects" ON public.objective_projects;
CREATE POLICY "Users can view own objective_projects" ON public.objective_projects
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own objective_projects" ON public.objective_projects;
CREATE POLICY "Users can insert own objective_projects" ON public.objective_projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own objective_projects" ON public.objective_projects;
CREATE POLICY "Users can delete own objective_projects" ON public.objective_projects
    FOR DELETE USING (auth.uid() = user_id);

-- objective_contents policies
ALTER TABLE public.objective_contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own objective_contents" ON public.objective_contents;
CREATE POLICY "Users can view own objective_contents" ON public.objective_contents
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own objective_contents" ON public.objective_contents;
CREATE POLICY "Users can insert own objective_contents" ON public.objective_contents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own objective_contents" ON public.objective_contents;
CREATE POLICY "Users can delete own objective_contents" ON public.objective_contents
    FOR DELETE USING (auth.uid() = user_id);

-- objective_mental_models policies
ALTER TABLE public.objective_mental_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own objective_mental_models" ON public.objective_mental_models;
CREATE POLICY "Users can view own objective_mental_models" ON public.objective_mental_models
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own objective_mental_models" ON public.objective_mental_models;
CREATE POLICY "Users can insert own objective_mental_models" ON public.objective_mental_models
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own objective_mental_models" ON public.objective_mental_models;
CREATE POLICY "Users can delete own objective_mental_models" ON public.objective_mental_models
    FOR DELETE USING (auth.uid() = user_id);

-- objective_notes policies
ALTER TABLE public.objective_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own objective_notes" ON public.objective_notes;
CREATE POLICY "Users can view own objective_notes" ON public.objective_notes
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own objective_notes" ON public.objective_notes;
CREATE POLICY "Users can insert own objective_notes" ON public.objective_notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own objective_notes" ON public.objective_notes;
CREATE POLICY "Users can delete own objective_notes" ON public.objective_notes
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 8. Verify tables exist
-- =====================================================
SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('objective_projects', 'objective_contents', 'objective_mental_models', 'objective_notes');
