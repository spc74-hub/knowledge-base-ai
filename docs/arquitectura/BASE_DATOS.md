# 🗄️ BASE DE DATOS - Diseño y Esquema

Este documento detalla el diseño de la base de datos para Knowledge Base AI.

---

## 📊 DIAGRAMA ENTIDAD-RELACIÓN

```
┌───────────────────┐       ┌───────────────────┐
│    auth.users     │       │     contents      │
│   (Supabase)      │       │                   │
├───────────────────┤       ├───────────────────┤
│ id (UUID) PK      │◄──────│ user_id FK        │
│ email             │       │ id (UUID) PK      │
│ created_at        │       │ url               │
│ ...               │       │ type              │
└───────────────────┘       │ schema_type       │
         │                  │ iab_tier1/2/3     │
         │                  │ title             │
         │                  │ summary           │
         │                  │ raw_content       │
         │                  │ concepts[]        │
         │                  │ entities{}        │
         │                  │ embedding         │
         │                  │ user_tags[]       │
         │                  │ metadata{}        │
         │                  │ created_at        │
         │                  └───────────────────┘
         │                           │
         │                           │
         ▼                           │
┌───────────────────┐                │
│  chat_sessions    │                │
├───────────────────┤                │
│ id (UUID) PK      │                │
│ user_id FK        │                │
│ title             │                │
│ created_at        │                │
└───────────────────┘                │
         │                           │
         │                           │
         ▼                           │
┌───────────────────┐                │
│  chat_messages    │                │
├───────────────────┤                │
│ id (UUID) PK      │                │
│ session_id FK     │                │
│ role              │                │
│ content           │                │
│ sources{}─────────┼────────────────┘
│ created_at        │  (referencia a contents)
└───────────────────┘

┌───────────────────┐
│ processing_queue  │
├───────────────────┤
│ id (UUID) PK      │
│ content_id FK     │
│ user_id FK        │
│ status            │
│ step              │
│ error_message     │
│ created_at        │
└───────────────────┘
```

---

## 📋 ESQUEMAS SQL COMPLETOS

### 1. Extensiones Necesarias

```sql
-- Habilitar extensiones en Supabase
-- Dashboard → Database → Extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUIDs
CREATE EXTENSION IF NOT EXISTS "vector";          -- pgvector para embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- Búsqueda fuzzy
```

### 2. Tabla Principal: `contents`

```sql
-- Tabla principal de contenidos
CREATE TABLE public.contents (
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

    -- Embedding para búsqueda semántica (1536 dimensiones)
    embedding vector(1536),

    -- Metadata adicional (flexible)
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
    CONSTRAINT valid_type CHECK (type IN ('web', 'youtube', 'tiktok', 'twitter', 'pdf', 'note')),
    CONSTRAINT valid_status CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT unique_user_url UNIQUE (user_id, url)
);

-- Comentarios
COMMENT ON TABLE public.contents IS 'Tabla principal de contenidos del knowledge base';
COMMENT ON COLUMN public.contents.embedding IS 'Vector embedding de 1536 dimensiones (OpenAI text-embedding-3-small)';
COMMENT ON COLUMN public.contents.entities IS 'Entidades extraídas: {persons: [], organizations: [], places: [], products: []}';
```

### 3. Tabla: `chat_sessions`

```sql
-- Sesiones de chat RAG
CREATE TABLE public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    title TEXT,
    description TEXT,

    -- Configuración de la sesión
    settings JSONB DEFAULT '{
        "model": "claude-sonnet-4-20250514",
        "max_sources": 5,
        "temperature": 0.7
    }',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);

COMMENT ON TABLE public.chat_sessions IS 'Sesiones de chat con el knowledge base (RAG)';
```

### 4. Tabla: `chat_messages`

```sql
-- Mensajes de chat
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,

    -- Fuentes citadas (para respuestas del asistente)
    sources JSONB DEFAULT '[]',
    -- Formato: [{content_id, title, relevance_score, snippet}]

    -- Metadata del mensaje
    tokens_used INTEGER,
    model_used VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'system'))
);

COMMENT ON TABLE public.chat_messages IS 'Mensajes individuales de chat';
COMMENT ON COLUMN public.chat_messages.sources IS 'Array de fuentes citadas: [{content_id, title, relevance_score, snippet}]';
```

### 5. Tabla: `processing_queue`

```sql
-- Cola de procesamiento
CREATE TABLE public.processing_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Estado
    status VARCHAR(20) DEFAULT 'pending',
    current_step VARCHAR(50),
    progress INTEGER DEFAULT 0,

    -- Pasos completados
    steps_completed JSONB DEFAULT '{}',
    -- Formato: {fetch: true, summarize: true, classify: false, embed: false}

    -- Errores
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Prioridad
    priority INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    CONSTRAINT valid_queue_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

COMMENT ON TABLE public.processing_queue IS 'Cola de trabajos de procesamiento asíncrono';
```

### 6. Tabla: `user_preferences`

