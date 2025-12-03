-- =====================================================
-- KNOWLEDGE BASE AI - Maturity Levels Feature
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- Añadir campo maturity_level a contents
-- =====================================================

-- Valores posibles: 'captured', 'processed', 'connected', 'integrated'
-- - captured: Contenido guardado, pendiente de revisar
-- - processed: Revisado y categorizado correctamente
-- - connected: Vinculado con otros contenidos relacionados
-- - integrated: Conocimiento asimilado y sintetizado

ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS maturity_level VARCHAR(20) DEFAULT 'captured';

-- Índice para filtrar por nivel de madurez
CREATE INDEX IF NOT EXISTS idx_contents_maturity_level ON contents(maturity_level);

-- Índice compuesto para queries comunes (usuario + madurez + archivado)
CREATE INDEX IF NOT EXISTS idx_contents_user_maturity ON contents(user_id, maturity_level, is_archived);

-- =====================================================
-- Campo para tracking de última revisión
-- =====================================================

ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'contents' AND column_name IN ('maturity_level', 'last_reviewed_at');

-- =====================================================
-- ¡LISTO! Ejecuta este script en Supabase SQL Editor
-- =====================================================
