-- =====================================================
-- KNOWLEDGE BASE AI - Supabase Database Setup
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor:
-- 1. Ve a https://supabase.com/dashboard
-- 2. Selecciona tu proyecto
-- 3. SQL Editor → New Query
-- 4. Pega todo este contenido y ejecuta (Run)
-- =====================================================

-- =====================================================
-- PASO 1: Habilitar extensiones
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- PASO 2: Tabla principal - contents
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contents (
    -- Identificadores
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- URL y tipo
    url TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'web',

    -- Clasificación Schema.org
    schema_type VARCHAR(100),
    schema_subtype VARCHAR(100),

    -- Clasificación IAB Content Taxonomy
    iab_tier1 VARCHAR(100),
    iab_tier2 VARCHAR(200),
    iab_tier3 VARCHAR(200),

    -- Contenido
    title TEXT NOT NULL,
    summary TEXT,
    raw_content TEXT,

    -- Clasificación avanzada
    concepts TEXT[] DEFAULT '{}',
    entities JSONB DEFAULT '{}',

    -- Metadata del contenido
    language VARCHAR(10) DEFAULT 'es',
    sentiment VARCHAR(20),
    technical_level VARCHAR(30),
    content_format VARCHAR(50),
    reading_time_minutes INTEGER,

    -- Tags del usuario
    user_tags TEXT[] DEFAULT '{}',
    is_favorite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,

    -- Embedding para búsqueda semántica (1536 dimensiones - OpenAI)
    embedding vector(1536),

    -- Metadata adicional
    metadata JSONB DEFAULT '{}',
    source_metadata JSONB DEFAULT '{}',

    -- Estado de procesamiento
    processing_status VARCHAR(20) DEFAULT 'pending',
    processing_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    fetched_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT valid_type CHECK (type IN ('web', 'youtube', 'tiktok', 'twitter', 'pdf', 'note', 'docx', 'email', 'audio')),
    CONSTRAINT valid_status CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT unique_user_url UNIQUE (user_id, url)
);

-- =====================================================
-- PASO 3: Tabla - chat_sessions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    title TEXT,
    description TEXT,

    settings JSONB DEFAULT '{
        "model": "claude-sonnet-4-20250514",
        "max_sources": 5,
        "temperature": 0.7
    }',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);

-- =====================================================
-- PASO 4: Tabla - chat_messages
-- =====================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,

    sources JSONB DEFAULT '[]',
    tokens_used INTEGER,
    model_used VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'system'))
);

-- =====================================================
-- PASO 5: Tabla - processing_queue
-- =====================================================
CREATE TABLE IF NOT EXISTS public.processing_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    status VARCHAR(20) DEFAULT 'pending',
    current_step VARCHAR(50),
    progress INTEGER DEFAULT 0,

    steps_completed JSONB DEFAULT '{}',

    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    priority INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    CONSTRAINT valid_queue_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

-- =====================================================
-- PASO 6: Tabla - user_preferences
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    theme VARCHAR(20) DEFAULT 'system',
    language VARCHAR(10) DEFAULT 'es',
    items_per_page INTEGER DEFAULT 20,
    default_view VARCHAR(20) DEFAULT 'grid',

    auto_classify BOOLEAN DEFAULT TRUE,
    auto_summarize BOOLEAN DEFAULT TRUE,
    default_tags TEXT[] DEFAULT '{}',

    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_digest VARCHAR(20) DEFAULT 'weekly',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PASO 7: Tabla - saved_searches
-- =====================================================
CREATE TABLE IF NOT EXISTS public.saved_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    description TEXT,

    query TEXT,
    filters JSONB DEFAULT '{}',

    is_pinned BOOLEAN DEFAULT FALSE,
    use_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PASO 8: Índices básicos
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_contents_user_id ON contents(user_id);
CREATE INDEX IF NOT EXISTS idx_contents_type ON contents(type);
CREATE INDEX IF NOT EXISTS idx_contents_created_at ON contents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contents_schema_type ON contents(schema_type);
CREATE INDEX IF NOT EXISTS idx_contents_iab_tier1 ON contents(iab_tier1);
CREATE INDEX IF NOT EXISTS idx_contents_processing_status ON contents(processing_status);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_user_id ON processing_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_content_id ON processing_queue(content_id);

-- =====================================================
-- PASO 9: Índices GIN para arrays y JSONB
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_contents_concepts ON contents USING GIN(concepts);
CREATE INDEX IF NOT EXISTS idx_contents_user_tags ON contents USING GIN(user_tags);
CREATE INDEX IF NOT EXISTS idx_contents_entities ON contents USING GIN(entities);

-- =====================================================
-- PASO 10: Habilitar Row Level Security
-- =====================================================
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 11: Políticas RLS para contents
-- =====================================================
DROP POLICY IF EXISTS "Users can view own contents" ON contents;
CREATE POLICY "Users can view own contents"
    ON contents FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own contents" ON contents;
CREATE POLICY "Users can insert own contents"
    ON contents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own contents" ON contents;
CREATE POLICY "Users can update own contents"
    ON contents FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own contents" ON contents;
CREATE POLICY "Users can delete own contents"
    ON contents FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- PASO 12: Políticas RLS para chat_sessions
-- =====================================================
DROP POLICY IF EXISTS "Users can manage own chat sessions" ON chat_sessions;
CREATE POLICY "Users can manage own chat sessions"
    ON chat_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- PASO 13: Políticas RLS para chat_messages
-- =====================================================
DROP POLICY IF EXISTS "Users can view messages from own sessions" ON chat_messages;
CREATE POLICY "Users can view messages from own sessions"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert messages to own sessions" ON chat_messages;
CREATE POLICY "Users can insert messages to own sessions"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- =====================================================
-- PASO 14: Políticas RLS para otras tablas
-- =====================================================
DROP POLICY IF EXISTS "Users can manage own processing queue" ON processing_queue;
CREATE POLICY "Users can manage own processing queue"
    ON processing_queue FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
CREATE POLICY "Users can manage own preferences"
    ON user_preferences FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own saved searches" ON saved_searches;
CREATE POLICY "Users can manage own saved searches"
    ON saved_searches FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- PASO 15: Función updated_at automático
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_contents_updated_at ON contents;
CREATE TRIGGER update_contents_updated_at
    BEFORE UPDATE ON contents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_processing_queue_updated_at ON processing_queue;
CREATE TRIGGER update_processing_queue_updated_at
    BEFORE UPDATE ON processing_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PASO 16: Función búsqueda semántica
-- =====================================================
CREATE OR REPLACE FUNCTION search_contents_semantic(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    summary text,
    type varchar,
    url text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.title,
        c.summary,
        c.type,
        c.url,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM contents c
    WHERE
        c.embedding IS NOT NULL
        AND (p_user_id IS NULL OR c.user_id = p_user_id)
        AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Verificar que las tablas se crearon correctamente
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('contents', 'chat_sessions', 'chat_messages', 'processing_queue', 'user_preferences', 'saved_searches');

-- =====================================================
-- ¡LISTO! Base de datos configurada correctamente
-- =====================================================
