# 🧪 GUÍA DE TESTING

Guía completa para testing en Knowledge Base AI.

---

## 📋 ESTRATEGIA DE TESTING

```
┌─────────────────────────────────────────────────────────────┐
│                    PIRÁMIDE DE TESTS                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                      ┌─────┐                                │
│                     /  E2E  \         (Pocos, lentos)       │
│                    /─────────\                              │
│                   / Integration\      (Algunos)             │
│                  /───────────────\                          │
│                 /    Unit Tests   \   (Muchos, rápidos)     │
│                /───────────────────\                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🐍 BACKEND TESTING (Python/Pytest)

### Setup

```bash
cd backend

# Instalar dependencias de testing
pip install pytest pytest-asyncio pytest-cov httpx

# Estructura de tests
tests/
├── conftest.py           # Fixtures globales
├── test_api/
│   ├── test_auth.py
│   ├── test_content.py
│   ├── test_search.py
│   └── test_chat.py
└── test_services/
    ├── test_fetcher.py
    ├── test_classifier.py
    └── test_summarizer.py
```

### Configuración (conftest.py)

```python
# tests/conftest.py
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base import Base
from app.core.config import settings

# Base de datos de testing
TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost/test_db"

@pytest_asyncio.fixture
async def db_session():
    """Crear sesión de base de datos para tests."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    """Cliente HTTP para tests de API."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def mock_user():
    """Usuario de prueba."""
    return {
        "id": "test-user-id",
        "email": "test@example.com"
    }


@pytest.fixture
def auth_headers(mock_user):
    """Headers con autenticación."""
    return {"Authorization": f"Bearer test-token-{mock_user['id']}"}
```

### Tests de API

```python
# tests/test_api/test_content.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_content_success(client: AsyncClient, auth_headers):
    """Test crear contenido exitosamente."""
    response = await client.post(
        "/api/v1/content",
        json={"url": "https://example.com/article"},
        headers=auth_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["url"] == "https://example.com/article"


@pytest.mark.asyncio
async def test_create_content_invalid_url(client: AsyncClient, auth_headers):
    """Test crear contenido con URL inválida."""
    response = await client.post(
        "/api/v1/content",
        json={"url": "not-a-valid-url"},
        headers=auth_headers
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_content_unauthorized(client: AsyncClient):
    """Test crear contenido sin autenticación."""
    response = await client.post(
        "/api/v1/content",
        json={"url": "https://example.com"}
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_contents(client: AsyncClient, auth_headers):
    """Test listar contenidos del usuario."""
    # Crear algunos contenidos primero
    for i in range(3):
        await client.post(
            "/api/v1/content",
            json={"url": f"https://example.com/article-{i}"},
            headers=auth_headers
        )

    # Listar
    response = await client.get(
        "/api/v1/content",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 3


@pytest.mark.asyncio
async def test_get_content_not_found(client: AsyncClient, auth_headers):
    """Test obtener contenido que no existe."""
    response = await client.get(
        "/api/v1/content/non-existent-id",
        headers=auth_headers
    )

    assert response.status_code == 404
```

### Tests de Servicios

```python
# tests/test_services/test_classifier.py
import pytest
from unittest.mock import AsyncMock, patch

from app.services.classifier import ClassifierService

@pytest.fixture
def classifier_service():
    return ClassifierService()


@pytest.mark.asyncio
async def test_classify_article(classifier_service):
    """Test clasificar un artículo."""
    content = """
    Machine learning is transforming healthcare.
    New AI models can detect diseases earlier than ever.
    """

    with patch.object(
        classifier_service, '_call_claude',
        new_callable=AsyncMock
    ) as mock_claude:
        mock_claude.return_value = {
            "schema_type": "Article",
            "schema_subtype": "TechArticle",
            "iab_tier1": "Technology & Computing",
            "iab_tier2": "Artificial Intelligence",
            "concepts": ["machine learning", "healthcare", "AI"]
        }

        result = await classifier_service.classify(
            title="AI in Healthcare",
            content=content
        )

        assert result.schema_type == "Article"
        assert result.iab_tier1 == "Technology & Computing"
        assert "machine learning" in result.concepts


@pytest.mark.asyncio
async def test_classify_validates_taxonomy(classifier_service):
    """Test que la clasificación valida contra taxonomías."""
    with patch.object(
        classifier_service, '_call_claude',
        new_callable=AsyncMock
    ) as mock_claude:
        # Claude devuelve categoría inválida
        mock_claude.return_value = {
            "schema_type": "InvalidType",
            "iab_tier1": "Invalid Category",
        }

        result = await classifier_service.classify(
            title="Test",
            content="Test content"
        )

        # Debe usar fallback
        assert result.schema_type in ["Article", "VideoObject", ...]
```

### Tests de Fetcher

```python
# tests/test_services/test_fetcher.py
import pytest
from unittest.mock import patch, MagicMock
import httpx

from app.services.fetcher import FetcherService

@pytest.fixture
def fetcher_service():
    return FetcherService()


@pytest.mark.asyncio
async def test_fetch_web_article(fetcher_service):
    """Test fetch de artículo web."""
    mock_response = MagicMock()
    mock_response.text = """
    <html>
        <head>
            <title>Test Article</title>
            <meta property="og:description" content="Test description">
        </head>
        <body>
            <article>
                <p>This is the article content.</p>
            </article>
        </body>
    </html>
    """
    mock_response.status_code = 200

    with patch('httpx.AsyncClient.get', return_value=mock_response):
        result = await fetcher_service.fetch("https://example.com/article")

        assert result.type == "web"
        assert result.title == "Test Article"
        assert "article content" in result.content


@pytest.mark.asyncio
async def test_fetch_youtube_detects_type(fetcher_service):
    """Test que detecta URL de YouTube."""
    result = fetcher_service._detect_type("https://youtube.com/watch?v=abc123")
    assert result == "youtube"

    result = fetcher_service._detect_type("https://youtu.be/abc123")
    assert result == "youtube"


@pytest.mark.asyncio
async def test_fetch_handles_timeout(fetcher_service):
    """Test manejo de timeout."""
    with patch('httpx.AsyncClient.get', side_effect=httpx.TimeoutException):
        with pytest.raises(Exception) as exc_info:
            await fetcher_service.fetch("https://slow-site.com")

        assert "timeout" in str(exc_info.value).lower()
```

### Ejecutar Tests

```bash
# Todos los tests
pytest

# Con coverage
pytest --cov=app --cov-report=html

# Tests específicos
pytest tests/test_api/test_content.py -v

# Tests con patrón
pytest -k "test_create"

# Ver output detallado
pytest -v -s

# Paralelizar
pip install pytest-xdist
pytest -n auto
```

---

## ⚛️ FRONTEND TESTING (TypeScript/Jest)

### Setup

```bash
cd frontend

# Instalar dependencias
npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest

# Estructura
src/
├── __tests__/
│   ├── components/
│   │   └── content-card.test.tsx
│   ├── hooks/
│   │   └── use-contents.test.tsx
│   └── lib/
│       └── api.test.ts
└── __mocks__/
    └── supabase.ts
```

### Configuración (jest.config.js)

```javascript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
    dir: './',
});

const customJestConfig = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testEnvironment: 'jest-environment-jsdom',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
};

module.exports = createJestConfig(customJestConfig);
```

```javascript
// jest.setup.js
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        prefetch: jest.fn(),
    }),
    usePathname: () => '/',
}));
```

### Tests de Componentes

```typescript
// src/__tests__/components/content-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ContentCard } from '@/components/content/content-card';

