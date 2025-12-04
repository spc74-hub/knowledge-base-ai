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
from app.services.classifier import classifier_service
from app.services.summarizer import summarizer_service
from app.services.embeddings import embeddings_service
from app.services.usage_tracker import usage_tracker
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


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None


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
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    is_asset: Optional[bool] = None  # Mark as reusable asset/template
    maturity_level: Optional[str] = None  # captured, processed, connected, integrated
    project_id: Optional[str] = None  # Link to project (can be null to unlink)


class MaturityUpdate(BaseModel):
    maturity_level: str  # captured, processed, connected, integrated


class ContentResponse(BaseModel):
    id: str
    url: str
    type: str
    title: str
    summary: Optional[str] = None
    schema_type: Optional[str] = None
    schema_subtype: Optional[str] = None
    iab_tier1: Optional[str] = None
    iab_tier2: Optional[str] = None
    concepts: List[str] = []
    user_tags: List[str] = []
    is_favorite: bool = False
    is_archived: bool = False
    is_asset: bool = False  # Reusable asset/template
    processing_status: str = "pending"
    maturity_level: str = "captured"
    project_id: Optional[str] = None  # Linked project
    created_at: str


class ContentDetailResponse(ContentResponse):
    raw_content: Optional[str] = None
    entities: Optional[dict] = None
    language: Optional[str] = None
    sentiment: Optional[str] = None
    technical_level: Optional[str] = None
    content_format: Optional[str] = None
    reading_time_minutes: Optional[int] = None
    metadata: Optional[dict] = None
    last_reviewed_at: Optional[str] = None


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


