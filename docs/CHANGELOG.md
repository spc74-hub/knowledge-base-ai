# Changelog

## 2026-08-29
- **fix(pwa):** el icono no aparecia al añadir la app a la pantalla de inicio **en iPad** (en iPhone si). Solo se declaraba `apple-touch-icon` de 180x180: el iPhone encuentra su tamaño exacto, pero el iPad busca 152x152 (retina) o 167x167 (Pro) y no habia ninguno, ni el fallback `/apple-touch-icon.png` en la raiz. Sin candidato valido, Safari pone una captura de la pagina. Añadidos los dos tamaños que faltaban y el fallback de raiz.

## 2026-06-23 — Auto-login con Cloudflare Access (sin segundo login)
- **feat(auth):** nuevo endpoint `POST /api/cf-access` que canjea una identidad ya validada por **Cloudflare Access** por un JWT de kbia, **sin pedir contraseña**. Valida el JWT firmado `Cf-Access-Jwt-Assertion` contra las claves del equipo (`spcapps.cloudflareaccess.com`) y comprueba el `aud` de esta app (`CF_ACCESS_AUD`). Vive en `/api` (no `/api/v1`) porque `/api/v1` está en bypass de Cloudflare y ahí no llega la cabecera de identidad.
- **feat(frontend):** la landing intenta el auto-login de Cloudflare al cargar; si Access ya te autenticó, entras directo a `/dashboard` (se elimina el segundo "Iniciar sesión"). Si falla (no estás tras Access), se muestra el login normal.
- **chore:** añadido `cryptography` a requirements (necesario para validar RS256). Nueva config `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` (esta última por env en el VPS).

- **feat:** Nueva home `/dashboard` PARA-first — tiles de areas activas con conteos rolled-up (proyectos, objetivos, habitos, captures sin triage); bandas debajo de captures pendientes, hoy (intencion + habitos) y recientes. Antes: 2,070 lineas de KPIs y widgets de pipeline IA. Ahora: 184 lineas
- **feat:** Nueva pagina `/captures` — inbox de capturas del bridge ContentHub con filtros `Sin triage / Asignados / Todos`. Cada fila muestra badge "from ContentHub", titulo, summary, tipo, fecha relativa, estado de asignacion
- **feat:** Nueva pagina `/apple-notes` — archivo paginado de las 2,006 notas importadas con busqueda full-text por titulo y carpeta original
- **feat:** Sistema visual rediseniado (vibe **Strategic / Calmado**, paleta navy + cream): `globals.css` reescrito con tokens HSL, `tailwind.config.ts` con surface/primary-soft/warning/shadows, Crimson Pro (serif) para titulos + Inter para body via `next/font`
- **feat:** Sidebar nuevo (`Sidebar.tsx`) PARA-first con secciones Primary / PARA / Archivo, badge en vivo de captures sin triage
- **feat:** Migracion 005 — columna `contents.is_triaged BOOLEAN`, indice parcial para inbox, backfill: las 2,006 notas + items con PARA pre-asignado quedan triaged
- **feat:** Backend — endpoint `GET /api/v1/home/` (single round trip para la home), `GET /api/v1/captures/inbox` con filtros, `GET /api/v1/captures/inbox/count` (badge sidebar), `POST /api/v1/captures/{id}/triage` (confirma asignacion + opcional area/project/objective/mental_model/note/tags), `POST /api/v1/captures/{id}/untriage`
- **refactor:** Borradas paginas obsoletas en frontend: `/explore`, `/chat`, `/processing`, `/taxonomy`, `/knowledge-graph`, `/import`, `/import-apple-notes`, `/experts` (~10,000 lineas)
- **feat:** `next.config.js` con redirects 308 permanentes: `/explore` `/chat` `/processing` `/taxonomy` `/knowledge-graph` `/experts` → `/dashboard`, `/import` → `/captures`, `/import-apple-notes` → `/apple-notes`
- **fix:** `home.py` compara `daily_journal.date` contra `date` object en lugar de string (asyncpg no auto-castea varchar → date)
- **fix:** `captures.py` usa `Query(pattern=...)` en vez de `regex=` (Pydantic v2 deprec.)
- **fix:** `ContentDetail` interface local del modal incluye `source_metadata` e `is_triaged` (el TypeScript build fallaba)

