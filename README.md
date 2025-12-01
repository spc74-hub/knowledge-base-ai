# 🧠 KNOWLEDGE BASE AI - Personal Content Manager

## 📌 RESUMEN EJECUTIVO

**Knowledge Base AI** es una aplicación personal tipo Recall/NotebookLM que permite:
- 📥 Capturar contenido de múltiples fuentes (YouTube, TikTok, Twitter, web)
- 🤖 Generar resúmenes automáticos con IA (Claude)
- 🏷️ Categorizar usando estándares (Schema.org + IAB Taxonomy)
- 🔍 Búsqueda semántica con embeddings
- 💬 Chat con tu knowledge base (RAG)

**Ventaja competitiva:** Control total, sin límites, privacidad, personalizable, open source.

---

## 🎯 OBJETIVOS DEL PROYECTO

### Problema que resuelve:
- Información dispersa en múltiples plataformas
- Difícil recordar y encontrar contenido guardado
- Falta de categorización inteligente
- Dependencia de servicios de terceros (Recall, NotebookLM)

### Solución propuesta:
Sistema personal de gestión de conocimiento con:
- ✅ Múltiples fuentes integradas
- ✅ Procesamiento con IA de última generación
- ✅ Clasificación basada en estándares (Schema.org + IAB)
- ✅ Búsqueda semántica potente
- ✅ Chat conversacional con tu contenido
- ✅ 100% bajo tu control

---

## 🏗️ STACK TECNOLÓGICO

### Frontend
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (componentes)
- **React Query** (state management)
- **Zustand** (estado global ligero)

### Backend
- **FastAPI** (Python 3.11+)
- **Async/await** para performance
- **Pydantic** para validación
- **SQLAlchemy** (ORM)
- **Alembic** (migraciones)

### Base de Datos
- **Supabase** (PostgreSQL + Auth + Storage)
- **pgvector** (embeddings vectoriales)
- **Redis** (cache y queue - opcional)

### IA/ML
- **Claude API** (Anthropic) - Resúmenes y clasificación
- **OpenAI Embeddings** (text-embedding-3-small)
- **Playwright** (scraping dinámico)
- **yt-dlp** (YouTube)
- **Beautiful Soup** (web scraping)

### DevOps
- **Docker** + Docker Compose
- **GitHub Actions** (CI/CD)
- **Vercel** (frontend)
- **Railway/Render** (backend)

---

## 📊 ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────┐
│                   USER INTERFACE                     │
│              (Next.js 14 + Tailwind)                 │
└───────────────────┬─────────────────────────────────┘
                    │
                    │ API Requests
                    ▼
┌─────────────────────────────────────────────────────┐
│                  API GATEWAY                         │
│                  (FastAPI)                           │
└───────────────────┬─────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Fetcher │ │Classify│ │  RAG   │
    │Service │ │Service │ │Service │
    └────────┘ └────────┘ └────────┘
        │           │           │
        └───────────┼───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   SUPABASE POSTGRES   │
        │     (+ pgvector)      │
        └───────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Claude  │ │OpenAI  │ │External│
    │  API   │ │  API   │ │ APIs   │
    └────────┘ └────────┘ └────────┘
