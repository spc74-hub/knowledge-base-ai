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
