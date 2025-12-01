# 🔌 APIs - Documentación de Endpoints

Este documento detalla todos los endpoints de la API de Knowledge Base AI.

---

## 📋 INFORMACIÓN GENERAL

### Base URL

```
Development: http://localhost:8000/api/v1
Production:  https://api.yourdomain.com/api/v1
```

### Autenticación

Todos los endpoints (excepto /auth) requieren autenticación via Bearer token:

```http
Authorization: Bearer <supabase_access_token>
```

### Formato de Respuesta

```json
{
    "success": true,
    "data": { ... },
    "error": null,
    "meta": {
        "page": 1,
        "per_page": 20,
        "total": 100,
        "total_pages": 5
    }
}
```

### Códigos de Estado

| Código | Significado |
|--------|-------------|
| 200 | OK - Petición exitosa |
| 201 | Created - Recurso creado |
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - Token inválido o expirado |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no encontrado |
| 422 | Unprocessable Entity - Validación fallida |
| 429 | Too Many Requests - Rate limit excedido |
| 500 | Internal Server Error |

---

## 🔐 AUTH ENDPOINTS

### POST /auth/register

Registrar nuevo usuario.

**Request:**
```json
{
    "email": "user@example.com",
    "password": "securepassword123",
    "name": "John Doe"
}
```

**Response (201):**
```json
{
    "success": true,
    "data": {
        "user": {
            "id": "uuid",
            "email": "user@example.com",
            "name": "John Doe",
            "created_at": "2024-12-01T10:00:00Z"
        },
        "session": {
            "access_token": "eyJ...",
            "refresh_token": "...",
            "expires_at": "2024-12-01T11:00:00Z"
        }
    }
}
```

---

### POST /auth/login

Iniciar sesión.

**Request:**
```json
{
    "email": "user@example.com",
    "password": "securepassword123"
}
```

**Response (200):**
```json
{
    "success": true,
    "data": {
        "user": {
            "id": "uuid",
            "email": "user@example.com"
        },
        "session": {
            "access_token": "eyJ...",
            "refresh_token": "...",
            "expires_at": "2024-12-01T11:00:00Z"
        }
    }
}
```

---

### POST /auth/logout

Cerrar sesión.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
    "success": true,
    "message": "Logged out successfully"
}
```

---

### POST /auth/refresh

Refrescar token de acceso.

**Request:**
```json
{
    "refresh_token": "..."
}
```

**Response (200):**
```json
{
    "success": true,
    "data": {
        "access_token": "eyJ...",
        "refresh_token": "...",
        "expires_at": "2024-12-01T12:00:00Z"
    }
}
```

---

### GET /auth/me

Obtener usuario actual.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "email": "user@example.com",
        "name": "John Doe",
        "created_at": "2024-12-01T10:00:00Z",
        "preferences": {
            "theme": "dark",
            "language": "es"
        }
    }
}
```

---

## 📄 CONTENT ENDPOINTS

### GET /content

Listar contenidos del usuario.