```

---

## 📁 ESTRUCTURA DEL PROYECTO

```
PROYECTO_KNOWLEDGE_BASE_AI/
│
├── README.md                          ← ESTÁS AQUÍ
├── START_HERE.md                      ← Empieza aquí (5 min)
├── ROADMAP.md                         ← Plan detallado por fases
├── ARQUITECTURA.md                    ← Arquitectura técnica completa
├── PROMPT_INICIAL_CLAUDE_CODE.md     ← Para Claude Code
├── CHEATSHEET.md                      ← Comandos útiles
│
├── backend/                           ← API FastAPI
│   ├── app/
│   │   ├── main.py                   ← Entry point
│   │   ├── models/                   ← SQLAlchemy models
│   │   ├── schemas/                  ← Pydantic schemas + Taxonomías
│   │   ├── services/                 ← Lógica de negocio
│   │   ├── api/                      ← Endpoints
│   │   └── core/                     ← Config y utilidades
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── alembic/                      ← Migraciones DB
│
├── frontend/                          ← Next.js 14
│   ├── src/
│   │   ├── app/                      ← App Router
│   │   ├── components/               ← React components
│   │   ├── lib/                      ← Utilidades
│   │   └── types/                    ← TypeScript types
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.ts
│
├── docs/                              ← Documentación
│   ├── arquitectura/
│   │   ├── SISTEMA_COMPLETO.md
│   │   ├── BASE_DATOS.md
│   │   └── APIs.md
│   ├── taxonomias/
│   │   ├── SCHEMA_ORG.md
│   │   ├── IAB_TAXONOMY.md
│   │   └── CLASIFICACION.md
│   └── guias/
│       ├── GUIA_DESARROLLO.md
│       ├── GUIA_DEPLOYMENT.md
│       └── GUIA_TESTING.md
│
├── scripts/                           ← Scripts útiles
│   ├── setup_db.py
│   ├── seed_taxonomies.py
│   └── test_claude_api.py
│
├── config/                            ← Configuración
│   ├── docker-compose.yml
│   └── .env.example
│
└── .github/
    └── workflows/                     ← CI/CD
