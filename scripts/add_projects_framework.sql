-- =====================================================
-- PROJECTS FRAMEWORK - Acciones y Vinculaciones
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- Extiende los proyectos con:
--   - Acciones (tareas checkbox)
--   - Vinculaciones a Modelos Mentales
--   - Vinculaciones a Objetivos
-- =====================================================

-- =====================================================
-- 1. Acciones de Proyectos (tareas simples)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.project_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Info
    title VARCHAR(300) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,

    -- Orden
    position INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_project_actions_project ON project_actions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_actions_user ON project_actions(user_id);

-- RLS
ALTER TABLE project_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own project_actions" ON project_actions;
CREATE POLICY "Users can view own project_actions"
    ON project_actions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own project_actions" ON project_actions;
CREATE POLICY "Users can insert own project_actions"
    ON project_actions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own project_actions" ON project_actions;
CREATE POLICY "Users can update own project_actions"
    ON project_actions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own project_actions" ON project_actions;
CREATE POLICY "Users can delete own project_actions"
    ON project_actions FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- 2. Relaciones: Proyectos <-> Modelos Mentales
-- =====================================================

CREATE TABLE IF NOT EXISTS public.project_mental_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    mental_model_id UUID NOT NULL REFERENCES mental_models(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, mental_model_id)
);

CREATE INDEX IF NOT EXISTS idx_project_mm_project ON project_mental_models(project_id);
CREATE INDEX IF NOT EXISTS idx_project_mm_model ON project_mental_models(mental_model_id);

ALTER TABLE project_mental_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own project_mental_models" ON project_mental_models;
CREATE POLICY "Users can manage own project_mental_models"
    ON project_mental_models FOR ALL
    USING (auth.uid() = user_id);

-- =====================================================
-- 3. Relaciones: Proyectos <-> Objetivos
-- (La tabla objective_projects ya existe, pero creamos vista inversa)
-- =====================================================

-- No necesitamos nueva tabla, usamos objective_projects existente
-- pero necesitamos asegurarnos de que podemos consultar desde proyectos

-- =====================================================
-- VERIFICACION
-- =====================================================

SELECT 'project_actions created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'project_actions';

SELECT 'project_mental_models created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'project_mental_models';

-- =====================================================
-- LISTO! Ejecuta en Supabase SQL Editor
-- =====================================================
