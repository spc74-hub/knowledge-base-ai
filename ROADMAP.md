# 🗺️ ROADMAP DETALLADO - Knowledge Base AI

Este documento detalla el plan de desarrollo completo del proyecto, fase por fase, sprint por sprint.

---

## 📊 VISIÓN GENERAL

```
FASE 0: Setup + POC          [1 semana]   →  Fundamentos
FASE 1: MVP Básico          [2-3 semanas] →  Producto mínimo usable
FASE 2: Multi-Source        [3 semanas]   →  Múltiples fuentes
FASE 3: Smart Features      [3 semanas]   →  IA avanzada
FASE 4: Polish + Deploy     [2 semanas]   →  Producción

TOTAL: 10-12 semanas (medio tiempo, ~20h/semana)
```

---

## 🎯 FASE 0: SETUP + POC (1 semana)

**Objetivo:** Configurar infraestructura básica y validar concepto

### Sprint 0.1: Configuración Inicial (2-3 días)

#### Backend Setup
```bash
□ Crear proyecto FastAPI
  ├─ main.py con endpoints básicos
  ├─ Estructura de carpetas
  ├─ requirements.txt
  └─ .env.example

□ Configurar Supabase
  ├─ Crear proyecto en Supabase
  ├─ Configurar Auth
  ├─ Habilitar pgvector extension
  └─ Configurar connection string

□ Setup PostgreSQL Schema
  ├─ Tabla users (extender Supabase Auth)
  ├─ Tabla contents (estructura básica)
  └─ Índices iniciales

□ Integrar Supabase con FastAPI
  ├─ Instalar supabase-py
  ├─ Cliente de Supabase
  └─ Test de conexión
```

#### Frontend Setup
```bash
□ Crear proyecto Next.js 14
  ├─ npx create-next-app@latest
  ├─ Configurar TypeScript
  ├─ Setup Tailwind CSS
  └─ Instalar shadcn/ui

□ Configurar Supabase Client
  ├─ @supabase/supabase-js
  ├─ Configurar Auth
  └─ Test de conexión

□ Estructura básica
  ├─ Layout principal
  ├─ Página de login
  └─ Dashboard esqueleto
```

#### APIs y Servicios
```bash
□ Claude API
  ├─ Registrarse en Anthropic
  ├─ Obtener API key
  ├─ Test de llamada básica
  └─ Calcular costos estimados

□ OpenAI API
  ├─ Obtener API key
  ├─ Test de embeddings
  └─ Calcular costos estimados
```

**Entregables:**
- ✅ Backend FastAPI corriendo en `localhost:8000`
- ✅ Frontend Next.js corriendo en `localhost:3000`
- ✅ Supabase configurado y conectado
- ✅ Claude API funcionando
- ✅ OpenAI API funcionando

---

### Sprint 0.2: POC Funcional (2-3 días)

**Objetivo:** Crear proof of concept end-to-end

#### Feature: Guardar y Resumir URL
```python
□ Backend Endpoint: POST /content
  ├─ Recibe URL
  ├─ Valida formato
  ├─ Fetch contenido (requests + BeautifulSoup)
  ├─ Limpia HTML (readability-lxml)
  ├─ Llama a Claude para resumen
  ├─ Guarda en DB
  └─ Retorna resultado

□ Backend Endpoint: GET /content
  ├─ Lista todos los contenidos
  ├─ Filtro básico por user_id
  └─ Paginación básica

□ Frontend: Formulario de URL
  ├─ Input de texto
  ├─ Botón de submit
  ├─ Loading state
  └─ Manejo de errores

□ Frontend: Lista de contenidos
  ├─ Cards con título y resumen
  ├─ Link a URL original
  └─ Fecha de creación
```

**Test del POC:**
```bash
1. Pega URL de artículo → Ver que se procesa
2. Ver resumen generado por Claude
3. Ver contenido en lista
4. Click en URL → Abre sitio original
```

**Decisión GO/NO-GO:**
- ¿El resumen de Claude es de buena calidad?
- ¿El tiempo de procesamiento es aceptable (<10s)?
- ¿La UI básica es usable?

Si todas son SÍ → Continuar a FASE 1  
Si alguna es NO → Iterar en POC