const mockContent = {
    id: '1',
    title: 'Test Article',
    summary: 'This is a test summary',
    url: 'https://example.com',
    type: 'web' as const,
    created_at: '2024-12-01T10:00:00Z',
};

describe('ContentCard', () => {
    it('renders content title and summary', () => {
        render(<ContentCard content={mockContent} />);

        expect(screen.getByText('Test Article')).toBeInTheDocument();
        expect(screen.getByText('This is a test summary')).toBeInTheDocument();
    });

    it('calls onDelete when delete button is clicked', () => {
        const onDelete = jest.fn();
        render(<ContentCard content={mockContent} onDelete={onDelete} />);

        const deleteButton = screen.getByRole('button', { name: /delete/i });
        fireEvent.click(deleteButton);

        expect(onDelete).toHaveBeenCalledWith('1');
    });

    it('shows favorite icon when content is favorite', () => {
        const favoriteContent = { ...mockContent, is_favorite: true };
        render(<ContentCard content={favoriteContent} />);

        expect(screen.getByTestId('favorite-icon')).toHaveClass('text-yellow-500');
    });

    it('links to content detail page', () => {
        render(<ContentCard content={mockContent} />);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/content/1');
    });
});
```

### Tests de Hooks

```typescript
// src/__tests__/hooks/use-contents.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useContents } from '@/hooks/use-contents';

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

// Mock API
jest.mock('@/lib/api', () => ({
    api: {
        get: jest.fn(),
    },
}));

import { api } from '@/lib/api';

describe('useContents', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('fetches contents successfully', async () => {
        const mockData = [
            { id: '1', title: 'Article 1' },
            { id: '2', title: 'Article 2' },
        ];
        (api.get as jest.Mock).mockResolvedValue(mockData);

        const { result } = renderHook(() => useContents(), { wrapper });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockData);
        expect(api.get).toHaveBeenCalledWith('/content');
    });

    it('handles error', async () => {
        (api.get as jest.Mock).mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useContents(), { wrapper });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeDefined();
    });
});
```

### Tests de Utilidades

```typescript
// src/__tests__/lib/utils.test.ts
import { formatDate, truncateText, isValidUrl } from '@/lib/utils';

