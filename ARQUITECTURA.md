# 🏗️ ARQUITECTURA TÉCNICA - Knowledge Base AI

Este documento describe la arquitectura completa del sistema, decisiones técnicas y patrones de diseño.

---

## 📊 VISIÓN GENERAL DE LA ARQUITECTURA

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CLIENTE (Browser)                               │
│                         Next.js 14 + React 18                            │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 │ HTTPS
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                  │
│                          FastAPI (Python 3.11+)                          │
│                                                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │   Auth     │ │  Content   │ │   Search   │ │    Chat    │           │
│  │  Router    │ │   Router   │ │   Router   │ │   Router   │           │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘           │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│    SERVICES     │   │   BACKGROUND    │   │    EXTERNAL     │
│                 │   │     JOBS        │   │     APIs        │
│ - Fetcher       │   │                 │   │                 │
│ - Classifier    │   │ - Celery Worker │   │ - Claude API    │
│ - Summarizer    │   │ - Redis Queue   │   │ - OpenAI API    │
│ - Embedder      │   │                 │   │ - YouTube       │
│ - RAG           │   │                 │   │ - TikTok        │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └───────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE                                        │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ PostgreSQL  │  │   Auth      │  │   Storage   │  │  Realtime   │    │
│  │ + pgvector  │  │  (JWT)      │  │  (Files)    │  │  (WebSocket)│    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 PRINCIPIOS DE ARQUITECTURA

### 1. **Separación de Responsabilidades**
- Frontend: Solo UI/UX, sin lógica de negocio
- Backend: API REST, toda la lógica de negocio
- Database: Persistencia y búsqueda

### 2. **Escalabilidad**
- Servicios desacoplados
- Background jobs para operaciones lentas
- Caché estratégico

### 3. **Seguridad**
- Autenticación centralizada (Supabase Auth)
- Row Level Security (RLS)
- API keys seguras (server-side)

### 4. **Mantenibilidad**
- Código tipado (TypeScript + Python type hints)
- Documentación en código
- Tests automatizados

---

## 🔵 FRONTEND - Next.js 14

### Estructura de Carpetas

```
frontend/
├── src/
│   ├── app/                    # App Router (Next.js 14)
│   │   ├── (auth)/            # Grupo de rutas de auth
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/       # Grupo de rutas protegidas
│   │   │   ├── dashboard/
│   │   │   ├── content/
│   │   │   ├── search/
│   │   │   └── chat/
│   │   ├── layout.tsx         # Layout principal
│   │   ├── page.tsx           # Landing page
│   │   └── globals.css
│   │
│   ├── components/            # Componentes React
│   │   ├── ui/               # Componentes base (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── layout/           # Componentes de layout
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── footer.tsx
│   │   ├── content/          # Componentes de contenido
│   │   │   ├── content-card.tsx
│   │   │   ├── content-list.tsx
│   │   │   ├── content-detail.tsx
│   │   │   └── add-content-form.tsx
│   │   ├── search/           # Componentes de búsqueda
│   │   │   ├── search-bar.tsx
│   │   │   ├── filters.tsx
│   │   │   └── results.tsx
│   │   └── chat/             # Componentes de chat
│   │       ├── chat-interface.tsx
│   │       ├── message.tsx
│   │       └── chat-input.tsx
│   │
│   ├── lib/                  # Utilidades y servicios
│   │   ├── supabase.ts       # Cliente Supabase
│   │   ├── api.ts            # Cliente API
│   │   ├── utils.ts          # Utilidades generales
│   │   └── validations.ts    # Validaciones Zod
│   │
│   ├── hooks/                # Custom hooks
│   │   ├── use-auth.ts
│   │   ├── use-contents.ts
│   │   └── use-search.ts
│   │
│   ├── stores/               # Zustand stores
│   │   ├── auth-store.ts
│   │   └── ui-store.ts
│   │
│   └── types/                # TypeScript types
│       ├── content.ts
│       ├── user.ts
│       └── api.ts
│
├── public/                   # Archivos estáticos
├── tailwind.config.ts
├── next.config.js
└── package.json
```

### Patrones y Tecnologías