```sql
-- Preferencias del usuario
CREATE TABLE public.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- Preferencias de UI
    theme VARCHAR(20) DEFAULT 'system',
    language VARCHAR(10) DEFAULT 'es',
    items_per_page INTEGER DEFAULT 20,
    default_view VARCHAR(20) DEFAULT 'grid',

    -- Preferencias de clasificación
    auto_classify BOOLEAN DEFAULT TRUE,
    auto_summarize BOOLEAN DEFAULT TRUE,
    default_tags TEXT[] DEFAULT '{}',

    -- Notificaciones
    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_digest VARCHAR(20) DEFAULT 'weekly',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.user_preferences IS 'Preferencias personalizadas del usuario';
```

### 7. Tabla: `saved_searches`

```sql
-- Búsquedas guardadas
CREATE TABLE public.saved_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    description TEXT,

    -- Query y filtros
    query TEXT,
    filters JSONB DEFAULT '{}',
    -- Formato: {types: [], categories: [], tags: [], date_range: {}}

    is_pinned BOOLEAN DEFAULT FALSE,
    use_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.saved_searches IS 'Búsquedas guardadas por el usuario';
```

---

## 📈 ÍNDICES

### Índices Básicos

```sql
-- Índices de foreign keys
CREATE INDEX idx_contents_user_id ON contents(user_id);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_processing_queue_user_id ON processing_queue(user_id);
CREATE INDEX idx_processing_queue_content_id ON processing_queue(content_id);

-- Índices de ordenación
CREATE INDEX idx_contents_created_at ON contents(created_at DESC);
CREATE INDEX idx_contents_updated_at ON contents(updated_at DESC);
CREATE INDEX idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
```

### Índices de Filtrado

```sql
-- Índices para filtros comunes
CREATE INDEX idx_contents_type ON contents(type);
CREATE INDEX idx_contents_schema_type ON contents(schema_type);
CREATE INDEX idx_contents_iab_tier1 ON contents(iab_tier1);
CREATE INDEX idx_contents_language ON contents(language);
CREATE INDEX idx_contents_is_favorite ON contents(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_contents_is_archived ON contents(is_archived) WHERE is_archived = FALSE;
CREATE INDEX idx_contents_processing_status ON contents(processing_status);

-- Índice compuesto para queries comunes
CREATE INDEX idx_contents_user_type_created ON contents(user_id, type, created_at DESC);
```

### Índices GIN (Arrays y JSONB)

```sql
-- Índices para arrays
CREATE INDEX idx_contents_concepts ON contents USING GIN(concepts);
CREATE INDEX idx_contents_user_tags ON contents USING GIN(user_tags);

-- Índices para JSONB
CREATE INDEX idx_contents_entities ON contents USING GIN(entities);
CREATE INDEX idx_contents_metadata ON contents USING GIN(metadata);

-- Índice para entities específicas
CREATE INDEX idx_contents_entities_persons ON contents USING GIN((entities->'persons'));
CREATE INDEX idx_contents_entities_orgs ON contents USING GIN((entities->'organizations'));
```

### Índice Full-Text Search

```sql
-- Crear columna tsvector para búsqueda
ALTER TABLE contents ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Función para actualizar search_vector
CREATE OR REPLACE FUNCTION contents_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('spanish', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('spanish', coalesce(NEW.summary, '')), 'B') ||
        setweight(to_tsvector('spanish', coalesce(array_to_string(NEW.concepts, ' '), '')), 'C') ||
        setweight(to_tsvector('spanish', coalesce(array_to_string(NEW.user_tags, ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar automáticamente
CREATE TRIGGER contents_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title, summary, concepts, user_tags
    ON contents
    FOR EACH ROW
    EXECUTE FUNCTION contents_search_vector_update();

-- Índice GIN para búsqueda
CREATE INDEX idx_contents_search_vector ON contents USING GIN(search_vector);
```

### Índice Vector (pgvector)

```sql
-- Índice IVFFlat para búsqueda aproximada (más rápida)
CREATE INDEX idx_contents_embedding_ivfflat ON contents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Alternativa: Índice HNSW (más preciso pero más lento de construir)
-- CREATE INDEX idx_contents_embedding_hnsw ON contents
--     USING hnsw (embedding vector_cosine_ops)
--     WITH (m = 16, ef_construction = 64);
```

---

## 🔐 ROW LEVEL SECURITY (RLS)

### Habilitar RLS

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
```

### Políticas para `contents`

```sql
-- SELECT: usuarios ven solo sus contenidos
CREATE POLICY "Users can view own contents"
    ON contents FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: usuarios solo insertan con su user_id
CREATE POLICY "Users can insert own contents"
    ON contents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: usuarios solo actualizan sus contenidos
CREATE POLICY "Users can update own contents"
    ON contents FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: usuarios solo eliminan sus contenidos
CREATE POLICY "Users can delete own contents"
    ON contents FOR DELETE
    USING (auth.uid() = user_id);
```

### Políticas para `chat_sessions`

```sql
CREATE POLICY "Users can manage own chat sessions"
    ON chat_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