describe('formatDate', () => {
    it('formats date correctly', () => {
        const date = '2024-12-01T10:30:00Z';
        expect(formatDate(date)).toBe('1 dic 2024');
    });

    it('handles invalid date', () => {
        expect(formatDate('invalid')).toBe('Fecha inválida');
    });
});

describe('truncateText', () => {
    it('truncates long text', () => {
        const text = 'This is a very long text that should be truncated';
        expect(truncateText(text, 20)).toBe('This is a very long...');
    });

    it('does not truncate short text', () => {
        const text = 'Short text';
        expect(truncateText(text, 20)).toBe('Short text');
    });
});

describe('isValidUrl', () => {
    it('validates correct URLs', () => {
        expect(isValidUrl('https://example.com')).toBe(true);
        expect(isValidUrl('http://test.org/path')).toBe(true);
    });

    it('rejects invalid URLs', () => {
        expect(isValidUrl('not-a-url')).toBe(false);
        expect(isValidUrl('')).toBe(false);
    });
});
```

### Ejecutar Tests Frontend

```bash
# Todos los tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# Test específico
npm test -- content-card

# Verbose output
npm test -- --verbose
```

---

## 🎭 E2E TESTING (Playwright)

### Setup

```bash
# Instalar Playwright
npm install --save-dev @playwright/test
npx playwright install

# Estructura
e2e/
├── playwright.config.ts
├── auth.setup.ts
└── tests/
    ├── auth.spec.ts
    ├── content.spec.ts
    └── search.spec.ts
```

### Configuración

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e/tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
    },
});
```

### Tests E2E

```typescript
// e2e/tests/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test('should show login page', async ({ page }) => {
        await page.goto('/login');

        await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
        await expect(page.getByLabel('Email')).toBeVisible();
        await expect(page.getByLabel('Password')).toBeVisible();
    });

    test('should login successfully', async ({ page }) => {
        await page.goto('/login');

        await page.getByLabel('Email').fill('test@example.com');
        await page.getByLabel('Password').fill('password123');
        await page.getByRole('button', { name: /login/i }).click();

        await expect(page).toHaveURL('/dashboard');
        await expect(page.getByText('Welcome')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login');

        await page.getByLabel('Email').fill('wrong@example.com');
        await page.getByLabel('Password').fill('wrongpassword');
        await page.getByRole('button', { name: /login/i }).click();

        await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    });
});
```

```typescript
// e2e/tests/content.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Content Management', () => {
    test.beforeEach(async ({ page }) => {
        // Login antes de cada test
        await page.goto('/login');
        await page.getByLabel('Email').fill('test@example.com');
        await page.getByLabel('Password').fill('password123');
        await page.getByRole('button', { name: /login/i }).click();
        await page.waitForURL('/dashboard');
    });

    test('should add new content', async ({ page }) => {
        await page.getByRole('button', { name: /add content/i }).click();

        await page.getByLabel('URL').fill('https://example.com/article');
        await page.getByRole('button', { name: /save/i }).click();

        // Esperar procesamiento
        await expect(page.getByText(/processing/i)).toBeVisible();
        await expect(page.getByText(/processing/i)).not.toBeVisible({ timeout: 30000 });

        // Verificar que aparece en la lista
        await expect(page.getByText('example.com')).toBeVisible();
    });

    test('should search contents', async ({ page }) => {
        await page.getByPlaceholder('Search...').fill('machine learning');
        await page.keyboard.press('Enter');

        await expect(page.getByText(/results for "machine learning"/i)).toBeVisible();
    });

    test('should filter by category', async ({ page }) => {
        await page.getByRole('button', { name: /filters/i }).click();
        await page.getByLabel('Category').selectOption('Technology & Computing');

        await expect(page.getByTestId('content-card')).toHaveCount(5);
    });
});
```

### Ejecutar E2E Tests

```bash
# Todos los tests
npx playwright test

# Con UI
npx playwright test --ui

# Test específico
npx playwright test auth.spec.ts

# Con debug
npx playwright test --debug

# Ver reporte
npx playwright show-report
```

---

## 📊 COVERAGE GOALS

| Tipo | Objetivo | Prioridad |
|------|----------|-----------|
| Unit Tests (Backend) | >80% | Alta |
| Unit Tests (Frontend) | >70% | Alta |
| Integration Tests | >60% | Media |
| E2E Tests | Flujos críticos | Media |

---

## 🔄 TESTING EN CI/CD

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: |
          cd backend
          pip install -r requirements.txt
          pytest --cov=app --cov-report=xml
      - uses: codecov/codecov-action@v3

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: |
          cd frontend
          npm ci
          npm test -- --coverage
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: |
          cd frontend
          npm ci
          npx playwright install --with-deps
          npm run build
          npm run test:e2e
```

---

**Última actualización:** Diciembre 2024
