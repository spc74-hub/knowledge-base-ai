-- =====================================================
-- KNOWLEDGE BASE AI - Journal Big Rocks Enhancement
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- =====================================================

-- Añadir campo para múltiples Big Rocks (configurable por usuario)
ALTER TABLE public.daily_journal
ADD COLUMN IF NOT EXISTS big_rocks JSONB DEFAULT '[]'::jsonb;
-- Estructura: [{ "id": "uuid", "text": "...", "type": "custom"|"objective"|"project", "ref_id": null|"uuid", "completed": false, "order": 0 }]

-- Añadir campo para la Full Note generada al cerrar el día
ALTER TABLE public.daily_journal
ADD COLUMN IF NOT EXISTS generated_note_id UUID REFERENCES public.contents(id) ON DELETE SET NULL;

-- Añadir campo is_day_completed si no existe (para tracking durante el día)
ALTER TABLE public.daily_journal
ADD COLUMN IF NOT EXISTS is_day_completed BOOLEAN DEFAULT FALSE;

-- Añadir campo para configuración del usuario (cuántos big rocks quiere)
-- Esto va en una tabla de user_preferences o lo guardamos en el journal
ALTER TABLE public.daily_journal
ADD COLUMN IF NOT EXISTS big_rocks_count INTEGER DEFAULT 3 CHECK (big_rocks_count >= 1 AND big_rocks_count <= 5);

-- Comentario explicativo
COMMENT ON COLUMN daily_journal.big_rocks IS 'Array de Big Rocks del día. Estructura: [{id, text, type, ref_id, completed, order}]';
COMMENT ON COLUMN daily_journal.generated_note_id IS 'ID de la Full Note generada automáticamente al cerrar el día';
COMMENT ON COLUMN daily_journal.big_rocks_count IS 'Número de Big Rocks que el usuario quiere usar (1-5)';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'daily_journal'
AND column_name IN ('big_rocks', 'generated_note_id', 'is_day_completed', 'big_rocks_count')
ORDER BY column_name;
