"""
Dashboard API endpoints.
Consolidated endpoint for dashboard KPIs and summaries.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException
from app.api.deps import CurrentUser, Database

router = APIRouter()


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

    # Parallel queries for all counts
    # Contents
    contents_result = db.table("contents").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute()

    # Contents by processing status
    pending_result = db.table("contents").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("processing_status", "pending").execute()

    failed_result = db.table("contents").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("processing_status", "failed").execute()

    # Objectives (active)
    objectives_result = db.table("objectives").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("status", "active").execute()

    # Objectives total
    objectives_total = db.table("objectives").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute()

    # Projects (active)
    projects_result = db.table("projects").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("status", "active").execute()

    # Projects total
    projects_total = db.table("projects").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute()

    # Mental Models (active)
    mental_models_result = db.table("mental_models").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("is_active", True).execute()

    # Notes (standalone)
    notes_result = db.table("standalone_notes").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute()

    # Tags
    tags_result = db.table("taxonomy_tags").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute()

    # Folders
    folders_result = db.table("folders").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute()

    # Usage stats (last 30 days)
    from datetime import datetime, timedelta
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()

    usage_result = db.table("ai_usage_log").select(
        "total_cost"
    ).eq("user_id", user_id).gte("created_at", thirty_days_ago).execute()

    total_cost = sum(u.get("total_cost", 0) or 0 for u in usage_result.data)

    # Recent items for default view (last 5 of each)
    recent_contents = db.table("contents").select(
        "id, title, content_type, source_url, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()

    recent_objectives = db.table("objectives").select(
        "id, title, status, progress, icon, color, horizon"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()

    recent_projects = db.table("projects").select(
        "id, name, status, color, icon"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()

    recent_mental_models = db.table("mental_models").select(
        "id, name, slug, icon, color, is_active"
    ).eq("user_id", user_id).eq("is_active", True).order("created_at", desc=True).limit(5).execute()

    recent_notes = db.table("standalone_notes").select(
        "id, title, is_pinned, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()

    return {
        "kpis": {
            "contents": {
                "total": contents_result.count or 0,
                "pending": pending_result.count or 0,
                "failed": failed_result.count or 0,
            },
            "objectives": {
                "active": objectives_result.count or 0,
                "total": objectives_total.count or 0,
            },
            "projects": {
                "active": projects_result.count or 0,
                "total": projects_total.count or 0,
            },
            "mental_models": {
                "active": mental_models_result.count or 0,
            },
            "notes": {
                "total": notes_result.count or 0,
            },
            "tags": {
                "total": tags_result.count or 0,
            },
            "folders": {
                "total": folders_result.count or 0,
            },
            "usage": {
                "cost_30d": round(total_cost, 2),
            },
        },
        "recent": {
            "contents": recent_contents.data or [],
            "objectives": recent_objectives.data or [],
            "projects": recent_projects.data or [],
            "mental_models": recent_mental_models.data or [],
            "notes": recent_notes.data or [],
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
        recent = db.table("contents").select(
            "id, title, content_type, source_url, is_favorite, created_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()

        favorites = db.table("contents").select(
            "id, title, content_type, source_url, created_at"
        ).eq("user_id", user_id).eq("is_favorite", True).order("created_at", desc=True).limit(limit).execute()

        return {
            "type": "contents",
            "recent": recent.data or [],
            "favorites": favorites.data or [],
        }

    elif object_type == "objectives":
        recent = db.table("objectives").select(
            "id, title, status, progress, icon, color, horizon, target_date"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()

        active = db.table("objectives").select(
            "id, title, status, progress, icon, color, horizon, target_date"
        ).eq("user_id", user_id).eq("status", "active").order("position").limit(limit).execute()

        return {
            "type": "objectives",
            "recent": recent.data or [],
            "active": active.data or [],
        }

    elif object_type == "projects":
        recent = db.table("projects").select(
            "id, name, status, color, icon, description"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()

        active = db.table("projects").select(
            "id, name, status, color, icon, description"
        ).eq("user_id", user_id).eq("status", "active").order("created_at", desc=True).limit(limit).execute()

        return {
            "type": "projects",
            "recent": recent.data or [],
            "active": active.data or [],
        }

    elif object_type == "mental_models":
        recent = db.table("mental_models").select(
            "id, name, slug, icon, color, description, is_active"
        ).eq("user_id", user_id).eq("is_active", True).order("created_at", desc=True).limit(limit).execute()

        return {
            "type": "mental_models",
            "recent": recent.data or [],
            "active": recent.data or [],  # Same as recent for mental models
        }

    elif object_type == "notes":
        recent = db.table("standalone_notes").select(
            "id, title, is_pinned, created_at, updated_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()

        pinned = db.table("standalone_notes").select(
            "id, title, is_pinned, created_at, updated_at"
        ).eq("user_id", user_id).eq("is_pinned", True).order("created_at", desc=True).limit(limit).execute()

        return {
            "type": "notes",
            "recent": recent.data or [],
            "pinned": pinned.data or [],
        }

    elif object_type == "tags":
        tags = db.table("taxonomy_tags").select(
            "id, tag, color, match_type, category, concept"
        ).eq("user_id", user_id).order("tag").limit(limit).execute()

        return {
            "type": "tags",
            "items": tags.data or [],
        }

    else:
        raise HTTPException(status_code=400, detail=f"Unknown object type: {object_type}")
