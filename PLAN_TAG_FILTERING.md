# Plan de Desarrollo: Filtrado por Tags y Contador de Resultados

## Resumen

Implementar dos funcionalidades clave:
1. **Contador de resultados filtrados** en el Dashboard
2. **Filtrado por tags** (individuales + heredados) en las 4 vistas principales

---

## Parte 1: Contador de Resultados en Dashboard

### Descripcion
Cuando el usuario aplica filtros en el Dashboard, mostrar un contador con el numero de contenidos resultantes.

### Ubicacion
- Archivo: `frontend/src/app/dashboard/page.tsx`
- Linea aproximada: despues de la barra de filtros (linea ~621-659)

### Implementacion

**Paso 1.1**: Agregar UI del contador

```tsx
// Debajo de la barra de filtros, mostrar:
{(filterType !== 'all' || filterCategory !== 'all' || filterMaturity !== 'all' || filterAsset !== 'all' || searchQuery) && (
    <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Mostrando {filteredContents.length} de {contents.length} contenidos
    </div>
)}
```

**Complejidad**: Baja - Solo cambios en frontend

---

## Parte 2: Sistema de Filtrado por Tags

### 2.1 Arquitectura del Sistema de Tags

**Tags Individuales (`user_tags`)**:
- Almacenados en `contents.user_tags` (array de strings)
- Asignados manualmente por el usuario a cada contenido

**Tags Heredados (`taxonomy_tags`)**:
- Definidos en la tabla `taxonomy_tags`
- Se calculan dinamicamente basados en:
  - `category`: coincide con `iab_tier1`, `iab_tier2`, `iab_tier3`
  - `concept`: coincide con elementos del array `concepts`
  - `person/organization/product`: coincide con `entities.persons/organizations/products`

### 2.2 Backend: Nuevos Endpoints

**Archivo**: `backend/app/api/v1/tags.py`

#### Endpoint 2.2.1: Obtener todos los tags disponibles

```python
@router.get("/available")
async def get_available_tags(
    current_user: CurrentUser,
    db: Database,
):
    """Get all available tags: user_tags + taxonomy_tags."""
    # 1. Obtener user_tags unicos de todos los contenidos
    contents = db.table("contents").select("user_tags").eq("user_id", current_user["id"]).execute()
    user_tags = set()
    for c in contents.data:
        for tag in (c.get("user_tags") or []):
            user_tags.add(tag)

    # 2. Obtener taxonomy_tags del usuario
    taxonomy = db.table("taxonomy_tags").select("tag, color").eq("user_id", current_user["id"]).execute()
    inherited_tags = {t["tag"]: t.get("color", "#6366f1") for t in taxonomy.data}

    return {
        "user_tags": sorted(list(user_tags)),
        "inherited_tags": [{"tag": k, "color": v} for k, v in inherited_tags.items()],
    }
```

#### Endpoint 2.2.2: Busqueda con filtros de tags

**Archivo**: `backend/app/api/v1/search.py`

Modificar `FacetedSearchRequest` y `/search/faceted`:

```python
class FacetedSearchRequest(BaseModel):
    query: Optional[str] = None
    types: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    concepts: Optional[List[str]] = None
    organizations: Optional[List[str]] = None
    products: Optional[List[str]] = None
    persons: Optional[List[str]] = None
    user_tags: Optional[List[str]] = None          # NUEVO
    inherited_tags: Optional[List[str]] = None     # NUEVO
    limit: int = 50
    offset: int = 0
```

Implementacion del filtro de tags en la query:

```python
# Filtro por user_tags (directo)
if request.user_tags:
    query = query.overlaps("user_tags", request.user_tags)

# Filtro por inherited_tags (requiere JOIN con taxonomy_tags)
if request.inherited_tags:
    # Obtener reglas de taxonomy_tags para estos tags
    taxonomy_rules = db.table("taxonomy_tags").select("*").eq(
        "user_id", current_user["id"]
    ).in_("tag", request.inherited_tags).execute()

    # Construir condiciones OR para cada regla
    # ... logica compleja de matching
```

### 2.3 Backend: Agregar tags a Facets

