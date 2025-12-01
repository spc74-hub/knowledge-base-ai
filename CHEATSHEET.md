# 📝 CHEATSHEET - Comandos Útiles

Comandos rápidos para copiar/pegar durante el desarrollo del proyecto.

---

## 🚀 SETUP INICIAL

### Backend Setup
```bash
# Crear entorno virtual
cd backend
python -m venv venv

# Activar entorno virtual
# Mac/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Instalar Playwright browsers
playwright install chromium

# Crear archivo .env
cp .env.example .env
# Editar .env con tus API keys

# Correr servidor
uvicorn app.main:app --reload
```

### Frontend Setup
```bash
cd frontend

# Instalar dependencias
npm install

# Crear archivo .env.local
cp .env.example .env.local
# Editar .env.local con tus keys

# Correr en desarrollo
npm run dev
```

### Supabase Setup
```bash
# 1. Crear proyecto en https://supabase.com
# 2. Habilitar pgvector extension:
#    Dashboard → Database → Extensions → pgvector (enable)
# 3. Copiar URL y keys a .env files
```

---

## 📊 BASE DE DATOS

### Crear tabla principal (SQL en Supabase)
```sql
-- Crear tabla contents
CREATE TABLE contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type VARCHAR(50), -- 'web', 'youtube', 'tiktok', 'twitter'
  
  -- Schema.org classification
  schema_type VARCHAR(100),
  schema_subtype VARCHAR(100),
  
  -- IAB Taxonomy
  iab_tier1 VARCHAR(100),
  iab_tier2 VARCHAR(100),
  iab_tier3 VARCHAR(100),
  
  -- Content
  title TEXT,
  summary TEXT,
  raw_content TEXT,
  
  -- Concepts and entities
  concepts TEXT[],
  entities JSONB,
  
  -- Metadata
  language VARCHAR(10),
  sentiment VARCHAR(20),
  technical_level VARCHAR(20),
  content_format VARCHAR(50),
  user_tags TEXT[],
  
  -- Embedding
  embedding vector(1536),
  
  -- Additional metadata
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_contents_user_id ON contents(user_id);
CREATE INDEX idx_contents_type ON contents(type);
CREATE INDEX idx_contents_schema_type ON contents(schema_type);
CREATE INDEX idx_contents_iab_tier1 ON contents(iab_tier1);
CREATE INDEX idx_contents_concepts ON contents USING GIN(concepts);
CREATE INDEX idx_contents_entities ON contents USING GIN(entities);
CREATE INDEX idx_contents_user_tags ON contents USING GIN(user_tags);
CREATE INDEX idx_contents_created_at ON contents(created_at DESC);

-- Índice para búsqueda vectorial
CREATE INDEX ON contents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search
CREATE INDEX idx_contents_fts ON contents USING GIN(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, ''))
);

-- Row Level Security
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contents"
  ON contents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contents"
  ON contents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contents"
  ON contents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contents"
  ON contents FOR DELETE
  USING (auth.uid() = user_id);
```

### Trigger para updated_at
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 🧪 TESTING

### Backend Tests
```bash
# Correr todos los tests
pytest

# Con coverage
pytest --cov=app --cov-report=html

# Test específico
pytest tests/test_classification.py -v

# Ver coverage report
open htmlcov/index.html
```

### Frontend Tests
```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Type check
npm run type-check
```

---

## 🐛 DEBUGGING

### Ver logs del backend
```bash
# Si usas uvicorn directamente
uvicorn app.main:app --reload --log-level debug

# Ver logs de Celery worker
celery -A app.worker worker --loglevel=info
```

### Test Claude API
```bash
# Correr script de test
python scripts/test_claude_api.py
```

### Test OpenAI Embeddings
```bash
python scripts/test_openai_embeddings.py
```

---

## 📦 DOCKER

### Build y correr con Docker
```bash
# Build
docker-compose -f config/docker-compose.yml build

# Correr
docker-compose -f config/docker-compose.yml up

# Correr en background
docker-compose -f config/docker-compose.yml up -d

# Ver logs
docker-compose -f config/docker-compose.yml logs -f

# Parar
docker-compose -f config/docker-compose.yml down
```

---

## 🚀 DEPLOYMENT

### Frontend (Vercel)
```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd frontend
vercel --prod
```

### Backend (Railway)
```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link proyecto
railway link

# Deploy
railway up
```

---

## 🔧 UTILIDADES

