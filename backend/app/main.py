"""
FastAPI main application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import content, chat, search, usage, folders, apple_notes, quick_save, process, taxonomy, tags, system_notes, projects, standalone_notes, mental_models, objectives, dashboard, files, google_drive, user_experts, podcasts
from app.services.batch_processor import batch_processor


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle events."""
    # Startup: Start the batch processor in background (non-blocking)
    import asyncio

    async def delayed_start():
        """Start batch processor after a delay to not block startup."""
        await asyncio.sleep(5)  # Wait 5 seconds after app is ready
        try:
            await batch_processor.start(interval_seconds=900)
        except Exception as e:
            print(f"Warning: Failed to start batch processor: {e}")

    # Start in background - don't await
    asyncio.create_task(delayed_start())
    print("Application startup complete")

    yield

    # Shutdown: Stop the batch processor
    try:
        await batch_processor.stop()
    except Exception as e:
        print(f"Warning: Error stopping batch processor: {e}")


app = FastAPI(
    title="Knowledge Base AI API",
    description="Personal knowledge base with AI-powered classification",
    version="0.1.0",
    lifespan=lifespan
)

# CORS - allow all origins for bookmarklet support
# Note: allow_credentials must be False when using "*" for origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
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


@app.get("/")
async def root():
    return {
        "message": "Knowledge Base AI API",
        "version": "0.1.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
