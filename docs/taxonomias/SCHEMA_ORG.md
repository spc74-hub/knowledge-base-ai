# 📋 Schema.org Types - Referencia

Tipos de Schema.org utilizados en Knowledge Base AI.

---

## 📊 TIPOS PRINCIPALES

### Article (Artículos)

El tipo base para cualquier contenido escrito.

```json
{
    "type": "Article",
    "subtypes": [
        "NewsArticle",
        "TechArticle",
        "BlogPosting",
        "ScholarlyArticle",
        "Report",
        "SatiricalArticle"
    ]
}
```

#### NewsArticle
- **Descripción**: Artículo de noticias
- **Fuentes típicas**: Periódicos, medios de comunicación
- **Ejemplo**: El País, BBC, CNN
- **Identificadores**: "news", "breaking", "report"

#### TechArticle
- **Descripción**: Artículo técnico o documentación
- **Fuentes típicas**: Blogs técnicos, documentación
- **Ejemplo**: Dev.to, Medium (tech), documentación oficial
- **Identificadores**: Código, tutoriales técnicos, APIs

#### BlogPosting
- **Descripción**: Entrada de blog personal
- **Fuentes típicas**: Blogs personales, Medium
- **Ejemplo**: Cualquier blog personal
- **Identificadores**: "blog", opiniones personales

#### ScholarlyArticle
- **Descripción**: Artículo académico o científico
- **Fuentes típicas**: Journals, arXiv, universidades
- **Ejemplo**: Papers de investigación
- **Identificadores**: "doi:", "abstract", "references"

---

### VideoObject (Videos)

Contenido en formato de video.

```json
{
    "type": "VideoObject",
    "properties": {
        "duration": "PT15M30S",
        "thumbnailUrl": "https://...",
        "uploadDate": "2024-12-01",
        "contentUrl": "https://youtube.com/...",
        "embedUrl": "https://youtube.com/embed/..."
    }
}
```

**Fuentes:**
- YouTube
- Vimeo
- TikTok (también SocialMediaPosting)
- Videos embebidos en artículos

**Propiedades adicionales:**
- `duration`: Duración en formato ISO 8601
- `transcript`: Transcripción del video
- `thumbnailUrl`: URL de la miniatura

---

### AudioObject (Audio)

Contenido en formato de audio.

```json
{
    "type": "AudioObject",
    "properties": {
        "duration": "PT45M",
        "contentUrl": "https://...",
        "encodingFormat": "audio/mpeg"
    }
}
```

**Fuentes:**
- Podcasts (Spotify, Apple Podcasts)
- Audiolibros
- Grabaciones de conferencias

---

### SocialMediaPosting (Redes Sociales)

Post de redes sociales.

```json
{
    "type": "SocialMediaPosting",
    "properties": {
        "sharedContent": {...},
        "isBasedOn": "https://original-source.com"
    }
}
```

**Fuentes:**
- Twitter/X
- TikTok
- LinkedIn
- Instagram
- Threads

**Notas:**
- TikTok puede ser tanto SocialMediaPosting como VideoObject
- Threads de Twitter se tratan como un conjunto

---

### HowTo (Tutoriales)

Contenido con instrucciones paso a paso.

```json
{
    "type": "HowTo",
    "properties": {
        "estimatedCost": {...},
        "supply": [...],
        "tool": [...],
        "step": [
            {
                "@type": "HowToStep",
                "text": "Paso 1: ..."
            }
        ],
        "totalTime": "PT2H"
    }
}
```

**Identificadores:**
- "how to", "tutorial", "guide"
- Listas numeradas
- "Step 1", "Step 2"
- "Instructions", "Recipe"

---

### Review (Reseñas)

Reseña o crítica de algo.

```json
{
    "type": "Review",
    "properties": {
        "itemReviewed": {
            "@type": "Product",
            "name": "iPhone 15"
        },
        "reviewRating": {
            "@type": "Rating",
            "ratingValue": 4,
            "bestRating": 5
        },
        "reviewBody": "..."
    }
}
```

**Identificadores:**
- "review", "rating", "pros and cons"
- Puntuaciones numéricas
- Comparaciones

---

### FAQPage (FAQ)

Página de preguntas frecuentes.

```json
{
    "type": "FAQPage",
    "properties": {
        "mainEntity": [
            {
                "@type": "Question",
                "name": "¿Pregunta?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Respuesta..."
                }
            }
        ]
    }
}
```

**Identificadores:**
- "FAQ", "frequently asked"
- Formato Q&A
- "?" en títulos

---

### Course (Cursos)