## 2026-05-18 (manana) — Fixes 1-6 y limpieza AI

- **fix:** `requirements.txt` anade `email-validator>=2.0.0` (Pydantic `EmailStr` en `auth.py` lo requiere al importar; sin el, el backend quedaba en restart loop)
- **fix:** `api_keys.py:189` y `deps.py:47` pasan `datetime` (no string ISO) a la columna TIMESTAMP `last_used_at` (asyncpg rechazaba el string). Antes cualquier request con `X-API-Key` o `kb_...` Bearer devolvia 500
- **feat:** `POST /api/v1/quick-save/` acepta y persiste `source_metadata` en el insert. ContentHub bridge ya envia este campo (`origin: contenthub_bridge`, `contenthub_id`, `contenthub_url`); antes Kbia lo descartaba
- **feat:** UI: detalle de Content muestra badge "from ContentHub" / "Apple Notes" segun `source_metadata.origin` y boton "Open in ContentHub" cuando aplica
- **refactor:** Pipeline IA eliminado completamente (fase 3a). Borrados servicios `embeddings`, `embedder`, `audio_transcriber`, `classifier`, `summarizer`, `processor`, `chat`, `batch_processor`. Borrados endpoints `/api/v1/chat`, `/api/v1/process`, `/api/v1/podcasts`. Borrado modelo `ChatSession`/`ChatMessage`. `quick_save` y `content` POST/reprocess ya no procesan con IA — guardan como pending. `/api/v1/search/semantic` y `/api/v1/search/hybrid` devuelven 410 Gone. Dependencia `openai` removida de `requirements.txt`. Total: 20 ficheros, +50/-3192 lineas
- **docs:** Nuevo `database/migrations/003_strip_ai_pipeline_and_wipe.sql` — script manual (psql) para wipe selectivo de contents redundantes (~6,400 rows tiktok/youtube/web/twitter/pdf/email/docx/audio/podcast) preservando los `type='note'` (~2,006 Apple Notes + journals). Limpia junctions huerfanas y dropea tablas `chat_*`. Phase 3b (drop columns AI) queda comentado pendiente de la reescritura de `search.py`
- **refactor:** Drop columns AI (fase 3d) — migracion 004 dropea 21 columnas de `contents` (embedding, raw_content, concepts, entities, user_entities, user_concepts, iab_tier1/2/3, schema_type/subtype, sentiment, technical_level, content_format, reading_time_minutes, language, maturity_level, processed_at, last_reviewed_at, processing_status, processing_error). search.py reescrito de 1,808 a 270 lineas. Total fase 3d: +594 / -3,368 lineas
- **feat:** Quick-save acepta `title` + `summary` opcionales — cuando vienen, se salta el fetch externo y se inserta directo (caso ContentHub bridge). Mantiene el path legacy con fallback URL-only si el fetch falla
- **fix:** docker-compose.yml tenia `DATABASE_URL=...:PASSWORD@...` con `PASSWORD` literal hardcoded. Reemplazado por `env_file: ./backend/.env` para que el container lea la password real
- **fix:** `compat.py` y `models/__init__.py` ya no importan `ChatSession`/`ChatMessage` (estaban rotos tras eliminar el modelo en fase 3a)
- **docs:** Plan de reorganizacion guardado en `~/.claude/plans/fizzy-bouncing-tiger.md`. Decisiones: PARA-first home, redirects para paginas obsoletas, Apple Notes como archivo aparte, re-skin completo con paleta Strategic

## 2026-04-14
- **docs:** Documentacion completa del proyecto (CLAUDE.md, USER_GUIDE, PROCESSES, CHANGELOG, BACKLOG)

