-- =====================================================
-- MENTAL MODELS FRAMEWORK - Acciones y Vinculaciones
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- Extiende los modelos mentales con:
--   - Acciones (tareas checkbox)
--   - Vinculaciones a Notas (junction table)
--   - Vinculaciones a Proyectos (junction table)
-- =====================================================

-- =====================================================
-- 1. Acciones de Modelos Mentales (tareas simples)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mental_model_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mental_model_id UUID NOT NULL REFERENCES mental_models(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_mm_actions_model ON mental_model_actions(mental_model_id);
CREATE INDEX IF NOT EXISTS idx_mm_actions_user ON mental_model_actions(user_id);

-- RLS
ALTER TABLE mental_model_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own mental_model_actions" ON mental_model_actions;
CREATE POLICY "Users can view own mental_model_actions"
    ON mental_model_actions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own mental_model_actions" ON mental_model_actions;
CREATE POLICY "Users can insert own mental_model_actions"
    ON mental_model_actions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own mental_model_actions" ON mental_model_actions;
CREATE POLICY "Users can update own mental_model_actions"
    ON mental_model_actions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own mental_model_actions" ON mental_model_actions;
CREATE POLICY "Users can delete own mental_model_actions"
    ON mental_model_actions FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- 2. Relaciones: Modelos Mentales <-> Notas
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mental_model_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mental_model_id UUID NOT NULL REFERENCES mental_models(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES standalone_notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mental_model_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_mm_notes_model ON mental_model_notes(mental_model_id);
CREATE INDEX IF NOT EXISTS idx_mm_notes_note ON mental_model_notes(note_id);

ALTER TABLE mental_model_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own mental_model_notes" ON mental_model_notes;
CREATE POLICY "Users can manage own mental_model_notes"
    ON mental_model_notes FOR ALL
    USING (auth.uid() = user_id);

-- =====================================================
-- 3. Relaciones: Modelos Mentales <-> Proyectos
-- =====================================================

-- Ya existe project_mental_models, usaremos esa tabla para la relación inversa

-- =====================================================
-- VERIFICACION
-- =====================================================

SELECT 'mental_model_actions created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'mental_model_actions';

SELECT 'mental_model_notes created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'mental_model_notes';

-- =====================================================
-- LISTO! Ejecuta en Supabase SQL Editor
-- =====================================================