Contenido educativo estructurado.

```json
{
    "type": "Course",
    "properties": {
        "courseCode": "CS101",
        "provider": {
            "@type": "Organization",
            "name": "Coursera"
        },
        "hasCourseInstance": {...}
    }
}
```

**Fuentes:**
- Coursera, Udemy, edX
- YouTube playlists educativas
- Bootcamps online

---

## 🔄 MAPEO DE DETECCIÓN

### Por URL/Dominio

```python
DOMAIN_SCHEMA_MAP = {
    # Noticias
    "bbc.com": "NewsArticle",
    "cnn.com": "NewsArticle",
    "elpais.com": "NewsArticle",
    "nytimes.com": "NewsArticle",

    # Tech blogs
    "dev.to": "TechArticle",
    "css-tricks.com": "TechArticle",
    "smashingmagazine.com": "TechArticle",

    # Documentación
    "docs.python.org": "TechArticle",
    "developer.mozilla.org": "TechArticle",

    # Académico
    "arxiv.org": "ScholarlyArticle",
    "scholar.google.com": "ScholarlyArticle",
    "nature.com": "ScholarlyArticle",

    # Video
    "youtube.com": "VideoObject",
    "vimeo.com": "VideoObject",

    # Social
    "twitter.com": "SocialMediaPosting",
    "x.com": "SocialMediaPosting",
    "tiktok.com": "SocialMediaPosting",

    # Cursos
    "coursera.org": "Course",
    "udemy.com": "Course",
    "edx.org": "Course",
}
```

### Por Contenido (Keywords)

```python
CONTENT_SCHEMA_INDICATORS = {
    "HowTo": [
        "how to", "tutorial", "guide", "step by step",
        "instructions", "learn how", "beginner's guide"
    ],
    "Review": [
        "review", "rating", "pros and cons", "compared to",
        "verdict", "our take", "best for", "worth it"
    ],
    "NewsArticle": [
        "breaking", "exclusive", "reported", "according to",
        "officials say", "announced", "latest news"
    ],
    "FAQPage": [
        "faq", "frequently asked", "common questions",
        "q&a", "questions and answers"
    ]
}
```

---

## 📝 PROPIEDADES COMUNES

### Para todos los tipos

```json
{
    "name": "Título del contenido",
    "description": "Descripción o resumen",
    "author": {
        "@type": "Person",
        "name": "Nombre del autor"
    },
    "datePublished": "2024-12-01",
    "dateModified": "2024-12-01",
    "publisher": {
        "@type": "Organization",
        "name": "Nombre de la publicación"
    },
    "image": "https://...",
    "url": "https://..."
}
```

### Propiedades específicas por tipo

| Tipo | Propiedades Específicas |
|------|------------------------|
| Article | wordCount, articleBody, articleSection |
| VideoObject | duration, thumbnailUrl, transcript |
| AudioObject | duration, encodingFormat |
| HowTo | step, tool, supply, totalTime |
| Review | itemReviewed, reviewRating |
| Course | courseCode, provider |

---

## 🎯 USO EN LA APLICACIÓN

### Almacenamiento

```sql
-- Campos en la tabla contents
schema_type VARCHAR(100),     -- 'Article', 'VideoObject', etc.
schema_subtype VARCHAR(100),  -- 'NewsArticle', 'TechArticle', etc.
```

### Iconos por Tipo

```typescript
const SCHEMA_ICONS = {
    'Article': FileText,
    'NewsArticle': Newspaper,
    'TechArticle': Code,
    'BlogPosting': PenTool,
    'VideoObject': Video,
    'AudioObject': Headphones,
    'SocialMediaPosting': MessageCircle,
    'HowTo': BookOpen,
    'Review': Star,
    'FAQPage': HelpCircle,
    'Course': GraduationCap
};
```

### Colores por Tipo

```typescript
const SCHEMA_COLORS = {
    'Article': 'blue',
    'NewsArticle': 'red',
    'TechArticle': 'purple',
    'BlogPosting': 'green',
    'VideoObject': 'red',
    'AudioObject': 'orange',
    'SocialMediaPosting': 'cyan',
    'HowTo': 'yellow',
    'Review': 'amber',
    'Course': 'indigo'
};
```

---

## 📚 RECURSOS

- [Schema.org](https://schema.org/)
- [Schema.org Article](https://schema.org/Article)
- [Schema.org VideoObject](https://schema.org/VideoObject)
- [Google Structured Data](https://developers.google.com/search/docs/appearance/structured-data)

---

**Última actualización:** Diciembre 2024
