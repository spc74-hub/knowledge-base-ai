-- =====================================================
-- MENTAL MODELS - Tabla dedicada
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- =====================================================

-- Tabla para modelos mentales del usuario
CREATE TABLE IF NOT EXISTS public.mental_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Identificador del modelo (slug)
    slug VARCHAR(100) NOT NULL,

    -- Info basica
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Nota/Wiki extendida (markdown)
    notes TEXT DEFAULT '',

    -- Estado
    is_active BOOLEAN DEFAULT TRUE,

    -- Visualizacion
    color VARCHAR(20) DEFAULT '#8b5cf6',
    icon VARCHAR(10) DEFAULT '🧠',

    -- Estadisticas (cache)
    content_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: un modelo por usuario
    UNIQUE(user_id, slug)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_mental_models_user_id ON mental_models(user_id);
CREATE INDEX IF NOT EXISTS idx_mental_models_active ON mental_models(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_mental_models_slug ON mental_models(user_id, slug);

-- RLS
ALTER TABLE mental_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own mental_models" ON mental_models;
CREATE POLICY "Users can view own mental_models"
    ON mental_models FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own mental_models" ON mental_models;
CREATE POLICY "Users can insert own mental_models"
    ON mental_models FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own mental_models" ON mental_models;
CREATE POLICY "Users can update own mental_models"
    ON mental_models FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own mental_models" ON mental_models;
CREATE POLICY "Users can delete own mental_models"
    ON mental_models FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_mental_models_updated_at ON mental_models;
CREATE TRIGGER update_mental_models_updated_at
    BEFORE UPDATE ON mental_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Tabla de relacion: contenidos <-> modelos mentales
-- =====================================================

CREATE TABLE IF NOT EXISTS public.content_mental_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    mental_model_id UUID NOT NULL REFERENCES mental_models(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Notas especificas de por que este contenido aplica este modelo
    application_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Un contenido solo puede tener un modelo mental una vez
    UNIQUE(content_id, mental_model_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_content_mental_models_content ON content_mental_models(content_id);
CREATE INDEX IF NOT EXISTS idx_content_mental_models_model ON content_mental_models(mental_model_id);
CREATE INDEX IF NOT EXISTS idx_content_mental_models_user ON content_mental_models(user_id);

-- RLS
ALTER TABLE content_mental_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own content_mental_models" ON content_mental_models;
CREATE POLICY "Users can view own content_mental_models"
    ON content_mental_models FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own content_mental_models" ON content_mental_models;
CREATE POLICY "Users can insert own content_mental_models"
    ON content_mental_models FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own content_mental_models" ON content_mental_models;
CREATE POLICY "Users can delete own content_mental_models"
    ON content_mental_models FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- Funcion para actualizar content_count
-- =====================================================

CREATE OR REPLACE FUNCTION update_mental_model_content_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE mental_models
        SET content_count = content_count + 1,
            last_used_at = NOW()
        WHERE id = NEW.mental_model_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE mental_models
        SET content_count = GREATEST(0, content_count - 1)
        WHERE id = OLD.mental_model_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_mental_model_count ON content_mental_models;
CREATE TRIGGER trigger_update_mental_model_count
    AFTER INSERT OR DELETE ON content_mental_models
    FOR EACH ROW EXECUTE FUNCTION update_mental_model_content_count();

-- =====================================================
-- VERIFICACION
-- =====================================================

SELECT 'mental_models created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'mental_models';

SELECT 'content_mental_models created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'content_mental_models';

-- =====================================================
-- LISTO! Ejecuta en Supabase SQL Editor
-- =====================================================