**Entregables:**
- ✅ POC funcional end-to-end
- ✅ Primera URL procesada y resumida
- ✅ Validación técnica completa
- ✅ Decisión de continuar

---

## 🎯 FASE 1: MVP BÁSICO (2-3 semanas)

**Objetivo:** Aplicación mínima viable completamente usable

### Sprint 1.1: Autenticación y Usuarios (3-4 días)

```bash
□ Backend: Auth endpoints
  ├─ POST /auth/register
  ├─ POST /auth/login
  ├─ GET /auth/me
  └─ POST /auth/logout

□ Middleware de autenticación
  ├─ Verificar token Supabase
  ├─ Extraer user_id
  └─ Proteger rutas

□ Frontend: Auth pages
  ├─ /login con formulario
  ├─ /register con formulario
  ├─ /dashboard (protegida)
  └─ Manejo de sesión

□ Protected routes
  ├─ Middleware Next.js
  ├─ Redirect si no auth
  └─ Persistir sesión
```

**Entregables:**
- ✅ Sistema de auth completo
- ✅ Registro de usuarios
- ✅ Login/logout funcional
- ✅ Rutas protegidas

---

### Sprint 1.2: CRUD Completo (4-5 días)

```bash
□ Backend: Content endpoints
  ├─ POST /content (create)
  ├─ GET /content (list)
  ├─ GET /content/{id} (detail)
  ├─ PUT /content/{id} (update)
  └─ DELETE /content/{id}

□ Modelos de datos
  ├─ Content model (SQLAlchemy)
  ├─ Pydantic schemas
  └─ Validaciones

□ Frontend: Dashboard
  ├─ Grid/List view
  ├─ Botón "Add Content"
  ├─ Cards de contenido
  └─ Paginación

□ Frontend: Content detail
  ├─ Vista completa del contenido
  ├─ Resumen destacado
  ├─ Link a original
  ├─ Botón editar
  └─ Botón eliminar

□ Frontend: Agregar contenido
  ├─ Modal o página dedicada
  ├─ Input URL
  ├─ Loading state con progress
  └─ Success/error feedback
```

**Entregables:**
- ✅ CRUD completo funcional
- ✅ Dashboard con contenidos
- ✅ Vista de detalle
- ✅ Agregar/editar/eliminar

---

### Sprint 1.3: Fetching Mejorado (3-4 días)

```bash
□ Servicio de fetching robusto
  ├─ Detección automática de tipo
  ├─ User-agent aleatorio
  ├─ Timeout configurable
  ├─ Reintentos automáticos
  └─ Manejo de errores

□ Extracción de metadata
  ├─ Título (Open Graph, meta tags)
  ├─ Descripción
  ├─ Imagen destacada
  ├─ Autor
  └─ Fecha de publicación

□ Limpieza de contenido
  ├─ Readability para artículos
  ├─ Remover scripts y estilos
  ├─ Extraer texto principal
  └─ Mantener estructura básica

□ Preview antes de guardar
  ├─ Mostrar título y resumen
  ├─ Confirmar antes de procesar
  └─ Permitir edición manual
```

**Entregables:**
- ✅ Fetching robusto y confiable
- ✅ Metadata extraída
- ✅ Contenido limpio
- ✅ Preview funcional

---

### Sprint 1.4: Clasificación Básica (3-4 días)

```bash
□ Implementar taxonomías
  ├─ Schema.org types (JSON file)
  ├─ IAB Taxonomy tier1 (JSON file)
  └─ Cargar en memoria al inicio

□ Servicio de clasificación
  ├─ Prompt optimizado para Claude
  ├─ Parsear respuesta JSON
  ├─ Validar contra taxonomías
  └─ Fallbacks para categorías inválidas

□ Guardar clasificación en DB
  ├─ schema_type
  ├─ schema_subtype
  ├─ iab_tier1
  └─ concepts (array básico)

□ Mostrar clasificación en UI
  ├─ Badges de categorías
  ├─ Tags de conceptos
  └─ Íconos por tipo
```

**Entregables:**
- ✅ Clasificación automática Schema.org
- ✅ Categorización IAB tier1
- ✅ Extracción de conceptos
- ✅ Visualización en UI

---

### Sprint 1.5: Búsqueda y Filtros (2-3 días)

