-- =====================================================
-- KNOWLEDGE BASE AI - Tags y Notes Feature
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- FASE 1: Añadir campo notes a contents
-- =====================================================

-- Campo para notas personales del usuario (markdown)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Índice de texto completo para buscar en notas
CREATE INDEX IF NOT EXISTS idx_contents_notes_fts
ON contents USING GIN(to_tsvector('spanish', COALESCE(notes, '')));

-- =====================================================
-- FASE 2: Tabla taxonomy_tags (reglas de herencia)
-- =====================================================

-- Tabla para definir tags que se heredan por taxonomía
CREATE TABLE IF NOT EXISTS public.taxonomy_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Tipo de taxonomía: 'category', 'person', 'organization', 'product', 'concept'
    taxonomy_type VARCHAR(50) NOT NULL,

    -- Valor específico (ej: "Elon Musk", "Technology & Computing", "machine learning")
    taxonomy_value TEXT NOT NULL,

    -- Tag a heredar (ej: "Gurú", "Seguir", "Importante")
    tag TEXT NOT NULL,

    -- Color opcional para visualización
    color VARCHAR(20) DEFAULT '#6366f1',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Un usuario no puede tener el mismo tag para la misma taxonomía dos veces
    CONSTRAINT unique_user_taxonomy_tag UNIQUE (user_id, taxonomy_type, taxonomy_value, tag)
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_taxonomy_tags_user_id ON taxonomy_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_tags_type ON taxonomy_tags(taxonomy_type);
CREATE INDEX IF NOT EXISTS idx_taxonomy_tags_value ON taxonomy_tags(taxonomy_value);
CREATE INDEX IF NOT EXISTS idx_taxonomy_tags_type_value ON taxonomy_tags(taxonomy_type, taxonomy_value);

-- =====================================================
-- RLS para taxonomy_tags
-- =====================================================
ALTER TABLE taxonomy_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own taxonomy tags" ON taxonomy_tags;
CREATE POLICY "Users can view own taxonomy tags"
    ON taxonomy_tags FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own taxonomy tags" ON taxonomy_tags;
CREATE POLICY "Users can insert own taxonomy tags"
    ON taxonomy_tags FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own taxonomy tags" ON taxonomy_tags;
CREATE POLICY "Users can update own taxonomy tags"
    ON taxonomy_tags FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own taxonomy tags" ON taxonomy_tags;
CREATE POLICY "Users can delete own taxonomy tags"
    ON taxonomy_tags FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- Trigger para updated_at en taxonomy_tags
-- =====================================================
DROP TRIGGER IF EXISTS update_taxonomy_tags_updated_at ON taxonomy_tags;
CREATE TRIGGER update_taxonomy_tags_updated_at
    BEFORE UPDATE ON taxonomy_tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Función para obtener tags heredados de un contenido
-- =====================================================
CREATE OR REPLACE FUNCTION get_inherited_tags(
    p_user_id UUID,
    p_iab_tier1 TEXT,
    p_iab_tier2 TEXT,
    p_iab_tier3 TEXT,
    p_concepts TEXT[],
    p_entities JSONB
)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
    inherited_tags TEXT[] := '{}';
    entity_record RECORD;
BEGIN
    -- Tags por categoría tier1
    IF p_iab_tier1 IS NOT NULL THEN
        SELECT array_agg(DISTINCT tag) INTO inherited_tags
        FROM taxonomy_tags
        WHERE user_id = p_user_id
        AND taxonomy_type = 'category'
        AND taxonomy_value = p_iab_tier1;
    END IF;

    -- Tags por categoría tier2
    IF p_iab_tier2 IS NOT NULL THEN
        inherited_tags := inherited_tags || (
            SELECT COALESCE(array_agg(DISTINCT tag), '{}')
            FROM taxonomy_tags
            WHERE user_id = p_user_id
            AND taxonomy_type = 'category'
            AND taxonomy_value = p_iab_tier2
        );
    END IF;

    -- Tags por conceptos
    IF p_concepts IS NOT NULL AND array_length(p_concepts, 1) > 0 THEN
        inherited_tags := inherited_tags || (
            SELECT COALESCE(array_agg(DISTINCT tag), '{}')
            FROM taxonomy_tags
            WHERE user_id = p_user_id
            AND taxonomy_type = 'concept'
            AND taxonomy_value = ANY(p_concepts)
        );
    END IF;

    -- Tags por personas
    IF p_entities IS NOT NULL AND p_entities->'persons' IS NOT NULL THEN
        FOR entity_record IN SELECT jsonb_array_elements(p_entities->'persons')->>'name' as name
        LOOP
            inherited_tags := inherited_tags || (
                SELECT COALESCE(array_agg(DISTINCT tag), '{}')
                FROM taxonomy_tags
                WHERE user_id = p_user_id
                AND taxonomy_type = 'person'
                AND taxonomy_value = entity_record.name
            );
        END LOOP;
    END IF;

    -- Tags por organizaciones
    IF p_entities IS NOT NULL AND p_entities->'organizations' IS NOT NULL THEN
        FOR entity_record IN SELECT jsonb_array_elements(p_entities->'organizations')->>'name' as name
        LOOP
            inherited_tags := inherited_tags || (
                SELECT COALESCE(array_agg(DISTINCT tag), '{}')
                FROM taxonomy_tags
                WHERE user_id = p_user_id
                AND taxonomy_type = 'organization'
                AND taxonomy_value = entity_record.name
            );
        END LOOP;
    END IF;

    -- Tags por productos
    IF p_entities IS NOT NULL AND p_entities->'products' IS NOT NULL THEN
        FOR entity_record IN SELECT jsonb_array_elements(p_entities->'products')->>'name' as name
        LOOP
            inherited_tags := inherited_tags || (
                SELECT COALESCE(array_agg(DISTINCT tag), '{}')
                FROM taxonomy_tags
                WHERE user_id = p_user_id
                AND taxonomy_type = 'product'
                AND taxonomy_value = entity_record.name
            );
        END LOOP;
    END IF;

    -- Eliminar duplicados y nulos
    SELECT ARRAY(SELECT DISTINCT unnest(inherited_tags) WHERE unnest IS NOT NULL) INTO inherited_tags;

    RETURN inherited_tags;
END;
$$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'contents' AND column_name = 'notes';

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'taxonomy_tags';

-- =====================================================
-- ¡LISTO! Ejecuta este script en Supabase SQL Editor
-- =====================================================
