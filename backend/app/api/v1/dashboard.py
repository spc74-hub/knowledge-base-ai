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


async def safe_query(coro_or_func):
    """Execute a query safely, returning default on error.
    Accepts either a coroutine or a callable that returns a coroutine."""
    try:
        import asyncio
        if asyncio.iscoroutine(coro_or_func):
            result = await coro_or_func
        elif callable(coro_or_func):
            result = coro_or_func()
            if asyncio.iscoroutine(result):
                result = await result
        else:
            result = coro_or_func
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
    contents_result = await safe_query(lambda: db.table("contents").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    pending_result = await safe_query(lambda: db.table("contents").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("processing_status", "pending").execute())

    failed_result = await safe_query(lambda: db.table("contents").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("processing_status", "failed").execute())

    # Objectives
    objectives_result = await safe_query(lambda: db.table("objectives").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("status", "active").execute())

    objectives_total = await safe_query(lambda: db.table("objectives").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    # Projects
    projects_result = await safe_query(lambda: db.table("projects").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("status", "active").execute())

    projects_total = await safe_query(lambda: db.table("projects").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    # Mental Models
    mental_models_result = await safe_query(lambda: db.table("mental_models").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("is_active", True).execute())

    # Notes (standalone/quick notes)
    notes_result = await safe_query(lambda: db.table("standalone_notes").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    # Full Notes (contents with type='note', excluding apple_notes)
    full_notes_result = await safe_query(lambda: db.table("contents").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).neq("metadata->>source", "apple_notes").execute())

    # Tags
    tags_result = await safe_query(lambda: db.table("taxonomy_tags").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    # Folders
    folders_result = await safe_query(lambda: db.table("folders").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute())

    # Areas of Responsibility
    areas_result = await safe_query(lambda: db.table("areas_of_responsibility").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("status", "active").execute())

    # Habits (active)
    habits_result = await safe_query(lambda: db.table("habits").select(
        "id", count="exact"
    ).eq("user_id", user_id).eq("is_active", True).execute())

    # Usage stats (last 30 days)
    from datetime import datetime, timedelta
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()

    usage_result = await safe_query(lambda: db.table("api_usage").select(
        "total_cost"
    ).eq("user_id", user_id).gte("created_at", thirty_days_ago).execute())

    total_cost = sum(u.get("total_cost", 0) or 0 for u in safe_data(usage_result))

    # Recent items for default view (last 5 of each)
    recent_contents = await safe_query(lambda: db.table("contents").select(
        "id, title, type, url, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute())

    recent_objectives = await safe_query(lambda: db.table("objectives").select(
        "id, title, status, progress, icon, color, horizon"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute())

    recent_projects = await safe_query(lambda: db.table("projects").select(
        "id, name, status, color, icon"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute())

    recent_mental_models = await safe_query(lambda: db.table("mental_models").select(
        "id, name, slug, icon, color, is_active"
    ).eq("user_id", user_id).eq("is_active", True).order("created_at", desc=True).limit(5).execute())

    # Simple notes (standalone_notes)
    recent_standalone_notes = await safe_query(lambda: db.table("standalone_notes").select(
        "id, title, note_type, is_pinned, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute())

    # System notes (quick notes from system_notes table)
    recent_system_notes = await safe_query(lambda: db.table("system_notes").select(
        "id, title, category, position, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute())

    # Full notes (contents with type='note')
    # Get all notes, then filter apple_notes in Python to avoid Supabase or_() issues
    recent_full_notes_summary = await safe_query(lambda: db.table("contents").select(
        "id, title, is_favorite, created_at, metadata"
    ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).order("created_at", desc=True).limit(10).execute())

    # Mark full notes with is_full_note flag, filter out apple_notes
    raw_full_notes = safe_data(recent_full_notes_summary)
    full_notes_data = []
    for fn in raw_full_notes:
        # Filter out apple_notes
        metadata = fn.get("metadata") or {}
        if metadata.get("source") == "apple_notes":
            continue
        fn["note_type"] = "full_note"
        fn["is_pinned"] = fn.get("is_favorite", False)
        fn["is_full_note"] = True
        # Remove metadata from response to keep it clean
        fn.pop("metadata", None)
        full_notes_data.append(fn)
        if len(full_notes_data) >= 5:
            break

    # Combine standalone_notes and system_notes as simple notes
    standalone_data = safe_data(recent_standalone_notes)
    for sn in standalone_data:
        sn["is_full_note"] = False
        sn["source"] = "standalone"

    system_data = safe_data(recent_system_notes)
    for sn in system_data:
        sn["is_full_note"] = False
        sn["is_pinned"] = False  # system_notes don't have is_pinned
        sn["note_type"] = sn.get("category", "system")
        sn["source"] = "system"

    # Merge and sort by created_at, take top 5
    all_simple_notes = standalone_data + system_data
    all_simple_notes.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    simple_notes_data = all_simple_notes[:5]

    # Areas of Responsibility (recent active)
    recent_areas = await safe_query(lambda: db.table("areas_of_responsibility").select(
        "id, name, icon, color, status"
    ).eq("user_id", user_id).eq("status", "active").order("display_order").limit(5).execute())

    # Habits (active)
    recent_habits = await safe_query(lambda: db.table("habits").select(
        "id, name, icon, color, frequency_type, is_active"
    ).eq("user_id", user_id).eq("is_active", True).order("created_at", desc=True).limit(5).execute())

    # Today's habit completions
    today = datetime.utcnow().date().isoformat()
    today_logs = await safe_query(lambda: db.table("habit_logs").select(
        "habit_id, status"
    ).eq("user_id", user_id).eq("date", today).execute())

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
            "areas": {
                "active": safe_count(areas_result),
            },
            "habits": {
                "active": safe_count(habits_result),
            },
        },
        "recent": {
            "contents": safe_data(recent_contents),
            "objectives": safe_data(recent_objectives),
            "projects": safe_data(recent_projects),
            "mental_models": safe_data(recent_mental_models),
            "notes": simple_notes_data,
            "simple_notes": simple_notes_data,
            "full_notes": full_notes_data,
            "areas": safe_data(recent_areas),
            "habits": safe_data(recent_habits),
        },
        "habits_today": {
            "logs": safe_data(today_logs),
            "total": safe_count(habits_result),
            "completed": len([l for l in safe_data(today_logs) if l.get("status") == "completed"]),
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
        recent = await safe_query(lambda: db.table("contents").select(
            "id, title, type, url, is_favorite, created_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute())
        logger.info(f"Recent contents result: {recent is not None}, data count: {len(recent.data) if recent and recent.data else 0}")

        favorites = await safe_query(lambda: db.table("contents").select(
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
        recent = await safe_query(lambda: db.table("objectives").select(
            "id, title, status, progress, icon, color, horizon, target_date, is_favorite"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute())

        active = await safe_query(lambda: db.table("objectives").select(
            "id, title, status, progress, icon, color, horizon, target_date, is_favorite"
        ).eq("user_id", user_id).eq("status", "active").order("position").limit(limit).execute())

        favorites = await safe_query(lambda: db.table("objectives").select(
            "id, title, status, progress, icon, color, horizon, target_date, is_favorite"
        ).eq("user_id", user_id).eq("is_favorite", True).eq("status", "active").order("position").limit(limit).execute())

        return {
            "type": "objectives",
            "recent": safe_data(recent),
            "active": safe_data(active),
            "favorites": safe_data(favorites),
        }

    elif object_type == "projects":
        recent = await safe_query(lambda: db.table("projects").select(
            "id, name, status, color, icon, description, is_favorite"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute())

        active = await safe_query(lambda: db.table("projects").select(
            "id, name, status, color, icon, description, is_favorite"
        ).eq("user_id", user_id).eq("status", "active").order("created_at", desc=True).limit(limit).execute())

        favorites_query = await safe_query(lambda: db.table("projects").select(
            "id, name, status, color, icon, description, is_favorite"
        ).eq("user_id", user_id).eq("is_favorite", True).eq("status", "active").order("created_at", desc=True).limit(limit).execute())

        # Get linked contents for each active project
        projects_with_contents = []
        for project in safe_data(active):
            linked_contents = await safe_query(lambda pid=project["id"]: db.table("contents").select(
                "id, title, type, maturity_level"
            ).eq("project_id", pid).eq("is_archived", False).limit(5).execute())
            project["linked_contents"] = safe_data(linked_contents)
            projects_with_contents.append(project)

        # Get linked contents for favorite projects
        favorites_with_contents = []
        for project in safe_data(favorites_query):
            linked_contents = await safe_query(lambda pid=project["id"]: db.table("contents").select(
                "id, title, type, maturity_level"
            ).eq("project_id", pid).eq("is_archived", False).limit(5).execute())
            project["linked_contents"] = safe_data(linked_contents)
            favorites_with_contents.append(project)

        return {
            "type": "projects",
            "recent": safe_data(recent),
            "active": projects_with_contents,
            "favorites": favorites_with_contents,
        }

    elif object_type == "mental_models":
        recent = await safe_query(lambda: db.table("mental_models").select(
            "id, name, slug, icon, color, description, is_active, is_favorite"
        ).eq("user_id", user_id).eq("is_active", True).order("created_at", desc=True).limit(limit).execute())

        favorites_query = await safe_query(lambda: db.table("mental_models").select(
            "id, name, slug, icon, color, description, is_active, is_favorite"
        ).eq("user_id", user_id).eq("is_favorite", True).eq("is_active", True).order("created_at", desc=True).limit(limit).execute())

        # Helper function to get linked contents for a model
        async def get_model_with_contents(model):
            associations = await safe_query(lambda mid=model["id"]: db.table("content_mental_models").select(
                "content_id"
            ).eq("mental_model_id", mid).limit(5).execute())

            content_ids = [a["content_id"] for a in safe_data(associations)]
            linked_contents = []
            if content_ids:
                contents_result = await safe_query(lambda cids=content_ids: db.table("contents").select(
                    "id, title, type, maturity_level"
                ).in_("id", cids).execute())
                linked_contents = safe_data(contents_result)

            model["linked_contents"] = linked_contents
            return model

        # Get linked contents for each active model
        models_with_contents = [await get_model_with_contents(model) for model in safe_data(recent)]

        # Get linked contents for favorite models
        favorites_with_contents = [await get_model_with_contents(model) for model in safe_data(favorites_query)]

        return {
            "type": "mental_models",
            "recent": models_with_contents,
            "active": models_with_contents,
            "favorites": favorites_with_contents,
        }

    elif object_type == "notes":
        # Standalone notes (journal/reflections)
        recent_standalone = await safe_query(lambda: db.table("standalone_notes").select(
            "id, title, note_type, is_pinned, created_at, updated_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute())

        pinned = await safe_query(lambda: db.table("standalone_notes").select(
            "id, title, note_type, is_pinned, created_at, updated_at"
        ).eq("user_id", user_id).eq("is_pinned", True).order("created_at", desc=True).limit(limit).execute())

        # Full notes (contents with type='note' but NOT apple_notes)
        # Apple Notes have type='note' AND metadata.source='apple_notes'
        # Manual full notes have type='note' AND metadata.source != 'apple_notes' (or no source)
        recent_full_notes = await safe_query(lambda: db.table("contents").select(
            "id, title, is_favorite, created_at, updated_at"
        ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).neq("metadata->>source", "apple_notes").order("created_at", desc=True).limit(limit).execute())

        full_notes_count = await safe_query(lambda: db.table("contents").select(
            "id", count="exact"
        ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).neq("metadata->>source", "apple_notes").execute())

        # Apple Notes count (contents with type='note' AND metadata.source='apple_notes')
        apple_notes_count = await safe_query(lambda: db.table("contents").select(
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
        note_types = ["reflection", "idea", "question", "connection", "journal", "action", "shopping"]
        by_type = {}
        for note_type in note_types:
            count_result = await safe_query(lambda nt=note_type: db.table("standalone_notes").select(
                "id", count="exact"
            ).eq("user_id", user_id).eq("note_type", nt).execute())
            by_type[note_type] = safe_count(count_result)

        # Add full notes and apple notes counts
        by_type["full_note"] = safe_count(full_notes_count)
        by_type["apple_notes"] = safe_count(apple_notes_count)

        # Total count (standalone + full notes, excluding apple notes for main total)
        standalone_total = await safe_query(lambda: db.table("standalone_notes").select(
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
                {"value": "shopping", "label": "Shopping", "icon": "🛒"},
                {"value": "full_note", "label": "Notas completas", "icon": "📄"},
            ],
        }

    elif object_type == "full_notes":
        # Full notes (contents with type='note', excluding apple_notes)
        recent = await safe_query(lambda: db.table("contents").select(
            "id, title, type, is_favorite, created_at, maturity_level"
        ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).neq("metadata->>source", "apple_notes").order("created_at", desc=True).limit(limit).execute())

        favorites = await safe_query(lambda: db.table("contents").select(
            "id, title, type, is_favorite, created_at, maturity_level"
        ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).eq("is_favorite", True).neq("metadata->>source", "apple_notes").order("created_at", desc=True).limit(limit).execute())

        return {
            "type": "full_notes",
            "recent": safe_data(recent),
            "favorites": safe_data(favorites),
        }

    elif object_type == "tags":
        tags = await safe_query(lambda: db.table("taxonomy_tags").select(
            "id, tag, color, match_type, category, concept"
        ).eq("user_id", user_id).order("tag").limit(limit).execute())

        return {
            "type": "tags",
            "items": safe_data(tags),
        }

    elif object_type == "areas":
        # Areas of Responsibility
        active = await safe_query(lambda: db.table("areas_of_responsibility").select(
            "id, name, description, icon, color, status, display_order"
        ).eq("user_id", user_id).eq("status", "active").order("display_order").limit(limit).execute())

        all_areas = await safe_query(lambda: db.table("areas_of_responsibility").select(
            "id, name, description, icon, color, status, display_order"
        ).eq("user_id", user_id).order("display_order").limit(limit).execute())

        # Get linked counts for each area
        areas_with_counts = []
        for area in safe_data(active):
            # Count habits linked to this area
            habits_count = await safe_query(lambda aid=area["id"]: db.table("habits").select(
                "id", count="exact"
            ).eq("area_id", aid).eq("is_active", True).execute())

            # Count objectives linked to this area
            objectives_count = await safe_query(lambda aid=area["id"]: db.table("objectives").select(
                "id", count="exact"
            ).eq("area_id", aid).execute())

            # Count projects linked to this area
            projects_count = await safe_query(lambda aid=area["id"]: db.table("projects").select(
                "id", count="exact"
            ).eq("area_id", aid).execute())

            area["habits_count"] = safe_count(habits_count)
            area["objectives_count"] = safe_count(objectives_count)
            area["projects_count"] = safe_count(projects_count)
            areas_with_counts.append(area)

        return {
            "type": "areas",
            "active": areas_with_counts,
            "all": safe_data(all_areas),
        }

    elif object_type == "habits":
        from datetime import datetime

        # Active habits
        active = await safe_query(lambda: db.table("habits").select(
            "id, name, description, icon, color, frequency_type, frequency_days, target_count, is_active, area_id"
        ).eq("user_id", user_id).eq("is_active", True).order("created_at", desc=True).limit(limit).execute())

        # Today's logs
        today = datetime.utcnow().date().isoformat()
        today_logs = await safe_query(lambda: db.table("habit_logs").select(
            "habit_id, status, value, notes"
        ).eq("user_id", user_id).eq("date", today).execute())

        # Map logs by habit_id
        logs_by_habit = {}
        for log in safe_data(today_logs):
            logs_by_habit[log["habit_id"]] = log

        # Add today's status to each habit
        habits_with_status = []
        for habit in safe_data(active):
            habit["today_log"] = logs_by_habit.get(habit["id"])
            habit["completed_today"] = logs_by_habit.get(habit["id"], {}).get("status") == "completed"
            habits_with_status.append(habit)

        # Stats
        total_active = len(safe_data(active))
        completed_today = len([h for h in habits_with_status if h["completed_today"]])

        return {
            "type": "habits",
            "active": habits_with_status,
            "stats": {
                "total_active": total_active,
                "completed_today": completed_today,
                "completion_rate": round((completed_today / total_active * 100) if total_active > 0 else 0, 1),
            },
        }

    else:
        raise HTTPException(status_code=400, detail=f"Unknown object type: {object_type}")