```bash
□ Búsqueda de texto completo
  ├─ Endpoint GET /content/search?q=query
  ├─ Buscar en título, resumen, contenido
  ├─ PostgreSQL full-text search
  └─ Ranking de resultados

□ Filtros básicos
  ├─ Por tipo (Article, Video, etc.)
  ├─ Por categoría IAB
  ├─ Por fecha (rango)
  └─ Combinación de filtros

□ UI de búsqueda
  ├─ Barra de búsqueda en header
  ├─ Resultados en tiempo real
  ├─ Destacar términos encontrados
  └─ Sidebar con filtros

□ Persistir filtros en URL
  ├─ Query params
  ├─ Compartir búsquedas
  └─ Back button funcional
```

**Entregables:**
- ✅ Búsqueda de texto funcional
- ✅ Filtros multi-dimensionales
- ✅ UI intuitiva
- ✅ Resultados relevantes

---

### Sprint 1.6: Polish del MVP (2-3 días)

```bash
□ Mejoras de UI/UX
  ├─ Loading skeletons
  ├─ Empty states
  ├─ Error boundaries
  └─ Transiciones suaves

□ Responsive design
  ├─ Mobile-first
  ├─ Tablet optimization
  └─ Desktop layout

□ Performance
  ├─ Lazy loading de imágenes
  ├─ Virtualización de listas largas
  ├─ Optimistic UI updates
  └─ Debounce en búsqueda

□ Testing básico
  ├─ Tests unitarios (backend)
  ├─ Tests de integración
  └─ Tests E2E críticos (Playwright)
```

**Entregables:**
- ✅ MVP completamente funcional
- ✅ UI pulida y responsive
- ✅ Performance optimizada
- ✅ Tests básicos pasando

---

## 🎯 FASE 2: MULTI-SOURCE (3 semanas)

**Objetivo:** Agregar soporte para YouTube, TikTok, Twitter

### Sprint 2.1: YouTube Integration (5-6 días)

```bash
□ Detección de URLs YouTube
  ├─ Regex patterns
  ├─ Validación de formatos
  └─ Extracción de video ID

□ yt-dlp integration
  ├─ Instalar yt-dlp
  ├─ Extraer metadata
  ├─ Descargar transcripción
  └─ Manejo de errores

□ Procesamiento de transcripción
  ├─ Limpiar timestamps
  ├─ Formatear texto
  ├─ Generar resumen con Claude
  └─ Extraer momentos clave

□ Metadata específica de YouTube
  ├─ Duración del video
  ├─ Views, likes
  ├─ Canal
  ├─ Thumbnail
  └─ Categoría de YouTube

□ UI específica para videos
  ├─ Player embed
  ├─ Transcripción colapsable
  ├─ Timestamps clickeables
  └─ Metadata visual
```

**Entregables:**
- ✅ YouTube totalmente soportado
- ✅ Transcripciones extraídas
- ✅ Resúmenes de videos
- ✅ UI optimizada para videos

---

### Sprint 2.2: TikTok Integration (5-6 días)

```bash
□ Detección de URLs TikTok
  ├─ Formatos: tiktok.com, tiktokv.com
  ├─ Validación
  └─ Extracción de video ID

□ Playwright para scraping
  ├─ Instalar Playwright
  ├─ Configurar browser headless
  ├─ Navigate y wait for content
  └─ Extraer datos

□ Extracción de datos TikTok
  ├─ Descripción del video
  ├─ Hashtags
  ├─ Usuario/creador
  ├─ Música
  ├─ Stats (likes, comments)
  └─ Transcripción si disponible

□ Procesamiento específico
  ├─ Resumen enfocado en hashtags
  ├─ Extracción de temas
  └─ Clasificación por tendencias

□ UI específica para TikTok
  ├─ Preview de video (iframe)
  ├─ Hashtags destacados
  ├─ Música/audio info
  └─ Stats visuales
```

**Entregables:**
- ✅ TikTok totalmente soportado
- ✅ Extracción de metadata
- ✅ Hashtags capturados
- ✅ UI optimizada

---

### Sprint 2.3: Twitter/X Integration (5-6 días)