### Políticas para `chat_messages`

```sql
-- Los usuarios pueden ver mensajes de sus sesiones
CREATE POLICY "Users can view messages from own sessions"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- Los usuarios pueden insertar mensajes en sus sesiones
CREATE POLICY "Users can insert messages to own sessions"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
    );
```

---

## 🔧 FUNCIONES Y TRIGGERS

### Auto-update `updated_at`

```sql
-- Función genérica para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas
CREATE TRIGGER update_contents_updated_at
    BEFORE UPDATE ON contents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_queue_updated_at
    BEFORE UPDATE ON processing_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Función: Búsqueda Semántica

```sql
-- Función para búsqueda semántica
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
```

### Función: Búsqueda Híbrida

```sql
-- Función para búsqueda híbrida (texto + semántica)
CREATE OR REPLACE FUNCTION search_contents_hybrid(
    search_query text,
    query_embedding vector(1536),
    p_user_id uuid,
    semantic_weight float DEFAULT 0.5,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    title text,
    summary text,
    type varchar,
    url text,
    combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH text_search AS (
        SELECT
            c.id,
            ts_rank(c.search_vector, plainto_tsquery('spanish', search_query)) AS text_score
        FROM contents c
        WHERE
            c.user_id = p_user_id
            AND c.search_vector @@ plainto_tsquery('spanish', search_query)
    ),
    semantic_search AS (
        SELECT
            c.id,
            1 - (c.embedding <=> query_embedding) AS semantic_score
        FROM contents c
        WHERE
            c.user_id = p_user_id
            AND c.embedding IS NOT NULL
    )
    SELECT
        c.id,
        c.title,
        c.summary,
        c.type,
        c.url,
        (
            COALESCE(ts.text_score, 0) * (1 - semantic_weight) +
            COALESCE(ss.semantic_score, 0) * semantic_weight
        ) AS combined_score
    FROM contents c
    LEFT JOIN text_search ts ON c.id = ts.id
    LEFT JOIN semantic_search ss ON c.id = ss.id
    WHERE
        c.user_id = p_user_id
        AND (ts.id IS NOT NULL OR ss.id IS NOT NULL)
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;
```

---

## 📊 QUERIES COMUNES

### Obtener contenidos con filtros

```sql
-- Query parametrizada para dashboard
SELECT
    id, title, summary, type, schema_type, iab_tier1,
    concepts, user_tags, is_favorite, created_at
FROM contents
WHERE
    user_id = $1
    AND ($2::varchar IS NULL OR type = $2)
    AND ($3::varchar IS NULL OR iab_tier1 = $3)
    AND ($4::text[] IS NULL OR user_tags && $4)
    AND is_archived = FALSE
ORDER BY
    CASE WHEN $5 = 'created_at' THEN created_at END DESC,
    CASE WHEN $5 = 'title' THEN title END ASC
LIMIT $6 OFFSET $7;
```

### Estadísticas del usuario

```sql
-- Dashboard stats
SELECT
    COUNT(*) as total_contents,
    COUNT(*) FILTER (WHERE type = 'web') as web_count,
    COUNT(*) FILTER (WHERE type = 'youtube') as youtube_count,
    COUNT(*) FILTER (WHERE type = 'tiktok') as tiktok_count,
    COUNT(*) FILTER (WHERE type = 'twitter') as twitter_count,
    COUNT(*) FILTER (WHERE is_favorite) as favorites_count,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent_count
FROM contents
WHERE user_id = $1 AND is_archived = FALSE;
```

### Top categorías

```sql
-- Top IAB categories
SELECT
    iab_tier1,
    COUNT(*) as count
FROM contents
WHERE user_id = $1 AND iab_tier1 IS NOT NULL
GROUP BY iab_tier1
ORDER BY count DESC
LIMIT 10;
```

---

## 🚀 MIGRACIONES (Alembic)

### Estructura de migraciones

```
alembic/
├── versions/
│   ├── 001_initial_schema.py
│   ├── 002_add_search_vector.py
│   ├── 003_add_pgvector_index.py
│   └── ...
├── env.py
└── alembic.ini
```

### Ejemplo de migración

```python
# alembic/versions/001_initial_schema.py
"""Initial schema

Revision ID: 001
Create Date: 2024-12-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision = '001'
down_revision = None

def upgrade():
    # Crear extensiones
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    # Crear tabla contents
    op.create_table(
        'contents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False, default='web'),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('summary', sa.Text()),
        sa.Column('embedding', Vector(1536)),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()')),
        # ... más columnas
    )

def downgrade():
    op.drop_table('contents')
```

---

## 💾 BACKUP Y RECUPERACIÓN

### Backup automático (Supabase)

Supabase incluye backups diarios automáticos en planes Pro.

### Backup manual

```bash
# Export con pg_dump
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup.sql

# Restaurar
psql -h db.xxxxx.supabase.co -U postgres -d postgres < backup.sql
```

---

**Última actualización:** Diciembre 2024
