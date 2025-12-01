# 🏗️ SISTEMA COMPLETO - Arquitectura Detallada

Este documento profundiza en cada componente del sistema Knowledge Base AI.

---

## 📊 COMPONENTES DEL SISTEMA

### 1. Frontend Layer

```
┌──────────────────────────────────────────────────────────────┐
│                      NEXT.JS 14 APPLICATION                   │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Pages     │  │ Components  │  │   Hooks     │         │
│  │  (App Dir)  │  │  (UI/Logic) │  │ (State)     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────┐          │
│  │              CLIENT STATE                      │          │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐    │          │
│  │  │  Zustand │  │  React   │  │  Local   │    │          │
│  │  │  Store   │  │  Query   │  │  Storage │    │          │
│  │  └──────────┘  └──────────┘  └──────────┘    │          │
│  └───────────────────────────────────────────────┘          │
│                          │                                   │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────┐          │
│  │           API CLIENT (lib/api.ts)             │          │
│  │  - Fetch wrapper with auth                    │          │
│  │  - Error handling                             │          │
│  │  - Response transformation                    │          │
│  └───────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

### 2. Backend Layer

```
┌──────────────────────────────────────────────────────────────┐
│                       FASTAPI APPLICATION                     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                     MIDDLEWARE                       │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │    │
│  │  │ CORS   │ │ Auth   │ │Logging │ │ Rate   │       │    │
│  │  │        │ │ Verify │ │        │ │ Limit  │       │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘       │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                      ROUTERS                         │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │    │
│  │  │ /auth  │ │/content│ │/search │ │ /chat  │       │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘       │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                     SERVICES                         │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │    │
│  │  │ Fetcher  │ │Classifier│ │Summarizer│            │    │
│  │  └──────────┘ └──────────┘ └──────────┘            │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │    │
│  │  │ Embedder │ │  Search  │ │   RAG    │            │    │
│  │  └──────────┘ └──────────┘ └──────────┘            │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   DATA ACCESS                        │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
│  │  │            SQLAlchemy + Supabase-py          │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 3. Data Layer

```
┌──────────────────────────────────────────────────────────────┐
│                         SUPABASE                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │   │
│  │  │ contents │ │  users   │ │  chats   │             │   │
│  │  └──────────┘ └──────────┘ └──────────┘             │   │
│  │  ┌──────────┐ ┌──────────┐                          │   │
│  │  │ pgvector │ │   RLS    │                          │   │
│  │  │(embeddings│ │(security)│                          │   │
│  │  └──────────┘ └──────────┘                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    Auth     │  │   Storage   │  │  Realtime   │         │
│  │   (JWT)     │  │  (Files)    │  │ (WebSocket) │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 FLUJOS DETALLADOS

### Flujo 1: Registro de Usuario

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Usuario │────▶│ Frontend│────▶│ Supabase│────▶│ Database│
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │
     │  1. Form      │               │               │
     │─────────────▶│               │               │
     │               │  2. signUp()  │               │
     │               │──────────────▶│               │
     │               │               │  3. INSERT    │
     │               │               │──────────────▶│
     │               │               │               │
     │               │               │  4. Confirm   │
     │               │◀──────────────│◀──────────────│
     │               │               │               │
     │  5. Redirect  │               │               │
     │◀──────────────│               │               │
```

### Flujo 2: Guardar Contenido (Completo)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Usuario │────▶│ Frontend│────▶│ Backend │────▶│ Services│────▶│   APIs  │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │               │
     │  1. URL       │               │               │               │
     │──────────────▶│               │               │               │
     │               │  2. POST      │               │               │
     │               │   /content    │               │               │
     │               │──────────────▶│               │               │
     │               │               │  3. Fetch     │               │
     │               │               │──────────────▶│               │
     │               │               │               │  4. HTTP GET  │
     │               │               │               │──────────────▶│
     │               │               │               │◀──────────────│
     │               │               │               │               │
     │               │               │  5. Summarize │               │
     │               │               │──────────────▶│               │
     │               │               │               │  6. Claude    │
     │               │               │               │──────────────▶│
     │               │               │               │◀──────────────│
     │               │               │               │               │
     │               │               │  7. Classify  │               │
     │               │               │──────────────▶│               │
     │               │               │               │  8. Claude    │
     │               │               │               │──────────────▶│
     │               │               │               │◀──────────────│
     │               │               │               │               │
     │               │               │  9. Embed     │               │
     │               │               │──────────────▶│               │
     │               │               │               │ 10. OpenAI    │
     │               │               │               │──────────────▶│
     │               │               │               │◀──────────────│
     │               │               │               │               │
     │               │               │ 11. Save DB   │               │
     │               │               │──────────────▶│               │
     │               │               │◀──────────────│               │
     │               │               │               │               │
     │               │ 12. Response  │               │               │
     │               │◀──────────────│               │               │
     │ 13. Update UI │               │               │               │
     │◀──────────────│               │               │               │