**Query Parameters:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| page | int | 1 | Página actual |
| per_page | int | 20 | Items por página (max 100) |
| type | string | - | Filtrar por tipo: web, youtube, tiktok, twitter |
| category | string | - | Filtrar por IAB tier1 |
| tags | string | - | Filtrar por tags (comma-separated) |
| favorite | bool | - | Solo favoritos |
| archived | bool | false | Incluir archivados |
| sort_by | string | created_at | Campo de ordenación |
| sort_order | string | desc | asc o desc |
| q | string | - | Búsqueda de texto |

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "url": "https://example.com/article",
            "type": "web",
            "title": "Article Title",
            "summary": "Brief summary...",
            "schema_type": "Article",
            "schema_subtype": "TechArticle",
            "iab_tier1": "Technology & Computing",
            "iab_tier2": "Artificial Intelligence",
            "concepts": ["AI", "Machine Learning"],
            "user_tags": ["important", "to-read"],
            "is_favorite": true,
            "created_at": "2024-12-01T10:00:00Z"
        }
    ],
    "meta": {
        "page": 1,
        "per_page": 20,
        "total": 150,
        "total_pages": 8
    }
}
```

---

### GET /content/{id}

Obtener contenido específico.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "url": "https://example.com/article",
        "type": "web",
        "title": "Complete Article Title",
        "summary": "Detailed summary of the article...",
        "raw_content": "Full text content...",
        "schema_type": "Article",
        "schema_subtype": "TechArticle",
        "iab_tier1": "Technology & Computing",
        "iab_tier2": "Artificial Intelligence",
        "iab_tier3": "Machine Learning",
        "concepts": ["AI", "Machine Learning", "NLP"],
        "entities": {
            "persons": ["Sam Altman", "Demis Hassabis"],
            "organizations": ["OpenAI", "Google DeepMind"],
            "places": ["San Francisco"],
            "products": ["GPT-4", "Gemini"]
        },
        "language": "en",
        "sentiment": "positive",
        "technical_level": "advanced",
        "content_format": "analysis",
        "reading_time_minutes": 8,
        "user_tags": ["important", "to-read"],
        "is_favorite": true,
        "is_archived": false,
        "metadata": {
            "author": "John Smith",
            "published_date": "2024-11-30",
            "image_url": "https://example.com/image.jpg"
        },
        "created_at": "2024-12-01T10:00:00Z",
        "updated_at": "2024-12-01T10:00:00Z",
        "processed_at": "2024-12-01T10:00:05Z"
    }
}
```

---

### POST /content

Crear nuevo contenido (guardar URL).

**Request:**
```json
{
    "url": "https://example.com/article",
    "tags": ["to-read"],
    "process_async": false
}
```

**Response (201) - Procesamiento síncrono:**
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "url": "https://example.com/article",
        "type": "web",
        "title": "Article Title",
        "summary": "Generated summary...",
        "processing_status": "completed"
    }
}
```

**Response (202) - Procesamiento asíncrono:**
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "url": "https://example.com/article",
        "processing_status": "pending",
        "job_id": "job-uuid"
    },
    "message": "Content is being processed"
}
```

---

### PUT /content/{id}

Actualizar contenido.

**Request:**
```json
{
    "title": "Updated Title",
    "user_tags": ["important", "reviewed"],
    "is_favorite": true,
    "is_archived": false
}
```

**Response (200):**
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "title": "Updated Title",
        "user_tags": ["important", "reviewed"],
        "is_favorite": true,
        "updated_at": "2024-12-01T11:00:00Z"
    }
}
```

---

### DELETE /content/{id}

Eliminar contenido.

**Response (200):**
```json
{
    "success": true,
    "message": "Content deleted successfully"
}
```

---

### POST /content/{id}/reprocess

Reprocesar contenido (regenerar resumen, clasificación, embedding).

**Request:**
```json
{
    "steps": ["summarize", "classify", "embed"]
}
```

**Response (202):**
```json
{
    "success": true,
    "data": {
        "job_id": "job-uuid",
        "status": "processing"
    }
}
```

---

### GET /content/stats

Obtener estadísticas del usuario.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "total_contents": 250,
        "by_type": {
            "web": 150,
            "youtube": 60,
            "tiktok": 25,
            "twitter": 15
        },
        "by_category": {
            "Technology & Computing": 80,
            "Business": 45,
            "Science": 35
        },
        "favorites_count": 42,
        "archived_count": 18,
        "this_week": 12,
        "this_month": 45
    }
}
```

---

## 🔍 SEARCH ENDPOINTS

### GET /search

Búsqueda de texto completo.

