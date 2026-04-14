# Kbia — Knowledge Base AI

## Overview
Aplicacion personal de gestion de conocimiento y "segundo cerebro". Captura, categoriza y analiza contenido web (articulos, TikToks, YouTube, PDFs) con IA. Incluye busqueda semantica, chat RAG, notas con editor rico, diario personal, habitos, objetivos, proyectos y modelos mentales.

Usuario unico: sergio.porcar@gmail.com

## Architecture
- **Frontend:** Next.js 14 (App Router) + React + TypeScript + Zustand + TailwindCSS + TipTap (editor rico) + React Query (TanStack Query 5)
- **Backend:** FastAPI + SQLAlchemy 2.0 (async con asyncpg) + Pydantic
- **Database:** PostgreSQL 16 con pgvector (shared `spcapps-postgres`, DB: `kbia`)
- **Search:** pgvector para similaridad semantica, full-text search via SQLAlchemy
- **AI:** OpenAI embeddings (text-embedding-3-small, 1536 dim), Anthropic Claude para analisis/chat/clasificacion
- **Domain:** https://kbia.spcapps.com
- **Repo:** spc74-hub/knowledge-base-ai (PRIVATE)

## Features

### Gestion de contenido
- Captura de URLs (web, YouTube, TikTok, Twitter/X, PDFs)
- Scraping automatico con Beautiful Soup, yt-dlp, Playwright
- Resumen automatico con Claude AI
- Clasificacion automatica: Schema.org + IAB Taxonomy (tier1/tier2/tier3)
- Extraccion de entidades (personas, organizaciones, lugares, productos)
- Embeddings vectoriales (OpenAI) para busqueda semantica
- Importacion masiva (URLs, CSV, ficheros, Google Drive)
- Quick Save via bookmarklet y iOS Shortcut
- Pipeline de procesamiento en background (batch processor cada 15 min)
- Nivel de madurez del contenido (captured, organized, synthesized)
- Favoritos, archivado, conteo de visitas

### Busqueda y exploracion
- Busqueda full-text con ranking
- Busqueda semantica por embeddings (cosine similarity)
- Busqueda facetada (tipo, categoria, conceptos, entidades, tags, estado, fecha)
- Explorador con pestanas Contents/Notes
- Taxonomia navegable (arbol jerarquico IAB + Schema.org)
- Grafo de conocimiento interactivo (force-directed graph)

### Notas
- Quick Notes (standalone_notes): tipo reflection, idea, question, connection, journal, shopping
- Full Notes (contents con type=note): editor rico TipTap con formato, tablas, listas de tareas
- Backlinks bidireccionales entre notas
- Vinculacion a contenidos, proyectos, modelos mentales, objetivos
- Prioridades (urgent, important, A, B, C)
- Pin/completar notas

### Chat RAG
- Sesiones de chat con historial
- Retrieval Augmented Generation usando embeddings del contenido
- Citaciones de fuentes en respuestas
- Powered by Claude AI

### Diario personal (Daily Journal)
- Seccion matinal: intencion, energia, contenido inspiracional, Big Rocks (objetivos/proyectos del dia)
- Durante el dia: energia (noon/afternoon/night), tareas, compromisos, capturas rapidas
- Seccion nocturna: victorias, aprendizajes, gratitudes, fracasos, perdon (a mi/otros/situaciones), nota para manana, valoracion del dia (1-10), palabra del dia
- Generacion de resumen IA y guardado como nota
- Streak tracking y estadisticas
- Habitos integrados en el diario

### Habitos
- Frecuencia configurable (diaria, semanal, personalizada)
- Momento del dia (manana, tarde, noche, cualquier momento)
- Calendario visual con historial
- Estadisticas de cumplimiento y rachas
- Vinculacion a areas y objetivos
- Iconos y colores personalizables

### Organizacion PARA
- **Areas de responsabilidad:** con sub-areas, iconos, colores, acciones, notas y modelos mentales vinculados
- **Proyectos:** jerarquia padre-hijo, estados (active, on_hold, completed, archived), drag & drop, acciones, vinculacion a contenidos/notas/modelos/objetivos
- **Objetivos:** horizontes (daily, weekly, monthly, quarterly, yearly, lifetime), progreso 0-100%, acciones, vinculaciones multiples
- **Modelos mentales:** catalogo activable, vinculacion a contenidos/notas/areas/proyectos/objetivos, acciones

### Dashboard
- KPIs configurables con drag & drop
- Widgets: areas, modelos mentales, objetivos, proyectos, notas, diario, habitos, contenidos, acciones
- Items recientes y estado de habitos del dia
- Modal de guardado rapido de URL

### Acciones
- Vista centralizada de acciones de todos los modulos (areas, proyectos, objetivos, modelos mentales)
- CRUD completo, agrupadas por tipo padre
- Filtrado y completado

