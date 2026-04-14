# Changelog

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
