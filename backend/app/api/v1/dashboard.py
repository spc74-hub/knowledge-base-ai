"""
Dashboard API endpoints.
Consolidated endpoint for dashboard KPIs and summaries.
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from app.api.deps import CurrentUser, Database

logger = logging.getLogger(__name__)

router = APIRouter()


def safe_query(func):
    """Execute a query safely, returning default on error."""
    try:
        result = func()
        return result
    except Exception as e:
        logger.error(f"Dashboard query error: {e}", exc_info=True)
        return None


def safe_count(result) -> int:
    """Get count from result, handling None."""
    if result is None:
        return 0
    return result.count or 0


def safe_data(result) -> list:
    """Get data from result, handling None."""
    if result is None:
        return []
    return result.data or []


@router.get("/summary")
async def get_dashboard_summary(
    current_user: CurrentUser,
    db: Database,
):
    """
    Get all dashboard KPIs in a single call.
    Returns counts for all object types and recent items.
    """
    user_id = current_user["id"]

    # Safe queries for all counts
    # Contents
    contents_result = safe_query(lambda: db.table("contents").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    pending_result = safe_query(lambda: db.table("contents").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("processing_status", "pending").execute())

    failed_result = safe_query(lambda: db.table("contents").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("processing_status", "failed").execute())

    # Objectives
    objectives_result = safe_query(lambda: db.table("objectives").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("status", "active").execute())

    objectives_total = safe_query(lambda: db.table("objectives").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    # Projects
    projects_result = safe_query(lambda: db.table("projects").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("status", "active").execute())

    projects_total = safe_query(lambda: db.table("projects").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    # Mental Models
    mental_models_result = safe_query(lambda: db.table("mental_models").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("is_active", True).execute())

    # Notes
    notes_result = safe_query(lambda: db.table("standalone_notes").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    # Tags
    tags_result = safe_query(lambda: db.table("taxonomy_tags").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    # Folders
    folders_result = safe_query(lambda: db.table("folders").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    # Usage stats (last 30 days)
    from datetime import datetime, timedelta
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()

    usage_result = safe_query(lambda: db.table("ai_usage_log").select(
        "total_cost"
    ).eq("user_id", user_id).gte("created_at", thirty_days_ago).execute())

    total_cost = sum(u.get("total_cost", 0) or 0 for u in safe_data(usage_result))

    # Recent items for default view (last 5 of each)
    recent_contents = safe_query(lambda: db.table("contents").select(
        "id, title, content_type, source_url, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute())

    recent_objectives = safe_query(lambda: db.table("objectives").select(
        "id, title, status, progress, icon, color, horizon"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute())

    recent_projects = safe_query(lambda: db.table("projects").select(
        "id, name, status, color, icon"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute())

    recent_mental_models = safe_query(lambda: db.table("mental_models").select(
        "id, name, slug, icon, color, is_active"
    ).eq("user_id", user_id).eq("is_active", True).order("created_at", desc=True).limit(5).execute())

    recent_notes = safe_query(lambda: db.table("standalone_notes").select(
        "id, title, is_pinned, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute())

    return {
        "kpis": {
            "contents": {
                "total": safe_count(contents_result),
                "pending": safe_count(pending_result),
                "failed": safe_count(failed_result),
            },
            "objectives": {
                "active": safe_count(objectives_result),
                "total": safe_count(objectives_total),
            },
            "projects": {
                "active": safe_count(projects_result),
                "total": safe_count(projects_total),
            },
            "mental_models": {
                "active": safe_count(mental_models_result),
            },
            "notes": {
                "total": safe_count(notes_result),
            },
            "tags": {
                "total": safe_count(tags_result),
            },
            "folders": {
                "total": safe_count(folders_result),
            },
            "usage": {
                "cost_30d": round(total_cost, 2),
            },
        },
        "recent": {
            "contents": safe_data(recent_contents),
            "objectives": safe_data(recent_objectives),
            "projects": safe_data(recent_projects),
            "mental_models": safe_data(recent_mental_models),
            "notes": safe_data(recent_notes),
        },
    }


@router.get("/objects/{object_type}")
async def get_object_summary(
    object_type: str,
    current_user: CurrentUser,
    db: Database,
    limit: int = 10,
):
    """
    Get summary for a specific object type (for contextual panel).
    Returns recent items, favorites/pinned, and active items.
    """
    user_id = current_user["id"]

    if object_type == "contents":
        logger.info(f"Fetching contents for user {user_id} with limit {limit}")
        recent = safe_query(lambda: db.table("contents").select(
            "id, title, content_type, source_url, is_favorite, created_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute())
        logger.info(f"Recent contents result: {recent is not None}, data count: {len(recent.data) if recent and recent.data else 0}")

        favorites = safe_query(lambda: db.table("contents").select(
            "id, title, content_type, source_url, created_at"
        ).eq("user_id", user_id).eq("is_favorite", True).order("created_at", desc=True).limit(limit).execute())

        result = {
            "type": "contents",
            "recent": safe_data(recent),
            "favorites": safe_data(favorites),
        }
        logger.info(f"Returning {len(result['recent'])} recent contents")
        return result

    elif object_type == "objectives":
        recent = safe_query(lambda: db.table("objectives").select(
            "id, title, status, progress, icon, color, horizon, target_date"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute())

        active = safe_query(lambda: db.table("objectives").select(
            "id, title, status, progress, icon, color, horizon, target_date"
        ).eq("user_id", user_id).eq("status", "active").order("position").limit(limit).execute())

        return {
            "type": "objectives",
            "recent": safe_data(recent),
            "active": safe_data(active),
        }

    elif object_type == "projects":
        recent = safe_query(lambda: db.table("projects").select(
            "id, name, status, color, icon, description"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute())

        active = safe_query(lambda: db.table("projects").select(
            "id, name, status, color, icon, description"
        ).eq("user_id", user_id).eq("status", "active").order("created_at", desc=True).limit(limit).execute())

        return {
            "type": "projects",
            "recent": safe_data(recent),
            "active": safe_data(active),
        }

    elif object_type == "mental_models":
        recent = safe_query(lambda: db.table("mental_models").select(
            "id, name, slug, icon, color, description, is_active"
        ).eq("user_id", user_id).eq("is_active", True).order("created_at", desc=True).limit(limit).execute())

        return {
            "type": "mental_models",
            "recent": safe_data(recent),
            "active": safe_data(recent),  # Same as recent for mental models
        }

    elif object_type == "notes":
        recent = safe_query(lambda: db.table("standalone_notes").select(
            "id, title, is_pinned, created_at, updated_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute())

        pinned = safe_query(lambda: db.table("standalone_notes").select(
            "id, title, is_pinned, created_at, updated_at"
        ).eq("user_id", user_id).eq("is_pinned", True).order("created_at", desc=True).limit(limit).execute())

        return {
            "type": "notes",
            "recent": safe_data(recent),
            "pinned": safe_data(pinned),
        }

    elif object_type == "tags":
        tags = safe_query(lambda: db.table("taxonomy_tags").select(
            "id, tag, color, match_type, category, concept"
        ).eq("user_id", user_id).order("tag").limit(limit).execute())

        return {
            "type": "tags",
            "items": safe_data(tags),
        }

    else:
        raise HTTPException(status_code=400, detail=f"Unknown object type: {object_type}")
