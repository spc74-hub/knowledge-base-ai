-- =====================================================
-- KNOWLEDGE BASE AI - Second Brain Features
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- FASE 1: Activos Reutilizables
-- =====================================================
-- Campo para marcar contenido como activo/template reutilizable

ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS is_asset BOOLEAN DEFAULT FALSE;

-- Índice para filtrar activos rápidamente
CREATE INDEX IF NOT EXISTS idx_contents_is_asset ON contents(is_asset) WHERE is_asset = TRUE;

-- =====================================================
-- FASE 2: Modelos Mentales (usando taxonomy_tags)
-- =====================================================
-- Los modelos mentales se implementan como taxonomy_tags con
-- taxonomy_type = 'mental_model'
-- Ejemplo: taxonomy_type='mental_model', taxonomy_value='First Principles', tag='modelo'

-- Insertar algunos modelos mentales predefinidos (opcional, el usuario puede crear los suyos)
-- Esto es solo para referencia, no se ejecuta automáticamente

-- =====================================================
-- FASE 3: Notas Standalone (Diario)
-- =====================================================
-- Tabla para notas personales no vinculadas a contenido externo

CREATE TABLE IF NOT EXISTS public.standalone_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Contenido
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- Markdown

    -- Tipo de nota
    note_type VARCHAR(50) DEFAULT 'reflection', -- reflection, idea, question, connection

    -- Vinculaciones opcionales
    linked_content_ids UUID[] DEFAULT '{}', -- Contenidos relacionados
    linked_note_ids UUID[] DEFAULT '{}', -- Otras notas relacionadas

    -- Tags personales
    tags TEXT[] DEFAULT '{}',

    -- Metadata
    is_pinned BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para notas
CREATE INDEX IF NOT EXISTS idx_standalone_notes_user_id ON standalone_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_standalone_notes_type ON standalone_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_standalone_notes_created ON standalone_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_standalone_notes_pinned ON standalone_notes(is_pinned) WHERE is_pinned = TRUE;

-- Full text search en notas
CREATE INDEX IF NOT EXISTS idx_standalone_notes_fts
ON standalone_notes USING GIN(to_tsvector('spanish', title || ' ' || content));

-- RLS para notas
ALTER TABLE standalone_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notes" ON standalone_notes;
CREATE POLICY "Users can view own notes"
    ON standalone_notes FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notes" ON standalone_notes;
CREATE POLICY "Users can insert own notes"
    ON standalone_notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notes" ON standalone_notes;
CREATE POLICY "Users can update own notes"
    ON standalone_notes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notes" ON standalone_notes;
CREATE POLICY "Users can delete own notes"
    ON standalone_notes FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_standalone_notes_updated_at ON standalone_notes;
CREATE TRIGGER update_standalone_notes_updated_at
    BEFORE UPDATE ON standalone_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FASE 4: Proyectos
-- =====================================================

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Info básica
    name TEXT NOT NULL,
    description TEXT,

    -- Estado y fechas
    status VARCHAR(20) DEFAULT 'active', -- active, completed, archived, on_hold
    deadline TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Organización
    color VARCHAR(20) DEFAULT '#6366f1',
    icon VARCHAR(10) DEFAULT '📁',
    position INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Añadir campo project_id a contents
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Índices para proyectos
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_contents_project_id ON contents(project_id);

-- RLS para proyectos
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own projects" ON projects;
CREATE POLICY "Users can view own projects"
    ON projects FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
CREATE POLICY "Users can insert own projects"
    ON projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON projects;
CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
CREATE POLICY "Users can delete own projects"
    ON projects FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT 'is_asset added' as status, column_name
FROM information_schema.columns
WHERE table_name = 'contents' AND column_name = 'is_asset';

SELECT 'standalone_notes created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'standalone_notes';

SELECT 'projects created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'projects';

SELECT 'project_id added' as status, column_name
FROM information_schema.columns
WHERE table_name = 'contents' AND column_name = 'project_id';

-- =====================================================
-- ¡LISTO! Ejecuta este script en Supabase SQL Editor
-- =====================================================
