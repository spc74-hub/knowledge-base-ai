-- =====================================================
-- KNOWLEDGE BASE AI - Daily Journal Feature
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- Tabla daily_journal (diario personal diario)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.daily_journal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Fecha del diario (única por usuario/día)
    date DATE NOT NULL,

    -- === APERTURA DEL DÍA ===
    morning_intention TEXT,  -- "Hoy elijo..."
    energy_morning VARCHAR(20),  -- high, medium, low

    -- Contenido inspiracional del día (generado o seleccionado)
    inspirational_content JSONB DEFAULT '{}'::jsonb,
    -- Estructura: { "quote": "...", "author": "...", "refran": "...", "challenge": "...", "question": "..." }

    -- === LA GRAN ROCA ===
    big_rock_type VARCHAR(20),  -- 'objective', 'project', 'custom'
    big_rock_id UUID,  -- FK a objectives o projects (opcional)
    big_rock_text TEXT,  -- Texto libre si es custom
    big_rock_completed BOOLEAN DEFAULT FALSE,

    -- === DURANTE EL DÍA ===
    energy_noon VARCHAR(20),  -- high, medium, low
    energy_afternoon VARCHAR(20),  -- high, medium, low
    energy_night VARCHAR(20),  -- high, medium, low

    -- Tareas del día (JSON array)
    daily_tasks JSONB DEFAULT '[]'::jsonb,
    -- Estructura: [{ "id": "uuid", "text": "...", "completed": false, "time": "10:00" }]

    -- Compromisos con hora (JSON array)
    commitments JSONB DEFAULT '[]'::jsonb,
    -- Estructura: [{ "id": "uuid", "time": "10:00", "text": "Reunión con...", "completed": false }]

    -- Notas rápidas del día (captura inbox)
    quick_captures JSONB DEFAULT '[]'::jsonb,
    -- Estructura: [{ "id": "uuid", "text": "...", "timestamp": "...", "converted_to_note_id": null }]

    -- === CIERRE DEL DÍA ===
    wins JSONB DEFAULT '[]'::jsonb,  -- ["Victoria 1", "Victoria 2", "Victoria 3"]
    learnings TEXT,  -- Qué aprendí hoy
    gratitudes JSONB DEFAULT '[]'::jsonb,  -- ["Gratitud 1", "Gratitud 2", "Gratitud 3"]

    -- Examen de conciencia
    failures TEXT,  -- En qué fallé
    forgiveness TEXT,  -- A quién perdonar/pedir perdón
    do_different TEXT,  -- Qué haría diferente

    note_to_tomorrow TEXT,  -- Nota para mi yo de mañana
    day_rating INTEGER CHECK (day_rating >= 1 AND day_rating <= 5),  -- 1-5 estrellas
    day_word VARCHAR(50),  -- Palabra que resume el día

    -- === METADATA ===
    is_morning_completed BOOLEAN DEFAULT FALSE,
    is_evening_completed BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: un diario por usuario por día
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_daily_journal_user_id ON daily_journal(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_journal_date ON daily_journal(date);
CREATE INDEX IF NOT EXISTS idx_daily_journal_user_date ON daily_journal(user_id, date);

-- =====================================================
-- RLS para daily_journal
-- =====================================================
ALTER TABLE daily_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own daily journals" ON daily_journal;
CREATE POLICY "Users can view own daily journals"
    ON daily_journal FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily journals" ON daily_journal;
CREATE POLICY "Users can insert own daily journals"
    ON daily_journal FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily journals" ON daily_journal;
CREATE POLICY "Users can update own daily journals"
    ON daily_journal FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own daily journals" ON daily_journal;
CREATE POLICY "Users can delete own daily journals"
    ON daily_journal FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- Trigger para updated_at
-- =====================================================
DROP TRIGGER IF EXISTS update_daily_journal_updated_at ON daily_journal;
CREATE TRIGGER update_daily_journal_updated_at
    BEFORE UPDATE ON daily_journal
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Tabla para contenido inspiracional predefinido
-- =====================================================
CREATE TABLE IF NOT EXISTS public.inspirational_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    content_type VARCHAR(30) NOT NULL,  -- 'quote', 'refran', 'challenge', 'question', 'word'
    content TEXT NOT NULL,
    author VARCHAR(100),  -- Para quotes
    category VARCHAR(50),  -- Para agrupar (motivacion, sabiduria, productividad, etc)

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para tipo de contenido
CREATE INDEX IF NOT EXISTS idx_inspirational_content_type ON inspirational_content(content_type);

-- =====================================================
-- Insertar contenido inspiracional inicial
-- =====================================================

-- Quotes motivacionales
INSERT INTO inspirational_content (content_type, content, author, category) VALUES
('quote', 'El único modo de hacer un gran trabajo es amar lo que haces.', 'Steve Jobs', 'motivacion'),
('quote', 'No es la especie más fuerte la que sobrevive, ni la más inteligente, sino la que responde mejor al cambio.', 'Charles Darwin', 'cambio'),
('quote', 'El éxito no es definitivo, el fracaso no es fatal: lo que cuenta es el coraje para continuar.', 'Winston Churchill', 'perseverancia'),
('quote', 'La única forma de hacer un trabajo genial es amar lo que haces.', 'Steve Jobs', 'trabajo'),
('quote', 'Sé el cambio que quieres ver en el mundo.', 'Mahatma Gandhi', 'cambio'),
('quote', 'El conocimiento habla, pero la sabiduría escucha.', 'Jimi Hendrix', 'sabiduria'),
('quote', 'No cuentes los días, haz que los días cuenten.', 'Muhammad Ali', 'motivacion'),
('quote', 'La disciplina es el puente entre metas y logros.', 'Jim Rohn', 'disciplina'),
('quote', 'Cada día es una nueva oportunidad para cambiar tu vida.', 'Anónimo', 'oportunidad'),
('quote', 'La mejor manera de predecir el futuro es crearlo.', 'Peter Drucker', 'futuro');

-- Refranes españoles
INSERT INTO inspirational_content (content_type, content, category) VALUES
('refran', 'A quien madruga, Dios le ayuda.', 'productividad'),
('refran', 'No dejes para mañana lo que puedas hacer hoy.', 'productividad'),
('refran', 'Más vale tarde que nunca.', 'perseverancia'),
('refran', 'El que la sigue la consigue.', 'perseverancia'),
('refran', 'Poco a poco se va lejos.', 'paciencia'),
('refran', 'Más sabe el diablo por viejo que por diablo.', 'sabiduria'),
('refran', 'En casa del herrero, cuchillo de palo.', 'reflexion'),
('refran', 'No hay mal que por bien no venga.', 'optimismo'),
('refran', 'A mal tiempo, buena cara.', 'optimismo'),
('refran', 'Quien mucho abarca, poco aprieta.', 'enfoque');

-- Micro-retos diarios
INSERT INTO inspirational_content (content_type, content, category) VALUES
('challenge', 'Habla con alguien nuevo hoy.', 'social'),
('challenge', 'Toma un camino diferente al habitual.', 'creatividad'),
('challenge', 'Escucha un género musical que nunca escuchas.', 'creatividad'),
('challenge', 'Almuerza sin mirar ninguna pantalla.', 'mindfulness'),
('challenge', 'Envía un mensaje de agradecimiento inesperado.', 'gratitud'),
('challenge', 'Haz 5 minutos de respiración consciente.', 'mindfulness'),
('challenge', 'Fotografía algo bello que normalmente ignoras.', 'mindfulness'),
('challenge', 'Haz una pausa de 10 minutos sin hacer nada.', 'descanso'),
('challenge', 'Escribe 3 cosas por las que estás agradecido.', 'gratitud'),
('challenge', 'Llama a alguien en lugar de enviar un mensaje.', 'social'),
('challenge', 'Bebe 8 vasos de agua hoy.', 'salud'),
('challenge', 'Camina 10 minutos al aire libre.', 'salud'),
('challenge', 'Lee 10 páginas de un libro físico.', 'desarrollo'),
('challenge', 'Organiza tu escritorio o espacio de trabajo.', 'organizacion'),
('challenge', 'Deja el móvil fuera del dormitorio esta noche.', 'descanso');

-- Preguntas poderosas
INSERT INTO inspirational_content (content_type, content, category) VALUES
('question', '¿Qué harías hoy si no tuvieras miedo?', 'valentia'),
('question', '¿Qué es lo más importante que podrías hacer hoy?', 'prioridades'),
('question', '¿Qué te haría sentir orgulloso al final del día?', 'logro'),
('question', '¿Qué pequeño paso puedes dar hacia tu gran meta?', 'progreso'),
('question', '¿A quién podrías ayudar hoy?', 'servicio'),
('question', '¿Qué hábito te gustaría fortalecer?', 'habitos'),
('question', '¿Qué conversación has estado evitando?', 'valentia'),
('question', '¿Qué te drena energía que podrías eliminar?', 'energia'),
('question', '¿Qué te llena de energía que podrías hacer más?', 'energia'),
('question', '¿Qué decisión has estado posponiendo?', 'decision');

-- Palabras del día para reflexionar
INSERT INTO inspirational_content (content_type, content, category) VALUES
('word', 'Serendipia: hallazgo valioso que se produce de manera accidental.', 'vocabulario'),
('word', 'Resiliencia: capacidad de adaptarse a situaciones adversas.', 'vocabulario'),
('word', 'Ikigai: razón de ser, aquello que da sentido a la vida.', 'vocabulario'),
('word', 'Kaizen: mejora continua mediante pequeños cambios.', 'vocabulario'),
('word', 'Ubuntu: "Soy porque somos" - filosofía africana de comunidad.', 'vocabulario'),
('word', 'Hygge: sensación de comodidad y bienestar que produce la simplicidad.', 'vocabulario'),
('word', 'Wabi-sabi: encontrar belleza en la imperfección.', 'vocabulario'),
('word', 'Saudade: nostalgia melancólica por algo o alguien ausente.', 'vocabulario'),
('word', 'Meraki: poner alma y creatividad en lo que haces.', 'vocabulario'),
('word', 'Ataraxia: estado de ánimo sereno y equilibrado.', 'vocabulario');

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT 'daily_journal' as tabla, COUNT(*) as registros FROM daily_journal
UNION ALL
SELECT 'inspirational_content', COUNT(*) FROM inspirational_content;

-- =====================================================
-- ¡LISTO! Ejecuta este script en Supabase SQL Editor
-- =====================================================