| Aspecto | Tecnología | Uso |
|---------|------------|-----|
| Framework | Next.js 14 | App Router, Server Components |
| UI Components | shadcn/ui | Componentes accesibles y personalizables |
| Styling | Tailwind CSS | Utility-first CSS |
| State Management | Zustand | Estado global ligero |
| Data Fetching | React Query | Cache y sincronización |
| Forms | React Hook Form | Formularios con validación |
| Validación | Zod | Schema validation |
| Icons | Lucide React | Iconos SVG |

### Flujo de Datos

```
User Action → Component → Hook → API Client → Backend
                                      ↓
Cache (React Query) ← Response ← API Response
```

---

## 🟢 BACKEND - FastAPI

### Estructura de Carpetas

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py               # Entry point FastAPI
│   │
│   ├── api/                  # Endpoints
│   │   ├── __init__.py
│   │   ├── deps.py           # Dependencias comunes
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── auth.py       # Endpoints de auth
│   │       ├── content.py    # CRUD de contenido
│   │       ├── search.py     # Búsqueda
│   │       └── chat.py       # Chat RAG
│   │
│   ├── core/                 # Configuración core
│   │   ├── __init__.py
│   │   ├── config.py         # Settings
│   │   ├── security.py       # JWT y auth
│   │   └── exceptions.py     # Excepciones custom
│   │
│   ├── models/               # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── content.py
│   │   ├── user.py
│   │   └── chat.py
│   │
│   ├── schemas/              # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── content.py
│   │   ├── user.py
│   │   ├── search.py
│   │   ├── chat.py
│   │   ├── schema_org_types.json
│   │   └── iab_taxonomy.json
│   │
│   ├── services/             # Lógica de negocio
│   │   ├── __init__.py
│   │   ├── fetcher.py        # Fetch contenido web
│   │   ├── classifier.py     # Clasificación con Claude
│   │   ├── summarizer.py     # Resúmenes con Claude
│   │   ├── embedder.py       # Embeddings OpenAI
│   │   ├── search.py         # Búsqueda semántica
│   │   └── rag.py            # RAG/Chat service
│   │
│   ├── db/                   # Database
│   │   ├── __init__.py
│   │   ├── session.py        # Database session
│   │   └── base.py           # Base model
│   │
│   └── workers/              # Background jobs
│       ├── __init__.py
│       ├── celery_app.py     # Configuración Celery
│       └── tasks.py          # Tareas asíncronas
│
├── alembic/                  # Migraciones
│   ├── versions/
│   └── alembic.ini
│
├── tests/                    # Tests
│   ├── conftest.py
│   ├── test_api/
│   └── test_services/
│
├── requirements.txt
├── Dockerfile
└── .env.example
```

### Servicios Principales

#### 1. FetcherService
```python
# Responsabilidad: Extraer contenido de URLs
class FetcherService:
    async def fetch(url: str) -> FetchResult:
        # 1. Detectar tipo (web, youtube, tiktok, twitter)
        # 2. Usar estrategia apropiada
        # 3. Extraer contenido y metadata
        # 4. Retornar FetchResult
```

#### 2. ClassifierService
```python
# Responsabilidad: Clasificar contenido usando Claude
class ClassifierService:
    async def classify(content: str) -> Classification:
        # 1. Llamar Claude con prompt estructurado
        # 2. Parsear respuesta JSON
        # 3. Validar contra taxonomías
        # 4. Retornar Classification
```

#### 3. SummarizerService
```python
# Responsabilidad: Generar resúmenes con Claude
class SummarizerService:
    async def summarize(content: str, max_length: int) -> str:
        # 1. Preparar prompt
        # 2. Llamar Claude
        # 3. Post-procesar respuesta
        # 4. Retornar resumen
```

#### 4. EmbedderService
```python
# Responsabilidad: Generar embeddings con OpenAI
class EmbedderService:
    async def embed(text: str) -> List[float]:
        # 1. Truncar si excede límite
        # 2. Llamar OpenAI embeddings API
        # 3. Retornar vector 1536d
```

#### 5. RAGService
```python
# Responsabilidad: Retrieval Augmented Generation
class RAGService:
    async def chat(query: str, user_id: str) -> ChatResponse:
        # 1. Generar embedding de query
        # 2. Buscar documentos relevantes (pgvector)
        # 3. Construir contexto
        # 4. Llamar Claude con contexto + query
        # 5. Retornar respuesta con fuentes
