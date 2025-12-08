-- =====================================================
-- USER CLASSIFICATION FIELDS - Campos de clasificación manual
-- =====================================================
-- Permite al usuario sobrescribir/editar la clasificación generada por IA

-- =====================================================
-- PASO 1: Añadir campos user_* a contents
-- =====================================================

-- Entidades editadas por el usuario (sobrescribe entities de IA)
ALTER TABLE contents
ADD COLUMN IF NOT EXISTS user_entities JSONB DEFAULT NULL;

-- Conceptos editados por el usuario (sobrescribe concepts de IA)
ALTER TABLE contents
ADD COLUMN IF NOT EXISTS user_concepts TEXT[] DEFAULT NULL;

-- Categoría editada por el usuario (sobrescribe iab_tier1/tier2 de IA)
ALTER TABLE contents
ADD COLUMN IF NOT EXISTS user_category TEXT DEFAULT NULL;

-- =====================================================
-- PASO 2: Índices para filtrado
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_contents_user_entities ON contents USING GIN(user_entities) WHERE user_entities IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contents_user_concepts ON contents USING GIN(user_concepts) WHERE user_concepts IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contents_user_category ON contents(user_category) WHERE user_category IS NOT NULL;

-- =====================================================
-- PASO 3: Comentarios
-- =====================================================
COMMENT ON COLUMN contents.user_entities IS 'Entidades editadas manualmente por el usuario. Si existe, tiene prioridad sobre entities (IA)';
COMMENT ON COLUMN contents.user_concepts IS 'Conceptos editados manualmente por el usuario. Si existe, tiene prioridad sobre concepts (IA)';
COMMENT ON COLUMN contents.user_category IS 'Categoría editada manualmente por el usuario. Si existe, tiene prioridad sobre iab_tier1 (IA)';

-- =====================================================
-- NOTA: Lógica de visualización
-- =====================================================
-- En las vistas y filtros:
-- - Si user_entities existe -> mostrar user_entities
-- - Si no -> mostrar entities (IA)
-- Lo mismo para concepts y category
-- Esto se implementa en el backend/frontend, no en SQL