```bash
□ Detección de URLs Twitter/X
  ├─ twitter.com y x.com
  ├─ Tweets individuales
  └─ Threads completos

□ Scraping de tweets
  ├─ Playwright o API (si disponible)
  ├─ Texto del tweet
  ├─ Imágenes
  ├─ Usuario
  ├─ Fecha
  └─ Stats (retweets, likes)

□ Detección y procesamiento de threads
  ├─ Detectar si es thread
  ├─ Extraer todos los tweets
  ├─ Concatenar en orden
  └─ Generar resumen del thread

□ Procesamiento específico
  ├─ Preservar mentions (@)
  ├─ Preservar hashtags (#)
  ├─ Links externos
  └─ Emojis

□ UI específica para tweets
  ├─ Estilo de tweet card
  ├─ Usuario y avatar
  ├─ Thread view (si aplica)
  └─ Link a Twitter
```

**Entregables:**
- ✅ Twitter/X totalmente soportado
- ✅ Tweets y threads
- ✅ Metadata completa
- ✅ UI estilo Twitter

---

### Sprint 2.4: Background Jobs (3-4 días)

```bash
□ Sistema de queue
  ├─ Celery + Redis (o alternativa)
  ├─ Worker process
  └─ Job scheduling

□ Procesamiento asíncrono
  ├─ Mover fetching a background
  ├─ Mover Claude calls a background
  ├─ Status tracking
  └─ Progress updates

□ Notificaciones
  ├─ WebSocket o polling
  ├─ "Processing..." → "Complete"
  └─ Error notifications

□ UI de progress
  ├─ Progress bar
  ├─ Status badges
  ├─ Retry button si falla
  └─ Queue position
```

**Entregables:**
- ✅ Procesamiento asíncrono
- ✅ No bloquea UI
- ✅ Progress tracking
- ✅ Manejo de errores robusto

---

## 🎯 FASE 3: SMART FEATURES (3 semanas)

**Objetivo:** IA avanzada con embeddings, búsqueda semántica y RAG

### Sprint 3.1: Embeddings y Vector Search (5-6 días)

```bash
□ Integración OpenAI Embeddings
  ├─ text-embedding-3-small
  ├─ Generar embedding de contenido
  ├─ Batch processing para eficiencia
  └─ Costos estimados

□ Almacenar en pgvector
  ├─ Columna embedding vector(1536)
  ├─ Índice IVFFlat o HNSW
  └─ Update de registros existentes

□ Búsqueda semántica
  ├─ Endpoint POST /search/semantic
  ├─ Generar embedding de query
  ├─ Búsqueda por cosine similarity
  └─ Top-K resultados

□ UI de búsqueda híbrida
  ├─ Toggle "Semantic Search"
  ├─ Combinar con full-text
  ├─ Mostrar similarity score
  └─ "More like this" button
```

**Entregables:**
- ✅ Embeddings generados
- ✅ Vector search funcional
- ✅ Búsqueda semántica en UI
- ✅ Resultados más relevantes

---

### Sprint 3.2: RAG / Chat (5-6 días)

```bash
□ Retrieval service
  ├─ Buscar contenido relevante (embedding)
  ├─ Top-K documentos
  ├─ Re-ranking (opcional)
  └─ Formatear contexto

□ Chat endpoint
  ├─ POST /chat
  ├─ Historial de conversación
  ├─ Retrieval de contexto
  ├─ Prompt engineering para RAG
  └─ Streaming response

□ Almacenar conversaciones
  ├─ Tabla chat_sessions
  ├─ Tabla chat_messages
  └─ Asociar a user_id

□ UI de chat
  ├─ Chat interface (ChatGPT-like)
  ├─ Mensajes usuario/asistente
  ├─ Streaming de respuesta
  ├─ Citaciones de fuentes
  ├─ Link a contenido original
  └─ Nueva conversación / historial
```

**Entregables:**
- ✅ Chat RAG funcional
- ✅ Respuestas basadas en tu contenido
- ✅ Fuentes citadas
- ✅ Historial de conversaciones

---

### Sprint 3.3: Clasificación Completa (4-5 días)

