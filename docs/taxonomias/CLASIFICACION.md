# 🏷️ SISTEMA DE CLASIFICACIÓN

Este documento describe el sistema híbrido de clasificación de contenidos.

---

## 📊 VISIÓN GENERAL

Knowledge Base AI utiliza un sistema de clasificación multi-nivel que combina estándares de la industria:

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTENIDO CAPTURADO                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLASIFICACIÓN AUTOMÁTICA                  │
│                        (Claude API)                          │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   NIVEL 1       │ │   NIVEL 2       │ │   NIVEL 3       │
│   Schema.org    │ │   IAB Taxonomy  │ │   Conceptos     │
│                 │ │                 │ │   + Tags        │
│ Tipo estructural│ │ Categoría       │ │ Keywords        │
│ del contenido   │ │ temática        │ │ libres          │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│   NIVEL 4: Entidades (NER)                                  │
│   Personas | Organizaciones | Lugares | Productos           │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│   NIVEL 5: Metadata Adicional                               │
│   Idioma | Sentimiento | Nivel Técnico | Formato            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 NIVEL 1: Schema.org

### ¿Qué es Schema.org?

[Schema.org](https://schema.org/) es un vocabulario estructurado creado por Google, Microsoft, Yahoo y Yandex para marcar datos en la web. Proporciona tipos predefinidos para describir contenido.

### Tipos Principales Usados

| Tipo | Subtipo | Descripción | Ejemplo |
|------|---------|-------------|---------|
| **Article** | - | Artículo genérico | Blog post, artículo de opinión |
| Article | NewsArticle | Artículo de noticias | CNN, El País |
| Article | TechArticle | Artículo técnico | Documentación, tutorial |
| Article | BlogPosting | Entrada de blog | Medium, personal blogs |
| Article | ScholarlyArticle | Artículo académico | Papers, investigación |
| **VideoObject** | - | Contenido de video | YouTube, Vimeo |
| **AudioObject** | - | Contenido de audio | Podcasts |
| **SocialMediaPosting** | - | Post de redes sociales | Twitter, TikTok |
| **HowTo** | - | Tutorial paso a paso | Guías, recetas |
| **Review** | - | Reseña | Reviews de productos |
| **FAQPage** | - | Página de FAQ | Preguntas frecuentes |
| **Course** | - | Curso educativo | Cursos online |

### Mapeo por Fuente

```python
SOURCE_TO_SCHEMA = {
    "web": {
        "default": "Article",
        "patterns": {
            "news": "NewsArticle",
            "blog": "BlogPosting",
            "tutorial": "TechArticle",
            "how-to": "HowTo",
            "review": "Review"
        }
    },
    "youtube": {
        "default": "VideoObject",
        "patterns": {
            "tutorial": "HowTo",
            "course": "Course"
        }
    },
    "tiktok": {
        "default": "SocialMediaPosting"
    },
    "twitter": {
        "default": "SocialMediaPosting"
    }
}
```

---

## 📋 NIVEL 2: IAB Content Taxonomy

### ¿Qué es IAB Content Taxonomy?

[IAB Content Taxonomy](https://iabtechlab.com/standards/content-taxonomy/) es el estándar de la industria publicitaria para categorizar contenido digital. Tiene 3 niveles de profundidad.

### Categorías Tier 1 (22 categorías principales)

| ID | Categoría | Descripción |
|----|-----------|-------------|
| 1 | Arts & Entertainment | Artes, cine, música, TV |
| 2 | Automotive | Automóviles, motos |
| 3 | Business | Negocios, empresas, economía |
| 4 | Careers | Empleo, carreras profesionales |
| 5 | Education | Educación, formación |
| 6 | Family & Parenting | Familia, crianza |
| 7 | Food & Drink | Gastronomía, bebidas |
| 8 | Health & Fitness | Salud, ejercicio, bienestar |
| 9 | Hobbies & Interests | Hobbies, aficiones |
| 10 | Home & Garden | Hogar, jardín, decoración |
| 11 | Law, Government & Politics | Legal, gobierno, política |
| 12 | News | Noticias, actualidad |
| 13 | Personal Finance | Finanzas personales |
| 14 | Pets | Mascotas |
| 15 | Real Estate | Inmobiliaria |
| 16 | Religion & Spirituality | Religión, espiritualidad |
| 17 | Science | Ciencia |
| 18 | Shopping | Compras |
| 19 | Society | Sociedad |
| 20 | Sports | Deportes |
| 21 | Style & Fashion | Moda, estilo |
| 22 | Technology & Computing | Tecnología, informática |
| 23 | Travel | Viajes, turismo |

### Subcategorías Tier 2 (Ejemplo: Technology & Computing)

```
Technology & Computing
├── Artificial Intelligence
├── Computing
│   ├── Computer Hardware
│   ├── Computer Software
│   └── Computer Programming
├── Consumer Electronics
│   ├── Smartphones
│   ├── Tablets
│   └── Wearables
├── Cybersecurity
├── Data Storage
├── Internet
│   ├── Cloud Computing
│   ├── Web Development
│   └── Social Media
├── Robotics
└── Virtual Reality
```

### Ejemplo de Clasificación Completa IAB

```json
{
    "iab_tier1": "Technology & Computing",
    "iab_tier2": "Artificial Intelligence",
    "iab_tier3": "Machine Learning"
}
```

---

## 📋 NIVEL 3: Conceptos y Tags

### Conceptos (Automáticos)

Los conceptos son keywords extraídos automáticamente por Claude que representan los temas principales del contenido.

**Características:**
- 3-7 conceptos por contenido
- Extraídos del análisis semántico
- Normalizados (lowercase, sin duplicados)

**Ejemplo:**
```json
{
    "concepts": [
        "machine learning",
        "neural networks",
        "deep learning",
        "natural language processing",
        "transformers"
    ]
}
```

### Tags (Manuales del Usuario)

Los tags son etiquetas que el usuario puede agregar manualmente.

**Características:**
- Sin límite de cantidad
- Definidos por el usuario
- Para organización personal

**Ejemplos comunes:**
- `to-read` - Para leer después
- `important` - Contenido importante
- `reference` - Material de referencia
- `project-x` - Relacionado con un proyecto

---

## 📋 NIVEL 4: Entidades (NER)

### Named Entity Recognition

Claude extrae entidades nombradas del contenido:

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **persons** | Personas mencionadas | "Elon Musk", "Sam Altman" |
| **organizations** | Empresas, instituciones | "OpenAI", "Google", "MIT" |
| **places** | Ubicaciones geográficas | "Silicon Valley", "Madrid" |
| **products** | Productos específicos | "GPT-4", "iPhone 15" |
| **technologies** | Tecnologías mencionadas | "Python", "Kubernetes" |
| **events** | Eventos importantes | "WWDC 2024", "CES" |

### Estructura JSON

```json
{
    "entities": {
        "persons": [
            {"name": "Sam Altman", "role": "CEO", "organization": "OpenAI"},
            {"name": "Demis Hassabis", "role": "CEO", "organization": "DeepMind"}
        ],
        "organizations": [
            {"name": "OpenAI", "type": "company"},
            {"name": "Google DeepMind", "type": "research_lab"}
        ],
        "places": [
            {"name": "San Francisco", "type": "city", "country": "USA"}
        ],
        "products": [
            {"name": "GPT-4", "type": "AI_model", "company": "OpenAI"},
            {"name": "Gemini", "type": "AI_model", "company": "Google"}
        ]
    }
}
```

---

## 📋 NIVEL 5: Metadata Adicional

### Campos de Metadata

| Campo | Valores Posibles | Descripción |
|-------|-----------------|-------------|
| **language** | es, en, fr, de, ... | Idioma principal |
| **sentiment** | positive, negative, neutral, mixed | Tono general |
| **technical_level** | beginner, intermediate, advanced, expert | Nivel de dificultad |
| **content_format** | tutorial, news, opinion, analysis, review, guide, reference | Tipo de formato |
| **reading_time** | Minutos (integer) | Tiempo estimado de lectura |

### Ejemplo Completo

```json
{
    "language": "en",
    "sentiment": "positive",
    "technical_level": "advanced",
    "content_format": "tutorial",
    "reading_time_minutes": 15
}
```

---

## 🤖 PROMPT DE CLASIFICACIÓN

### Prompt para Claude

```python
CLASSIFICATION_PROMPT = """
Analiza el siguiente contenido y proporciona una clasificación estructurada.

## INSTRUCCIONES

1. Lee el contenido cuidadosamente
2. Identifica el tipo de contenido según Schema.org
3. Clasifica según IAB Content Taxonomy (los 3 niveles)
4. Extrae 3-7 conceptos principales
5. Identifica entidades nombradas (personas, organizaciones, lugares, productos)
6. Determina metadata adicional

## TAXONOMÍAS

### Schema.org Types (usar exactamente estos valores):
- Article, NewsArticle, BlogPosting, TechArticle, ScholarlyArticle
- VideoObject, AudioObject
- SocialMediaPosting
- HowTo, Review, FAQPage, Course

### IAB Content Taxonomy Tier 1:
{iab_tier1_list}

## FORMATO DE RESPUESTA

Responde ÚNICAMENTE con JSON válido (sin markdown, sin explicaciones):

{{
    "schema_type": "Article|VideoObject|...",
    "schema_subtype": "NewsArticle|TechArticle|null",
    "iab_tier1": "Technology & Computing|Business|...",
    "iab_tier2": "subcategoría específica",
    "iab_tier3": "subcategoría más específica o null",
    "concepts": ["concepto1", "concepto2", ...],
    "entities": {{
        "persons": [
            {{"name": "Nombre", "role": "rol o null", "organization": "org o null"}}
        ],
        "organizations": [
            {{"name": "Nombre", "type": "company|institution|..."}}
        ],
        "places": [
            {{"name": "Lugar", "type": "city|country|...", "country": "país o null"}}
        ],
        "products": [
            {{"name": "Producto", "type": "tipo", "company": "empresa o null"}}
        ]
    }},
    "language": "es|en|...",
    "sentiment": "positive|negative|neutral|mixed",
    "technical_level": "beginner|intermediate|advanced|expert",
    "content_format": "tutorial|news|opinion|analysis|review|guide|reference"
}}

## CONTENIDO A CLASIFICAR

Título: {title}

URL: {url}

Contenido:
{content}
"""
```

---

## 🔄 FLUJO DE CLASIFICACIÓN

```
┌─────────────┐
│  Contenido  │
│   Fetched   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│  1. Preparar Prompt                         │
│     - Título + Contenido (max 8000 tokens)  │
│     - Incluir listas de taxonomías          │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│  2. Llamar Claude API                       │
│     - Model: claude-sonnet-4-20250514               │
│     - Max tokens: 1500                      │
│     - Temperature: 0.3 (consistencia)       │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│  3. Parsear Respuesta JSON                  │
│     - Validar estructura                    │
│     - Manejar errores de parsing            │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│  4. Validar Contra Taxonomías               │
│     - Verificar schema_type válido          │
│     - Verificar iab_tier1 válido            │
│     - Aplicar fallbacks si necesario        │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│  5. Guardar en Base de Datos                │
│     - Actualizar campos de clasificación    │
│     - Marcar como procesado                 │
└─────────────────────────────────────────────┘
```

---

## 🎯 USO EN LA APLICACIÓN

### Búsqueda por Categoría

```sql
-- Buscar por categoría IAB
SELECT * FROM contents
WHERE user_id = $1
AND iab_tier1 = 'Technology & Computing'
ORDER BY created_at DESC;

-- Buscar con múltiples categorías
SELECT * FROM contents
WHERE user_id = $1
AND iab_tier1 = ANY($2::varchar[])
ORDER BY created_at DESC;
```

### Filtros en UI

```typescript
// Componente de filtros
const filters = {
  types: ['web', 'youtube', 'tiktok', 'twitter'],
  categories: IAB_TIER1_LIST,
  schemaTypes: SCHEMA_ORG_TYPES,
  technicalLevels: ['beginner', 'intermediate', 'advanced', 'expert'],
  formats: ['tutorial', 'news', 'opinion', 'analysis', 'review']
};
```

### Estadísticas por Categoría

```sql
-- Distribución de contenido por categoría
SELECT
    iab_tier1,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM contents
WHERE user_id = $1
GROUP BY iab_tier1
ORDER BY count DESC;
```

---

## 📈 MEJORES PRÁCTICAS

### Para Claude (Prompt Engineering)

1. **Ser específico**: Listar exactamente los valores válidos
2. **Forzar JSON**: Indicar que solo devuelva JSON válido
3. **Limitar contenido**: Max 8000 tokens para input
4. **Temperature baja**: 0.3 para consistencia
5. **Validar siempre**: La respuesta de Claude puede variar

### Para la Base de Datos

1. **Índices**: Crear índices en campos de clasificación
2. **Constraints**: Validar valores con CHECK constraints
3. **Normalización**: Almacenar IDs en lugar de textos completos (opcional)

### Para la UI

1. **Autocomplete**: Sugerir categorías existentes
2. **Bulk edit**: Permitir cambiar categorías en lote
3. **Visualización**: Mostrar distribución con gráficos
4. **Filtros combinados**: Permitir múltiples filtros simultáneos

---

## 📚 RECURSOS

- [Schema.org Full Hierarchy](https://schema.org/docs/full.html)
- [IAB Tech Lab Content Taxonomy](https://iabtechlab.com/standards/content-taxonomy/)
- [Claude API Best Practices](https://docs.anthropic.com/claude/docs/prompt-engineering)

---

**Última actualización:** Diciembre 2024
