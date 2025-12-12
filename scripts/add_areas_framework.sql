-- =====================================================
-- AREAS FRAMEWORK - Acciones y Vinculaciones
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- Extiende las areas con:
--   - Acciones (tareas checkbox)
--   - Vinculaciones a Notas (junction table)
-- =====================================================

-- =====================================================
-- 1. Acciones de Areas (tareas simples)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.area_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_id UUID NOT NULL REFERENCES areas_of_responsibility(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_area_actions_area ON area_actions(area_id);
CREATE INDEX IF NOT EXISTS idx_area_actions_user ON area_actions(user_id);

-- RLS
ALTER TABLE area_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own area_actions" ON area_actions;
CREATE POLICY "Users can view own area_actions"
    ON area_actions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own area_actions" ON area_actions;
CREATE POLICY "Users can insert own area_actions"
    ON area_actions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own area_actions" ON area_actions;
CREATE POLICY "Users can update own area_actions"
    ON area_actions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own area_actions" ON area_actions;
CREATE POLICY "Users can delete own area_actions"
    ON area_actions FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- 2. Relaciones: Areas <-> Notas (junction table)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.area_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_id UUID NOT NULL REFERENCES areas_of_responsibility(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES standalone_notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(area_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_area_notes_area ON area_notes(area_id);
CREATE INDEX IF NOT EXISTS idx_area_notes_note ON area_notes(note_id);

ALTER TABLE area_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own area_notes" ON area_notes;
CREATE POLICY "Users can manage own area_notes"
    ON area_notes FOR ALL
    USING (auth.uid() = user_id);

-- =====================================================
-- VERIFICACION
-- =====================================================

SELECT 'area_actions created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'area_actions';

SELECT 'area_notes created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'area_notes';

-- =====================================================
-- LISTO! Ejecuta en Supabase SQL Editor
-- =====================================================