```bash
□ IAB Taxonomy completa
  ├─ Tier 1, 2, 3 (JSON completo)
  ├─ Validadores
  └─ Cargar en memoria

□ Extracción de entidades (NER)
  ├─ Personas
  ├─ Organizaciones
  ├─ Lugares
  ├─ Productos
  └─ Tecnologías

□ Metadata rica
  ├─ Idioma (langdetect)
  ├─ Sentimiento (Claude)
  ├─ Nivel técnico (Claude)
  ├─ Formato (tutorial/news/opinion)
  └─ Duración de lectura estimada

□ Tags sugeridos
  ├─ Claude sugiere tags
  ├─ Usuario puede aceptar/rechazar
  ├─ Tags custom del usuario
  └─ Autocomplete de tags

□ UI de clasificación
  ├─ Vista estructurada jerárquica
  ├─ Entidades destacadas
  ├─ Edición de categorías
  └─ Tag manager
```

**Entregables:**
- ✅ Clasificación completa IAB
- ✅ Entidades extraídas
- ✅ Metadata rica
- ✅ Sistema de tags completo

---

### Sprint 3.4: Filtros y Analytics (3-4 días)

```bash
□ Filtros avanzados
  ├─ Multi-select de categorías
  ├─ Tag filtering
  ├─ Entity filtering (por persona, org, etc.)
  ├─ Date range picker
  ├─ Custom filters combinations
  └─ Saved searches

□ Analytics básicas
  ├─ Total items por categoría
  ├─ Items por mes (gráfico)
  ├─ Top tags (word cloud)
  ├─ Top entidades
  └─ Activity heatmap

□ Visualizaciones
  ├─ Charts con Recharts
  ├─ Interactive graphs
  └─ Export de stats

□ Insights automáticos
  ├─ "Your top interests"
  ├─ "Trending topics in your library"
  └─ "Content you might have missed"
```

**Entregables:**
- ✅ Filtros avanzados
- ✅ Analytics dashboard
- ✅ Visualizaciones
- ✅ Insights automáticos

---

## 🎯 FASE 4: POLISH + DEPLOY (2 semanas)

**Objetivo:** Optimización, testing, deployment

### Sprint 4.1: Optimización (4-5 días)

```bash
□ Performance backend
  ├─ Database query optimization
  ├─ Índices adicionales
  ├─ Connection pooling
  ├─ Caching con Redis
  └─ Rate limiting

□ Performance frontend
  ├─ Code splitting
  ├─ Image optimization
  ├─ Lazy loading
  ├─ Bundle size analysis
  └─ Lighthouse audit

□ Caché estratégico
  ├─ Cache de embeddings
  ├─ Cache de clasificaciones
  ├─ Cache de búsquedas comunes
  └─ Invalidation strategy

□ Monitoring
  ├─ Sentry para errores
  ├─ Analytics de uso
  ├─ API metrics
  └─ Database monitoring
```

**Entregables:**
- ✅ Performance optimizado
- ✅ Caché implementado
- ✅ Monitoring setup
- ✅ Lighthouse score >90

---

### Sprint 4.2: Testing (3-4 días)

```bash
□ Tests backend
  ├─ Unit tests (pytest)
  ├─ Integration tests
  ├─ API tests
  └─ Coverage >80%

□ Tests frontend
  ├─ Component tests (Jest/Vitest)
  ├─ Integration tests
  └─ Coverage >70%

□ E2E tests
  ├─ Playwright tests
  ├─ Critical user flows
  └─ Cross-browser testing

□ Load testing
  ├─ API load testing (Locust)
  ├─ Database load testing
  └─ Stress testing
```

**Entregables:**
- ✅ Suite de tests completa
- ✅ Alta cobertura
- ✅ E2E tests pasando
- ✅ Load testing completado

---

### Sprint 4.3: Deploy y DevOps (4-5 días)

```bash
□ Dockerización
  ├─ Dockerfile backend
  ├─ Dockerfile frontend
  ├─ docker-compose.yml
  └─ .dockerignore

□ CI/CD pipeline
  ├─ GitHub Actions
  ├─ Tests automáticos
  ├─ Linting
  ├─ Type checking
  └─ Deploy automático

□ Deploy frontend
  ├─ Vercel setup
  ├─ Environment variables
  ├─ Custom domain
  └─ Analytics

□ Deploy backend
  ├─ Railway o Render
  ├─ Environment variables
  ├─ Health checks
  └─ Scaling configuration

□ Supabase production
  ├─ Production project
  ├─ Backups automáticos
  ├─ RLS policies
  └─ Monitoring
```