```

---

## 🚀 FASES DE DESARROLLO

### **FASE 0: Setup + POC (1 semana)**
```
✅ Setup repositorio y estructura
✅ Configurar Supabase
✅ Setup FastAPI básico
✅ Setup Next.js básico
✅ Probar integración Claude API
✅ POC: Guardar URL → Fetch → Resumir → Mostrar
```

### **FASE 1: MVP Básico (2-3 semanas)**
```
✅ Autenticación (Supabase Auth)
✅ CRUD de contenidos
✅ Fetch de artículos web (Beautiful Soup)
✅ Resúmenes con Claude
✅ Clasificación básica (Schema.org + IAB tier1)
✅ Dashboard con lista de contenidos
✅ Vista de detalle
✅ Búsqueda por texto
```

### **FASE 2: Multi-Source (3 semanas)**
```
✅ YouTube (yt-dlp + transcripciones)
✅ TikTok (Playwright)
✅ Twitter/X (scraping)
✅ Detección automática de tipo de URL
✅ Procesamiento asíncrono (background jobs)
✅ Progress tracking en UI
```

### **FASE 3: Smart Features (3 semanas)**
```
✅ Embeddings (OpenAI)
✅ Búsqueda semántica (pgvector)
✅ RAG/Chat con contenido
✅ Clasificación completa (IAB tier1+tier2+tier3)
✅ Extracción de entidades (NER)
✅ Filtros avanzados
✅ Tags manuales del usuario
```

### **FASE 4: Polish + Scale (2 semanas)**
```
✅ UI/UX profesional
✅ Optimización de performance
✅ Sistema de caché (Redis)
✅ Rate limiting
✅ Monitoreo y logs
✅ Tests automatizados
✅ Deploy a producción
✅ Documentación completa
```

**TOTAL: 10-12 semanas** (medio tiempo)

---

## 💰 COSTOS ESTIMADOS

### Desarrollo (Gratis/bajo):
- Supabase Free Tier: **$0** (500MB DB, 1GB storage)
- Vercel: **$0** (hosting frontend)
- Railway/Render: **$5-10/mes** (backend)

### APIs (Variable según uso):
- **Claude API (Sonnet 4):**
  - Input: $3 / 1M tokens
  - Output: $15 / 1M tokens
  - Estimado 1000 items: **$8-12/mes**

- **OpenAI Embeddings:**
  - text-embedding-3-small: $0.02 / 1M tokens
  - Estimado 5000 items: **$3-5/mes**

**TOTAL MVP: $15-30/mes**
**TOTAL Producción: $30-60/mes** (con más uso)

Vs. Recall Plus: $10/mes pero sin control ni personalización

---

## 🎯 CARACTERÍSTICAS CLAVE

### Core Features (MVP):
- ✅ Múltiples fuentes de contenido
- ✅ Resúmenes automáticos con IA
- ✅ Clasificación usando estándares
- ✅ Búsqueda de texto completo
- ✅ Organización por categorías
- ✅ Tags personalizados

### Advanced Features (Post-MVP):
- ✅ Búsqueda semántica con embeddings
- ✅ Chat con tu knowledge base (RAG)
- ✅ Grafo de conocimiento
- ✅ Extracción de entidades (personas, organizaciones)
- ✅ Detección de temas relacionados
- ✅ Exportación de datos

### Nice to Have (Futuro):
- 📱 App móvil (React Native)
- 🔌 Extensión de navegador
- 📊 Analytics y insights
- 🤝 Compartir knowledge bases
- 🔄 Sincronización multi-dispositivo
- 🎨 Temas personalizables

---

## 🔒 SEGURIDAD Y PRIVACIDAD

- ✅ Autenticación segura (Supabase Auth)
- ✅ Row Level Security (RLS) en Supabase
- ✅ Datos encriptados en tránsito (HTTPS)
- ✅ Datos encriptados en reposo (Supabase)
- ✅ API keys seguras (variables de entorno)
- ✅ Rate limiting en API
- ✅ Validación de inputs (Pydantic)
- ✅ CORS configurado
- ✅ 100% de control sobre tus datos

---

## 📊 MODELO DE DATOS

### Tabla Principal: `contents`
```sql
- id (UUID)
- user_id (UUID) → auth.users
- url (TEXT)
- type (VARCHAR) → 'youtube', 'tiktok', 'web', 'twitter'
- schema_type (VARCHAR) → Schema.org type
- schema_subtype (VARCHAR)
- iab_tier1 (VARCHAR) → IAB category
- iab_tier2 (VARCHAR)
- iab_tier3 (VARCHAR)
- title (TEXT)
- summary (TEXT)
- raw_content (TEXT)
- concepts (TEXT[])
- entities (JSONB)
- language (VARCHAR)
- sentiment (VARCHAR)
- technical_level (VARCHAR)
- content_format (VARCHAR)
- user_tags (TEXT[])
- embedding (vector(1536))
- metadata (JSONB)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### Tablas Adicionales:
- `users` (extendida de Supabase Auth)
- `tags` (tags del sistema)
- `chat_sessions` (historial de chats RAG)
- `processing_queue` (jobs asíncronos)

---

## 🛠️ TECNOLOGÍAS DE CLASIFICACIÓN

### Schema.org
- Tipos estructurados de contenido web
- ~886 tipos, 1,469 propiedades
- Estándar reconocido por Google, Microsoft, etc.
- **Uso:** Tipo principal de contenido (Article, Video, etc.)

### IAB Content Taxonomy
- 22 categorías tier-1
- ~400 subcategorías tier-2
- Estándar de industria publicitaria
- **Uso:** Categorización temática

### Claude NER
- Extracción de entidades nombradas
- Personas, organizaciones, lugares, productos
- **Uso:** Metadata rica y búsqueda por entidades

### Embeddings Vectoriales
- OpenAI text-embedding-3-small (1536 dimensiones)
- Almacenados en pgvector
- **Uso:** Búsqueda semántica y RAG

---

## 🎨 UI/UX FEATURES

### Dashboard:
- Grid/List view de contenidos
- Filtros multi-dimensionales
- Búsqueda en tiempo real
- Tag cloud interactivo
- Estadísticas visuales

### Vista de Detalle:
- Resumen ejecutivo
- Contenido completo
- Clasificación estructurada
- Entidades extraídas
- Contenido relacionado
- Edición de tags/categoría

