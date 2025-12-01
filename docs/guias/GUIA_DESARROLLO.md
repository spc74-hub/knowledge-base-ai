# 🛠️ GUÍA DE DESARROLLO

Guía completa para desarrollar Knowledge Base AI.

---

## 📋 PRERREQUISITOS

### Software Necesario

| Software | Versión Mínima | Verificar |
|----------|----------------|-----------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | 2.30+ | `git --version` |
| Docker | 20+ (opcional) | `docker --version` |

### Cuentas Necesarias

1. **Supabase** - [supabase.com](https://supabase.com)
   - Crear cuenta gratuita
   - Crear nuevo proyecto

2. **Anthropic** - [console.anthropic.com](https://console.anthropic.com)
   - Crear cuenta
   - Generar API key

3. **OpenAI** - [platform.openai.com](https://platform.openai.com)
   - Crear cuenta
   - Generar API key

---

## 🚀 SETUP INICIAL

### 1. Clonar/Abrir Proyecto

```bash
# Si descargaste el zip
cd PROYECTO_KNOWLEDGE_BASE_AI

# Si usas git
git clone <repo-url>
cd PROYECTO_KNOWLEDGE_BASE_AI
```

### 2. Setup del Backend

```bash
# Entrar al directorio backend
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# Mac/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Instalar browsers para Playwright
playwright install chromium

# Copiar archivo de variables de entorno
cp .env.example .env

# Editar .env con tus API keys
```

### 3. Setup del Frontend

```bash
# Entrar al directorio frontend
cd frontend

# Instalar dependencias
npm install

# Copiar archivo de variables de entorno
cp .env.example .env.local

# Editar .env.local con tus keys
```

### 4. Configurar Supabase

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard)
2. Crear nuevo proyecto
3. En Settings > Database, habilitar pgvector:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Copiar las credenciales:
   - Project URL
   - anon key
   - service_role key

### 5. Configurar Variables de Entorno

**Backend (.env):**
```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJxxxx...
SUPABASE_SERVICE_KEY=eyJxxxx...

# Claude API
ANTHROPIC_API_KEY=sk-ant-api03-xxxx

# OpenAI API
OPENAI_API_KEY=sk-xxxx

# Application
ENVIRONMENT=development
DEBUG=True
SECRET_KEY=tu-secret-key-aqui
```

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🏃 EJECUTAR EN DESARROLLO

### Terminal 1: Backend

```bash
cd backend
source venv/bin/activate  # o venv\Scripts\activate en Windows
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El backend estará en: `http://localhost:8000`
Documentación API: `http://localhost:8000/docs`

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

El frontend estará en: `http://localhost:3000`

---

## 📁 ESTRUCTURA DE DESARROLLO

### Backend (FastAPI)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py               # Entry point
│   ├── api/                  # Endpoints
│   │   ├── deps.py          # Dependencias comunes
│   │   └── v1/
│   │       ├── auth.py
│   │       ├── content.py
│   │       ├── search.py
│   │       └── chat.py
│   ├── core/                 # Config y utilidades
│   │   ├── config.py
│   │   ├── security.py
│   │   └── exceptions.py
│   ├── models/               # SQLAlchemy models
│   ├── schemas/              # Pydantic schemas
│   ├── services/             # Lógica de negocio
│   └── db/                   # Database config
├── tests/
├── requirements.txt
└── Dockerfile
```

### Frontend (Next.js)

```
frontend/
├── src/
│   ├── app/                  # App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── (auth)/          # Rutas de auth
│   │   └── (dashboard)/     # Rutas protegidas
│   ├── components/           # React components
│   │   ├── ui/              # Componentes base
│   │   └── ...
│   ├── lib/                  # Utilidades
│   ├── hooks/                # Custom hooks
│   ├── stores/               # Zustand stores
│   └── types/                # TypeScript types
├── public/
├── package.json
└── next.config.js
```

---

## 💻 FLUJO DE DESARROLLO

### Crear Nuevo Endpoint (Backend)

1. **Definir Schema** (Pydantic):
```python
# app/schemas/content.py
from pydantic import BaseModel

class ContentCreate(BaseModel):
    url: str
    tags: list[str] = []

class ContentResponse(BaseModel):
    id: str
    url: str
    title: str
    summary: str | None

    class Config:
        from_attributes = True
```

2. **Crear Router**:
```python
# app/api/v1/content.py
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.content import ContentCreate, ContentResponse
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/", response_model=ContentResponse)
async def create_content(
    content: ContentCreate,
    current_user = Depends(get_current_user)
):
    # Lógica aquí
    pass
```

3. **Registrar en main.py**:
```python
# app/main.py
from app.api.v1 import content

app.include_router(
    content.router,
    prefix="/api/v1/content",
    tags=["content"]
)
```

### Crear Nuevo Componente (Frontend)

1. **Crear Componente**:
```typescript
// src/components/content/content-card.tsx
interface ContentCardProps {
    content: Content;
    onDelete?: (id: string) => void;
}

export function ContentCard({ content, onDelete }: ContentCardProps) {
    return (
        <div className="rounded-lg border p-4">
            <h3 className="font-semibold">{content.title}</h3>
            <p className="text-sm text-gray-500">{content.summary}</p>
        </div>
    );
}
```

2. **Crear Hook (si necesario)**:
```typescript
// src/hooks/use-contents.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useContents() {
    return useQuery({
        queryKey: ['contents'],
        queryFn: () => api.get('/content'),
    });
}

export function useCreateContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateContentInput) =>
            api.post('/content', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contents'] });
        },
    });
}
```

3. **Usar en Página**:
```typescript
// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useContents } from '@/hooks/use-contents';
import { ContentCard } from '@/components/content/content-card';

