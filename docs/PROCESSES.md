# Kbia — Flujos de Negocio

## Tabla de Contenidos

1. [Captura y procesamiento de contenido](#1-captura-y-procesamiento-de-contenido)
2. [Busqueda y descubrimiento](#2-busqueda-y-descubrimiento)
3. [Chat RAG](#3-chat-rag)
4. [Diario personal (ciclo diario)](#4-diario-personal)
5. [Gestion de habitos](#5-gestion-de-habitos)
6. [Organizacion del conocimiento](#6-organizacion-del-conocimiento)
7. [Autenticacion](#7-autenticacion)
8. [Quick Save (guardado externo)](#8-quick-save)
9. [Importacion masiva](#9-importacion-masiva)
10. [Procesamiento en background](#10-procesamiento-en-background)

---

## 1. Captura y procesamiento de contenido

Flujo principal: el usuario guarda una URL y el sistema la procesa con IA.

```mermaid
flowchart TD
    A[Usuario introduce URL] --> B{Detectar tipo}
    B -->|web| C[BeautifulSoup scraping]
    B -->|youtube| D[yt-dlp metadata + transcripcion]
    B -->|tiktok| E[Resolver short URL + scraping]
    B -->|twitter| F[Scraping limitado]
    B -->|pdf| G[Document parser]

    C --> H[Extraer titulo, contenido, metadata]
    D --> H
    E --> H
    F --> H
    G --> H

    H --> I{URL ya existe?}
    I -->|Si| J[Error: duplicado]
    I -->|No| K[Guardar en DB con status=pending]

    K --> L[Resumen con Claude AI]
    L --> M[Clasificacion IAB + Schema.org]
    M --> N[Extraccion de entidades]
    N --> O[Embedding con OpenAI]
    O --> P[status=completed]

    L -->|Error| Q[status=failed + processing_error]
    M -->|Error| Q
    O -->|Error| Q
```

**Actores:** Usuario, Frontend, Backend API, FetcherService, ClassifierService, SummarizerService, EmbedderService, Claude API, OpenAI API

**Decisiones clave:**
- Deteccion automatica del tipo de URL por patron de dominio
- Duplicados detectados por constraint unique (user_id, url)
- Si el procesamiento falla, el contenido queda guardado con status=failed para reintento

---

## 2. Busqueda y descubrimiento

```mermaid
flowchart TD
    A[Usuario escribe query] --> B{Tipo de busqueda}

    B -->|Full-text| C[PostgreSQL ts_rank]
    B -->|Semantica| D[Generar embedding del query]
    B -->|Facetada| E[Filtros multiples]

    D --> F[Cosine similarity en pgvector]
    F --> G[Top-K resultados por similaridad]

    C --> H[Ranking por relevancia textual]

    E --> I[WHERE clauses combinadas]
    I --> J[Conteo de facetas]

    G --> K[Resultados combinados]
    H --> K
    J --> K

    K --> L[Mostrar con metadata y scores]
```

**Actores:** Usuario, Frontend (explorador/busqueda), Backend Search API, PostgreSQL + pgvector, OpenAI (embedding del query)

**Tipos de busqueda:**
- **Full-text:** Busca en titulo + resumen + conceptos + tags con ranking
- **Semantica:** Convierte query a embedding, busca por cosine similarity (threshold 0.7)
- **Facetada:** Filtros combinados (tipo, categoria, entidades, tags, fecha, estado)
- **Global:** Busca en todas las entidades (contenidos, notas, proyectos, etc.)

---

## 3. Chat RAG

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant B as Backend
    participant PG as pgvector
    participant OAI as OpenAI
    participant C as Claude

    U->>F: Escribe pregunta
    F->>B: POST /chat/sessions/{id}/messages
    B->>OAI: Generar embedding del mensaje
    OAI-->>B: Vector 1536 dims
    B->>PG: match_contents(embedding, threshold=0.7, limit=5)
    PG-->>B: Top-K contenidos relevantes
    B->>B: Construir contexto (pregunta + contenidos + historial)
    B->>C: Llamada con contexto RAG
    C-->>B: Respuesta con citaciones
    B->>B: Guardar mensaje + fuentes en DB
    B-->>F: Respuesta + sources[]
    F-->>U: Mostrar respuesta con links a fuentes
```

**Actores:** Usuario, Frontend Chat, Backend Chat API, OpenAI (embedding), pgvector (retrieval), Claude (generacion)

**Reglas de negocio:**
- Se recuperan maximo 5 contenidos relevantes por mensaje
- El historial de la sesion se incluye como contexto
- Cada respuesta lleva las fuentes citadas con content_id, titulo y snippet
- Se trackea tokens_used y model_used por mensaje

---

## 4. Diario personal

```mermaid
flowchart TD
    A[Usuario abre Mi Diario] --> B{Existe entrada para hoy?}
    B -->|No| C[Crear entrada vacia]
    B -->|Si| D[Cargar entrada existente]

    C --> E[Seccion matinal]
    D --> E

    E --> F[Intencion + Energia + Big Rocks]
    F --> G[Contenido inspiracional]
    G --> H{Refrescar?}
    H -->|Si| I[Cargar nueva cita/refran/reto]
    H -->|No| J[Mantener actual]

    I --> K[Durante el dia]
    J --> K

    K --> L[Tareas + Compromisos + Capturas]
    L --> M[Energia noon/afternoon/night]
    M --> N[Marcar habitos del dia]

    N --> O[Reflexion nocturna]
    O --> P[Victorias + Aprendizajes]
    P --> Q[Gratitudes]
    Q --> R[Perdon: a mi, a otros, situaciones]
    R --> S[Nota para manana + Valoracion 1-10 + Palabra]

    S --> T{Cerrar dia?}
    T -->|Si| U[is_evening_completed=true]
    T -->|No| V[Guardar borrador]

    U --> W{Generar resumen IA?}
    W -->|Si| X[Claude analiza el dia]
    X --> Y[Mostrar insights]
    Y --> Z{Guardar como nota?}
    Z -->|Si| AA[Crear standalone_note con resumen]
```

**Actores:** Usuario, Frontend Daily Journal, Backend Journal API, Claude AI (resumen), InspirationalContent (citas)

**Reglas de negocio:**
- Una entrada por usuario por dia (unique constraint user_id + date)
- Big Rocks pueden vincularse a objetivos o proyectos existentes
- Las capturas rapidas llevan timestamp automatico
- El dia tiene 3 fases: morning, day, evening (cada una con flag de completado)
- El resumen IA analiza patrones emocionales y temas recurrentes

---

## 5. Gestion de habitos

```mermaid
flowchart TD
    A[Usuario crea habito] --> B[Definir frecuencia y momento del dia]
    B --> C[Habito activo]

    C --> D{Dia programado?}
    D -->|Si| E[Habito aparece en dashboard y diario]
    D -->|No| F[No aparece hoy]

    E --> G{Accion del usuario}
    G -->|Completar| H[HabitLog: status=completed]
    G -->|Saltar| I[HabitLog: status=skipped + nota]
    G -->|Ignorar| J[Sin registro]

    H --> K[Actualizar calendario visual]
    I --> K

    K --> L[Calcular estadisticas]
    L --> M[Racha actual]
    L --> N[% cumplimiento semanal/mensual]
    L --> O[Mejor racha]
```

**Actores:** Usuario, Frontend Habits, Backend Habits API

**Reglas de negocio:**
- frequency_type: daily, weekly, custom
- frequency_days: array de dias (0=lunes, 6=domingo)
- time_of_day: morning, noon, evening, anytime
- Un log por habito por dia (upsert)
- Los habitos archivados no aparecen pero mantienen su historial

---

## 6. Organizacion del conocimiento

Relaciones entre entidades del sistema PARA.

```mermaid
flowchart TD
    AR[Areas de Responsabilidad] --> PR[Proyectos]
    AR --> OB[Objetivos]
    AR --> HA[Habitos]
    AR --> MM[Modelos Mentales]
    AR --> NO[Notas]
    AR --> AC1[Acciones de Area]

    PR --> CO[Contenidos]
    PR --> NO
    PR --> MM
    PR --> OB
    PR --> AC2[Acciones de Proyecto]
    PR --> SP[Sub-Proyectos]

    OB --> CO
    OB --> PR
    OB --> MM
    OB --> NO
    OB --> AC3[Acciones de Objetivo]
    OB --> SO[Sub-Objetivos]

    MM --> CO
    MM --> NO
    MM --> AC4[Acciones de Modelo]

    NO --> CO
    NO --> NO2[Otras Notas via Backlinks]
```

**Reglas de negocio:**
- Las relaciones son muchos-a-muchos via tablas junction
- Unique constraints en junctions para evitar duplicados
- Un proyecto puede pertenecer a un area y tener un proyecto padre
- Un objetivo puede pertenecer a un area y tener un objetivo padre
- Las acciones (tareas) pertenecen a exactamente una entidad padre
- Los contenidos pueden estar vinculados a multiples entidades

---

## 7. Autenticacion

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant B as Backend
    participant DB as PostgreSQL

    U->>F: Email + Password
    F->>B: POST /api/v1/auth/login
    B->>DB: SELECT user WHERE email
    DB-->>B: User + password_hash
    B->>B: bcrypt.checkpw(password, hash)

    alt Password correcta
        B->>B: Generar JWT access_token (7 dias)
        B->>B: Generar JWT refresh_token (30 dias)
        B-->>F: {user, session: {access_token, refresh_token}}
        F->>F: Guardar tokens en localStorage
        F-->>U: Redirect a Dashboard
    else Password incorrecta
        B-->>F: 401 Unauthorized
        F-->>U: Error de autenticacion
    end

    Note over F,B: Peticiones autenticadas
    F->>B: GET /api/v1/content (Authorization: Bearer token)
    B->>B: Decodificar JWT (HS256)
    B->>B: Extraer user_id del payload
    B-->>F: Datos filtrados por user_id
```

**Alternativa: API Key**
```mermaid
sequenceDiagram
    participant C as Cliente externo
    participant B as Backend
    participant DB as PostgreSQL

    C->>B: Request con header X-API-Key: kb_xxxx
    B->>B: SHA256 hash de la key
    B->>DB: SELECT user_api_keys WHERE key_hash AND is_active
    DB-->>B: Key + user_id
    B->>DB: UPDATE last_used_at
    B-->>C: Respuesta autenticada
```

---

## 8. Quick Save

```mermaid
sequenceDiagram
    participant U as Usuario
    participant BR as Navegador (cualquier web)
    participant B as Backend

    Note over U,BR: Setup (una vez)
    U->>BR: Instalar bookmarklet desde /quick-save

    Note over U,B: Uso diario
    U->>BR: Navega a una web interesante
    U->>BR: Clic en bookmarklet
    BR->>B: GET /api/v1/quick-save/shortcut?url=X&token=JWT
    B->>B: Validar token
    B->>B: Crear contenido con URL
    B->>B: Encolar para procesamiento
    B-->>BR: Redirect a /quick-save/callback?status=ok
    BR-->>U: Popup de confirmacion
```

---

## 9. Importacion masiva

```mermaid
flowchart TD
    A[Usuario abre pagina Import] --> B{Modo de importacion}

    B -->|URLs multiples| C[Pegar URLs una por linea]
    B -->|CSV| D[Subir fichero CSV]
    B -->|Ficheros| E[Subir PDFs/docs]
    B -->|Google Drive| F[Seleccionar ficheros de Drive]
    B -->|Apple Notes| G[Importar carpetas/notas]

    C --> H[POST /api/v1/content/queue-urls]
    D --> I[POST /api/v1/content/import-csv]
    E --> J[POST /api/v1/files/upload]
    F --> K[Google Drive sync]
    G --> L[POST /api/v1/apple-notes/import-all]

    H --> M[Contenidos creados con status=pending]
    I --> M
    J --> M
    K --> M
    L --> M

    M --> N[Batch Processor cada 15 min]
    N --> O[Fase 1: Fetch raw_content]
    O --> P[Fase 2: IA processing]
    P --> Q[status=completed o failed]
```

---

## 10. Procesamiento en background

```mermaid
flowchart TD
    A[App inicia] -->|5s delay| B[BatchProcessor.start]
    B --> C{Cada 15 minutos}

    C --> D[Fase 1: Fetch URLs pendientes]
    D --> E[SELECT contents WHERE status=pending AND raw_content IS NULL]
    E --> F{Hay items?}
    F -->|Si| G[Fetch cada URL con timeout 30s]
    G --> H[Actualizar raw_content, type, title, metadata]
    H --> I{Fetch exitoso?}
    I -->|Si| J[Mantener status=pending para Fase 2]
    I -->|No| K[status=failed + processing_error]
    F -->|No| L[Skip Fase 1]

    J --> M[Fase 2: Proceso IA]
    L --> M
    M --> N[SELECT contents WHERE status=pending AND raw_content NOT NULL]
    N --> O{Hay items?}
    O -->|Si| P[Por cada usuario, procesar batch de 50]
    P --> Q[Clasificar + Resumir + Embedding]
    Q --> R{Proceso exitoso?}
    R -->|Si| S[status=completed]
    R -->|No| T[processing_error + continuar]
    O -->|No| U[Esperar siguiente ciclo]

    S --> C
    T --> C
    U --> C
    K --> C
```

**Actores:** BatchProcessor (servicio en background), FetcherService, ProcessorService, PostgreSQL

**Reglas de negocio:**
- Se procesan maximo 50 items por batch
- Timeout de 30 segundos por URL en fetch
- Los errores se capturan por item (no rompen el batch completo)
- El procesamiento es por usuario para aislamiento
- El batch processor se detiene automaticamente al cerrar la app

---

*Ultima actualizacion: Abril 2026*