### Chat Interface:
- Conversación natural con IA
- Fuentes citadas
- Navegación a contenido original
- Historial de conversaciones

### Settings:
- Preferencias de clasificación
- API keys management
- Exportación de datos
- Privacidad y seguridad

---

## 📈 MÉTRICAS DE ÉXITO

### MVP (Fase 1):
- [ ] 100+ items guardados
- [ ] 90%+ precisión en clasificación
- [ ] <3s tiempo de procesamiento por item
- [ ] Búsqueda funcional en <1s

### Post-MVP (Fase 3):
- [ ] 1000+ items guardados
- [ ] Chat RAG responde en <5s
- [ ] Búsqueda semántica en <1s
- [ ] 95%+ satisfacción personal con resúmenes

---

## 🚦 CÓMO EMPEZAR

### **Opción A: Con Claude Code (RECOMENDADO)**
1. Descarga este proyecto
2. Abre en VS Code
3. Abre Claude Code (`Cmd+Shift+P` → "Claude Code: Open")
4. Copia/pega `PROMPT_INICIAL_CLAUDE_CODE.md`
5. Deja que Claude Code configure todo

### **Opción B: Manual**
1. Lee `START_HERE.md`
2. Sigue `docs/guias/GUIA_DESARROLLO.md`
3. Ejecuta scripts de setup
4. Desarrolla por fases según `ROADMAP.md`

---

## 📚 RECURSOS Y REFERENCIAS

### Documentación Técnica:
- Schema.org: https://schema.org/
- IAB Taxonomy: https://iabtechlab.com/standards/content-taxonomy/
- Claude API: https://docs.anthropic.com/
- OpenAI Embeddings: https://platform.openai.com/docs/guides/embeddings
- Supabase: https://supabase.com/docs
- pgvector: https://github.com/pgvector/pgvector

### Inspiración:
- Recall.ai: https://www.getrecall.ai/
- NotebookLM: https://notebooklm.google.com/
- Mem.ai: https://get.mem.ai/
- Obsidian: https://obsidian.md/

---

## 🤝 CONTRIBUCIÓN Y FEEDBACK

Este es un proyecto personal pero puedes:
- Sugerir features
- Reportar bugs
- Compartir experiencias
- Hacer fork y personalizar

---

## 📞 SOPORTE

### Durante desarrollo con Claude Code:
- Claude Code tiene acceso a TODA la documentación
- Pregunta cualquier duda directamente
- Puede ejecutar código, crear archivos, debuggear

### Documentación:
- `docs/` - Documentación técnica completa
- `ROADMAP.md` - Plan detallado de desarrollo
- `ARQUITECTURA.md` - Detalles de arquitectura
- `CHEATSHEET.md` - Comandos útiles

---

## 🎯 PRÓXIMOS PASOS

1. ⬇️ **Descarga** este proyecto completo
2. 📖 **Lee** START_HERE.md (5 minutos)
3. 💻 **Abre** en VS Code
4. 🤖 **Inicia** Claude Code
5. 📋 **Copia** PROMPT_INICIAL_CLAUDE_CODE.md
6. 🚀 **¡Empieza** a construir!

---

## ✨ VISIÓN FUTURA

Este proyecto es el inicio de tu sistema personal de gestión de conocimiento. Con el tiempo puede evolucionar a:
- 🧠 Segundo cerebro digital
- 📚 Biblioteca personal inteligente
- 🎓 Sistema de aprendizaje continuo
- 💡 Generador de insights y conexiones
- 🤖 Asistente personal con IA

**El límite es tu imaginación.** 🌟

---

**Autor:** SPC74  
**Claude Version:** Sonnet 4.5  
**Fecha:** Diciembre 2024  
**Licencia:** Personal / MIT (tú decides)

---

## 🎉 ¡LISTO PARA EMPEZAR!

Todo está preparado. Claude Code te guiará paso a paso en la construcción de tu Knowledge Base con IA.

**¡Que disfrutes el viaje! 🚀**
