# 🚀 GUÍA DE DEPLOYMENT

Guía completa para desplegar Knowledge Base AI en producción.

---

## 📋 ARQUITECTURA DE DEPLOYMENT

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCCIÓN                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                    ┌──────────────┐          │
│  │   Vercel     │                    │   Railway    │          │
│  │  (Frontend)  │◄──────────────────▶│  (Backend)   │          │
│  │  Next.js 14  │    API Calls       │   FastAPI    │          │
│  └──────────────┘                    └──────────────┘          │
│         │                                    │                  │
│         │                                    │                  │
│         ▼                                    ▼                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                    SUPABASE                           │      │
│  │  PostgreSQL + pgvector + Auth + Storage              │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔵 FRONTEND - Vercel

### Preparación

1. **Verificar build local**:
```bash
cd frontend
npm run build
```

2. **Verificar variables de entorno**:
```bash
# Necesarias para producción
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Deploy con Vercel CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (primera vez)
cd frontend
vercel

# Deploy a producción
vercel --prod
```

### Deploy con GitHub

1. Ir a [vercel.com](https://vercel.com)
2. "Add New Project"
3. Conectar repositorio de GitHub
4. Seleccionar carpeta `frontend`
5. Configurar variables de entorno
6. Deploy

### Configuración vercel.json

```json
{
    "framework": "nextjs",
    "buildCommand": "npm run build",
    "outputDirectory": ".next",
    "regions": ["cdg1"],
    "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key",
        "NEXT_PUBLIC_API_URL": "@api_url"
    }
}
```

### Dominio Personalizado

1. En Vercel Dashboard > Project > Settings > Domains
2. Agregar dominio
3. Configurar DNS según instrucciones

---

## 🟢 BACKEND - Railway

### Preparación

1. **Verificar Dockerfile**:
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Instalar Playwright
RUN playwright install chromium
RUN playwright install-deps chromium

# Copiar código
COPY . .

# Exponer puerto
EXPOSE 8000

# Comando de inicio
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

2. **Crear railway.json**:
```json
{
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
        "builder": "DOCKERFILE",
        "dockerfilePath": "Dockerfile"
    },
    "deploy": {
        "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
        "healthcheckPath": "/health",
        "restartPolicyType": "ON_FAILURE"
    }
}
```

### Deploy con Railway CLI

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Crear proyecto (primera vez)
railway init

# Link proyecto existente
railway link

# Deploy
cd backend
railway up
```

### Deploy con GitHub

1. Ir a [railway.app](https://railway.app)
2. "New Project" > "Deploy from GitHub repo"
3. Seleccionar repositorio
4. Configurar root directory: `backend`
5. Configurar variables de entorno
6. Deploy automático con cada push

### Variables de Entorno (Railway)

```bash
# En Railway Dashboard > Variables
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJxxxx...
SUPABASE_SERVICE_KEY=eyJxxxx...
ANTHROPIC_API_KEY=sk-ant-api03-xxxx
OPENAI_API_KEY=sk-xxxx
ENVIRONMENT=production
DEBUG=False
SECRET_KEY=<generar-key-segura>
ALLOWED_ORIGINS=https://yourdomain.com
```

### Dominio Personalizado (Railway)

1. Railway Dashboard > Project > Settings > Domains
2. "Generate Domain" o "Custom Domain"
3. Configurar DNS si es custom

---

## 🗄️ SUPABASE - Producción

### Crear Proyecto de Producción

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard)
2. "New Project" (usar región cercana, ej: Frankfurt para España)
3. Copiar credenciales

### Configurar Base de Datos

```sql
-- 1. Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Crear tablas (ver docs/arquitectura/BASE_DATOS.md)
-- ... ejecutar scripts de creación ...

-- 3. Habilitar RLS
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
-- ... crear políticas ...

-- 4. Crear índices
-- ... crear índices ...
```

### Migrar Datos (si necesario)

```bash
# Exportar de desarrollo
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup.sql

# Importar a producción
psql -h db.yyyyy.supabase.co -U postgres -d postgres < backup.sql
```

### Configurar Backups

Supabase Pro incluye backups diarios automáticos. Para plan gratuito:

```bash
# Backup manual
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d).sql
```

---

## 🔄 CI/CD - GitHub Actions

### Workflow para Frontend

```yaml
# .github/workflows/frontend.yml
name: Frontend CI/CD

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
  pull_request:
    branches: [main]
    paths:
      - 'frontend/**'

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}

  # Deploy se hace automáticamente con Vercel GitHub integration