### Otros
- Modo oscuro/claro
- PWA con vistas moviles dedicadas (/m/*)
- API keys para integraciones externas
- Tracking de uso de API (tokens, costes por proveedor)
- Expertos de usuario (personas con areas de expertise)
- System notes (notas del sistema por categoria)
- Tags de taxonomia personalizados con colores

## Database schema (tablas principales)

| Tabla | Descripcion |
|-------|-------------|
| `users` | Usuarios (id UUID, email, password_hash, name) |
| `contents` | 8400+ items — url, type, title, summary, raw_content, clasificacion IAB/Schema.org, concepts[], entities{}, embedding vector(1536), user_tags[], processing_status, maturity_level |
| `standalone_notes` | Quick notes — title, content, note_type, tags[], linked_content_ids[], priority, is_pinned |
| `folders` | Carpetas jerarquicas con parent_id |
| `areas_of_responsibility` | Areas de vida/trabajo con sub_areas |
| `projects` | Proyectos jerarquicos con area_id, status, deadline |
| `objectives` | Objetivos con horizon, progress, parent_id |
| `mental_models` | Modelos mentales con slug, is_active |
| `habits` | Habitos con frequency_type, frequency_days[], time_of_day, target_count |
| `habit_logs` | Logs diarios de habitos (date, status, value) |
| `daily_journal` | Diario con secciones morning/day/evening, big_rocks{}, wins{}, gratitudes{}, forgiveness_items{} |
| `chat_sessions` / `chat_messages` | Sesiones y mensajes de chat RAG |
| `taxonomy_tags` | Tags de taxonomia personalizados |
| `system_notes` | Notas del sistema por categoria |
| `user_experts` | Expertos con categorias |
| `api_usage` | Tracking de uso de API (tokens, costes) |
| `user_api_keys` | API keys (prefijo kb_, hash SHA256) |
| `inspirational_content` | Contenido inspiracional para el diario |

Tablas junction: `project_actions`, `project_mental_models`, `objective_projects`, `objective_actions`, `objective_contents`, `objective_mental_models`, `objective_notes`, `content_mental_models`, `mental_model_actions`, `mental_model_notes`, `area_mental_models`, `area_actions`, `area_notes`

## API endpoints (principales)

| Grupo | Prefijo | Endpoints clave |
|-------|---------|-----------------|
| Auth | `/api/v1/auth` | register, login, logout, refresh, me |
| Content | `/api/v1/content` | CRUD, favorite, reprocess, bulk-import, queue-urls, import-csv, facets, maturity |
| Search | `/api/v1/search` | full-text, semantic, hybrid, global, faceted, graph, suggestions |
| Chat | `/api/v1/chat` | sessions CRUD, messages |
| Notes | `/api/v1/notes` | CRUD, pin, complete, priority, search, cleanup-orphans |
| Projects | `/api/v1/projects` | CRUD, tree, reorder, favorite, link/unlink (contents, notes, models, objectives), actions |
| Objectives | `/api/v1/objectives` | CRUD, favorite, actions, link/unlink (contents, projects, models, notes) |
| Areas | `/api/v1/areas` | CRUD, reorder, sub-areas, link/unlink (models, objectives, projects, habits, notes), actions |
| Mental Models | `/api/v1/mental-models` | CRUD, favorite, activate, actions, link/unlink (contents, notes) |
| Habits | `/api/v1/habits` | CRUD, complete, skip, logs, archive, stats, bulk-create |
| Journal | `/api/v1/daily-journal` | today, by-date, history, update, tasks, captures, inspirational, streak, summary, close |
| Dashboard | `/api/v1/dashboard` | summary, objects by type |
| Tags | `/api/v1/tags` | CRUD, inherited, available, values |
| Taxonomy | `/api/v1/taxonomy` | nodes, contents, types |
| Files | `/api/v1/files` | upload, supported-types |
| Quick Save | `/api/v1/quick-save` | save, bookmarklet.js |
| Processing | `/api/v1/process` | stats, errors, retry, bulk |
| Usage | `/api/v1/usage` | all, stats, summary, daily, by-operation |
| Experts | `/api/v1/experts` | CRUD, categories, persons |
| API Keys | `/api/v1/api-keys` | create, list, delete |
| Apple Notes | `/api/v1/apple-notes` | folders, notes, import |
| Google Drive | `/api/v1/google-drive` | auth, files, sync |
| System Notes | `/api/v1/system-notes` | CRUD, categories |
| REST Compat | `/rest/v1` | rpc calls |

## Auth
- JWT propio (migrado de Supabase Auth)
- Access token: 7 dias, HS256
- Refresh token: 30 dias
- Password: bcrypt hash
- API Keys: prefijo `kb_`, hash SHA256, header `X-API-Key` o Bearer token
- Default user: sergio.porcar@gmail.com / changeme
- User ID (migrado de Supabase): `8a4dbac6-7da6-4838-a119-a19698e0a2e0`

## Detalles tecnicos importantes
- **CompatDB** (`backend/app/db/compat.py`): Query builder compatible con API de Supabase sobre SQLAlchemy. Interfaz fluida: `db.table("x").select(...).eq(...).execute()`. Incluye soporte RPC con funciones builtin (match_contents, get_category_counts, etc.)
- **Column name mismatch:** El modelo Content tiene `content_metadata = Column("metadata", JSONB)` — el atributo Python difiere del nombre de columna DB. CompatDB usa `_resolve_column()` con el mapper de SQLAlchemy para resolver esto
- **Session rollback:** `execute()` de CompatDB hace rollback on failure para prevenir cascading `InFailedSQLTransactionError`
- **Frontend API URL:** Via `NEXT_PUBLIC_API_URL` env var en Dockerfile (build-time). Debe ser `https://kbia.spcapps.com`
- **Batch Processor:** Arranca con 5s delay, ejecuta cada 15 min. Fase 1: fetch URLs pendientes. Fase 2: proceso IA (clasificacion, resumen, embedding)
- **React Query:** Cache de 5 min por defecto para carga instantanea entre paginas

## Deployment
- Backend: container `kbia-backend` (FastAPI en port 8000)
- Frontend: container `kbia-frontend` (Next.js en port 3000)
- Compose: `/opt/spcapps-infra/projects/kbia/docker-compose.yml`
- Auto-deploy via webhook en `git push`
- PostgreSQL 16 compartido (container `spcapps-postgres`)
- Nginx reverse proxy + Cloudflare Tunnel

## Key files

### Backend
- [main.py](backend/app/main.py) — Entry point FastAPI, lifespan, seed user, batch processor
- [compat.py](backend/app/db/compat.py) — CompatDB: query builder Supabase-compatible sobre SQLAlchemy
- [content.py](backend/app/api/v1/content.py) — Endpoints de contenido (el mas grande, ~800 lineas)
- [search.py](backend/app/api/v1/search.py) — Busqueda full-text, semantica, facetada (~460 lineas)
- [daily_journal.py](backend/app/api/v1/daily_journal.py) — Diario personal completo
- [habits.py](backend/app/api/v1/habits.py) — Habitos con estadisticas y calendario
- [deps.py](backend/app/api/deps.py) — Dependencias: auth JWT/API Key, DB session
- [fetcher.py](backend/app/services/fetcher.py) — Scraping multi-source (web, YouTube, TikTok, PDF)
- [classifier.py](backend/app/services/classifier.py) — Clasificacion IA con Claude
- [batch_processor.py](backend/app/services/batch_processor.py) — Procesamiento en background

### Frontend
- [dashboard/page.tsx](frontend/src/app/dashboard/page.tsx) — Dashboard principal (~1450 lineas)
- [explore/page.tsx](frontend/src/app/explore/page.tsx) — Explorador con filtros facetados
- [daily-journal/page.tsx](frontend/src/app/daily-journal/page.tsx) — Diario personal
- [habits/page.tsx](frontend/src/app/habits/page.tsx) — Habitos con calendario
- [NoteEditor.tsx](frontend/src/components/editor/NoteEditor.tsx) — Editor TipTap
- [api.ts](frontend/src/lib/api.ts) — Cliente API con auth
- [use-auth.ts](frontend/src/hooks/use-auth.ts) — Hook de autenticacion

## Known issues
- Background worker error: `_process_pending_content: 'function' object has no attribute 'is_'` (non-blocking)
- `raw_content` y `embedding` no completamente importados de Supabase (datos demasiado grandes para session pooler)
- Supabase aun activo (no eliminado) — tiene los datos originales
- TODO: Usar API o Playwright para Twitter (`backend/app/services/fetcher.py:469`)
- TODO: Implementar hybrid search (`backend/app/api/v1/search.py:219`)

## History
- Desarrollo iniciado en diciembre 2024
- ~15,900 lineas de codigo (49% TypeScript, 39% Python, 5% SQL)
- Migrado de Supabase + Railway a VPS el 2026-04-13
- 42 ficheros tenian URLs de Railway hardcodeadas, reemplazadas con env var
- CompatDB arreglado 3 veces para resolucion de columna metadata
- Data importada: 8407 contents, 30 notes, 12 habits, 17 projects, etc.

## Backlog
Resumen: mejorar Twitter scraping, implementar hybrid search, completar importacion de embeddings desde Supabase, eliminar Supabase, mejorar PWA offline. Ver [docs/BACKLOG.md](docs/BACKLOG.md) para detalle completo.

## Conventions
- **When making changes to this app, update this CLAUDE.md**
- Todas las rutas API bajo `/api/v1/`
- Endpoints usan CompatDB wrapper, no SQLAlchemy directo
- Frontend hooks en `src/hooks/`, paginas en `src/app/`
- Commits en ingles, documentacion en espanol
- Al completar items del backlog, marcarlos en BACKLOG.md y documentar en CHANGELOG.md

## Documentacion
Ver `docs/` para documentacion detallada:
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — Guia funcional del usuario
- [docs/PROCESSES.md](docs/PROCESSES.md) — Flujos de negocio con diagramas mermaid
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — Historial de cambios por fecha
- [docs/BACKLOG.md](docs/BACKLOG.md) — Tareas pendientes por prioridad
