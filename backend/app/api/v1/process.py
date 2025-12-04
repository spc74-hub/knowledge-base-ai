"""
Content processing endpoints.
Handles manual and bulk processing of pending content.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser
from app.services.processor import processor_service

router = APIRouter()


class ProcessResponse(BaseModel):
    success: bool
    message: str
    content_id: Optional[str] = None
    title: Optional[str] = None
    error: Optional[str] = None


class BulkProcessResponse(BaseModel):
    success: bool
    message: str
    processed: int
    failed: int
    results: List[dict]


class ProcessingStatsResponse(BaseModel):
    queued: int = 0
    pending: int
    processing: int
    completed: int
    failed: int


class RetryFailedResponse(BaseModel):
    success: bool
    message: str
    retried: int


class RetryErroredResponse(BaseModel):
    success: bool
    message: str
    found: int
    reset: int


@router.get("/stats", response_model=ProcessingStatsResponse)
async def get_processing_stats(
    current_user: CurrentUser,
    db: Database
):
    """
    Get processing statistics for the current user.
    """
    stats = await processor_service.get_processing_stats(db, current_user["id"])
    return stats


@router.get("/errors")
async def get_processing_errors(
    current_user: CurrentUser,
    db: Database,
    limit: int = Query(default=50, ge=1, le=200)
):
    """
    Get failed content with their error messages for debugging.
    Returns error summary grouped by error type.
    """
    try:
        # Get failed content with errors
        response = db.table("contents").select(
            "id, title, url, processing_error, created_at"
        ).eq(
            "user_id", current_user["id"]
        ).eq(
            "processing_status", "failed"
        ).order("created_at", desc=True).limit(limit).execute()

        failed_items = response.data or []

        # Group errors by type
        error_groups = {}
        for item in failed_items:
            error = item.get("processing_error") or "Unknown error"
            # Simplify error message for grouping
            if "Timeout" in error:
                error_key = "Timeout al obtener contenido"
            elif "Fetch error" in error:
                error_key = "Error al descargar URL"
            elif "No content" in error:
                error_key = "Sin contenido para procesar"
            elif "rate_limit" in error.lower() or "rate limit" in error.lower():
                error_key = "Rate limit de API"
            elif "credit" in error.lower():
                error_key = "Sin creditos de API"
            elif "connection" in error.lower():
                error_key = "Error de conexion"
            else:
                # Truncate long errors
                error_key = error[:100] if len(error) > 100 else error

            if error_key not in error_groups:
                error_groups[error_key] = {"count": 0, "examples": []}
            error_groups[error_key]["count"] += 1
            if len(error_groups[error_key]["examples"]) < 3:
                error_groups[error_key]["examples"].append({
                    "id": item["id"],
                    "title": item.get("title", "Sin titulo")[:50],
                    "url": item.get("url", "")[:80]
                })

        # Sort by count
        sorted_errors = sorted(
            [{"error": k, **v} for k, v in error_groups.items()],
            key=lambda x: x["count"],
            reverse=True
        )

        return {
            "total_failed": len(failed_items),
            "error_types": len(error_groups),
            "errors": sorted_errors,
            "raw_items": failed_items[:10]  # First 10 raw items for detailed inspection
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/pending/count")
async def get_pending_count(
    current_user: CurrentUser,
    db: Database
):
    """
    Get count of pending content.
    """
    count = await processor_service.get_pending_count(db, current_user["id"])
    return {"count": count}


@router.post("/retry-failed", response_model=RetryFailedResponse)
async def retry_failed_content(
    current_user: CurrentUser,
    db: Database
):
    """
    Reset all failed content back to pending status for retry.
    """
    try:
        # Get failed content
        response = db.table("contents").select("id", count="exact").eq("user_id", current_user["id"]).eq("processing_status", "failed").execute()

        count = response.count or 0

        if count == 0:
            return RetryFailedResponse(
                success=True,
                message="No failed content to retry",
                retried=0
            )

        # Reset to pending
        db.table("contents").update({
            "processing_status": "pending",
            "processing_error": None
        }).eq("user_id", current_user["id"]).eq("processing_status", "failed").execute()

        return RetryFailedResponse(
            success=True,
            message=f"{count} items reset to pending",
            retried=count
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/retry-errored", response_model=RetryErroredResponse)
async def retry_errored_content(
    current_user: CurrentUser,
    db: Database
):
    """
    Find and reset completed content that has error messages in summary field.
    This handles cases where processing was marked complete but actually failed
    (e.g., API credit errors stored in summary).
    """
    try:
        # Get completed content where summary contains error indicators
        response = db.table("contents").select(
            "id, summary"
        ).eq(
            "user_id", current_user["id"]
        ).eq(
            "processing_status", "completed"
        ).execute()

        # Filter for error patterns in summary
        error_patterns = [
            "Error generating summary",
            "Error code:",
            "credit balance is too low",
            "invalid_request_error",
            "API error",
            "Error:",
        ]

        errored_ids = []
        for content in response.data:
            summary = content.get("summary") or ""
            if any(pattern in summary for pattern in error_patterns):
                errored_ids.append(content["id"])

        if not errored_ids:
            return RetryErroredResponse(
                success=True,
                message="No errored content found",
                found=0,
                reset=0
            )

        # Reset these to pending and clear the error summary
        for content_id in errored_ids:
            db.table("contents").update({
                "processing_status": "pending",
                "summary": None,
                "processing_error": None
            }).eq("id", content_id).execute()

        return RetryErroredResponse(
            success=True,
            message=f"Found {len(errored_ids)} items with errors, reset to pending",
            found=len(errored_ids),
            reset=len(errored_ids)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/bulk", response_model=BulkProcessResponse)
async def process_all_pending(
    current_user: CurrentUser,
    db: Database,
    limit: Optional[int] = Query(default=None, ge=1, description="Maximum items to process (None = all)")
):
    """
    Process all pending content for the current user.
    If limit is not specified, processes all pending content.
    """
    result = await processor_service.process_pending(
        db=db,
        user_id=current_user["id"],
        limit=limit
    )

    return result


@router.post("/{content_id}", response_model=ProcessResponse)
async def process_single_content(
    content_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Process a single content item (classify, summarize, generate embedding).
    """
    result = await processor_service.process_content(
        db=db,
        content_id=content_id,
        user_id=current_user["id"]
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Processing failed")
        )

    return result