```

### Patrón de Endpoints

```python
# Patrón estándar para endpoints
@router.post("/content", response_model=ContentResponse)
async def create_content(
    content: ContentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Crear nuevo contenido."""
    # 1. Validar input (automático con Pydantic)
    # 2. Ejecutar lógica de negocio
    # 3. Retornar respuesta tipada
```

---

## 🗄️ BASE DE DATOS - Supabase

### Modelo de Datos Principal

```sql
-- Tabla principal de contenidos
CREATE TABLE contents (
    -- Identificadores
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL UNIQUE,

    -- Tipo de contenido
    type VARCHAR(50),  -- 'web', 'youtube', 'tiktok', 'twitter'

    -- Clasificación Schema.org
    schema_type VARCHAR(100),     -- 'Article', 'VideoObject', etc.
    schema_subtype VARCHAR(100),  -- 'NewsArticle', 'TechArticle', etc.

    -- Clasificación IAB
    iab_tier1 VARCHAR(100),       -- 'Technology & Computing'
    iab_tier2 VARCHAR(200),       -- 'Artificial Intelligence'
    iab_tier3 VARCHAR(200),       -- 'Machine Learning'

    -- Contenido
    title TEXT NOT NULL,
    summary TEXT,
    raw_content TEXT,

    -- Clasificación avanzada
    concepts TEXT[],              -- ['AI', 'Machine Learning', 'NLP']
    entities JSONB,               -- {persons: [], orgs: [], places: []}

    -- Metadata
    language VARCHAR(10),         -- 'es', 'en', etc.
    sentiment VARCHAR(20),        -- 'positive', 'negative', 'neutral'
    technical_level VARCHAR(20),  -- 'beginner', 'intermediate', 'advanced'
    content_format VARCHAR(50),   -- 'tutorial', 'news', 'opinion', 'review'
    reading_time INTEGER,         -- Minutos estimados

    -- Tags de usuario
    user_tags TEXT[],
    is_favorite BOOLEAN DEFAULT FALSE,

    -- Embedding para búsqueda semántica
    embedding vector(1536),

    -- Metadata adicional (flexible)
    metadata JSONB,               -- Información específica del tipo

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    fetched_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT valid_type CHECK (type IN ('web', 'youtube', 'tiktok', 'twitter'))
);

-- Tabla de sesiones de chat
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de mensajes de chat
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,    -- 'user', 'assistant'
    content TEXT NOT NULL,
    sources JSONB,                -- [{content_id, title, relevance}]
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de procesamiento (queue)
CREATE TABLE processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    step VARCHAR(50),             -- 'fetch', 'summarize', 'classify', 'embed'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Índices para Performance

```sql
-- Índices básicos
CREATE INDEX idx_contents_user_id ON contents(user_id);
CREATE INDEX idx_contents_type ON contents(type);
CREATE INDEX idx_contents_schema_type ON contents(schema_type);
CREATE INDEX idx_contents_iab_tier1 ON contents(iab_tier1);
CREATE INDEX idx_contents_created_at ON contents(created_at DESC);

-- Índices GIN para arrays y JSONB
CREATE INDEX idx_contents_concepts ON contents USING GIN(concepts);
CREATE INDEX idx_contents_entities ON contents USING GIN(entities);
CREATE INDEX idx_contents_user_tags ON contents USING GIN(user_tags);

-- Índice para búsqueda de texto completo
CREATE INDEX idx_contents_fts ON contents USING GIN(
    to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(summary, ''))
);

-- Índice para búsqueda vectorial (pgvector)
CREATE INDEX idx_contents_embedding ON contents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

### Row Level Security (RLS)

```sql
-- Habilitar RLS
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para contents
CREATE POLICY "Users can view own contents"
    ON contents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contents"
    ON contents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contents"
    ON contents FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contents"
    ON contents FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas similares para chat_sessions y chat_messages
```

---

## 🤖 SERVICIOS DE IA

### Claude API (Anthropic)

**Usos:**
1. Generación de resúmenes
2. Clasificación de contenido
3. Extracción de entidades (NER)
4. Chat RAG (respuestas)

**Modelo:** Claude 3.5 Sonnet (claude-sonnet-4-20250514)

**Ejemplo de prompt para clasificación:**
```json
{
  "role": "user",
  "content": "Clasifica el siguiente contenido según:\n
    1. Schema.org type (Article, VideoObject, etc.)\n
    2. IAB Content Taxonomy tier 1, 2, 3\n
    3. Conceptos principales (3-7)\n
    4. Entidades (personas, organizaciones, lugares)\n
    5. Metadata (idioma, sentimiento, nivel técnico)\n
    \n
    Responde SOLO en JSON válido.\n
    \n
    CONTENIDO:\n
    {content}"
}
```

### OpenAI Embeddings

**Modelo:** text-embedding-3-small
**Dimensiones:** 1536
**Max tokens:** 8191

**Uso:**
- Generar embedding de contenido al guardar
- Generar embedding de query para búsqueda

---

## 🔄 FLUJOS DE DATOS

### Flujo: Guardar Contenido

```
1. Usuario pega URL en frontend
2. Frontend → POST /api/v1/content
3. Backend valida URL
4. Si es largo → Crear job en queue, responder con status "processing"
5. Si es corto → Procesar sincrónicamente
6. Worker/Service ejecuta:
   a. Fetch contenido (FetcherService)
   b. Generar resumen (SummarizerService)
   c. Clasificar (ClassifierService)
   d. Generar embedding (EmbedderService)
   e. Guardar en DB
7. Notificar a frontend (WebSocket/polling)
8. Frontend actualiza UI
```

### Flujo: Búsqueda Semántica

```
1. Usuario escribe query
2. Frontend → GET /api/v1/search?q=...&semantic=true
3. Backend:
   a. Generar embedding de query (EmbedderService)
   b. Buscar en pgvector (similarity search)
   c. Opcionalmente combinar con full-text search
   d. Retornar resultados ordenados
4. Frontend muestra resultados con relevance score
```

### Flujo: Chat RAG

```
1. Usuario envía mensaje
2. Frontend → POST /api/v1/chat
3. Backend (RAGService):
   a. Generar embedding del mensaje
   b. Buscar contenido relevante (top-K)
   c. Construir contexto con fuentes
   d. Llamar Claude con contexto + historial + query
   e. Parsear respuesta y extraer citaciones
   f. Guardar en chat_messages
   g. Retornar respuesta con fuentes
4. Frontend muestra respuesta con links a fuentes
```

---

## 🚀 DEPLOYMENT

### Frontend (Vercel)

```yaml
# vercel.json
{
  "framework": "nextjs",
  "regions": ["cdg1"],  # Europe (Paris)
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key",
    "NEXT_PUBLIC_API_URL": "@api_url"
  }
}
```

### Backend (Railway/Render)

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Instalar Playwright browsers
RUN playwright install chromium

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Supabase

- Proyecto production separado de development
- Backups diarios automáticos
- pgvector habilitado
- RLS policies activas

---

## 📊 ESTIMACIÓN DE COSTOS

### APIs (por 1000 items/mes)

| Servicio | Operación | Costo estimado |
|----------|-----------|----------------|
| Claude API | Resúmenes | ~$5-8 |
| Claude API | Clasificación | ~$2-3 |
| Claude API | Chat (RAG) | ~$3-5 |
| OpenAI | Embeddings | ~$2-3 |
| **Total APIs** | | **$12-20/mes** |

### Infraestructura

| Servicio | Tier | Costo |
|----------|------|-------|
| Supabase | Free/Pro | $0-25/mes |
| Vercel | Free/Pro | $0-20/mes |
| Railway | Starter | $5-10/mes |
| Redis (opcional) | - | $0-10/mes |
| **Total Infra** | | **$5-65/mes** |

### Total Estimado

- **Desarrollo:** $15-30/mes
- **Producción ligera:** $30-50/mes
- **Producción activa:** $50-100/mes

---

## 🔒 SEGURIDAD

### Autenticación
- Supabase Auth (JWT)
- Tokens con expiración
- Refresh tokens seguros

### Autorización
- Row Level Security en todas las tablas
- Verificación de user_id en cada request
- API keys solo en server-side

### Datos
- HTTPS en todas las comunicaciones
- Encriptación en reposo (Supabase)
- No almacenar datos sensibles innecesarios

### API Keys
- Nunca exponer en frontend
- Variables de entorno
- Rotación periódica

---

## 📚 REFERENCIAS

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Claude API Documentation](https://docs.anthropic.com/)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [pgvector GitHub](https://github.com/pgvector/pgvector)

---

**Última actualización:** Diciembre 2024
**Versión:** 1.0