@router.get("/", response_model=PaginatedResponse)
async def list_contents(
    current_user: CurrentUser,
    db: Database,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    type: Optional[str] = None,
    category: Optional[str] = None,
    tags: Optional[str] = None,
    favorite: Optional[bool] = None,
    archived: bool = False,
    asset: Optional[bool] = None,  # Filter by is_asset
    project_id: Optional[str] = None,  # Filter by project
    maturity_level: Optional[str] = None,  # Filter by maturity level
    sort_by: str = "created_at",
    sort_order: str = "desc",
    q: Optional[str] = None
):
    """
    List user's contents with pagination and filters.
    """
    try:
        # Build query
        query = db.table("contents").select("*").eq("user_id", current_user["id"])

        # Apply filters
        if type:
            query = query.eq("type", type)
        if category:
            query = query.eq("iab_tier1", category)
        if favorite is not None:
            query = query.eq("is_favorite", favorite)
        if not archived:
            query = query.eq("is_archived", False)
        if asset is not None:
            query = query.eq("is_asset", asset)
        if project_id:
            query = query.eq("project_id", project_id)
        if maturity_level:
            query = query.eq("maturity_level", maturity_level)
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
        response = query.execute()

        # Get total count
        count_query = db.table("contents").select("id", count="exact").eq("user_id", current_user["id"])
        if not archived:
            count_query = count_query.eq("is_archived", False)
        count_response = count_query.execute()
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
        total = db.table("contents").select("id", count="exact").eq("user_id", user_id).execute()

        # By type
        type_stats = {}
        for content_type in ["web", "youtube", "tiktok", "twitter"]:
            count = db.table("contents").select("id", count="exact").eq("user_id", user_id).eq("type", content_type).execute()
            type_stats[content_type] = count.count or 0

        # Favorites and archived
        favorites = db.table("contents").select("id", count="exact").eq("user_id", user_id).eq("is_favorite", True).execute()
        archived = db.table("contents").select("id", count="exact").eq("user_id", user_id).eq("is_archived", True).execute()

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
        response = db.table("contents").select("*").eq("id", content_id).eq("user_id", current_user["id"]).single().execute()

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
        existing = db.table("contents").select("id").eq("user_id", user_id).eq("url", url_str).execute()

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

        # Estimate reading time (average 200 words per minute)
        word_count = len(fetch_result.content.split())
        reading_time = max(1, word_count // 200)

        # If process_async is True, process immediately
        if data.process_async:
            # Set up usage tracker with database
            usage_tracker.set_db(db)

            # Step 2: Classify content using Claude (with usage tracking)
            classification = await classifier_service.classify(
                title=fetch_result.title,
                content=fetch_result.content,
                url=url_str,
                user_id=user_id
            )

            # Step 3: Generate summary using Claude (with usage tracking)
            summary = await summarizer_service.summarize(
                title=fetch_result.title,
                content=fetch_result.content,
                language=classification.language,
                user_id=user_id
            )

            # Step 4: Generate embedding for semantic search (with usage tracking)
            embedding_text = embeddings_service.prepare_content_for_embedding(
                title=fetch_result.title,
                summary=summary,
                content=fetch_result.content,
                concepts=classification.concepts,
                entities=classification.entities.model_dump() if classification.entities else None,
                metadata=fetch_result.metadata
            )
            embedding = await embeddings_service.generate_embedding(
                embedding_text,
                user_id=user_id,
                operation="content_embedding"
            )

            # Create content record with all processed data
            content_data = {
                "user_id": user_id,
                "url": url_str,
                "type": fetch_result.type,
                "title": fetch_result.title,
                "raw_content": fetch_result.content[:50000],
                "summary": summary,
                "schema_type": classification.schema_type,
                "schema_subtype": classification.schema_subtype,
                "iab_tier1": classification.iab_tier1,
                "iab_tier2": classification.iab_tier2,
                "iab_tier3": classification.iab_tier3,
                "concepts": classification.concepts,
                "entities": classification.entities.model_dump() if classification.entities else {},
                "language": classification.language,
                "sentiment": classification.sentiment,
                "technical_level": classification.technical_level,
                "content_format": classification.content_format,
                "reading_time_minutes": reading_time,
                "metadata": fetch_result.metadata,
                "user_tags": data.tags,
                "processing_status": "completed",
                "embedding": embedding
            }
        else:
            # Save as pending - only fetch was done
            content_data = {
                "user_id": user_id,
                "url": url_str,
                "type": fetch_result.type,
                "title": fetch_result.title,
                "raw_content": fetch_result.content[:50000],
                "summary": None,
                "schema_type": None,
                "schema_subtype": None,
                "iab_tier1": None,
                "iab_tier2": None,
                "iab_tier3": None,
                "concepts": [],
                "entities": {},
                "language": None,
                "sentiment": None,
                "technical_level": None,
                "content_format": None,
                "reading_time_minutes": reading_time,
                "metadata": fetch_result.metadata,
                "user_tags": data.tags,
                "processing_status": "pending",
                "embedding": None
            }

        response = db.table("contents").insert(content_data).execute()

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
        existing = db.table("contents").select("id").eq("id", content_id).eq("user_id", current_user["id"]).execute()

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

        response = db.table("contents").update(update_data).eq("id", content_id).execute()

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
        existing = db.table("contents").select("id").eq("id", content_id).eq("user_id", current_user["id"]).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found"
            )

        db.table("contents").delete().eq("id", content_id).execute()

        return {"message": "Content deleted successfully"}

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
        response = db.table("contents")\
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
        response = db.table("contents")\
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
        count_response = db.table("contents")\
            .select("id", count="exact")\
            .eq("user_id", current_user["id"])\
            .in_("id", data.content_ids)\
            .execute()

        affected_count = count_response.count or 0

        # Delete all contents that belong to the user
        db.table("contents")\
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
    steps: List[str] = Query(default=["summarize", "classify", "embed"])
):
    """
    Reprocess content (regenerate summary, classification, embedding).
    """
    try:
        # Check ownership
        existing = db.table("contents").select("id").eq("id", content_id).eq("user_id", current_user["id"]).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found"
            )

        # Update status
        db.table("contents").update({"processing_status": "pending"}).eq("id", content_id).execute()

        # TODO: Add to processing queue with specified steps

        return {
            "message": "Content queued for reprocessing",
            "steps": steps
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


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
                existing = db.table("contents").select("id").eq("user_id", user_id).eq("url", url_str).execute()

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

                # Estimate reading time
                word_count = len(fetch_result.content.split())
                reading_time = max(1, word_count // 200)

                # Create content record WITHOUT AI processing (deferred)
                content_data = {
                    "user_id": user_id,
                    "url": url_str,
                    "type": fetch_result.type,
                    "title": fetch_result.title,
                    "raw_content": fetch_result.content[:50000],
                    "summary": None,
                    "schema_type": None,
                    "schema_subtype": None,
                    "iab_tier1": None,
                    "iab_tier2": None,
                    "iab_tier3": None,
                    "concepts": [],
                    "entities": {},
                    "language": None,
                    "sentiment": None,
                    "technical_level": None,
                    "content_format": None,
                    "reading_time_minutes": reading_time,
                    "metadata": fetch_result.metadata,
                    "user_tags": data.tags,
                    "processing_status": "pending",
                    "embedding": None
                }

                response = db.table("contents").insert(content_data).execute()

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
            existing = db.table("contents").select("id").eq("user_id", user_id).eq("url", url_str).execute()

            if existing.data:
                details.append({"url": raw_url, "status": "duplicate"})
                duplicates += 1
                continue

            # Also check by content_id if available (e.g., TikTok video ID)
            if content_info.get("content_id"):
                # Search for same content ID in URL (covers different URL formats for same video)
                existing_by_id = db.table("contents").select("id, url").eq("user_id", user_id).like("url", f"%{content_info['content_id']}%").execute()
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
                "raw_content": None,
                "summary": None,
                "user_tags": data.tags,
                "processing_status": "pending",  # URLs waiting to be fetched
                "metadata": {"original_url": raw_url}
            }

            response = db.table("contents").insert(content_data).execute()

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
    """Status of import queue."""
    queued: int  # URLs waiting to be fetched
    pending: int  # Fetched, waiting for AI processing
    processing: int  # Currently being processed
    completed: int  # Fully processed
    failed: int  # Failed processing
    total: int


@router.get("/import-status", response_model=ImportStatusResponse)
async def get_import_status(
    current_user: CurrentUser,
    db: Database
):
    """Get status of URL import queue for current user."""
    user_id = current_user["id"]

    try:
        # Count by status
        all_content = db.table("contents").select(
            "processing_status",
            count="exact"
        ).eq("user_id", user_id).execute()

        status_counts = {
            "queued": 0,
            "pending": 0,
            "processing": 0,
            "completed": 0,
            "failed": 0
        }

        for item in all_content.data:
            s = item.get("processing_status", "pending")
            if s in status_counts:
                status_counts[s] += 1
            elif s == "error":
                status_counts["failed"] += 1
            else:
                status_counts["pending"] += 1

        return ImportStatusResponse(
            queued=status_counts["queued"],
            pending=status_counts["pending"],
            processing=status_counts["processing"],
            completed=status_counts["completed"],
            failed=status_counts["failed"],
            total=sum(status_counts.values())
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


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
            existing = db.table("contents").select("id").eq("user_id", user_id).eq("url", url_str).execute()

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
                "raw_content": None,
                "user_tags": all_tags,
                "processing_status": "pending",
                "metadata": {"original_url": raw_url, "source": "csv_import"}
            }

            db.table("contents").insert(content_data).execute()
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

        # Estimate reading time (average 200 words per minute)
        word_count = len(data.content.split())
        reading_time = max(1, word_count // 200)

        # Create content record WITHOUT AI processing (deferred)
        content_data = {
            "user_id": user_id,
            "url": f"note://{user_id}/{data.title[:50].replace(' ', '-').lower()}",  # Pseudo-URL for notes
            "type": "note",
            "title": data.title,
            "raw_content": data.content[:50000],  # Limit stored content
            "summary": None,
            "schema_type": None,
            "schema_subtype": None,
            "iab_tier1": None,
            "iab_tier2": None,
            "iab_tier3": None,
            "concepts": [],
            "entities": {},
            "language": None,
            "sentiment": None,
            "technical_level": None,
            "content_format": None,
            "reading_time_minutes": reading_time,
            "metadata": {"source": "manual_note", "created_via": "editor"},
            "user_tags": data.tags,
            "processing_status": "pending",  # Deferred processing
            "embedding": None
        }

        response = db.table("contents").insert(content_data).execute()

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
        existing = db.table("contents").select("*").eq("id", content_id).eq("user_id", user_id).eq("type", "note").single().execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Note not found"
            )

        note = existing.data

        # Determine what changed
        new_title = data.title if data.title is not None else note["title"]
        new_content = data.content if data.content is not None else note["raw_content"]
        new_tags = data.tags if data.tags is not None else note["user_tags"]

        # If content or title changed, mark as pending for re-processing
        if data.title is not None or data.content is not None:
            # Re-calculate reading time
            word_count = len(new_content.split())
            reading_time = max(1, word_count // 200)

            update_data = {
                "title": new_title,
                "raw_content": new_content[:50000],
                "summary": None,  # Clear for re-processing
                "schema_type": None,
                "schema_subtype": None,
                "iab_tier1": None,
                "iab_tier2": None,
                "iab_tier3": None,
                "concepts": [],
                "entities": {},
                "language": None,
                "sentiment": None,
                "technical_level": None,
                "content_format": None,
                "reading_time_minutes": reading_time,
                "user_tags": new_tags,
                "embedding": None,
                "processing_status": "pending"  # Mark for re-processing
            }
        else:
            # Only tags changed, no AI reprocessing needed
            update_data = {"user_tags": new_tags}

        response = db.table("contents").update(update_data).eq("id", content_id).execute()

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# =====================================================
# MATURITY LEVEL ENDPOINTS
# =====================================================

VALID_MATURITY_LEVELS = ["captured", "processed", "connected", "integrated"]

MATURITY_LABELS = {
    "captured": "Capturado",
    "processed": "Procesado",
    "connected": "Conectado",
    "integrated": "Integrado",
}


@router.put("/{content_id}/maturity")
async def update_maturity_level(
    content_id: str,
    data: MaturityUpdate,
    current_user: CurrentUser,
    db: Database
):
    """
    Update the maturity level of a content.
    Valid levels: captured, processed, connected, integrated
    """
    try:
        # Validate maturity level
        if data.maturity_level not in VALID_MATURITY_LEVELS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid maturity level. Must be one of: {', '.join(VALID_MATURITY_LEVELS)}"
            )

        # Check ownership
        existing = db.table("contents").select("id, maturity_level").eq(
            "id", content_id
        ).eq(
            "user_id", current_user["id"]
        ).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found"
            )

        from datetime import datetime, timezone

        # Update maturity level and last_reviewed_at
        response = db.table("contents").update({
            "maturity_level": data.maturity_level,
            "last_reviewed_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", content_id).execute()

        return {
            "id": content_id,
            "maturity_level": data.maturity_level,
            "previous_level": existing.data[0].get("maturity_level", "captured"),
            "message": f"Nivel actualizado a {MATURITY_LABELS.get(data.maturity_level, data.maturity_level)}"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/maturity/stats")
async def get_maturity_stats(
    current_user: CurrentUser,
    db: Database
):
    """
    Get statistics about content maturity levels.
    """
    try:
        user_id = current_user["id"]

        # Get all non-archived contents with their maturity level
        response = db.table("contents").select(
            "maturity_level"
        ).eq("user_id", user_id).eq("is_archived", False).execute()

        # Count by level
        stats = {level: 0 for level in VALID_MATURITY_LEVELS}
        total = 0

        for item in response.data or []:
            level = item.get("maturity_level") or "captured"
            if level in stats:
                stats[level] += 1
            else:
                stats["captured"] += 1  # Default for old content
            total += 1

        return {
            "total": total,
            "by_level": stats,
            "levels": [
                {"value": level, "label": MATURITY_LABELS[level], "count": stats[level]}
                for level in VALID_MATURITY_LEVELS
            ]
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/maturity/bulk")
async def bulk_update_maturity(
    content_ids: List[str],
    maturity_level: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Update maturity level for multiple contents at once.
    """
    try:
        if maturity_level not in VALID_MATURITY_LEVELS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid maturity level. Must be one of: {', '.join(VALID_MATURITY_LEVELS)}"
            )

        if not content_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No content IDs provided"
            )

        from datetime import datetime, timezone

        updated = 0
        for content_id in content_ids:
            try:
                result = db.table("contents").update({
                    "maturity_level": maturity_level,
                    "last_reviewed_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", content_id).eq("user_id", current_user["id"]).execute()

                if result.data:
                    updated += 1
            except Exception:
                continue  # Skip failed updates

        return {
            "updated": updated,
            "total": len(content_ids),
            "maturity_level": maturity_level
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