## 2026-04-13
- **feat:** Migracion completa de Supabase + Railway a VPS self-hosted
- **refactor:** Backend migrado a SQLAlchemy 2.0 async con asyncpg (antes usaba supabase-py)
- **feat:** CompatDB — query builder compatible con API de Supabase sobre SQLAlchemy
- **fix:** Reemplazadas 42 URLs de Railway hardcodeadas por `NEXT_PUBLIC_API_URL` env var
- **fix:** Resolucion de column name vs attribute name en CompatDB (3 iteraciones: metadata/content_metadata)
- **fix:** Rollback de sesion en CompatDB al fallar queries para prevenir cascading transaction errors
- **fix:** Renombrada columna reservada `metadata` a `content_metadata` en modelo Content
- **feat:** Endpoint REST generico `/rest/v1/rpc/{function_name}` para compatibilidad
- **feat:** Importados 8407 contents, 30 notes, 12 habits, 17 projects, etc. desde Supabase

## 2025-12-24
- **feat:** Auto-resolucion de URLs cortas de TikTok antes de guardar contenido

## 2025-12-20
- **feat:** Secciones colapsables por defecto en vista movil de acciones

## 2025-12-14 — 2025-12-15
- **feat:** Sistema de acciones centralizado con vista desktop y sidebar de navegacion
- **feat:** KPI de acciones pendientes en header del dashboard
- **feat:** Funcionalidad de edicion de acciones en todas las entidades (areas, proyectos, objetivos, modelos)
- **feat:** Vinculacion de objetos (objetivos, proyectos, habitos) desde pagina de detalle de area
- **feat:** Auto-link de objetivos/proyectos a area cuando se crean desde pagina de area
- **feat:** Paleta de 24 colores en todos los modales
- **feat:** KPIs independientes del sidebar, incluyendo KPI de Journal
- **feat:** Auto-seleccion del primer proyecto y formato de fecha europeo
- **fix:** KPI clicks abren en nueva ventana

## 2025-12-13
- **feat:** Resumen IA del diario almacenado y mostrado
- **feat:** Edicion y eliminacion de capturas del inbox
- **feat:** Edicion de diarios pasados cuando no estan completados
- **feat:** Capturas permitidas en diarios de dias anteriores
- **feat:** Acciones en dashboard movil
- **fix:** Mixed Content HTTPS resuelto con trailing slashes
- **fix:** Multiples fixes de URL de API para produccion (HTTPS)

## 2025-12-12
- **feat:** Framework de acciones y vinculacion para Proyectos, Areas y Modelos Mentales

## 2025-12-11
- **feat:** Rutas moviles para Full Notes con navegacion back correcta
- **feat:** UI movil mejorada con navegacion de 6 pestanas
- **feat:** Habitos mejorados con soporte scheduled/unscheduled
- **feat:** Notas mejoradas con filtros avanzados y mejoras UI
- **feat:** Rediseno del Daily Journal con multiples Big Rocks y "Cerrar Dia"
- **feat:** React Query caching para cargas de pagina instantaneas
- **feat:** Seccion dedicada Full Notes con lista y acceso a editor
- **fix:** Dashboard Full Notes links abren editor directamente
- **fix:** Full Notes usa API backend en vez de llamadas directas a Supabase

## 2025-12-10
- **feat:** Daily Journal completo con habitos time_of_day e insights en dashboard
- **feat:** PWA movil: vistas para notas, diario, habitos, contenidos
- **feat:** Modo oscuro y fix de posicionamiento de modales en movil PWA
- **feat:** Iconos KBAI con gradiente azul para PWA
- **feat:** Vista movil de contenidos con filtro de madurez, editor, archivo, paginacion
- **feat:** Dashboard mejorado: botones de crear, eliminar en popup, favoritos primero
- **feat:** Popup rico para todos los items del dashboard
- **feat:** Drag & drop para KPIs y cajas de overview
- **feat:** Mejoras UI en paneles de Objetivos y Proyectos
- **feat:** Dashboard con sidebar colapsable y colores KPI unificados
- **fix:** Endpoint de prioridad de notas acepta JSON body

## 2025-12-09
- **feat:** Sistema de Areas de Responsabilidad y Habitos completo
- **feat:** Habitos con vista de calendario y estadisticas
- **feat:** Sistema de prioridades y sidebar colapsable en notas
- **feat:** Editor de texto rico en Quick Notes
- **feat:** Tipo de nota "Shopping"
- **feat:** Deep linking para objetos vinculados en notas
- **fix:** Rendimiento de notas mejorado y fix de guardado de prioridad

---

*Ultima actualizacion: Abril 2026*
