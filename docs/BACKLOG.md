# Kbia — Backlog

## Prioridad Alta
- [ ] **Completar importacion de embeddings desde Supabase** — Los campos `raw_content` y `embedding` no se importaron completamente (datos demasiado grandes para session pooler). Sin embeddings, la busqueda semantica y el chat RAG no funcionan para contenido antiguo
- [ ] **Fix background worker error** — Error `_process_pending_content: 'function' object has no attribute 'is_'` (no bloqueante pero impide procesamiento automatico)
- [ ] **Implementar scraping de Twitter/X** — Actualmente limitado. Necesita API oficial o Playwright (`backend/app/services/fetcher.py:469`)
- [ ] **Eliminar Supabase** — La instancia de Supabase sigue activa con los datos originales. Tras completar la importacion de embeddings, eliminar para reducir costes

## Prioridad Media
- [ ] **Implementar hybrid search** — Endpoint existe pero busqueda hibrida (texto + semantica) no esta implementada (`backend/app/api/v1/search.py:219`)
- [ ] **Exportacion de datos** — Permitir exportar contenido a PDF, Markdown, JSON
- [ ] **Mejorar PWA offline** — Soporte basico de PWA existe pero no hay funcionalidad offline real
- [ ] **Extension de navegador** — Alternativa mas robusta al bookmarklet para Quick Save
- [ ] **Mejorar transcripcion de audio** — Integrar Whisper directamente en vez de depender de Google Drive
- [ ] **Cambiar contrasena por defecto** — El usuario por defecto tiene `changeme` como contrasena

## Prioridad Baja / Futuro
- [ ] **Graficos de tendencia en habitos** — Anadir graficos de linea/barras con recharts
- [ ] **Calendario de contenido** — Vista de calendario para ver contenido por fecha de guardado
- [ ] **Recordatorios y alertas** — Notificaciones push para habitos y compromisos del diario
- [ ] **Versionado de contenido** — Historial de cambios en notas
- [ ] **Operadores de busqueda avanzada** — AND, OR, NOT, comillas, exclusion
- [ ] **Integraciones externas** — Notion, Obsidian, Readwise import/export
- [ ] **Sugerencias IA de organizacion** — Sugerir carpetas, tags, proyectos basados en contenido
- [ ] **Multiples workspaces** — Separar conocimiento personal de profesional
- [ ] **Compartir knowledge bases** — Funcionalidad colaborativa (futuro lejano)

## Bugs Conocidos
- [ ] **Background worker `is_` error** — `'function' object has no attribute 'is_'` en `_process_pending_content`. No bloquea la app pero impide procesamiento automatico
- [ ] **Twitter scraping limitado** — Muchos tweets no se extraen correctamente por restricciones de Twitter/X
- [ ] **Mixed Content intermitente** — Algunos redirects HTTP pueden causar Mixed Content en produccion (mitigado con trailing slashes)

---

*Ultima actualizacion: Abril 2026*