```

### Flujo 3: Búsqueda Semántica

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Usuario │────▶│ Frontend│────▶│ Backend │────▶│ OpenAI  │────▶│pgvector │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │               │
     │  1. Query     │               │               │               │
     │──────────────▶│               │               │               │
     │               │  2. GET       │               │               │
     │               │   /search?q=  │               │               │
     │               │──────────────▶│               │               │
     │               │               │  3. Embed     │               │
     │               │               │   query       │               │
     │               │               │──────────────▶│               │
     │               │               │  4. Vector    │               │
     │               │               │◀──────────────│               │
     │               │               │               │               │
     │               │               │  5. Cosine    │               │
     │               │               │   similarity  │               │
     │               │               │──────────────────────────────▶│
     │               │               │  6. Results   │               │
     │               │               │◀──────────────────────────────│
     │               │               │               │               │
     │               │  7. Response  │               │               │
     │               │◀──────────────│               │               │
     │  8. Display   │               │               │               │
     │◀──────────────│               │               │               │
```

### Flujo 4: Chat RAG

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Usuario │────▶│ Frontend│────▶│ Backend │────▶│pgvector │────▶│ Claude  │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │               │
     │  1. Message   │               │               │               │
     │──────────────▶│               │               │               │
     │               │  2. POST      │               │               │
     │               │   /chat       │               │               │
     │               │──────────────▶│               │               │
     │               │               │  3. Retrieve  │               │
     │               │               │   relevant    │               │
     │               │               │   docs        │               │
     │               │               │──────────────▶│               │
     │               │               │  4. Top-K     │               │
     │               │               │   results     │               │
     │               │               │◀──────────────│               │
     │               │               │               │               │
     │               │               │  5. Build     │               │
     │               │               │   context     │               │
     │               │               │   + query     │               │
     │               │               │──────────────────────────────▶│
     │               │               │  6. Response  │               │
     │               │               │   with        │               │
     │               │               │   citations   │               │
     │               │               │◀──────────────────────────────│
     │               │               │               │               │
     │               │  7. Stream    │               │               │
     │               │   response    │               │               │
     │               │◀──────────────│               │               │
     │  8. Display   │               │               │               │
     │   + sources   │               │               │               │
     │◀──────────────│               │               │               │
```

---

## 🔧 CONFIGURACIÓN DE SERVICIOS

### FetcherService - Estrategias por Tipo

```python
class FetcherService:
    """Servicio para extraer contenido de diferentes fuentes."""

    strategies = {
        "web": WebFetchStrategy,
        "youtube": YouTubeFetchStrategy,
        "tiktok": TikTokFetchStrategy,
        "twitter": TwitterFetchStrategy
    }

    async def fetch(self, url: str) -> FetchResult:
        # 1. Detectar tipo de URL
        content_type = self._detect_type(url)

        # 2. Obtener estrategia apropiada
        strategy = self.strategies[content_type]()

        # 3. Ejecutar fetch
        result = await strategy.fetch(url)

        return result

    def _detect_type(self, url: str) -> str:
        if "youtube.com" in url or "youtu.be" in url:
            return "youtube"
        elif "tiktok.com" in url:
            return "tiktok"
        elif "twitter.com" in url or "x.com" in url:
            return "twitter"
        else:
            return "web"
```

### WebFetchStrategy

```python
class WebFetchStrategy:
    """Estrategia para artículos web."""

    async def fetch(self, url: str) -> FetchResult:
        # 1. HTTP request con headers apropiados
        response = await self._http_get(url)

        # 2. Parsear HTML
        soup = BeautifulSoup(response.text, 'lxml')

        # 3. Extraer metadata (Open Graph, meta tags)
        metadata = self._extract_metadata(soup)

        # 4. Extraer contenido principal (Readability)
        content = self._extract_content(soup)

        return FetchResult(
            type="web",
            title=metadata.title,
            content=content,
            metadata=metadata
        )
```

### YouTubeFetchStrategy

```python
class YouTubeFetchStrategy:
    """Estrategia para videos de YouTube."""

    async def fetch(self, url: str) -> FetchResult:
        # 1. Extraer video ID
        video_id = self._extract_video_id(url)

        # 2. Obtener metadata con yt-dlp
        metadata = await self._get_metadata(video_id)

        # 3. Obtener transcripción
        transcript = await self._get_transcript(video_id)

        return FetchResult(
            type="youtube",
            title=metadata['title'],
            content=transcript,
            metadata={
                "duration": metadata['duration'],
                "channel": metadata['channel'],
                "views": metadata['view_count'],
                "thumbnail": metadata['thumbnail']
            }
        )