**Query Parameters:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| q | string | required | Query de búsqueda |
| type | string | - | Filtrar por tipo |
| category | string | - | Filtrar por categoría |
| limit | int | 20 | Máximo resultados |

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "title": "Article About AI",
            "summary": "This article discusses...",
            "type": "web",
            "relevance_score": 0.95,
            "highlight": {
                "title": "Article About <mark>AI</mark>",
                "summary": "...discusses <mark>artificial intelligence</mark>..."
            }
        }
    ],
    "meta": {
        "query": "artificial intelligence",
        "total_results": 15,
        "search_time_ms": 45
    }
}
```

---

### POST /search/semantic

Búsqueda semántica con embeddings.

**Request:**
```json
{
    "query": "artículos sobre machine learning aplicado a medicina",
    "limit": 10,
    "threshold": 0.7,
    "filters": {
        "type": ["web", "youtube"],
        "category": "Technology & Computing"
    }
}
```

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "title": "Deep Learning in Healthcare",
            "summary": "...",
            "type": "web",
            "similarity_score": 0.89,
            "concepts": ["AI", "Healthcare", "Deep Learning"]
        }
    ],
    "meta": {
        "query": "artículos sobre machine learning aplicado a medicina",
        "embedding_generated": true,
        "search_time_ms": 120
    }
}
```

---

### POST /search/hybrid

Búsqueda híbrida (texto + semántica).

**Request:**
```json
{
    "query": "machine learning healthcare",
    "semantic_weight": 0.6,
    "limit": 10
}
```

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "title": "ML Applications in Medicine",
            "combined_score": 0.87,
            "text_score": 0.82,
            "semantic_score": 0.91
        }
    ]
}
```

---

### GET /search/suggestions

Sugerencias de búsqueda.

**Query Parameters:**

| Param | Tipo | Descripción |
|-------|------|-------------|
| q | string | Texto parcial |
| limit | int | Max sugerencias (default 5) |

**Response (200):**
```json
{
    "success": true,
    "data": {
        "suggestions": [
            "machine learning",
            "machine learning tutorial",
            "machine learning python"
        ]
    }
}
```

---

## 💬 CHAT ENDPOINTS

### GET /chat/sessions

Listar sesiones de chat.

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "title": "Conversation about AI trends",
            "message_count": 12,
            "last_message_at": "2024-12-01T10:30:00Z",
            "created_at": "2024-12-01T10:00:00Z"
        }
    ]
}
```

---

### POST /chat/sessions

Crear nueva sesión de chat.

**Request:**
```json
{
    "title": "New conversation"
}
```

**Response (201):**
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "title": "New conversation",
        "created_at": "2024-12-01T10:00:00Z"
    }
}
```

---

### GET /chat/sessions/{id}/messages

Obtener mensajes de una sesión.

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "role": "user",
            "content": "What are the latest AI trends in my saved articles?",
            "created_at": "2024-12-01T10:00:00Z"
        },
        {
            "id": "uuid",
            "role": "assistant",
            "content": "Based on your saved content, here are the main AI trends...",
            "sources": [
                {
                    "content_id": "uuid",
                    "title": "AI Trends 2024",
                    "relevance_score": 0.92,
                    "snippet": "The most significant trend is..."
                }
            ],
            "created_at": "2024-12-01T10:00:05Z"
        }
    ]
}
```

---

### POST /chat/sessions/{id}/messages

Enviar mensaje y obtener respuesta RAG.

**Request:**
```json
{
    "content": "What do my saved articles say about transformers architecture?",
    "settings": {
        "max_sources": 5,
        "temperature": 0.7
    }
}
```

**Response (200):**
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "role": "assistant",
        "content": "Based on your saved content about transformers architecture...\n\nYour articles highlight several key points:\n\n1. **Attention Mechanism**: According to [Source 1], the self-attention mechanism allows...\n\n2. **Applications**: [Source 2] discusses how transformers have been applied to...",
        "sources": [
            {
                "content_id": "uuid-1",
                "title": "Understanding Transformers",
                "relevance_score": 0.94,
                "snippet": "The transformer architecture revolutionized..."
            },
            {
                "content_id": "uuid-2",
                "title": "Transformers in NLP",
                "relevance_score": 0.88,
                "snippet": "Applications of transformers include..."
            }
        ],
        "tokens_used": 1250,
        "created_at": "2024-12-01T10:00:05Z"
    }
}
```

---

### POST /chat/sessions/{id}/messages (Streaming)

Enviar mensaje con respuesta streaming.

**Request:**
```json
{
    "content": "Explain the main concepts...",
    "stream": true
}
```

**Response (200 - SSE):**
```
event: start
data: {"session_id": "uuid"}