export default function DashboardPage() {
    const { data: contents, isLoading } = useContents();

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="grid grid-cols-3 gap-4">
            {contents?.map((content) => (
                <ContentCard key={content.id} content={content} />
            ))}
        </div>
    );
}
```

---

## 🧪 TESTING

### Backend Tests

```bash
cd backend

# Correr todos los tests
pytest

# Con coverage
pytest --cov=app --cov-report=html

# Test específico
pytest tests/test_api/test_content.py -v

# Ver coverage en navegador
open htmlcov/index.html
```

**Ejemplo de test:**
```python
# tests/test_api/test_content.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_create_content():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/content",
            json={"url": "https://example.com"},
            headers={"Authorization": "Bearer test-token"}
        )
        assert response.status_code == 201
        assert "id" in response.json()
```

### Frontend Tests

```bash
cd frontend

# Correr tests
npm test

# Watch mode
npm test -- --watch

# Type checking
npm run type-check
```

---

## 🐛 DEBUGGING

### Backend

1. **Logs detallados**:
```bash
uvicorn app.main:app --reload --log-level debug
```

2. **Debug en VS Code** (.vscode/launch.json):
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "FastAPI",
            "type": "python",
            "request": "launch",
            "module": "uvicorn",
            "args": ["app.main:app", "--reload"],
            "jinja": true
        }
    ]
}
```

3. **Probar endpoint manualmente**:
```bash
# Con curl
curl -X POST http://localhost:8000/api/v1/content \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"url": "https://example.com"}'

# Con httpie
http POST localhost:8000/api/v1/content url=https://example.com
```

### Frontend

1. **React DevTools**: Instalar extensión en navegador
2. **Console logs**: Usar `console.log` o DevTools
3. **Network tab**: Ver requests en DevTools > Network

---

## 📝 CONVENCIONES DE CÓDIGO

### Python (Backend)

```python
# Type hints siempre
def get_content(content_id: str) -> Content:
    pass

# Async cuando sea posible
async def fetch_url(url: str) -> str:
    pass

# Docstrings descriptivos
def classify_content(content: str, title: str) -> Classification:
    """
    Clasifica el contenido usando Claude API.

    Args:
        content: Texto del contenido
        title: Título del contenido

    Returns:
        Classification con schema_type, iab_tier1, etc.
    """
    pass

# snake_case para variables y funciones
user_id = "123"
def get_user_by_id():
    pass

# PascalCase para clases
class ContentService:
    pass
```

### TypeScript (Frontend)

```typescript
// Tipos explícitos
interface Content {
    id: string;
    title: string;
    url: string;
}

// camelCase para variables y funciones
const contentList = [];
function fetchContents() {}

// PascalCase para componentes y tipos
function ContentCard() {}
type ContentType = 'web' | 'youtube';

// Props con interface
interface ContentCardProps {
    content: Content;
    onDelete?: (id: string) => void;
}
```

### Git Commits

```bash
# Formato: <tipo>: <descripción>

# Tipos:
feat: nueva funcionalidad
fix: corrección de bug
docs: documentación
style: formato (sin cambio de lógica)
refactor: refactorización
test: tests
chore: tareas de mantenimiento

# Ejemplos:
git commit -m "feat: add content classification service"
git commit -m "fix: handle empty response from Claude API"
git commit -m "docs: update API documentation"
```

---

## 🔧 HERRAMIENTAS ÚTILES

### VS Code Extensions

- **Python**: ms-python.python
- **Pylance**: ms-python.vscode-pylance
- **ESLint**: dbaeumer.vscode-eslint
- **Prettier**: esbenp.prettier-vscode
- **Tailwind CSS IntelliSense**: bradlc.vscode-tailwindcss
- **GitLens**: eamodio.gitlens

### Comandos Útiles

```bash
# Formatear código Python
black app/
isort app/

# Formatear código TypeScript
npm run lint -- --fix
npx prettier --write .

# Ver dependencias desactualizadas
pip list --outdated
npm outdated

# Actualizar dependencias
pip install --upgrade <package>
npm update
```

---

## 🚨 ERRORES COMUNES

### "Module not found"
```bash
# Python: Asegurar que el venv está activado
source venv/bin/activate

# Node: Reinstalar dependencias
rm -rf node_modules
npm install
```

### "CORS error"
- Verificar que el backend tiene CORS configurado
- Verificar que `FRONTEND_URL` en backend apunta al frontend correcto

### "Supabase connection failed"
- Verificar que las variables de entorno están configuradas
- Verificar que el proyecto de Supabase existe y está activo

### "Claude API error"
- Verificar API key válida
- Verificar que tienes créditos disponibles
- Verificar rate limits

---

## 📚 RECURSOS

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Claude API Docs](https://docs.anthropic.com/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React Query Docs](https://tanstack.com/query/latest)

---

**Última actualización:** Diciembre 2024