```

### ClassifierService - Prompt Engineering

```python
class ClassifierService:
    """Servicio para clasificar contenido con Claude."""

    CLASSIFICATION_PROMPT = """
    Analiza el siguiente contenido y proporciona una clasificación estructurada.

    TAXONOMÍAS A USAR:

    1. Schema.org Types:
       - Article, NewsArticle, BlogPosting, TechArticle
       - VideoObject, AudioObject
       - SocialMediaPosting
       - Review, HowTo, FAQ

    2. IAB Content Taxonomy (usar exactamente estos valores):
       Tier 1: {iab_tier1_list}
       Tier 2: Ver lista completa en taxonomía
       Tier 3: Ver lista completa en taxonomía

    RESPONDE ÚNICAMENTE CON JSON VÁLIDO en este formato:

    {{
        "schema_type": "Article|VideoObject|...",
        "schema_subtype": "NewsArticle|TechArticle|...",
        "iab_tier1": "Technology & Computing|Business|...",
        "iab_tier2": "subcategoría específica",
        "iab_tier3": "subcategoría más específica (si aplica)",
        "concepts": ["concepto1", "concepto2", ...],
        "entities": {{
            "persons": ["nombre1", ...],
            "organizations": ["org1", ...],
            "places": ["lugar1", ...],
            "products": ["producto1", ...]
        }},
        "language": "es|en|...",
        "sentiment": "positive|negative|neutral|mixed",
        "technical_level": "beginner|intermediate|advanced|expert",
        "content_format": "tutorial|news|opinion|review|analysis|guide"
    }}

    CONTENIDO A CLASIFICAR:

    Título: {title}

    Contenido:
    {content}
    """

    async def classify(self, title: str, content: str) -> Classification:
        # 1. Preparar prompt
        prompt = self.CLASSIFICATION_PROMPT.format(
            iab_tier1_list=self._get_iab_tier1_list(),
            title=title,
            content=content[:8000]  # Limitar tokens
        )

        # 2. Llamar Claude
        response = await self.claude_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        # 3. Parsear JSON
        classification = json.loads(response.content[0].text)

        # 4. Validar contra taxonomías
        validated = self._validate_classification(classification)

        return Classification(**validated)
```

---

## 🔐 SEGURIDAD EN DETALLE

### Middleware de Autenticación

```python
async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Verificar token y obtener usuario actual."""

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    token = authorization.split(" ")[1]

    try:
        # Verificar token con Supabase
        user_response = supabase.auth.get_user(token)
        user_id = user_response.user.id

        # Obtener usuario de DB (opcional, para datos adicionales)
        user = await db.get(User, user_id)

        return user

    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

### Row Level Security Policies

```sql
-- Política base: usuarios solo ven sus propios datos
CREATE POLICY "user_isolation" ON contents
    FOR ALL
    USING (auth.uid() = user_id);

-- Política específica para INSERT
CREATE POLICY "user_insert" ON contents
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Política para service role (backend)
CREATE POLICY "service_all" ON contents
    FOR ALL
    TO service_role
    USING (true);
```

---

## 📈 MONITOREO Y OBSERVABILIDAD

### Logging Estructurado

```python
import structlog

logger = structlog.get_logger()

@router.post("/content")
async def create_content(content: ContentCreate, user: User = Depends(get_current_user)):
    logger.info(
        "content_creation_started",
        user_id=str(user.id),
        url=content.url,
        request_id=request.state.request_id
    )

    try:
        result = await content_service.create(content, user.id)

        logger.info(
            "content_creation_completed",
            user_id=str(user.id),
            content_id=str(result.id),
            processing_time_ms=elapsed_time
        )

        return result

    except Exception as e:
        logger.error(
            "content_creation_failed",
            user_id=str(user.id),
            url=content.url,
            error=str(e)
        )
        raise
```

### Métricas (Prometheus-style)

```python
from prometheus_client import Counter, Histogram

# Contadores
content_created_total = Counter(
    'content_created_total',
    'Total de contenidos creados',
    ['type', 'source']
)

# Histogramas
processing_duration = Histogram(
    'content_processing_duration_seconds',
    'Tiempo de procesamiento de contenido',
    ['step']  # fetch, summarize, classify, embed
)

# Uso
content_created_total.labels(type='web', source='manual').inc()

with processing_duration.labels(step='summarize').time():
    summary = await summarizer.summarize(content)
```

---

## 🔄 ESCALABILIDAD

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  api:
    image: kbase-api
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G

  worker:
    image: kbase-worker
    deploy:
      replicas: 2
```

### Caché Strategy

```python
class CacheService:
    """Servicio de caché con Redis."""

    async def get_or_compute(
        self,
        key: str,
        compute_fn: Callable,
        ttl: int = 3600
    ):
        # 1. Intentar obtener de caché
        cached = await self.redis.get(key)
        if cached:
            return json.loads(cached)

        # 2. Computar valor
        value = await compute_fn()

        # 3. Guardar en caché
        await self.redis.setex(key, ttl, json.dumps(value))

        return value

# Uso
embedding = await cache.get_or_compute(
    f"embedding:{content_id}",
    lambda: embedder.embed(content.text),
    ttl=86400  # 24 horas
)
```

---

## 📚 PATRONES DE DISEÑO UTILIZADOS

1. **Repository Pattern**: Abstracción de acceso a datos
2. **Strategy Pattern**: Diferentes estrategias de fetching
3. **Factory Pattern**: Creación de fetchers según tipo
4. **Dependency Injection**: FastAPI Depends()
5. **Observer Pattern**: Eventos y notificaciones
6. **Chain of Responsibility**: Pipeline de procesamiento

---

**Última actualización:** Diciembre 2024
