"""
Home endpoint — PARA-first dashboard.

GET /api/v1/home returns everything the new home screen needs in one call:
  - active areas with rolled-up counts (projects / objectives / habits /
    untriaged captures / last activity)
  - recent untriaged captures (top 5)
  - today's habits + actions + journal big rocks (compact)
  - recent items for the "Recientes" band
"""
from datetime import date, datetime
import logging

from fastapi import APIRouter

from app.api.deps import Database, CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def get_home(current_user: CurrentUser, db: Database):
    user_id = current_user["id"]

    # -----------------------------------------------------------------
    # 1. Active areas with counts
    # -----------------------------------------------------------------
    areas_resp = await (
        db.table("areas_of_responsibility")
        .select("id, name, description, icon, color, status, display_order")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("display_order")
        .execute()
    )
    areas = areas_resp.data or []

    if areas:
        area_ids = [a["id"] for a in areas]

        # Counts: projects active per area
        projects_resp = await (
            db.table("projects")
            .select("id, area_id, status")
            .eq("user_id", user_id)
            .in_("area_id", area_ids)
            .execute()
        )
        active_projects_by_area: dict = {}
        for p in projects_resp.data or []:
            if p.get("status") == "active":
                active_projects_by_area[p["area_id"]] = active_projects_by_area.get(p["area_id"], 0) + 1

        # Counts: objectives per area
        objectives_resp = await (
            db.table("objectives")
            .select("id, area_id, status")
            .eq("user_id", user_id)
            .in_("area_id", area_ids)
            .execute()
        )
        active_objectives_by_area: dict = {}
        for o in objectives_resp.data or []:
            if o.get("status") != "completed":
                active_objectives_by_area[o["area_id"]] = active_objectives_by_area.get(o["area_id"], 0) + 1

        # Counts: habits per area
        habits_resp = await (
            db.table("habits")
            .select("id, area_id, is_active")
            .eq("user_id", user_id)
            .in_("area_id", area_ids)
            .execute()
        )
        active_habits_by_area: dict = {}
        for h in habits_resp.data or []:
            if h.get("is_active"):
                active_habits_by_area[h["area_id"]] = active_habits_by_area.get(h["area_id"], 0) + 1

        # Counts: untriaged captures per area
        untriaged_resp = await (
            db.table("contents")
            .select("id, area_id, created_at")
            .eq("user_id", user_id)
            .eq("is_triaged", False)
            .neq("is_archived", True)
            .neq("type", "note")
            .execute()
        )
        untriaged_by_area: dict = {}
        for c in untriaged_resp.data or []:
            if c.get("area_id") in area_ids:
                untriaged_by_area[c["area_id"]] = untriaged_by_area.get(c["area_id"], 0) + 1

        # Roll all the counts into each area
        for a in areas:
            aid = a["id"]
            a["counts"] = {
                "projects_active": active_projects_by_area.get(aid, 0),
                "objectives_active": active_objectives_by_area.get(aid, 0),
                "habits_active": active_habits_by_area.get(aid, 0),
                "captures_untriaged": untriaged_by_area.get(aid, 0),
            }

    # -----------------------------------------------------------------
    # 2. Recent untriaged captures (top 5) — for the band on home
    # -----------------------------------------------------------------
    recent_untriaged = await (
        db.table("contents")
        .select(
            "id, url, type, title, summary, source_metadata, "
            "area_id, project_id, created_at"
        )
        .eq("user_id", user_id)
        .eq("is_triaged", False)
        .neq("is_archived", True)
        .neq("type", "note")
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    # -----------------------------------------------------------------
    # 3. Today: habits + actions due today + journal big rocks
    # -----------------------------------------------------------------
    today_str = date.today().isoformat()
    today_obj = date.today()

    habits_today_resp = await (
        db.table("habits")
        .select("id, name, icon, color, time_of_day, frequency_type, frequency_days")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    # habit_logs.date is stored as String("YYYY-MM-DD") in this app, so compare
    # against a string; daily_journal.date is DATE in postgres, so compare
    # against a date object to avoid the implicit cast that asyncpg rejects.
    habit_logs_today_resp = await (
        db.table("habit_logs")
        .select("habit_id, status")
        .eq("user_id", user_id)
        .eq("date", today_str)
        .execute()
    )
    logs_by_habit = {l["habit_id"]: l.get("status") for l in (habit_logs_today_resp.data or [])}
    habits_today = []
    for h in (habits_today_resp.data or []):
        habits_today.append({
            **h,
            "status_today": logs_by_habit.get(h["id"]),
        })

    journal_today = None
    try:
        journal_resp = await (
            db.table("daily_journal")
            .select("big_rocks, morning_intention, day_word")
            .eq("user_id", user_id)
            .eq("date", today_obj)
            .limit(1)
            .execute()
        )
        journal_today = journal_resp.data[0] if journal_resp.data else None
    except Exception as e:
        logger.warning(f"home: could not fetch today's journal: {e}")

    # -----------------------------------------------------------------
    # 4. Recent items (compact strip)
    # -----------------------------------------------------------------
    recent_notes = await (
        db.table("standalone_notes")
        .select("id, title, note_type, created_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(5)
        .execute()
    )
    recent_objectives = await (
        db.table("objectives")
        .select("id, title, icon, color, horizon, progress, status")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(5)
        .execute()
    )

    return {
        "areas": areas,
        "captures_recent_untriaged": recent_untriaged.data or [],
        "today": {
            "habits": habits_today,
            "journal": journal_today,
        },
        "recent": {
            "notes": recent_notes.data or [],
            "objectives": recent_objectives.data or [],
        },
    }
