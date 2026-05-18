"""
Content management endpoints.
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, status, BackgroundTasks, UploadFile, File
from pydantic import BaseModel, HttpUrl
import csv
import io

from app.api.deps import Database, CurrentUser
from app.services.fetcher import fetcher_service
from app.services.url_normalizer import normalize_url, extract_content_id

router = APIRouter()


# Request/Response Models
class ContentCreate(BaseModel):
    url: HttpUrl
    tags: List[str] = []
    process_async: bool = False


class BulkUrlImport(BaseModel):
    urls: List[str]
    tags: List[str] = []


class NoteCreate(BaseModel):
    title: str
    content: str
    tags: List[str] = []


VALID_NOTE_PRIORITIES = ["important", "urgent", "A", "B", "C"]


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    priority: Optional[str] = None  # important, urgent, A, B, C


class BulkImportResult(BaseModel):
    url: str
    success: bool
    content_id: Optional[str] = None
    error: Optional[str] = None


class BulkImportResponse(BaseModel):
    total: int
    successful: int
    failed: int
    results: List[BulkImportResult]


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    user_tags: Optional[List[str]] = None
    user_note: Optional[str] = None  # Personal note attached to content
    note_category: Optional[str] = None  # For notes: idea, reflection, summary, project, reference
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    is_asset: Optional[bool] = None  # Mark as reusable asset/template
    project_id: Optional[str] = None  # Link to project (can be null to unlink)
    user_category: Optional[str] = None  # Strategic-layer category override


class ContentResponse(BaseModel):
    id: str
    url: str
    type: str
    title: str
    summary: Optional[str] = None
    user_tags: List[str] = []
    is_favorite: bool = False
    is_archived: bool = False
    is_asset: bool = False
    project_id: Optional[str] = None
    created_at: str
    view_count: Optional[int] = None
    source_metadata: Optional[dict] = None


class ContentDetailResponse(ContentResponse):
    description: Optional[str] = None
    user_note: Optional[str] = None
    user_category: Optional[str] = None
    note_category: Optional[str] = None
    metadata: Optional[dict] = None
    folder_id: Optional[str] = None
    area_id: Optional[str] = None
    updated_at: Optional[str] = None


class PaginatedResponse(BaseModel):
    data: List[ContentResponse]
    meta: dict


class StatsResponse(BaseModel):
    total_contents: int
    by_type: dict
    by_category: dict
    favorites_count: int
    archived_count: int
    this_week: int
    this_month: int


# =====================================================
# OPTIMIZED LISTING FIELDS (for faster queries)
# =====================================================
# Fields needed for list/card display
LIST_FIELDS = (
    "id, url, type, title, summary, user_tags, is_favorite, is_archived, "
    "is_asset, project_id, created_at, view_count, source_metadata"
)


# In-memory cache for facets (simple TTL cache)
import time
_facets_cache: dict = {}
FACETS_CACHE_TTL = 300  # 5 minutes


def get_cached_facets(user_id: str):
    """Get cached facets if still valid."""
    if user_id in _facets_cache:
        cached = _facets_cache[user_id]
        if time.time() - cached["timestamp"] < FACETS_CACHE_TTL:
            return cached["data"]
    return None


def set_cached_facets(user_id: str, data: dict):
    """Cache facets for user."""
    _facets_cache[user_id] = {
        "timestamp": time.time(),
        "data": data
    }


def invalidate_facets_cache(user_id: str):
    """Invalidate facets cache for user."""
    if user_id in _facets_cache:
        del _facets_cache[user_id]


@router.get("/", response_model=PaginatedResponse)
async def list_contents(
    current_user: CurrentUser,
    db: Database,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    type: Optional[str] = None,
    category: Optional[str] = None,  # Maps to user_category
    tags: Optional[str] = None,
    favorite: Optional[bool] = None,
    archived: bool = False,
    asset: Optional[bool] = None,
    project_id: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    q: Optional[str] = None
):
    """List user's contents with pagination and filters."""
    try:
        query = db.table("contents").select(LIST_FIELDS).eq("user_id", current_user["id"])

        if type:
            query = query.eq("type", type)
        if category:
            query = query.eq("user_category", category)
        if favorite is not None:
            query = query.eq("is_favorite", favorite)
        if not archived:
            query = query.eq("is_archived", False)
        if asset is not None:
            query = query.eq("is_asset", asset)
        if project_id:
            query = query.eq("project_id", project_id)
        if tags:
            tag_list = tags.split(",")
            query = query.contains("user_tags", tag_list)
        if q:
            query = query.or_(f"title.ilike.%{q}%,summary.ilike.%{q}%")

        # Sorting
        query = query.order(sort_by, desc=(sort_order == "desc"))

        # Pagination
        offset = (page - 1) * per_page
        query = query.range(offset, offset + per_page - 1)

        # Execute
        response = await query.execute()

        # Get total count
        count_query = db.table("contents").select("id", count="exact").eq("user_id", current_user["id"])
        if not archived:
            count_query = count_query.eq("is_archived", False)
        count_response = await count_query.execute()
        total = count_response.count or 0

        return {
            "data": response.data,
            "meta": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": (total + per_page - 1) // per_page
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/stats", response_model=StatsResponse)
async def get_stats(current_user: CurrentUser, db: Database):
    """
    Get user's content statistics.
    """
    try:
        user_id = current_user["id"]

        # Total contents
        total = await db.table("contents").select("id", count="exact").eq("user_id", user_id).execute()

        # By type
        type_stats = {}
        for content_type in ["web", "youtube", "tiktok", "twitter"]:
            count = await db.table("contents").select("id", count="exact").eq("user_id", user_id).eq("type", content_type).execute()
            type_stats[content_type] = count.count or 0

        # Favorites and archived
        favorites = await db.table("contents").select("id", count="exact").eq("user_id", user_id).eq("is_favorite", True).execute()
        archived = await db.table("contents").select("id", count="exact").eq("user_id", user_id).eq("is_archived", True).execute()

        return {
            "total_contents": total.count or 0,
            "by_type": type_stats,
            "by_category": {},  # TODO: Implement category stats
            "favorites_count": favorites.count or 0,
            "archived_count": archived.count or 0,
            "this_week": 0,  # TODO: Implement time-based stats
            "this_month": 0
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{content_id}", response_model=ContentDetailResponse)
async def get_content(content_id: str, current_user: CurrentUser, db: Database):
    """
    Get a specific content by ID.
    """
    try:
        response = await db.table("contents").select("*").eq("id", content_id).eq("user_id", current_user["id"]).single().execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found"
            )

        return response.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/", response_model=ContentResponse, status_code=status.HTTP_201_CREATED)
async def create_content(data: ContentCreate, current_user: CurrentUser, db: Database):
    """
    Create new content from URL.
    By default, only fetches content and saves as pending for later processing.
    Set process_async=True to process immediately.
    """
    try:
        # Keep original URL for fetching, normalize for storage/dedup
        original_url = str(data.url)
        url_str = normalize_url(original_url)
        user_id = current_user["id"]

        # Check if normalized URL already exists for user
        existing = await db.table("contents").select("id").eq("user_id", user_id).eq("url", url_str).execute()

        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="URL already saved"
            )

        # Step 1: Fetch content from ORIGINAL URL (yt-dlp needs full URL)
        fetch_result = await fetcher_service.fetch(original_url)

        if not fetch_result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch content: {fetch_result.error}"
            )

        # AI processing pipeline removed (see CHANGELOG 2026-05-18) — store only basics.
        content_data = {
            "user_id": user_id,
            "url": url_str,
            "type": fetch_result.type,
            "title": fetch_result.title,
            "metadata": fetch_result.metadata,
            "user_tags": data.tags,
            "view_count": fetch_result.view_count,
            "description": fetch_result.description,
        }

        response = await db.table("contents").insert(content_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create content"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: str,
    data: ContentUpdate,
    current_user: CurrentUser,
    db: Database
):
    """
    Update content.
    """
    try:
        # Check ownership
        existing = await db.table("contents").select("id").eq("id", content_id).eq("user_id", current_user["id"]).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found"
            )

        # Update only provided fields
        update_data = data.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        response = await db.table("contents").update(update_data).eq("id", content_id).execute()

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/{content_id}")
async def delete_content(content_id: str, current_user: CurrentUser, db: Database):
    """
    Delete content.
    """
    try:
        # Check ownership
        existing = await db.table("contents").select("id").eq("id", content_id).eq("user_id", current_user["id"]).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found"
            )

        await db.table("contents").delete().eq("id", content_id).execute()

        return {"message": "Content deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{content_id}/favorite")
