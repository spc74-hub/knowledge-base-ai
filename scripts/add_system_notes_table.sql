-- =====================================================
-- KNOWLEDGE BASE AI - System Notes Feature
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- Tabla system_notes (notas de documentación del usuario)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.system_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Contenido de la nota
    title TEXT NOT NULL,
    content TEXT NOT NULL,

    -- Categorización
    category VARCHAR(50) DEFAULT 'general',  -- general, workflow, tips, reference

    -- Orden de visualización
    position INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_system_notes_user_id ON system_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_system_notes_category ON system_notes(category);
CREATE INDEX IF NOT EXISTS idx_system_notes_position ON system_notes(position);

-- =====================================================
-- RLS para system_notes
-- =====================================================
ALTER TABLE system_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own system notes" ON system_notes;
CREATE POLICY "Users can view own system notes"
    ON system_notes FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own system notes" ON system_notes;
CREATE POLICY "Users can insert own system notes"
    ON system_notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own system notes" ON system_notes;
CREATE POLICY "Users can update own system notes"
    ON system_notes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own system notes" ON system_notes;
CREATE POLICY "Users can delete own system notes"
    ON system_notes FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- Trigger para updated_at
-- =====================================================
DROP TRIGGER IF EXISTS update_system_notes_updated_at ON system_notes;
CREATE TRIGGER update_system_notes_updated_at
    BEFORE UPDATE ON system_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'system_notes';

-- =====================================================
-- ¡LISTO! Ejecuta este script en Supabase SQL Editor
-- =====================================================
