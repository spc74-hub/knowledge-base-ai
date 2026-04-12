"""
FastAPI main application entry point.
Migrated from Supabase to self-hosted PostgreSQL with SQLAlchemy.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import (
    auth, content, chat, search, usage, folders, apple_notes, quick_save,
    process, taxonomy, tags, system_notes, projects, standalone_notes,
    mental_models, objectives, dashboard, files, google_drive, user_experts,
    podcasts, api_keys, areas, habits, daily_journal, actions, rest_compat,
)
from app.services.batch_processor import batch_processor


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle events."""
    import asyncio
    from app.db.session import engine
    from app.models.base import Base

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed default user if none exists
    await _seed_default_user()

    # Start batch processor after a delay
    async def delayed_start():
        await asyncio.sleep(5)
        try:
            await batch_processor.start(interval_seconds=900)
        except Exception as e:
            print(f"Warning: Failed to start batch processor: {e}")

    asyncio.create_task(delayed_start())
    print("Application startup complete")

    yield

    # Shutdown
    try:
        await batch_processor.stop()
    except Exception as e:
        print(f"Warning: Error stopping batch processor: {e}")

    await engine.dispose()


async def _seed_default_user():
    """Create default user if the users table is empty."""
    from app.db.session import AsyncSessionLocal
    from app.db.compat import CompatDB

    async with AsyncSessionLocal() as session:
        db = CompatDB(session)
        result = await db.table("users").select("id").limit(1).execute()
        if not result.data:
            import bcrypt
            password_hash = bcrypt.hashpw("changeme".encode(), bcrypt.gensalt()).decode()
            await db.table("users").insert({
                "email": "sergio.porcar@gmail.com",
                "password_hash": password_hash,
                "name": "Sergio",
            }).execute()
            print("Default user created: sergio.porcar@gmail.com / changeme")


app = FastAPI(
    title="Knowledge Base AI API",
    description="Personal knowledge base with AI-powered classification",
    version="0.2.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(content.router, prefix="/api/v1/content", tags=["content"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(usage.router, prefix="/api/v1/usage", tags=["usage"])
app.include_router(folders.router, prefix="/api/v1/folders", tags=["folders"])
app.include_router(apple_notes.router, prefix="/api/v1/apple-notes", tags=["apple-notes"])
app.include_router(quick_save.router, prefix="/api/v1/quick-save", tags=["quick-save"])
app.include_router(process.router, prefix="/api/v1/process", tags=["process"])
app.include_router(taxonomy.router, prefix="/api/v1/taxonomy", tags=["taxonomy"])
app.include_router(tags.router, prefix="/api/v1/tags", tags=["tags"])
app.include_router(system_notes.router, prefix="/api/v1/system-notes", tags=["system-notes"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(standalone_notes.router, prefix="/api/v1/notes", tags=["notes"])
app.include_router(mental_models.router, prefix="/api/v1/mental-models", tags=["mental-models"])
app.include_router(objectives.router, prefix="/api/v1/objectives", tags=["objectives"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(files.router, prefix="/api/v1/files", tags=["files"])
app.include_router(google_drive.router, prefix="/api/v1/google-drive", tags=["google-drive"])
app.include_router(user_experts.router, prefix="/api/v1/experts", tags=["experts"])
app.include_router(podcasts.router, prefix="/api/v1/podcasts", tags=["podcasts"])
app.include_router(api_keys.router, prefix="/api/v1/api-keys", tags=["api-keys"])
app.include_router(areas.router, prefix="/api/v1", tags=["areas"])
app.include_router(habits.router, prefix="/api/v1", tags=["habits"])
app.include_router(daily_journal.router, prefix="/api/v1", tags=["daily-journal"])
app.include_router(actions.router, prefix="/api/v1", tags=["actions"])
app.include_router(rest_compat.router, prefix="/rest/v1", tags=["rest-compat"])


@app.get("/")
async def root():
    return {
        "message": "Knowledge Base AI API",
        "version": "0.2.0",
        "status": "running",
        "database": "self-hosted PostgreSQL",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