**Archivo**: `backend/app/api/v1/search.py`

Modificar `_aggregate_facets()` para incluir tags:

```python
def _aggregate_facets(...) -> dict:
    # ... codigo existente ...

    # Agregar agregacion de user_tags
    user_tags_count = {}
    for content in contents:
        for tag in (content.get("user_tags") or []):
            user_tags_count[tag] = user_tags_count.get(tag, 0) + 1

    facets["user_tags"] = [
        {"value": tag, "count": count}
        for tag, count in sorted(user_tags_count.items(), key=lambda x: -x[1])
    ]

    return facets
```

### 2.4 Frontend: Componente TagFilter

**Nuevo archivo**: `frontend/src/components/tag-filter.tsx`

```tsx
interface TagFilterProps {
    userTags: string[];
    inheritedTags: { tag: string; color: string }[];
    selectedUserTags: string[];
    selectedInheritedTags: string[];
    onUserTagsChange: (tags: string[]) => void;
    onInheritedTagsChange: (tags: string[]) => void;
}

export function TagFilter({...}: TagFilterProps) {
    return (
        <div className="space-y-4">
            {/* Tags individuales */}
            <div>
                <h4 className="text-sm font-medium mb-2">Tags manuales</h4>
                <div className="flex flex-wrap gap-2">
                    {userTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => toggleUserTag(tag)}
                            className={`px-2 py-1 rounded-full text-xs ${
                                selectedUserTags.includes(tag)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700'
                            }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tags heredados */}
            <div>
                <h4 className="text-sm font-medium mb-2">Tags heredados</h4>
                <div className="flex flex-wrap gap-2">
                    {inheritedTags.map(({ tag, color }) => (
                        <button
                            key={tag}
                            onClick={() => toggleInheritedTag(tag)}
                            style={{ backgroundColor: selectedInheritedTags.includes(tag) ? color : undefined }}
                            className={`px-2 py-1 rounded-full text-xs ${
                                selectedInheritedTags.includes(tag)
                                    ? 'text-white'
                                    : 'bg-gray-200 text-gray-700'
                            }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
```

---

## Parte 3: Implementacion por Vista

### 3.1 Dashboard (`dashboard/page.tsx`)

**Cambios necesarios**:

1. **Estado para filtros de tags** (linea ~129):
```tsx
const [filterUserTags, setFilterUserTags] = useState<string[]>([]);
const [filterInheritedTags, setFilterInheritedTags] = useState<string[]>([]);
const [availableTags, setAvailableTags] = useState({ user_tags: [], inherited_tags: [] });
```

2. **Fetch tags disponibles** (nuevo useEffect):
```tsx
useEffect(() => {
    const fetchAvailableTags = async () => {
        const response = await fetch(`${API_URL}/api/v1/tags/available`, { headers });
        const data = await response.json();
        setAvailableTags(data);
    };
    if (user) fetchAvailableTags();
}, [user]);
```

3. **Modificar filtro local** (linea ~621-659):
- Agregar condicion para `user_tags`
- Calcular inherited tags para cada contenido y filtrar

4. **Agregar UI de TagFilter** en la barra de filtros

5. **Agregar contador de resultados**

### 3.2 Explore (`explore/page.tsx`)

**Cambios necesarios**:

1. **Actualizar interface Filters** (linea ~50-57):
```tsx
interface Filters {
    types: string[];
    categories: string[];
    concepts: string[];
    organizations: string[];
    products: string[];
    persons: string[];
    user_tags: string[];          // NUEVO
    inherited_tags: string[];     // NUEVO
}
```

2. **Actualizar interface Facets** (linea ~9-22):
```tsx
interface Facets {
    // ... existentes ...
    user_tags: Facet[];  // NUEVO
}
```

3. **Agregar seccion de tags en sidebar** (linea ~508-593):
- Nueva seccion colapsable para "Tags manuales"
- Nueva seccion colapsable para "Tags heredados"

4. **Actualizar searchWithFilters** para enviar tags al backend

### 3.3 Taxonomy (`taxonomy/page.tsx`)

**Cambios necesarios**:

1. **Agregar estado de filtro de tags** (linea ~57):
```tsx
const [filterUserTags, setFilterUserTags] = useState<string[]>([]);
const [filterInheritedTags, setFilterInheritedTags] = useState<string[]>([]);
```

2. **Modificar fetchContents** (linea ~152-188):
- Enviar tags como filtros adicionales al backend

3. **Agregar UI de TagFilter en sidebar** (linea ~516-558)

### 3.4 Knowledge Graph (`knowledge-graph/page.tsx`)

**Cambios necesarios**:

1. **Agregar estado de filtro de tags** (linea ~84-90):
```tsx
const [filterUserTags, setFilterUserTags] = useState<string[]>([]);
const [filterInheritedTags, setFilterInheritedTags] = useState<string[]>([]);
```

2. **Modificar GraphFilters interface** (linea ~47-53):
```tsx
interface GraphFilters {
    include_persons: boolean;
    include_organizations: boolean;
    include_products: boolean;
    include_concepts: boolean;
    min_connections: number;
    user_tags?: string[];          // NUEVO
    inherited_tags?: string[];     // NUEVO
}
```

3. **Modificar backend `/search/graph`** para filtrar por tags

4. **Agregar UI de TagFilter en sidebar** (linea ~498-565)

---

## Parte 4: Backend - Endpoint de Graph con Tags

**Archivo**: `backend/app/api/v1/search.py`

Modificar el endpoint `/graph`:

```python
class GraphFilters(BaseModel):
    include_persons: bool = True
    include_organizations: bool = True
    include_products: bool = True
    include_concepts: bool = False
    min_connections: int = 1
    user_tags: Optional[List[str]] = None
    inherited_tags: Optional[List[str]] = None

@router.post("/graph")
async def get_knowledge_graph(filters: GraphFilters, ...):
    # Construir query base
    query = db.table("contents").select("*").eq("user_id", current_user["id"])

    # Aplicar filtros de tags
    if filters.user_tags:
        query = query.overlaps("user_tags", filters.user_tags)

    # Para inherited_tags, filtrar post-query
    # ... logica similar a faceted search
```

---

## Parte 5: Orden de Implementacion

### Fase 1: Contador en Dashboard (30 min)
1. Agregar UI del contador en dashboard/page.tsx
2. Probar con filtros existentes

### Fase 2: Backend Tags (2-3 horas)
1. Crear endpoint `/tags/available`
2. Modificar `FacetedSearchRequest` para incluir tags
3. Implementar logica de filtrado por inherited_tags
4. Agregar tags a `_aggregate_facets()`
5. Modificar endpoint `/graph` para tags

### Fase 3: Componente TagFilter (1 hora)
1. Crear `components/tag-filter.tsx`
2. Estilos y logica de seleccion

### Fase 4: Dashboard con Tags (1-2 horas)
1. Integrar TagFilter
2. Modificar logica de filtrado local
3. Fetch de tags disponibles

### Fase 5: Explore con Tags (1 hora)
1. Agregar TagFilter al sidebar
2. Actualizar interfaces
3. Conectar con backend

### Fase 6: Taxonomy con Tags (1 hora)
1. Agregar TagFilter al sidebar
2. Modificar fetchContents

### Fase 7: Knowledge Graph con Tags (1-2 horas)
1. Agregar TagFilter al sidebar
2. Modificar backend para filtrar nodos

### Fase 8: Testing y Ajustes (1 hora)
1. Probar todas las vistas
2. Verificar performance
3. Ajustes de UX

---

## Consideraciones Tecnicas

### Performance
- Los inherited_tags requieren calculo dinamico
- Para Explore/Taxonomy, el backend hace el filtrado
- Para Dashboard, el filtrado es local (ya tiene todos los contenidos)
- Considerar cache de inherited_tags por contenido

### UX
- Los tags heredados deben mostrar su color distintivo
- Mostrar indicador de "heredado" vs "manual"
- Al seleccionar un tag, actualizar facets dinamicamente

### Edge Cases
- Contenidos sin user_tags
- Contenidos sin coincidencias de inherited_tags
- Tags con nombres duplicados entre user_tags e inherited_tags
