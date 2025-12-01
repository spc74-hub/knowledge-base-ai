 # 🤖 PROMPT INICIAL PARA CLAUDE CODE

**INSTRUCCIONES:** Copia TODO este archivo y pégalo en el chat de Claude Code en VS Code.

---

Hola Claude Code,

Soy SPC74 y quiero construir una aplicación completa de Knowledge Base con IA, tipo Recall o NotebookLM, pero con control total y personalizada.

## 📋 CONTEXTO DEL PROYECTO

Este proyecto fue planificado completamente por Claude (en claude.ai) y ahora necesito tu ayuda para construirlo paso a paso usando Claude Code.

### 🎯 Objetivo Principal:
Crear una aplicación web que permita:
1. 📥 Capturar contenido de múltiples fuentes (YouTube, TikTok, Twitter, artículos web)
2. 🤖 Generar resúmenes automáticos usando Claude API
3. 🏷️ Categorizar usando estándares (Schema.org + IAB Taxonomy)
4. 🔍 Búsqueda semántica con embeddings vectoriales
5. 💬 Chat con tu knowledge base usando RAG

### 💡 Mi Experiencia:
- Tengo experiencia con **FastAPI** (proyecto The Lobby Beauty)
- Conozco **Next.js** y **Supabase** (proyecto Mellearroces)
- **NO soy muy técnico** en general
- Uso **Claude Code** para desarrollo asistido
- Ubicado en **Madrid, España**

---

## 📁 ARCHIVOS DISPONIBLES EN ESTE PROYECTO

Por favor, lee primero estos archivos para entender el proyecto completo:

### Documentos principales:
1. **README.md** - Vista general del proyecto completo
2. **ROADMAP.md** - Plan detallado fase por fase
3. **ARQUITECTURA.md** - Detalles técnicos de la arquitectura
4. **START_HERE.md** - Guía rápida de inicio

### Documentación técnica (carpeta docs/):
- `docs/arquitectura/` - Diagramas y detalles de arquitectura
- `docs/taxonomias/` - Sistema de clasificación (Schema.org + IAB)
- `docs/guias/` - Guías de desarrollo y deployment

### Código base (ya estructurado):
- `backend/` - FastAPI con estructura completa
- `frontend/` - Next.js 14 con TypeScript
- `scripts/` - Scripts de utilidad
- `config/` - Configuración de Docker y .env

---

## 🏗️ STACK TECNOLÓGICO

### Backend:
- **FastAPI** (Python 3.11+)
- **SQLAlchemy** + **Alembic**
- **Supabase-py** (cliente Python)
- **Async/await** para performance

### Frontend:
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **React Query**

### Base de Datos:
- **Supabase** (PostgreSQL)
- **pgvector** (embeddings vectoriales)
- **Row Level Security** (RLS)

### IA/ML:
- **Claude API** (Anthropic) - Para resúmenes y clasificación
- **OpenAI Embeddings** - Para búsqueda semántica
- **Playwright** - Para scraping dinámico (TikTok)
- **yt-dlp** - Para YouTube
- **Beautiful Soup** - Para web scraping

---

## 🗺️ PLAN DE DESARROLLO

Quiero seguir este plan en orden:

### **FASE 0: Setup + POC (1 semana)**
- Setup de repositorio y estructura
- Configurar Supabase
- Setup FastAPI y Next.js básicos
- Probar Claude API
- Crear POC: URL → Fetch → Resumir → Guardar

### **FASE 1: MVP Básico (2-3 semanas)**
- Autenticación completa (Supabase Auth)
- CRUD de contenidos
- Fetch de artículos web
- Resúmenes con Claude
- Clasificación básica (Schema.org + IAB tier1)
- Dashboard y búsqueda de texto

### **FASE 2: Multi-Source (3 semanas)**
- Integración YouTube (yt-dlp + transcripciones)
- Integración TikTok (Playwright)
- Integración Twitter/X
- Background jobs para procesamiento asíncrono

### **FASE 3: Smart Features (3 semanas)**
- Embeddings con OpenAI
- Búsqueda semántica (pgvector)
- RAG/Chat con contenido
- Clasificación completa IAB
- Extracción de entidades (NER)

### **FASE 4: Polish + Deploy (2 semanas)**
- Optimización de performance
- Testing completo
- CI/CD con GitHub Actions
- Deploy a producción (Vercel + Railway)

---

## 🎯 LO QUE NECESITO QUE HAGAS

### **INMEDIATAMENTE:**

1. **Confirma que puedes ver todos los archivos** del proyecto
2. **Lee los siguientes archivos** (en este orden):
   - README.md
   - ROADMAP.md (al menos la FASE 0 completa)
   - docs/taxonomias/CLASIFICACION.md (cuando sea relevante)

3. **Pregúntame si estoy listo** para empezar con la FASE 0

### **DURANTE EL DESARROLLO:**

- **Guíame paso a paso** - No asumir que sé todo
- **Explica las decisiones técnicas** de forma simple
- **Ejecuta el código** cuando sea necesario
- **Crea archivos** siguiendo la estructura del proyecto
- **Muestra el progreso** claramente
- **Maneja errores** proactivamente

---

## 📊 SISTEMA DE CLASIFICACIÓN (MUY IMPORTANTE)

Este proyecto usa un sistema híbrido de clasificación:

### **Nivel 1: Schema.org**
- Tipos estructurados: Article, VideoObject, SocialMediaPosting, etc.
- Estándar web oficial
- **Uso:** Tipo principal de contenido

