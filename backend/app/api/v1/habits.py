"""
Habits API endpoints.
Handles CRUD operations for habits, logging completions, and statistics.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, timedelta
from collections import defaultdict

from app.api.deps import Database, CurrentUser

router = APIRouter(prefix="/habits", tags=["habits"])


# =====================================================
# Pydantic Models
# =====================================================

class HabitCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "✅"
    color: Optional[str] = "#10b981"
    frequency_type: str = "daily"  # daily, weekly, monthly, custom
    frequency_days: Optional[List[int]] = [0, 1, 2, 3, 4, 5, 6]  # 0=Sunday
    target_count: Optional[int] = 1
    target_time: Optional[str] = None  # HH:MM format
    time_of_day: Optional[str] = "anytime"  # morning, afternoon, evening, anytime
    reminder_enabled: Optional[bool] = False
    reminder_time: Optional[str] = None
    area_id: Optional[str] = None
    objective_id: Optional[str] = None


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    frequency_type: Optional[str] = None
    frequency_days: Optional[List[int]] = None
    target_count: Optional[int] = None
    target_time: Optional[str] = None
    time_of_day: Optional[str] = None  # morning, afternoon, evening, anytime
    reminder_enabled: Optional[bool] = None
    reminder_time: Optional[str] = None
    area_id: Optional[str] = None
    objective_id: Optional[str] = None
    is_active: Optional[bool] = None


class HabitLogCreate(BaseModel):
    date: str  # YYYY-MM-DD
    status: str = "completed"  # completed, skipped, partial, missed
    value: Optional[int] = 1
    notes: Optional[str] = None


class BulkLogRequest(BaseModel):
    date: str  # YYYY-MM-DD
    logs: List[dict]  # [{habit_id: str, status: str, value?: int}]


# =====================================================
# Helper Functions
# =====================================================

def calculate_streak(logs: List[dict], frequency_type: str, frequency_days: List[int]) -> int:
    """Calculate current streak from logs."""
    if not logs:
        return 0

    streak = 0
    check_date = date.today()
    log_dates = {log["date"]: log["status"] for log in logs}

    while True:
        # Check if this day should be counted based on frequency
        day_of_week = check_date.weekday()
        # Convert to Sunday=0 format
        day_of_week = (day_of_week + 1) % 7

        should_track = (
            frequency_type == "daily" or
            (frequency_type in ["weekly", "custom"] and day_of_week in frequency_days)
        )

        if should_track:
            date_str = check_date.isoformat()
            if date_str in log_dates and log_dates[date_str] == "completed":
                streak += 1
            elif check_date == date.today():
                # Today not completed yet, check yesterday
                check_date -= timedelta(days=1)
                continue
            else:
                break

        check_date -= timedelta(days=1)

        # Safety limit
        if check_date < date.today() - timedelta(days=365):
            break

    return streak


def calculate_best_streak(logs: List[dict]) -> int:
    """Calculate best ever streak from logs."""
    if not logs:
        return 0

    completed_dates = sorted([
        datetime.fromisoformat(log["date"]).date()
        for log in logs
        if log["status"] == "completed"
    ])

    if not completed_dates:
        return 0

    best_streak = 1
    current_streak = 1

    for i in range(1, len(completed_dates)):
        diff = (completed_dates[i] - completed_dates[i-1]).days
        if diff == 1:
            current_streak += 1
            best_streak = max(best_streak, current_streak)
        elif diff > 1:
            current_streak = 1

    return best_streak


def calculate_completion_rate(logs: List[dict], start_date: date, end_date: date, frequency_type: str, frequency_days: List[int]) -> float:
    """Calculate completion rate for a date range."""
    total_days = 0
    completed_days = 0
    log_dates = {log["date"]: log["status"] for log in logs}

    check_date = start_date
    while check_date <= end_date:
        day_of_week = (check_date.weekday() + 1) % 7  # Sunday=0

        should_track = (
            frequency_type == "daily" or
            (frequency_type in ["weekly", "custom"] and day_of_week in frequency_days)
        )

        if should_track:
            total_days += 1
            date_str = check_date.isoformat()
            if date_str in log_dates and log_dates[date_str] == "completed":
                completed_days += 1

        check_date += timedelta(days=1)

    if total_days == 0:
        return 0.0

    return round((completed_days / total_days) * 100, 1)


def get_day_stats(logs: List[dict]) -> dict:
    """Get completion stats by day of week."""
    day_counts = defaultdict(lambda: {"completed": 0, "total": 0})
    day_names = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"]

    for log in logs:
        log_date = datetime.fromisoformat(log["date"]).date()
        day_of_week = (log_date.weekday() + 1) % 7
        day_counts[day_of_week]["total"] += 1
        if log["status"] == "completed":
            day_counts[day_of_week]["completed"] += 1

    result = []
    for i in range(7):
        total = day_counts[i]["total"]
        completed = day_counts[i]["completed"]
        rate = round((completed / total) * 100, 1) if total > 0 else 0
        result.append({
            "day": i,
            "name": day_names[i],
            "completed": completed,
            "total": total,
            "rate": rate
        })

    return result


# =====================================================
# Habit CRUD Endpoints
# =====================================================

@router.get("")
async def get_habits(
    db: Database,
    current_user: CurrentUser,
    include_archived: bool = False,
    area_id: Optional[str] = None,
):
    """Get all habits for the current user."""
    try:
        user_id = current_user["id"]

        query = db.table("habits").select("*").eq("user_id", user_id)

        if not include_archived:
            query = query.eq("is_active", True)

        if area_id:
            query = query.eq("area_id", area_id)

        query = query.order("created_at", desc=False)

        result = query.execute()
        habits = result.data or []

        # Get today's logs for each habit
        today = date.today().isoformat()
        for habit in habits:
            log = db.table("habit_logs").select("*").eq("habit_id", habit["id"]).eq("date", today).execute()
            habit["today_log"] = log.data[0] if log.data else None

        return {"data": habits}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/today")
async def get_today_habits(db: Database, current_user: CurrentUser):
    """Get habits that should be completed today with their status."""
    try:
        user_id = current_user["id"]
        today = date.today()
        today_str = today.isoformat()
        day_of_week = (today.weekday() + 1) % 7  # Sunday=0

        # Get active habits
        habits_result = db.table("habits").select("*").eq("user_id", user_id).eq("is_active", True).execute()

        habits = []
        for habit in (habits_result.data or []):
            # Check if habit should be tracked today
            freq_days = habit.get("frequency_days") or [0, 1, 2, 3, 4, 5, 6]
            if habit["frequency_type"] == "daily" or day_of_week in freq_days:
                # Get today's log
                log = db.table("habit_logs").select("*").eq("habit_id", habit["id"]).eq("date", today_str).execute()
                habit["today_log"] = log.data[0] if log.data else None
                habit["is_completed"] = habit["today_log"] and habit["today_log"]["status"] == "completed"
                habits.append(habit)

        # Sort: incomplete first, then by target_time
        habits.sort(key=lambda h: (h["is_completed"], h.get("target_time") or "99:99"))

        return {"data": habits, "date": today_str}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{habit_id}")
async def get_habit(habit_id: str, db: Database, current_user: CurrentUser):
    """Get a single habit with full statistics."""
    try:
        user_id = current_user["id"]

        # Get habit
        result = db.table("habits").select("*").eq("id", habit_id).eq("user_id", user_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Habit not found")

        habit = result.data

        # Get all logs for this habit
        logs = db.table("habit_logs").select("*").eq("habit_id", habit_id).order("date", desc=True).execute()
        all_logs = logs.data or []

        # Calculate statistics
        freq_type = habit["frequency_type"]
        freq_days = habit.get("frequency_days") or [0, 1, 2, 3, 4, 5, 6]

        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)

        habit["statistics"] = {
            "current_streak": calculate_streak(all_logs, freq_type, freq_days),
            "best_streak": calculate_best_streak(all_logs),
            "total_completions": len([l for l in all_logs if l["status"] == "completed"]),
            "completion_rate_week": calculate_completion_rate(all_logs, week_start, today, freq_type, freq_days),
            "completion_rate_month": calculate_completion_rate(all_logs, month_start, today, freq_type, freq_days),
            "completion_rate_year": calculate_completion_rate(all_logs, year_start, today, freq_type, freq_days),
            "day_stats": get_day_stats(all_logs),
        }

        # Get recent logs (last 30 days)
        thirty_days_ago = (today - timedelta(days=30)).isoformat()
        recent_logs = [l for l in all_logs if l["date"] >= thirty_days_ago]
        habit["recent_logs"] = recent_logs

        return habit

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_habit(habit: HabitCreate, db: Database, current_user: CurrentUser):
    """Create a new habit."""
    try:
        user_id = current_user["id"]

        habit_data = {
            "user_id": user_id,
            "name": habit.name,
            "description": habit.description,
            "icon": habit.icon,
            "color": habit.color,
            "frequency_type": habit.frequency_type,
            "frequency_days": habit.frequency_days,
            "target_count": habit.target_count,
            "target_time": habit.target_time,
            "time_of_day": habit.time_of_day,
            "reminder_enabled": habit.reminder_enabled,
            "reminder_time": habit.reminder_time,
            "area_id": habit.area_id,
            "objective_id": habit.objective_id,
        }

        result = db.table("habits").insert(habit_data).execute()

        return {"data": result.data[0], "message": "Habit created successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{habit_id}")
async def update_habit(habit_id: str, habit: HabitUpdate, db: Database, current_user: CurrentUser):
    """Update a habit."""
    try:
        user_id = current_user["id"]

        # Verify ownership
        existing = db.table("habits").select("id").eq("id", habit_id).eq("user_id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Habit not found")

        update_data = {k: v for k, v in habit.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        result = db.table("habits").update(update_data).eq("id", habit_id).execute()

        return {"data": result.data[0], "message": "Habit updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{habit_id}")
async def delete_habit(habit_id: str, db: Database, current_user: CurrentUser):
    """Delete a habit and all its logs."""
    try:
        user_id = current_user["id"]

        existing = db.table("habits").select("id").eq("id", habit_id).eq("user_id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Habit not found")

        db.table("habits").delete().eq("id", habit_id).execute()

        return {"message": "Habit deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{habit_id}/archive")
async def archive_habit(habit_id: str, db: Database, current_user: CurrentUser):
    """Archive a habit (soft delete)."""
    try:
        user_id = current_user["id"]

        existing = db.table("habits").select("id").eq("id", habit_id).eq("user_id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Habit not found")

        db.table("habits").update({
            "is_active": False,
            "archived_at": datetime.now().isoformat()
        }).eq("id", habit_id).execute()

        return {"message": "Habit archived successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{habit_id}/restore")
async def restore_habit(habit_id: str, db: Database, current_user: CurrentUser):
    """Restore an archived habit."""
    try:
        user_id = current_user["id"]

        existing = db.table("habits").select("id").eq("id", habit_id).eq("user_id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Habit not found")

        db.table("habits").update({
            "is_active": True,
            "archived_at": None
        }).eq("id", habit_id).execute()

        return {"message": "Habit restored successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# Habit Log Endpoints
# =====================================================

@router.post("/{habit_id}/log")
async def log_habit(habit_id: str, log: HabitLogCreate, db: Database, current_user: CurrentUser):
    """Log a habit completion for a specific date."""
    try:
        user_id = current_user["id"]

        # Verify habit ownership
        habit = db.table("habits").select("id").eq("id", habit_id).eq("user_id", user_id).execute()
        if not habit.data:
            raise HTTPException(status_code=404, detail="Habit not found")

        # Check if log exists for this date
        existing = db.table("habit_logs").select("id").eq("habit_id", habit_id).eq("date", log.date).execute()

        log_data = {
            "habit_id": habit_id,
            "user_id": user_id,
            "date": log.date,
            "status": log.status,
            "value": log.value,
            "notes": log.notes,
            "completed_at": datetime.now().isoformat() if log.status == "completed" else None,
        }

        if existing.data:
            # Update existing log
            result = db.table("habit_logs").update(log_data).eq("id", existing.data[0]["id"]).execute()
        else:
            # Create new log
            result = db.table("habit_logs").insert(log_data).execute()

        return {"data": result.data[0], "message": "Habit logged successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-log")
async def bulk_log_habits(request: BulkLogRequest, db: Database, current_user: CurrentUser):
    """Log multiple habits for a single date."""
    try:
        user_id = current_user["id"]
        results = []

        for log_item in request.logs:
            habit_id = log_item.get("habit_id")
            log_status = log_item.get("status", "completed")
            value = log_item.get("value", 1)

            # Verify ownership
            habit = db.table("habits").select("id").eq("id", habit_id).eq("user_id", user_id).execute()
            if not habit.data:
                continue

            # Check existing
            existing = db.table("habit_logs").select("id").eq("habit_id", habit_id).eq("date", request.date).execute()

            log_data = {
                "habit_id": habit_id,
                "user_id": user_id,
                "date": request.date,
                "status": log_status,
                "value": value,
                "completed_at": datetime.now().isoformat() if log_status == "completed" else None,
            }

            if existing.data:
                result = db.table("habit_logs").update(log_data).eq("id", existing.data[0]["id"]).execute()
            else:
                result = db.table("habit_logs").insert(log_data).execute()

            results.append(result.data[0])

        return {"data": results, "message": f"{len(results)} habits logged"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{habit_id}/log/{log_date}")
async def delete_log(habit_id: str, log_date: str, db: Database, current_user: CurrentUser):
    """Delete a habit log for a specific date."""
    try:
        user_id = current_user["id"]

        # Verify ownership
        habit = db.table("habits").select("id").eq("id", habit_id).eq("user_id", user_id).execute()
        if not habit.data:
            raise HTTPException(status_code=404, detail="Habit not found")

        db.table("habit_logs").delete().eq("habit_id", habit_id).eq("date", log_date).execute()

        return {"message": "Log deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# Statistics Endpoints
# =====================================================

@router.get("/stats/overview")
async def get_habits_overview(db: Database, current_user: CurrentUser):
    """Get overall habits statistics."""
    try:
        user_id = current_user["id"]
        today = date.today()
        today_str = today.isoformat()

        # Get active habits count
        habits = db.table("habits").select("id, frequency_type, frequency_days").eq("user_id", user_id).eq("is_active", True).execute()
        total_habits = len(habits.data or [])

        # Count habits for today
        day_of_week = (today.weekday() + 1) % 7
        habits_for_today = 0
        for habit in (habits.data or []):
            freq_days = habit.get("frequency_days") or [0, 1, 2, 3, 4, 5, 6]
            if habit["frequency_type"] == "daily" or day_of_week in freq_days:
                habits_for_today += 1

        # Get today's completed count
        today_logs = db.table("habit_logs").select("id").eq("user_id", user_id).eq("date", today_str).eq("status", "completed").execute()
        completed_today = len(today_logs.data or [])

        # Get this week's stats
        week_start = (today - timedelta(days=today.weekday())).isoformat()
        week_logs = db.table("habit_logs").select("id, status").eq("user_id", user_id).gte("date", week_start).execute()
        completed_this_week = len([l for l in (week_logs.data or []) if l["status"] == "completed"])

        return {
            "total_habits": total_habits,
            "habits_for_today": habits_for_today,
            "completed_today": completed_today,
            "today_progress": round((completed_today / habits_for_today) * 100, 1) if habits_for_today > 0 else 0,
            "completed_this_week": completed_this_week,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/heatmap")
async def get_heatmap_data(
    db: Database,
    current_user: CurrentUser,
    year: Optional[int] = None,
):
    """Get heatmap data for the year (GitHub-style contributions)."""
    try:
        user_id = current_user["id"]

        if year is None:
            year = date.today().year

        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        # Get all logs for the year
        logs = db.table("habit_logs").select("date, status").eq("user_id", user_id).gte("date", start_date).lte("date", end_date).execute()

        # Count completions per day
        day_counts = defaultdict(int)
        for log in (logs.data or []):
            if log["status"] == "completed":
                day_counts[log["date"]] += 1

        # Build heatmap data
        heatmap = []
        current = date(year, 1, 1)
        end = date(year, 12, 31)

        while current <= end:
            date_str = current.isoformat()
            count = day_counts.get(date_str, 0)
            # Level: 0=none, 1=low, 2=medium, 3=high, 4=very high
            if count == 0:
                level = 0
            elif count <= 2:
                level = 1
            elif count <= 4:
                level = 2
            elif count <= 6:
                level = 3
            else:
                level = 4

            heatmap.append({
                "date": date_str,
                "count": count,
                "level": level,
            })
            current += timedelta(days=1)

        return {
            "year": year,
            "data": heatmap,
            "total_completions": sum(day_counts.values()),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/calendar/{year}/{month}")
async def get_calendar_data(year: int, month: int, db: Database, current_user: CurrentUser):
    """Get calendar view data for a specific month."""
    try:
        user_id = current_user["id"]

        # Get date range for month
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"

        # Get all active habits
        habits = db.table("habits").select("id, name, icon, color, frequency_type, frequency_days").eq("user_id", user_id).eq("is_active", True).execute()

        # Get logs for the month
        logs = db.table("habit_logs").select("*").eq("user_id", user_id).gte("date", start_date).lt("date", end_date).execute()

        # Organize logs by date
        logs_by_date = defaultdict(list)
        for log in (logs.data or []):
            logs_by_date[log["date"]].append(log)

        # Build calendar data
        calendar_data = []
        current = date(year, month, 1)

        while current.month == month:
            date_str = current.isoformat()
            day_of_week = (current.weekday() + 1) % 7

            day_habits = []
            for habit in (habits.data or []):
                freq_days = habit.get("frequency_days") or [0, 1, 2, 3, 4, 5, 6]
                if habit["frequency_type"] == "daily" or day_of_week in freq_days:
                    log = next((l for l in logs_by_date[date_str] if l["habit_id"] == habit["id"]), None)
                    day_habits.append({
                        "habit_id": habit["id"],
                        "name": habit["name"],
                        "icon": habit["icon"],
                        "color": habit["color"],
                        "status": log["status"] if log else None,
                        "log_id": log["id"] if log else None,
                    })

            completed = len([h for h in day_habits if h["status"] == "completed"])
            total = len(day_habits)

            calendar_data.append({
                "date": date_str,
                "day": current.day,
                "day_of_week": day_of_week,
                "habits": day_habits,
                "completed": completed,
                "total": total,
                "completion_rate": round((completed / total) * 100, 1) if total > 0 else 0,
            })

            current += timedelta(days=1)

        return {
            "year": year,
            "month": month,
            "data": calendar_data,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/trends")
async def get_trends(db: Database, current_user: CurrentUser, days: int = 30):
    """Get completion trends over time."""
    try:
        user_id = current_user["id"]
        today = date.today()
        start_date = (today - timedelta(days=days)).isoformat()

        # Get logs for the period
        logs = db.table("habit_logs").select("date, status").eq("user_id", user_id).gte("date", start_date).execute()

        # Count by date
        by_date = defaultdict(lambda: {"completed": 0, "total": 0})
        for log in (logs.data or []):
            by_date[log["date"]]["total"] += 1
            if log["status"] == "completed":
                by_date[log["date"]]["completed"] += 1

        # Build trend data
        trends = []
        current = today - timedelta(days=days)
        while current <= today:
            date_str = current.isoformat()
            data = by_date[date_str]
            rate = round((data["completed"] / data["total"]) * 100, 1) if data["total"] > 0 else 0
            trends.append({
                "date": date_str,
                "completed": data["completed"],
                "total": data["total"],
                "rate": rate,
            })
            current += timedelta(days=1)

        # Calculate trend direction
        if len(trends) >= 7:
            first_week_avg = sum(t["rate"] for t in trends[:7]) / 7
            last_week_avg = sum(t["rate"] for t in trends[-7:]) / 7
            trend_direction = "improving" if last_week_avg > first_week_avg else "declining" if last_week_avg < first_week_avg else "stable"
        else:
            trend_direction = "insufficient_data"

        return {
            "data": trends,
            "trend_direction": trend_direction,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/summary")
async def get_stats_summary(db: Database, current_user: CurrentUser):
    """Get comprehensive habit statistics by time period and area."""
    try:
        user_id = current_user["id"]
        today = date.today()

        # Define time periods
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)

        # Get all habits with area info
        habits = db.table("habits").select("id, name, icon, color, area_id, frequency_type, frequency_days").eq("user_id", user_id).eq("is_active", True).execute()
        habits_data = habits.data or []
        habit_ids = [h["id"] for h in habits_data]
        habit_map = {h["id"]: h for h in habits_data}

        if not habit_ids:
            return {
                "by_period": {
                    "week": {"completed": 0, "total": 0, "rate": 0},
                    "month": {"completed": 0, "total": 0, "rate": 0},
                    "year": {"completed": 0, "total": 0, "rate": 0},
                },
                "by_area": [],
                "by_habit": [],
                "totals": {"habits": 0, "total_completions": 0}
            }

        # Get all logs from year start
        logs = db.table("habit_logs").select("habit_id, date, status").eq("user_id", user_id).gte("date", year_start.isoformat()).execute()
        all_logs = logs.data or []

        # Get areas
        areas = db.table("areas").select("id, name, icon").eq("user_id", user_id).execute()
        area_map = {a["id"]: a for a in (areas.data or [])}

        # Calculate stats by period
        def calc_period_stats(start_date: date, end_date: date) -> dict:
            period_logs = [l for l in all_logs if start_date.isoformat() <= l["date"] <= end_date.isoformat()]
            completed = len([l for l in period_logs if l["status"] == "completed"])
            total = len(period_logs)
            return {
                "completed": completed,
                "total": total,
                "rate": round((completed / total) * 100, 1) if total > 0 else 0
            }

        by_period = {
            "week": calc_period_stats(week_start, today),
            "month": calc_period_stats(month_start, today),
            "year": calc_period_stats(year_start, today),
        }

        # Calculate stats by area
        area_stats = defaultdict(lambda: {"completed": 0, "total": 0, "habits": []})
        no_area_stats = {"completed": 0, "total": 0, "habits": []}

        for habit in habits_data:
            habit_logs = [l for l in all_logs if l["habit_id"] == habit["id"]]
            completed = len([l for l in habit_logs if l["status"] == "completed"])
            total = len(habit_logs)

            habit_stat = {
                "id": habit["id"],
                "name": habit["name"],
                "icon": habit["icon"],
                "color": habit["color"],
                "completed": completed,
                "total": total,
                "rate": round((completed / total) * 100, 1) if total > 0 else 0
            }

            if habit["area_id"] and habit["area_id"] in area_map:
                area_stats[habit["area_id"]]["completed"] += completed
                area_stats[habit["area_id"]]["total"] += total
                area_stats[habit["area_id"]]["habits"].append(habit_stat)
            else:
                no_area_stats["completed"] += completed
                no_area_stats["total"] += total
                no_area_stats["habits"].append(habit_stat)

        by_area = []
        for area_id, stats in area_stats.items():
            area = area_map.get(area_id, {})
            by_area.append({
                "area_id": area_id,
                "area_name": area.get("name", "Sin nombre"),
                "area_icon": area.get("icon", "📋"),
                "completed": stats["completed"],
                "total": stats["total"],
                "rate": round((stats["completed"] / stats["total"]) * 100, 1) if stats["total"] > 0 else 0,
                "habits": stats["habits"]
            })

        # Add "no area" if there are habits without area
        if no_area_stats["habits"]:
            by_area.append({
                "area_id": None,
                "area_name": "Sin área",
                "area_icon": "📌",
                "completed": no_area_stats["completed"],
                "total": no_area_stats["total"],
                "rate": round((no_area_stats["completed"] / no_area_stats["total"]) * 100, 1) if no_area_stats["total"] > 0 else 0,
                "habits": no_area_stats["habits"]
            })

        # Sort areas by completion rate
        by_area.sort(key=lambda x: x["rate"], reverse=True)

        # Calculate by habit (all habits sorted by rate)
        by_habit = []
        for habit in habits_data:
            habit_logs = [l for l in all_logs if l["habit_id"] == habit["id"]]
            completed = len([l for l in habit_logs if l["status"] == "completed"])
            total = len(habit_logs)

            # Get area name
            area_name = None
            if habit["area_id"] and habit["area_id"] in area_map:
                area_name = area_map[habit["area_id"]].get("name")

            by_habit.append({
                "id": habit["id"],
                "name": habit["name"],
                "icon": habit["icon"],
                "color": habit["color"],
                "area_name": area_name,
                "completed": completed,
                "total": total,
                "rate": round((completed / total) * 100, 1) if total > 0 else 0
            })

        by_habit.sort(key=lambda x: x["rate"], reverse=True)

        return {
            "by_period": by_period,
            "by_area": by_area,
            "by_habit": by_habit,
            "totals": {
                "habits": len(habits_data),
                "total_completions": len([l for l in all_logs if l["status"] == "completed"])
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