### Migrar base de datos (Alembic)
```bash
# Crear migración
cd backend
alembic revision --autogenerate -m "descripcion"

# Aplicar migraciones
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Seed data (taxonomías)
```bash
python scripts/seed_taxonomies.py
```

### Generar embeddings para contenido existente
```bash
python scripts/generate_embeddings.py
```

---

## 📊 COMANDOS CLAUDE CODE

### Para pedir a Claude Code durante desarrollo:

**Setup inicial:**
```
Por favor ayúdame a configurar Supabase. 
Necesito crear el proyecto y la tabla contents.
```

**Crear endpoint:**
```
Crea el endpoint POST /content que:
1. Reciba una URL
2. Fetch el contenido con Beautiful Soup
3. Genere resumen con Claude
4. Guarde en Supabase
```

**Debugging:**
```
Tengo este error: [pega el error]
¿Qué significa y cómo lo soluciono?
```

**Testing:**
```
Crea tests para el servicio de clasificación
```

**Review:**
```
¿Puedes revisar este código y sugerir mejoras?
[pega código]
```

---

## 🔑 VARIABLES DE ENTORNO

### Backend (.env)
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
API_HOST=0.0.0.0
API_PORT=8000
FRONTEND_URL=http://localhost:3000

# Security
SECRET_KEY=xxxx
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🐍 PYTHON SNIPPETS

### Llamar a Claude API
```python
from anthropic import Anthropic

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=2000,
    messages=[
        {"role": "user", "content": "Tu prompt aquí"}
    ]
)

response = message.content[0].text
```

### Generar embeddings
```python
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

response = client.embeddings.create(
    input="Tu texto aquí",
    model="text-embedding-3-small"
)

embedding = response.data[0].embedding  # List[float] de 1536 dimensiones
```

### Búsqueda semántica con pgvector
```python
from sqlalchemy import text

query_embedding = [0.1, 0.2, ...]  # 1536 dimensiones

sql = text("""
    SELECT id, title, summary, 
           1 - (embedding <=> :query_embedding) as similarity
    FROM contents
    WHERE user_id = :user_id
    ORDER BY embedding <=> :query_embedding
    LIMIT :limit
""")

results = await session.execute(
    sql,
    {
        "query_embedding": query_embedding,
        "user_id": user_id,
        "limit": 10
    }
)
```

---

## ⚛️ REACT/NEXT.JS SNIPPETS

### Supabase Auth Hook
```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
```

### Fetch API con React Query
```typescript
import { useQuery } from '@tanstack/react-query'

async function fetchContents() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export function useContents() {
  return useQuery({
    queryKey: ['contents'],
    queryFn: fetchContents
  })
}
```

---

## 🎨 TAILWIND CSS CLASSES ÚTILES

```css
/* Layouts */
flex items-center justify-between
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4

/* Cards */
bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition

/* Buttons */
bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded

/* Loading states */
animate-pulse bg-gray-200 rounded

/* Text truncate */
truncate
line-clamp-3
```

---

## 🔍 COMANDOS DE BÚSQUEDA

### Git
```bash
# Ver cambios
git status
git diff

# Commits
git add .
git commit -m "feat: add classification service"

# Push
git push origin main

# Branches
git checkout -b feature/new-feature
git merge feature/new-feature
```

### Find en código
```bash
# Buscar en archivos Python
grep -r "function_name" backend/

# Buscar en archivos TS
grep -r "component_name" frontend/src/

# Buscar TODO comments
grep -r "TODO" .
```

---

## 💡 TIPS Y TRICKS

### Reiniciar todo
```bash
# Backend
cd backend
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
rm -rf node_modules .next
npm install
```

### Ver versiones
```bash
python --version
node --version
npm --version
docker --version
```

### Limpiar cache
```bash
# Python
find . -type d -name "__pycache__" -exec rm -r {} +
find . -type f -name "*.pyc" -delete

# Node
rm -rf frontend/node_modules frontend/.next
```

---

## 📚 RECURSOS ÚTILES

- **FastAPI docs:** https://fastapi.tiangolo.com/
- **Next.js docs:** https://nextjs.org/docs
- **Supabase docs:** https://supabase.com/docs
- **Claude API:** https://docs.anthropic.com/
- **OpenAI API:** https://platform.openai.com/docs/
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Schema.org:** https://schema.org/
- **IAB Taxonomy:** https://iabtechlab.com/standards/content-taxonomy/

---

**💡 Pro tip:** Guarda este archivo abierto en una pestaña de VS Code para referencia rápida durante el desarrollo.
