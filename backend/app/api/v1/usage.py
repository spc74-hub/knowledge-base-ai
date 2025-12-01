"""
API Usage tracking endpoints.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser
from app.services.usage_tracker import usage_tracker

router = APIRouter()


class UsageStatsResponse(BaseModel):
    total_tokens: int
    total_cost_usd: float
    by_provider: dict
    by_operation: dict
    by_model: dict
    daily_usage: dict
    record_count: int


class UsageSummaryResponse(BaseModel):
    period: str
    total_tokens: int
    total_cost_usd: float
    openai_tokens: int
    openai_cost_usd: float
    anthropic_tokens: int
    anthropic_cost_usd: float
    total_calls: int


@router.get("/stats", response_model=UsageStatsResponse)
async def get_usage_stats(
    current_user: CurrentUser,
    db: Database,
    days: int = Query(30, ge=1, le=365, description="Number of days to look back")
):
    """
    Get detailed API usage statistics for the current user.
    """
    try:
        stats = await usage_tracker.get_usage_stats(
            user_id=current_user["id"],
            db=db,
            days=days
        )
        return stats

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/summary", response_model=UsageSummaryResponse)
async def get_usage_summary(
    current_user: CurrentUser,
    db: Database,
    days: int = Query(30, ge=1, le=365, description="Number of days to look back")
):
    """
    Get a summary of API usage for the current user.
    """
    try:
        stats = await usage_tracker.get_usage_stats(
            user_id=current_user["id"],
            db=db,
            days=days
        )

        # Extract provider-specific stats
        openai_stats = stats.get("by_provider", {}).get("openai", {"tokens": 0, "cost_usd": 0.0, "calls": 0})
        anthropic_stats = stats.get("by_provider", {}).get("anthropic", {"tokens": 0, "cost_usd": 0.0, "calls": 0})

        return {
            "period": f"last_{days}_days",
            "total_tokens": stats.get("total_tokens", 0),
            "total_cost_usd": stats.get("total_cost_usd", 0.0),
            "openai_tokens": openai_stats.get("tokens", 0),
            "openai_cost_usd": openai_stats.get("cost_usd", 0.0),
            "anthropic_tokens": anthropic_stats.get("tokens", 0),
            "anthropic_cost_usd": anthropic_stats.get("cost_usd", 0.0),
            "total_calls": stats.get("record_count", 0)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/daily")
async def get_daily_usage(
    current_user: CurrentUser,
    db: Database,
    days: int = Query(30, ge=1, le=365)
):
    """
    Get daily usage breakdown.
    """
    try:
        stats = await usage_tracker.get_usage_stats(
            user_id=current_user["id"],
            db=db,
            days=days
        )

        # Convert daily_usage dict to sorted list
        daily = stats.get("daily_usage", {})
        daily_list = [
            {"date": date, **data}
            for date, data in sorted(daily.items())
        ]

        return {
            "period": f"last_{days}_days",
            "daily_usage": daily_list
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/by-operation")
async def get_usage_by_operation(
    current_user: CurrentUser,
    db: Database,
    days: int = Query(30, ge=1, le=365)
):
    """
    Get usage breakdown by operation type.
    """
    try:
        stats = await usage_tracker.get_usage_stats(
            user_id=current_user["id"],
            db=db,
            days=days
        )

        operations = stats.get("by_operation", {})
        operation_list = [
            {"operation": op, **data}
            for op, data in operations.items()
        ]

        return {
            "period": f"last_{days}_days",
            "by_operation": operation_list
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