event: chunk
data: {"content": "Based on"}

event: chunk
data: {"content": " your saved"}

event: chunk
data: {"content": " articles..."}

event: sources
data: {"sources": [{"content_id": "uuid", "title": "..."}]}

event: done
data: {"message_id": "uuid", "tokens_used": 850}
```

---

## 📊 PROCESSING ENDPOINTS

### GET /processing/status/{job_id}

Obtener estado de un job de procesamiento.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "job_id": "uuid",
        "content_id": "uuid",
        "status": "processing",
        "current_step": "classify",
        "progress": 60,
        "steps_completed": {
            "fetch": true,
            "summarize": true,
            "classify": false,
            "embed": false
        },
        "started_at": "2024-12-01T10:00:00Z",
        "estimated_completion": "2024-12-01T10:00:30Z"
    }
}
```

---

### GET /processing/queue

Obtener jobs en cola del usuario.

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "job_id": "uuid",
            "content_id": "uuid",
            "url": "https://example.com/article",
            "status": "pending",
            "position_in_queue": 3,
            "created_at": "2024-12-01T10:00:00Z"
        }
    ]
}
```

---

## 🏷️ TAGS ENDPOINTS

### GET /tags

Obtener tags del usuario.

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "tag": "important",
            "count": 45
        },
        {
            "tag": "to-read",
            "count": 32
        }
    ]
}
```

---

### GET /tags/suggestions

Sugerencias de tags basadas en contenido.

**Query Parameters:**

| Param | Tipo | Descripción |
|-------|------|-------------|
| content_id | uuid | ID del contenido |

**Response (200):**
```json
{
    "success": true,
    "data": {
        "suggestions": ["AI", "technology", "tutorial", "python"]
    }
}
```

---

## ⚙️ USER ENDPOINTS

### GET /user/preferences

Obtener preferencias del usuario.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "theme": "dark",
        "language": "es",
        "items_per_page": 20,
        "default_view": "grid",
        "auto_classify": true,
        "auto_summarize": true,
        "notifications_enabled": true
    }
}
```

---

### PUT /user/preferences

Actualizar preferencias.

**Request:**
```json
{
    "theme": "light",
    "items_per_page": 50,
    "auto_classify": false
}
```

---

### POST /user/export

Exportar datos del usuario.

**Request:**
```json
{
    "format": "json",
    "include": ["contents", "tags", "chats"]
}
```

**Response (202):**
```json
{
    "success": true,
    "data": {
        "export_id": "uuid",
        "status": "processing",
        "download_url": null
    }
}
```

---

## 🔧 WEBHOOKS

### Content Processed

Webhook enviado cuando un contenido termina de procesarse.

**Payload:**
```json
{
    "event": "content.processed",
    "timestamp": "2024-12-01T10:00:30Z",
    "data": {
        "content_id": "uuid",
        "status": "completed",
        "processing_time_ms": 5200
    }
}
```

---

## 📝 RATE LIMITING

| Endpoint | Límite |
|----------|--------|
| /auth/* | 10 req/min |
| /content POST | 20 req/min |
| /search/* | 60 req/min |
| /chat/* | 30 req/min |
| General | 100 req/min |

**Headers de respuesta:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1701432000
```

---

## 🔒 ERRORES COMUNES

### Error de validación (422)
```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Validation failed",
        "details": [
            {
                "field": "url",
                "message": "Invalid URL format"
            }
        ]
    }
}
```

### Error de autenticación (401)
```json
{
    "success": false,
    "error": {
        "code": "UNAUTHORIZED",
        "message": "Invalid or expired token"
    }
}
```

### Error de rate limit (429)
```json
{
    "success": false,
    "error": {
        "code": "RATE_LIMIT_EXCEEDED",
        "message": "Too many requests",
        "retry_after": 60
    }
}
```

---

**Última actualización:** Diciembre 2024
**Versión API:** v1
