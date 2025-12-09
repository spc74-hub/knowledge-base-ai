"""
Dashboard API endpoints.
Consolidated endpoint for dashboard KPIs and summaries.
"""
import logging
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.api.deps import CurrentUser, Database

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory cache for dashboard summary (reduces DB load)
_dashboard_cache: dict = {}
DASHBOARD_CACHE_TTL = 120  # 2 minutes


def get_cached_dashboard(user_id: str):
    """Get cached dashboard if still valid."""
    if user_id in _dashboard_cache:
        cached = _dashboard_cache[user_id]
        if time.time() - cached["timestamp"] < DASHBOARD_CACHE_TTL:
            return cached["data"]
    return None


def set_cached_dashboard(user_id: str, data: dict):
    """Cache dashboard for user."""
    _dashboard_cache[user_id] = {
        "timestamp": time.time(),
        "data": data
    }


def invalidate_dashboard_cache(user_id: str):
    """Invalidate dashboard cache for user."""
    if user_id in _dashboard_cache:
        del _dashboard_cache[user_id]


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
    force_refresh: bool = Query(False, description="Force cache refresh")
):
    """
    Get all dashboard KPIs in a single call (cached for 2 minutes).
    Returns counts for all object types and recent items.
    """
    user_id = current_user["id"]

    # Check cache first
    if not force_refresh:
        cached = get_cached_dashboard(user_id)
        if cached:
            return {**cached, "cached": True}

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

    # Notes (standalone/quick notes)
    notes_result = safe_query(lambda: db.table("standalone_notes").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    # Full Notes (contents with type='note', excluding apple_notes)
    full_notes_result = safe_query(lambda: db.table("contents").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).neq("metadata->>source", "apple_notes").execute())

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

    usage_result = safe_query(lambda: db.table("api_usage").select(
        "total_cost"
    ).eq("user_id", user_id).gte("created_at", thirty_days_ago).execute())

    total_cost = sum(u.get("total_cost", 0) or 0 for u in safe_data(usage_result))

    # Recent items for default view (last 5 of each)
    recent_contents = safe_query(lambda: db.table("contents").select(
        "id, title, type, url, created_at"
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

    result = {
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
            "full_notes": {
                "total": safe_count(full_notes_result),
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

    # Cache the result
    set_cached_dashboard(user_id, result)

    return {**result, "cached": False}


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
            "id, title, type, url, is_favorite, created_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute())
        logger.info(f"Recent contents result: {recent is not None}, data count: {len(recent.data) if recent and recent.data else 0}")

        favorites = safe_query(lambda: db.table("contents").select(
            "id, title, type, url, created_at"
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

        # Get linked contents for each active project
        projects_with_contents = []
        for project in safe_data(active):
            linked_contents = safe_query(lambda pid=project["id"]: db.table("contents").select(
                "id, title, type, maturity_level"
            ).eq("project_id", pid).eq("is_archived", False).limit(5).execute())
            project["linked_contents"] = safe_data(linked_contents)
            projects_with_contents.append(project)

        return {
            "type": "projects",
            "recent": safe_data(recent),
            "active": projects_with_contents,
        }

    elif object_type == "mental_models":
        recent = safe_query(lambda: db.table("mental_models").select(
            "id, name, slug, icon, color, description, is_active"
        ).eq("user_id", user_id).eq("is_active", True).order("created_at", desc=True).limit(limit).execute())

        # Get linked contents for each mental model
        models_with_contents = []
        for model in safe_data(recent):
            # Get content IDs from junction table
            associations = safe_query(lambda mid=model["id"]: db.table("content_mental_models").select(
                "content_id"
            ).eq("mental_model_id", mid).limit(5).execute())

            content_ids = [a["content_id"] for a in safe_data(associations)]
            linked_contents = []
            if content_ids:
                contents_result = safe_query(lambda cids=content_ids: db.table("contents").select(
                    "id, title, type, maturity_level"
                ).in_("id", cids).execute())
                linked_contents = safe_data(contents_result)

            model["linked_contents"] = linked_contents
            models_with_contents.append(model)

        return {
            "type": "mental_models",
            "recent": models_with_contents,
            "active": models_with_contents,
        }

    elif object_type == "notes":
        # Standalone notes (journal/reflections)
        recent_standalone = safe_query(lambda: db.table("standalone_notes").select(
            "id, title, note_type, is_pinned, created_at, updated_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute())

        pinned = safe_query(lambda: db.table("standalone_notes").select(
            "id, title, note_type, is_pinned, created_at, updated_at"
        ).eq("user_id", user_id).eq("is_pinned", True).order("created_at", desc=True).limit(limit).execute())

        # Full notes (contents with type='note' but NOT apple_notes)
        # Apple Notes have type='note' AND metadata.source='apple_notes'
        # Manual full notes have type='note' AND metadata.source != 'apple_notes' (or no source)
        recent_full_notes = safe_query(lambda: db.table("contents").select(
            "id, title, is_favorite, created_at, updated_at"
        ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).neq("metadata->>source", "apple_notes").order("created_at", desc=True).limit(limit).execute())

        full_notes_count = safe_query(lambda: db.table("contents").select(
            "id", count="exact"
        ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).neq("metadata->>source", "apple_notes").execute())

        # Apple Notes count (contents with type='note' AND metadata.source='apple_notes')
        apple_notes_count = safe_query(lambda: db.table("contents").select(
            "id", count="exact"
        ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).filter("metadata->>source", "eq", "apple_notes").execute())

        # Add note_type marker to full notes for UI display
        full_notes_data = safe_data(recent_full_notes)
        for fn in full_notes_data:
            fn["note_type"] = "full_note"
            fn["is_pinned"] = fn.get("is_favorite", False)
            fn["is_full_note"] = True

        # Combine recent from both sources
        combined_recent = safe_data(recent_standalone) + full_notes_data
        # Sort by created_at and limit
        combined_recent.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        combined_recent = combined_recent[:limit]

        # Get counts by note_type for standalone notes
        note_types = ["reflection", "idea", "question", "connection", "journal"]
        by_type = {}
        for note_type in note_types:
            count_result = safe_query(lambda nt=note_type: db.table("standalone_notes").select(
                "id", count="exact"
            ).eq("user_id", user_id).eq("note_type", nt).execute())
            by_type[note_type] = safe_count(count_result)

        # Add full notes and apple notes counts
        by_type["full_note"] = safe_count(full_notes_count)
        by_type["apple_notes"] = safe_count(apple_notes_count)

        # Total count (standalone + full notes, excluding apple notes for main total)
        standalone_total = safe_query(lambda: db.table("standalone_notes").select(
            "id", count="exact"
        ).eq("user_id", user_id).execute())

        # Main total excludes Apple Notes (they're shown separately)
        total = safe_count(standalone_total) + safe_count(full_notes_count)
        # Total including Apple Notes for reference
        total_with_apple = total + safe_count(apple_notes_count)

        return {
            "type": "notes",
            "recent": combined_recent,
            "pinned": safe_data(pinned),
            "full_notes": full_notes_data,
            "stats": {
                "total": total,  # Without Apple Notes
                "total_with_apple": total_with_apple,  # With Apple Notes
                "by_type": by_type,
            },
            "note_types": [
                {"value": "reflection", "label": "Reflexiones", "icon": "💭"},
                {"value": "idea", "label": "Ideas", "icon": "💡"},
                {"value": "question", "label": "Preguntas", "icon": "❓"},
                {"value": "connection", "label": "Conexiones", "icon": "🔗"},
                {"value": "journal", "label": "Diario", "icon": "📓"},
                {"value": "action", "label": "Acciones", "icon": "✅"},
                {"value": "full_note", "label": "Notas completas", "icon": "📄"},
            ],
        }

    elif object_type == "full_notes":
        # Full notes (contents with type='note', excluding apple_notes)
        recent = safe_query(lambda: db.table("contents").select(
            "id, title, type, is_favorite, created_at, maturity_level"
        ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).neq("metadata->>source", "apple_notes").order("created_at", desc=True).limit(limit).execute())

        favorites = safe_query(lambda: db.table("contents").select(
            "id, title, type, is_favorite, created_at, maturity_level"
        ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).eq("is_favorite", True).neq("metadata->>source", "apple_notes").order("created_at", desc=True).limit(limit).execute())

        return {
            "type": "full_notes",
            "recent": safe_data(recent),
            "favorites": safe_data(favorites),
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