**Entregables:**
- ✅ Aplicación en producción
- ✅ CI/CD funcionando
- ✅ Monitoring activo
- ✅ Backups configurados

---

### Sprint 4.4: Documentación Final (2-3 días)

```bash
□ Documentación técnica
  ├─ API docs (Swagger/OpenAPI)
  ├─ Architecture diagrams
  ├─ Database schema
  └─ Deployment guide

□ Documentación de usuario
  ├─ User guide
  ├─ FAQ
  ├─ Troubleshooting
  └─ Video tutorials (opcional)

□ README completo
  ├─ Features list
  ├─ Screenshots
  ├─ Setup instructions
  └─ Contributing guide

□ Code quality
  ├─ Code comments
  ├─ Type hints (Python)
  ├─ JSDoc (TypeScript)
  └─ Clean code review
```

**Entregables:**
- ✅ Documentación completa
- ✅ API docs públicas
- ✅ User guide
- ✅ Código bien documentado

---

## 📊 MÉTRICAS DE ÉXITO POR FASE

### FASE 0 (Setup):
- [x] Todos los servicios conectados
- [x] POC funcional end-to-end
- [x] Decisión GO confirmada

### FASE 1 (MVP):
- [ ] 50+ items procesados y guardados
- [ ] Auth funcionando sin fallos
- [ ] 90%+ clasificaciones correctas
- [ ] Búsqueda retorna resultados <1s
- [ ] UI responsive y usable

### FASE 2 (Multi-source):
- [ ] YouTube videos procesados correctamente
- [ ] TikToks capturados con metadata
- [ ] Tweets y threads extraídos
- [ ] Background jobs sin fallos
- [ ] 100+ items de múltiples fuentes

### FASE 3 (Smart):
- [ ] Búsqueda semántica retorna resultados relevantes
- [ ] Chat RAG responde correctamente
- [ ] Cita fuentes apropiadamente
- [ ] Clasificación completa IAB funcional
- [ ] 500+ items con embeddings

### FASE 4 (Polish):
- [ ] Lighthouse score >90
- [ ] Test coverage >75%
- [ ] Deployed en producción
- [ ] Zero critical bugs
- [ ] Documentación completa

---

## 🎯 PRIORIDADES Y FLEXIBILIDAD

### Must Have (MVP):
- Autenticación
- CRUD de contenidos
- Web scraping básico
- Resúmenes con Claude
- Clasificación Schema.org + IAB tier1
- Búsqueda de texto

### Should Have (Post-MVP):
- YouTube, TikTok, Twitter
- Background jobs
- Embeddings
- Búsqueda semántica

### Could Have (Nice to have):
- RAG/Chat
- Analytics
- Grafo de conocimiento
- Exportación avanzada

### Won't Have (Futuro):
- App móvil
- Extensión browser
- Colaboración multi-usuario
- Compartir knowledge bases

---

## 📅 CRONOGRAMA FLEXIBLE

```
Semana 1:    FASE 0 (Setup + POC)
Semanas 2-4: FASE 1 (MVP Básico)
Semanas 5-7: FASE 2 (Multi-Source)
Semanas 8-10: FASE 3 (Smart Features)
Semanas 11-12: FASE 4 (Polish + Deploy)
```

**Buffers incluidos:** ~20% de tiempo extra en cada fase

---

## 🚀 CÓMO USAR ESTE ROADMAP

1. **Sigue el orden** - Las fases se construyen una sobre otra
2. **No te saltes sprints** - Cada uno tiene dependencias
3. **Checkea los entregables** - Asegura calidad antes de continuar
4. **Adapta según necesidad** - Es una guía, no dogma
5. **Pregunta a Claude Code** - Tiene TODO este contexto

---

## ✅ SIGUIENTE ACCIÓN

Si acabas de leer esto:
1. Ve a `START_HERE.md`
2. Abre Claude Code
3. Copia `PROMPT_INICIAL_CLAUDE_CODE.md`
4. Empieza con FASE 0

**¡Claude Code te guiará sprint por sprint!** 🚀

---

**Última actualización:** Diciembre 2024  
**Versión:** 1.0