```

### Workflow para Backend

```yaml
# .github/workflows/backend.yml
name: Backend CI/CD

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
  pull_request:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: backend/requirements.txt

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Run linter
        run: |
          pip install black isort flake8
          black --check app/
          isort --check-only app/
          flake8 app/

      - name: Run tests
        run: pytest --cov=app
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

  # Deploy se hace automáticamente con Railway GitHub integration
```

---

## 📊 MONITOREO

### Vercel Analytics

1. En Vercel Dashboard > Project > Analytics
2. Habilitar Web Analytics
3. Agregar en `frontend/src/app/layout.tsx`:

```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
    return (
        <html>
            <body>
                {children}
                <Analytics />
            </body>
        </html>
    );
}
```

### Railway Metrics

- Railway Dashboard > Project > Metrics
- CPU, Memory, Network automático

### Sentry (Error Tracking)

```bash
# Backend
pip install sentry-sdk[fastapi]

# Frontend
npm install @sentry/nextjs
```

```python
# backend/app/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn="https://xxx@sentry.io/xxx",
    integrations=[FastApiIntegration()],
    environment="production",
    traces_sample_rate=0.1,
)
```

### Uptime Monitoring

Opciones gratuitas:
- UptimeRobot
- Freshping
- Railway's built-in health checks

---

## 🔒 SEGURIDAD EN PRODUCCIÓN

### Checklist de Seguridad

- [ ] HTTPS habilitado (automático en Vercel/Railway)
- [ ] Variables de entorno seguras (no en código)
- [ ] CORS configurado correctamente
- [ ] Rate limiting habilitado
- [ ] RLS activo en Supabase
- [ ] API keys rotadas
- [ ] Logs no exponen datos sensibles

### Headers de Seguridad (Next.js)

```typescript
// frontend/next.config.js
const securityHeaders = [
    {
        key: 'X-DNS-Prefetch-Control',
        value: 'on'
    },
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
    },
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
    },
    {
        key: 'X-Frame-Options',
        value: 'DENY'
    },
    {
        key: 'X-XSS-Protection',
        value: '1; mode=block'
    }
];

module.exports = {
    async headers() {
        return [
            {
                source: '/:path*',
                headers: securityHeaders,
            },
        ];
    },
};
```

### Rate Limiting (FastAPI)

```python
# backend/app/main.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/api/v1/content")
@limiter.limit("100/minute")
async def list_contents(request: Request):
    pass
```

---

## 💰 COSTOS DE PRODUCCIÓN

### Estimación Mensual

| Servicio | Plan | Costo |
|----------|------|-------|
| Vercel | Hobby/Pro | $0-20 |
| Railway | Starter | $5-15 |
| Supabase | Free/Pro | $0-25 |
| Claude API | Usage | $10-30 |
| OpenAI API | Usage | $5-10 |
| Dominio | Anual | ~$12/año |
| **Total** | | **$20-100/mes** |

### Optimización de Costos

1. **Caché agresivo**: Reducir llamadas a APIs
2. **Batch processing**: Agrupar operaciones
3. **Lazy loading**: Cargar solo lo necesario
4. **Compression**: Reducir tamaño de respuestas

---

## 🔄 ROLLBACK

### Vercel

```bash
# Ver deployments anteriores
vercel ls

# Rollback a deployment específico
vercel rollback <deployment-url>
```

### Railway

1. Dashboard > Deployments
2. Click en deployment anterior
3. "Rollback to this deployment"

### Base de Datos

```bash
# Restaurar backup
psql -h db.xxxxx.supabase.co -U postgres -d postgres < backup.sql
```

---

## 📝 CHECKLIST DE DEPLOYMENT

### Pre-deployment

- [ ] Tests pasando en local
- [ ] Build exitoso en local
- [ ] Variables de entorno configuradas
- [ ] Secrets en GitHub/Railway/Vercel
- [ ] Base de datos migrada
- [ ] RLS configurado

### Post-deployment

- [ ] Verificar que la app carga
- [ ] Probar login/registro
- [ ] Probar crear contenido
- [ ] Verificar conexión a APIs externas
- [ ] Verificar logs en busca de errores
- [ ] Configurar monitoreo/alertas

---

**Última actualización:** Diciembre 2024
