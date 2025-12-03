"""
FastAPI main application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import content, chat, search, usage, folders, apple_notes, quick_save, process, taxonomy, tags
from app.services.batch_processor import batch_processor


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle events."""
    # Startup: Start the batch processor
    await batch_processor.start(interval_seconds=3600)  # Every hour
    yield
    # Shutdown: Stop the batch processor
    await batch_processor.stop()


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