async def toggle_content_favorite(
    content_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Toggle favorite status for a content.
    """
    try:
        # Check ownership and get current status
        existing = await db.table("contents").select("id, is_favorite").eq(
            "id", content_id
        ).eq("user_id", current_user["id"]).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found"
            )

        current_favorite = existing.data[0].get("is_favorite", False)
        new_favorite = not current_favorite

        await db.table("contents").update({
            "is_favorite": new_favorite
        }).eq("id", content_id).execute()

        return {
            "success": True,
            "is_favorite": new_favorite
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


class BulkActionRequest(BaseModel):
    content_ids: List[str]


class BulkActionResponse(BaseModel):
    success: bool
    affected_count: int
    message: str


@router.post("/bulk/archive", response_model=BulkActionResponse)
async def bulk_archive_contents(
    data: BulkActionRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Archive multiple contents at once.
    """
    try:
        if not data.content_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No content IDs provided"
            )

        # Update all contents that belong to the user
        response = await db.table("contents")\
            .update({"is_archived": True})\
            .eq("user_id", current_user["id"])\
            .in_("id", data.content_ids)\
            .execute()

        affected_count = len(response.data) if response.data else 0

        return BulkActionResponse(
            success=True,
            affected_count=affected_count,
            message=f"{affected_count} contenido(s) archivado(s)"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/bulk/unarchive", response_model=BulkActionResponse)
async def bulk_unarchive_contents(
    data: BulkActionRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Unarchive (restore) multiple contents at once.
    """
    try:
        if not data.content_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No content IDs provided"
            )

        # Update all contents that belong to the user
        response = await db.table("contents")\
            .update({"is_archived": False})\
            .eq("user_id", current_user["id"])\
            .in_("id", data.content_ids)\
            .execute()

        affected_count = len(response.data) if response.data else 0

        return BulkActionResponse(
            success=True,
            affected_count=affected_count,
            message=f"{affected_count} contenido(s) restaurado(s)"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/bulk/delete", response_model=BulkActionResponse)
async def bulk_delete_contents(
    data: BulkActionRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Delete multiple contents at once.
    """
    try:
        if not data.content_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No content IDs provided"
            )

        # First count how many will be deleted (for accurate count)
        count_response = await db.table("contents")\
            .select("id", count="exact")\
            .eq("user_id", current_user["id"])\
            .in_("id", data.content_ids)\
            .execute()

        affected_count = count_response.count or 0

        # Delete all contents that belong to the user
        await db.table("contents")\
            .delete()\
            .eq("user_id", current_user["id"])\
            .in_("id", data.content_ids)\
            .execute()

        return BulkActionResponse(
            success=True,
            affected_count=affected_count,
            message=f"{affected_count} contenido(s) eliminado(s)"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{content_id}/reprocess")
async def reprocess_content(
    content_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """
    No-op stub. The AI processing pipeline has been removed
    (see CHANGELOG 2026-05-18). Kept so existing clients don't 404.
    """
    return {
        "message": "Reprocessing disabled — AI pipeline removed",
        "success": True,
    }


@router.post("/bulk-import", response_model=BulkImportResponse)
async def bulk_import_urls(
    data: BulkUrlImport,
    current_user: CurrentUser,
    db: Database
):
    """
    Import multiple URLs at once (deferred processing).
    Only fetches content, AI processing happens later.
    Processes URLs in parallel with concurrency limit.
    """
    import asyncio

    results: List[BulkImportResult] = []
    user_id = current_user["id"]

    # Filter valid URLs first
    valid_urls = []
    for raw_url in data.urls:
        raw_url = raw_url.strip()
        if not raw_url:
            continue
        if not raw_url.startswith(('http://', 'https://')):
            results.append(BulkImportResult(
                url=raw_url,
                success=False,
                error="URL invalida (debe empezar con http:// o https://)"
            ))
        else:
            valid_urls.append(raw_url)

    # Semaphore for concurrency control (max 5 concurrent fetches)
    semaphore = asyncio.Semaphore(5)

    async def process_single_url(raw_url: str) -> BulkImportResult:
        """Process a single URL with timeout and error handling."""
        url_str = normalize_url(raw_url)

        async with semaphore:
            try:
                # Check if normalized URL already exists
                existing = await db.table("contents").select("id").eq("user_id", user_id).eq("url", url_str).execute()

                if existing.data:
                    return BulkImportResult(
                        url=raw_url,
                        success=False,
                        error="URL ya guardada"
                    )

                # Fetch with timeout (30 seconds per URL)
                try:
                    fetch_result = await asyncio.wait_for(
                        fetcher_service.fetch(raw_url),
                        timeout=30.0
                    )
                except asyncio.TimeoutError:
                    return BulkImportResult(
                        url=raw_url,
                        success=False,
                        error="Timeout al obtener contenido (>30s)"
                    )

                if not fetch_result.success:
                    return BulkImportResult(
                        url=raw_url,
                        success=False,
                        error=f"Error al obtener: {fetch_result.error}"
                    )

                # AI pipeline removed (CHANGELOG 2026-05-18) — store only basics.
                content_data = {
                    "user_id": user_id,
                    "url": url_str,
                    "type": fetch_result.type,
                    "title": fetch_result.title,
                    "summary": None,
                    "metadata": fetch_result.metadata,
                    "user_tags": data.tags,
                    "view_count": fetch_result.view_count,
                    "description": fetch_result.description,
                }

                response = await db.table("contents").insert(content_data).execute()

                if response.data:
                    return BulkImportResult(
                        url=raw_url,
                        success=True,
                        content_id=response.data[0]["id"]
                    )
                else:
                    return BulkImportResult(
                        url=raw_url,
                        success=False,
                        error="Error al guardar contenido"
                    )

            except Exception as e:
                return BulkImportResult(
                    url=raw_url,
                    success=False,
                    error=str(e)[:100]  # Truncate long errors
                )

    # Process all URLs concurrently
    if valid_urls:
        url_results = await asyncio.gather(
            *[process_single_url(url) for url in valid_urls],
            return_exceptions=True
        )

        for i, result in enumerate(url_results):
            if isinstance(result, Exception):
                results.append(BulkImportResult(
                    url=valid_urls[i],
                    success=False,
                    error=f"Error inesperado: {str(result)[:100]}"
                ))
            else:
                results.append(result)

    successful = sum(1 for r in results if r.success)

    return BulkImportResponse(
        total=len(results),
        successful=successful,
        failed=len(results) - successful,
        results=results
    )


# ==========================================
# Queue-based URL import (for large batches)
# ==========================================

class QueueUrlsRequest(BaseModel):
    """Request to add URLs to queue (no fetch, just save to DB)."""
    urls: List[str]
    tags: List[str] = []


class QueueUrlsResponse(BaseModel):
    """Response from queue operation."""
    queued: int
    duplicates: int
    invalid: int
    details: List[dict]  # List of {url, status, error?}


@router.post("/queue-urls", response_model=QueueUrlsResponse)
async def queue_urls_for_import(
    data: QueueUrlsRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Queue URLs for background import (no fetch yet).
    Creates placeholder records with fetch_status='queued'.
    The background processor will fetch them later.
    Use this for large batches (1000+ URLs).
    """
    user_id = current_user["id"]
    details = []
    queued = 0
    duplicates = 0
    invalid = 0

    for raw_url in data.urls:
        raw_url = raw_url.strip()
        if not raw_url:
            continue

        # Validate URL format
        if not raw_url.startswith(('http://', 'https://')):
            details.append({"url": raw_url, "status": "invalid", "error": "URL invalida"})
            invalid += 1
            continue

        # Normalize URL
        url_str = normalize_url(raw_url)

        # Extract content ID for better duplicate detection
        content_info = extract_content_id(raw_url)

        try:
            # Check if already exists by normalized URL
            existing = await db.table("contents").select("id").eq("user_id", user_id).eq("url", url_str).execute()

            if existing.data:
                details.append({"url": raw_url, "status": "duplicate"})
                duplicates += 1
                continue

            # Also check by content_id if available (e.g., TikTok video ID)
            if content_info.get("content_id"):
                # Search for same content ID in URL (covers different URL formats for same video)
                existing_by_id = await db.table("contents").select("id, url").eq("user_id", user_id).like("url", f"%{content_info['content_id']}%").execute()
                if existing_by_id.data:
                    details.append({"url": raw_url, "status": "duplicate", "existing_url": existing_by_id.data[0]["url"]})
                    duplicates += 1
                    continue

            # Determine content type from URL (tiktok, youtube, twitter, instagram, or web)
            content_type = content_info.get("platform") or "web"

            # Create placeholder record (no fetch yet)
            content_data = {
                "user_id": user_id,
                "url": url_str,
                "type": content_type,
                "title": url_str[:100],  # Placeholder title
                "summary": None,
                "user_tags": data.tags,
                "metadata": {"original_url": raw_url}
            }

            response = await db.table("contents").insert(content_data).execute()

            if response.data:
                details.append({"url": raw_url, "status": "queued", "content_id": response.data[0]["id"]})
                queued += 1
            else:
                details.append({"url": raw_url, "status": "error", "error": "Error al guardar"})
                invalid += 1

        except Exception as e:
            error_msg = str(e)
            # Log full error for debugging
            print(f"Queue URL error for {raw_url}: {error_msg}")
            details.append({"url": raw_url, "status": "error", "error": error_msg[:100]})
            invalid += 1

    return QueueUrlsResponse(
        queued=queued,
        duplicates=duplicates,
        invalid=invalid,
        details=details
    )


class ImportStatusResponse(BaseModel):
    """Stub — AI processing pipeline removed; all imports are instant now."""
    queued: int
    pending: int
    processing: int
    completed: int
    failed: int
    total: int


@router.get("/import-status", response_model=ImportStatusResponse)
async def get_import_status(
    current_user: CurrentUser,
    db: Database,
):
    """AI pipeline removed (CHANGELOG 2026-05-18). All imports are instant."""
    try:
        total_resp = await db.table("contents").select("id", count="exact").eq("user_id", current_user["id"]).execute()
        total = total_resp.count or 0
        return ImportStatusResponse(queued=0, pending=0, processing=0, completed=total, failed=0, total=total)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/import-csv")
async def import_from_csv(
    file: UploadFile = File(...),
    tags: str = Query("", description="Tags separados por coma"),
    current_user: CurrentUser = None,
    db: Database = None
):
    """
    Import URLs from CSV file.
    CSV format: url (required), tags (optional, comma-separated)
    First row can be header (url,tags) or data.
    """
    user_id = current_user["id"]

    # Read file
    content = await file.read()
    try:
        text = content.decode('utf-8')
    except UnicodeDecodeError:
        text = content.decode('latin-1')

    # Parse CSV
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV vacio"
        )

    # Detect if first row is header
    first_row = rows[0]
    start_idx = 0
    if first_row and first_row[0].lower() in ['url', 'urls', 'link', 'links']:
        start_idx = 1

    # Parse global tags
    global_tags = [t.strip() for t in tags.split(',') if t.strip()]

    results = {
        "queued": 0,
        "duplicates": 0,
        "invalid": 0
    }

    for row in rows[start_idx:]:
        if not row or not row[0].strip():
            continue

        raw_url = row[0].strip()

        # Get row-specific tags if present
        row_tags = []
        if len(row) > 1 and row[1].strip():
            row_tags = [t.strip() for t in row[1].split(',') if t.strip()]

        all_tags = list(set(global_tags + row_tags))

        # Validate URL
        if not raw_url.startswith(('http://', 'https://')):
            results["invalid"] += 1
            continue

        url_str = normalize_url(raw_url)

        try:
            # Check duplicate
            existing = await db.table("contents").select("id").eq("user_id", user_id).eq("url", url_str).execute()

            if existing.data:
                results["duplicates"] += 1
                continue

            # Determine content type from URL
            content_info = extract_content_id(raw_url)
            content_type = content_info.get("platform") or "web"

            # Queue URL
            content_data = {
                "user_id": user_id,
                "url": url_str,
                "type": content_type,
                "title": url_str[:100],
                "user_tags": all_tags,
                "metadata": {"original_url": raw_url, "source": "csv_import"}
            }

            await db.table("contents").insert(content_data).execute()
            results["queued"] += 1

        except Exception:
            results["invalid"] += 1

    return {
        "message": f"CSV procesado: {results['queued']} URLs en cola",
        "queued": results["queued"],
        "duplicates": results["duplicates"],
        "invalid": results["invalid"],
        "total_rows": len(rows) - start_idx
    }


@router.post("/note", response_model=ContentResponse, status_code=status.HTTP_201_CREATED)
async def create_note(data: NoteCreate, current_user: CurrentUser, db: Database):
    """
    Create a new note directly (not from URL).
    Saves immediately, AI processing happens later (deferred).
    """
    try:
        user_id = current_user["id"]

        # Note content is now stored in `summary` (raw_content column removed).
        content_data = {
            "user_id": user_id,
            "url": f"note://{user_id}/{data.title[:50].replace(' ', '-').lower()}",  # Pseudo-URL for notes
            "type": "note",
            "title": data.title,
            "summary": data.content[:50000],  # was raw_content
            "metadata": {"source": "manual_note", "created_via": "editor"},
            "user_tags": data.tags,
        }

        response = await db.table("contents").insert(content_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create note"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/note/{content_id}", response_model=ContentResponse)
async def update_note(
    content_id: str,
    data: NoteUpdate,
    current_user: CurrentUser,
    db: Database
):
    """
    Update a note's content. If content/title changed, marks as pending for re-processing.
    """
    try:
        user_id = current_user["id"]

        # Check ownership and get existing note
        existing = await db.table("contents").select("*").eq("id", content_id).eq("user_id", user_id).eq("type", "note").single().execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Note not found"
            )

        note = existing.data

        # Validate priority if provided
        if data.priority is not None and data.priority != "" and data.priority not in VALID_NOTE_PRIORITIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid priority. Must be one of: {', '.join(VALID_NOTE_PRIORITIES)}"
            )

        # Notes store body in `summary` now (raw_content column removed).
        new_title = data.title if data.title is not None else note["title"]
        new_content = data.content if data.content is not None else note.get("summary")
        new_tags = data.tags if data.tags is not None else note["user_tags"]
        # Handle priority: empty string means clear, None means no change
        new_priority = None if data.priority == "" else (data.priority if data.priority is not None else note.get("priority"))

        if data.title is not None or data.content is not None:
            update_data = {
                "title": new_title,
                "summary": (new_content or "")[:50000],
                "user_tags": new_tags,
                "priority": new_priority,
            }
        else:
            update_data = {"user_tags": new_tags, "priority": new_priority}

        response = await db.table("contents").update(update_data).eq("id", content_id).execute()

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# =====================================================
# MATURITY LEVEL ENDPOINTS — stubbed (column dropped in migration 004)
# =====================================================
@router.put("/{content_id}/maturity")
async def update_maturity_level(content_id: str, current_user: CurrentUser):
    return {"id": content_id, "message": "maturity_level removed — endpoint stubbed"}


@router.get("/maturity/stats")
async def get_maturity_stats(current_user: CurrentUser):
    return {"total": 0, "by_level": {}, "levels": []}


@router.post("/maturity/bulk")
async def bulk_update_maturity(content_ids: List[str], maturity_level: str, current_user: CurrentUser):
    return {"updated": 0, "message": "maturity_level removed — endpoint stubbed"}


# =====================================================
# CACHED FACETS ENDPOINT (for Explorer/Taxonomy sidebar)
# =====================================================

@router.get("/facets")
async def get_facets(
    current_user: CurrentUser,
    db: Database,
    force_refresh: bool = Query(False, description="Force cache refresh"),
):
    """
    Aggregated facets for the Explorer sidebar.
    Post AI-pipeline removal (2026-05-18) only type, favorites, archived and
    project facets are computed. Category/schema/maturity/processing buckets
    are kept in the response for frontend compatibility (always empty).
    """
    user_id = current_user["id"]

    if not force_refresh:
        cached = get_cached_facets(user_id)
        if cached:
            return {**cached, "cached": True}

    try:
        response = await db.table("contents").select(
            "type, is_favorite, is_archived, project_id, user_category"
        ).eq("user_id", user_id).execute()

        contents = response.data or []

        type_counts = {}
        category_counts = {}  # user_category only
        project_counts = {}
        total = 0
        archived = 0
        favorites = 0

        for item in contents:
            if item.get("is_archived"):
                archived += 1
                continue
            total += 1
            t = item.get("type") or "web"
            type_counts[t] = type_counts.get(t, 0) + 1
            cat = item.get("user_category")
            if cat:
                category_counts[cat] = category_counts.get(cat, 0) + 1
            if item.get("is_favorite"):
                favorites += 1
            proj = item.get("project_id")
            if proj:
                project_counts[proj] = project_counts.get(proj, 0) + 1

        facets = {
            "total": total,
            "archived": archived,
            "favorites": favorites,
            "by_type": dict(sorted(type_counts.items(), key=lambda x: -x[1])),
            "by_category": dict(sorted(category_counts.items(), key=lambda x: -x[1])),
            "by_subcategory": {},
            "by_schema": {},
            "by_maturity": {},
            "by_status": {},
            "by_project": project_counts,
        }

        set_cached_facets(user_id, facets)
        return {**facets, "cached": False}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/facets/invalidate")
async def invalidate_facets(current_user: CurrentUser):
    """
    Manually invalidate facets cache.
    Called after bulk operations that change many items.
    """
    invalidate_facets_cache(current_user["id"])
    return {"message": "Cache invalidated"}