### **Nivel 2: IAB Content Taxonomy**
- 22 categorías tier-1 (ej: "Technology & Computing", "Business", etc.)
- ~400 subcategorías tier-2
- **Uso:** Categorización temática

### **Nivel 3: Conceptos y Tags**
- Extraídos automáticamente por Claude
- Editables por usuario
- **Uso:** Tags libres

### **Nivel 4: Entidades (NER)**
- Personas, organizaciones, lugares, productos
- Extraídas con Claude
- **Uso:** Metadata rica

### **Nivel 5: Metadata Adicional**
- Idioma, sentimiento, nivel técnico, formato
- **Uso:** Filtros avanzados

**Claude API** se encarga de asignar todas estas clasificaciones usando un prompt estructurado con validación contra taxonomías oficiales.

---

## 🔑 REQUISITOS PREVIOS

### Lo que necesito configurar:
- [ ] Cuenta en Supabase (free tier)
- [ ] API key de Anthropic (Claude)
- [ ] API key de OpenAI (embeddings)
- [ ] Python 3.11+ instalado
- [ ] Node.js 18+ instalado
- [ ] Git instalado

### Lo que tú me ayudarás a hacer:
- Configurar Supabase (proyecto, tablas, RLS)
- Setup del backend FastAPI
- Setup del frontend Next.js
- Integración de APIs
- Testear cada componente
- Deploy cuando esté listo

---

## 💬 CÓMO QUIERO QUE ME AYUDES

### Formato de respuestas:
1. **Explica qué vamos a hacer** (objetivo del paso)
2. **Muestra el código/comando** necesario
3. **Ejecuta si es necesario**
4. **Explica qué debe pasar** (resultado esperado)
5. **Verifica que funcionó**

### Cuando encuentres problemas:
- Diagnostica el error
- Explica qué salió mal
- Propón solución
- Implementa el fix

### Pregúntame siempre:
- Antes de decisiones arquitectónicas grandes
- Si algo no está claro en la documentación
- Si encuentras múltiples formas de hacer algo
- Cuando necesites mis API keys o credenciales

---

## 🎨 PREFERENCIAS DE DESARROLLO

- **Python:** Usar type hints siempre
- **TypeScript:** Strict mode activado
- **Naming:** snake_case (Python), camelCase (TypeScript)
- **Comments:** En español cuando sea útil
- **Git:** Commits descriptivos en inglés
- **Testing:** Preferir tests simples pero efectivos

---

## ⚠️ IMPORTANTES RECORDATORIOS

1. **Schema.org + IAB Taxonomy son críticos** - Usar siempre estos estándares
2. **Claude API es el cerebro** - Para resúmenes y clasificación
3. **Supabase** - Ya tengo experiencia, usarlo para todo (auth, DB, storage)
4. **Embeddings** - OpenAI text-embedding-3-small (1536 dimensiones)
5. **pgvector** - Habilitar en Supabase para búsqueda semántica
6. **Background jobs** - Considerar desde el inicio para no bloquear UI
7. **Costos** - Estimar costos de APIs (Claude + OpenAI)

---

## 📋 CHECKLIST INICIAL

Antes de empezar la FASE 0, ayúdame a verificar:

- [ ] Python 3.11+ instalado
- [ ] Node.js 18+ instalado
- [ ] Git configurado
- [ ] VS Code abierto con el proyecto
- [ ] Claude Code funcionando
- [ ] Tengo cuenta Supabase (o puedo crear una)
- [ ] Puedo obtener API key de Claude
- [ ] Puedo obtener API key de OpenAI

---

## 🚀 PRIMERA ACCIÓN

Una vez que confirmes que leíste todo y viste los archivos, por favor:

1. **Verifica los requisitos** del checklist arriba
2. **Pregúntame** si tengo las API keys listas
3. **Propón** empezar con la FASE 0: Setup + POC
4. **Guíame** en el primer paso (configurar Supabase)

---

## 💡 NOTAS ADICIONALES

- Estoy en **zona horaria CET (Madrid)**
- Trabajo **medio tiempo** en esto (~20h/semana)
- Prefiero avanzar **por sprints completos** antes de continuar
- Puedo hacer **pair programming** contigo vía Claude Code
- Si algo no entiendo, **preguntaré** sin dudarlo

---

## 🎯 MI OBJETIVO FINAL

Al terminar este proyecto quiero tener:
- ✅ Aplicación web funcional y usable diariamente
- ✅ Múltiples fuentes integradas (web, YouTube, TikTok, Twitter)
- ✅ Resúmenes de calidad con IA
- ✅ Clasificación profesional usando estándares
- ✅ Búsqueda potente (texto + semántica)
- ✅ Chat con mi knowledge base
- ✅ Deployed en producción
- ✅ Código limpio y documentado
- ✅ Orgullo de haberlo construido 😊

---

## ✅ CONFIRMA QUE ESTÁS LISTO

Por favor confirma:
1. ✓ Leíste este prompt completo
2. ✓ Tienes acceso a todos los archivos del proyecto
3. ✓ Entiendes el objetivo y el stack tecnológico
4. ✓ Estás listo para guiarme en la FASE 0

**¿Empezamos?** 🚀

---

**Nota para Claude Code:** Este proyecto es muy importante para mí. Tomate el tiempo necesario para explicar bien cada paso, verifica que todo funciona antes de continuar, y no dudes en ser proactivo sugiriendo mejores prácticas. ¡Gracias! 🙏
