"""
Daily Journal API endpoints.
Manages daily journal entries with morning/evening routines and inspirational content.
"""
import random
from datetime import date, datetime
from typing import Optional, List
from uuid import uuid4

from anthropic import Anthropic
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import Database, CurrentUser
from app.core.config import settings
from app.services.usage_tracker import usage_tracker

router = APIRouter(prefix="/daily-journal", tags=["daily-journal"])


# =====================================================
# Pydantic Models
# =====================================================

class TaskItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    text: str
    completed: bool = False
    time: Optional[str] = None


class CommitmentItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    time: str
    text: str
    completed: bool = False


class QuickCapture(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    text: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    converted_to_note_id: Optional[str] = None


class ForgivenessItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    text: str
    type: str = "self"  # self, other, situation


class InspirationalContent(BaseModel):
    quote: Optional[str] = None
    quote_author: Optional[str] = None
    refran: Optional[str] = None
    challenge: Optional[str] = None
    question: Optional[str] = None
    word: Optional[str] = None


class DailyJournalCreate(BaseModel):
    date: date


class DailyJournalUpdate(BaseModel):
    # Morning section
    morning_intention: Optional[str] = None
    energy_morning: Optional[str] = None

    # Big rock
    big_rock_type: Optional[str] = None  # 'objective', 'project', 'custom'
    big_rock_id: Optional[str] = None
    big_rock_text: Optional[str] = None
    big_rock_completed: Optional[bool] = None

    # During the day
    energy_noon: Optional[str] = None
    energy_afternoon: Optional[str] = None
    energy_night: Optional[str] = None
    daily_tasks: Optional[List[TaskItem]] = None
    commitments: Optional[List[CommitmentItem]] = None
    quick_captures: Optional[List[QuickCapture]] = None

    # Evening section
    wins: Optional[List[str]] = None
    learnings: Optional[str] = None
    gratitudes: Optional[List[str]] = None
    failures: Optional[str] = None
    forgiveness: Optional[str] = None  # Legacy text field
    forgiveness_items: Optional[List[ForgivenessItem]] = None  # New structured field
    do_different: Optional[str] = None
    note_to_tomorrow: Optional[str] = None
    day_rating: Optional[int] = Field(None, ge=1, le=5)
    day_word: Optional[str] = None

    # Metadata
    is_morning_completed: Optional[bool] = None
    is_day_completed: Optional[bool] = None
    is_evening_completed: Optional[bool] = None


class DailyJournalResponse(BaseModel):
    id: str
    user_id: str
    date: date
    morning_intention: Optional[str]
    energy_morning: Optional[str]
    inspirational_content: dict
    big_rock_type: Optional[str]
    big_rock_id: Optional[str]
    big_rock_text: Optional[str]
    big_rock_completed: bool
    energy_noon: Optional[str]
    energy_afternoon: Optional[str]
    energy_night: Optional[str]
    daily_tasks: list
    commitments: list
    quick_captures: list
    wins: list
    learnings: Optional[str]
    gratitudes: list
    failures: Optional[str]
    forgiveness: Optional[str]
    forgiveness_items: list
    do_different: Optional[str]
    note_to_tomorrow: Optional[str]
    day_rating: Optional[int]
    day_word: Optional[str]
    is_morning_completed: bool
    is_day_completed: bool
    is_evening_completed: bool
    created_at: datetime
    updated_at: datetime


# =====================================================
# Helper Functions
# =====================================================

def get_random_inspirational_content(db: Database) -> dict:
    """Get random inspirational content for each type."""
    content = {}

    types = ['quote', 'refran', 'challenge', 'question', 'word']

    for content_type in types:
        result = db.table("inspirational_content").select("*").eq(
            "content_type", content_type
        ).eq("is_active", True).execute()

        if result.data:
            item = random.choice(result.data)
            if content_type == 'quote':
                content['quote'] = item['content']
                content['quote_author'] = item.get('author')
            else:
                content[content_type] = item['content']

    return content


# =====================================================
# Endpoints
# =====================================================

@router.get("/today")
async def get_today_journal(db: Database, current_user: CurrentUser):
    """
    Get or create today's journal entry.
    If it doesn't exist, creates one with inspirational content.
    """
    user_id = current_user["id"]
    today = date.today()

    # Try to get existing journal
    result = db.table("daily_journal").select("*").eq(
        "user_id", user_id
    ).eq("date", today.isoformat()).execute()

    if result.data:
        return result.data[0]

    # Create new journal for today
    inspirational = get_random_inspirational_content(db)

    new_journal = {
        "user_id": user_id,
        "date": today.isoformat(),
        "inspirational_content": inspirational,
        "daily_tasks": [],
        "commitments": [],
        "quick_captures": [],
        "wins": [],
        "gratitudes": [],
        "forgiveness_items": [],
        "big_rock_completed": False,
        "is_morning_completed": False,
        "is_day_completed": False,
        "is_evening_completed": False,
    }

    insert_result = db.table("daily_journal").insert(new_journal).execute()

    if not insert_result.data:
        raise HTTPException(status_code=500, detail="Failed to create journal")

    return insert_result.data[0]


@router.get("/by-date/{journal_date}")
async def get_journal_by_date(
    journal_date: date,
    db: Database,
    current_user: CurrentUser
):
    """Get journal entry for a specific date."""
    user_id = current_user["id"]

    result = db.table("daily_journal").select("*").eq(
        "user_id", user_id
    ).eq("date", journal_date.isoformat()).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Journal not found for this date")

    return result.data[0]


class CreateForDateRequest(BaseModel):
    date: str  # YYYY-MM-DD format


@router.post("/create-for-date")
async def create_journal_for_date(
    request: CreateForDateRequest,
    db: Database,
    current_user: CurrentUser
):
    """
    Create a journal entry for a specific past date.
    This allows users to fill in journals for days they missed.
    """
    user_id = current_user["id"]

    # Parse the date
    try:
        journal_date = datetime.strptime(request.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Don't allow future dates
    today = date.today()
    if journal_date > today:
        raise HTTPException(status_code=400, detail="Cannot create journal for future dates")

    # Check if journal already exists
    existing = db.table("daily_journal").select("*").eq(
        "user_id", user_id
    ).eq("date", journal_date.isoformat()).execute()

    if existing.data:
        return existing.data[0]

    # Create new journal for the specified date with inspirational content
    inspirational = get_random_inspirational_content(db)

    new_journal = {
        "user_id": user_id,
        "date": journal_date.isoformat(),
        "inspirational_content": inspirational,
        "daily_tasks": [],
        "commitments": [],
        "quick_captures": [],
        "wins": [],
        "gratitudes": [],
        "forgiveness_items": [],
        "big_rock_completed": False,
        "is_morning_completed": False,
        "is_day_completed": False,
        "is_evening_completed": False,
    }

    insert_result = db.table("daily_journal").insert(new_journal).execute()

    if not insert_result.data:
        raise HTTPException(status_code=500, detail="Failed to create journal")

    return insert_result.data[0]


@router.get("/history")
async def get_journal_history(
    db: Database,
    current_user: CurrentUser,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get journal history with pagination."""
    user_id = current_user["id"]

    result = db.table("daily_journal").select(
        "id, date, day_rating, day_word, is_morning_completed, is_evening_completed"
    ).eq("user_id", user_id).order(
        "date", desc=True
    ).range(offset, offset + limit - 1).execute()

    return {
        "journals": result.data or [],
        "count": len(result.data or [])
    }


@router.patch("/today")
async def update_today_journal(
    updates: DailyJournalUpdate,
    db: Database,
    current_user: CurrentUser
):
    """Update today's journal entry."""
    user_id = current_user["id"]
    today = date.today()

    # Ensure journal exists
    existing = db.table("daily_journal").select("id").eq(
        "user_id", user_id
    ).eq("date", today.isoformat()).execute()

    if not existing.data:
        # Create if doesn't exist
        await get_today_journal(db, current_user)

    # Prepare update data
    update_data = updates.model_dump(exclude_unset=True)

    # Convert lists to JSON-compatible format
    if 'daily_tasks' in update_data and update_data['daily_tasks']:
        update_data['daily_tasks'] = [t.model_dump() if hasattr(t, 'model_dump') else t for t in update_data['daily_tasks']]
    if 'commitments' in update_data and update_data['commitments']:
        update_data['commitments'] = [c.model_dump() if hasattr(c, 'model_dump') else c for c in update_data['commitments']]
    if 'quick_captures' in update_data and update_data['quick_captures']:
        update_data['quick_captures'] = [q.model_dump() if hasattr(q, 'model_dump') else q for q in update_data['quick_captures']]

    # Update
    result = db.table("daily_journal").update(update_data).eq(
        "user_id", user_id
    ).eq("date", today.isoformat()).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update journal")

    return result.data[0]


@router.patch("/{journal_id}")
async def update_journal(
    journal_id: str,
    updates: DailyJournalUpdate,
    db: Database,
    current_user: CurrentUser
):
    """Update a specific journal entry by ID."""
    user_id = current_user["id"]

    # Verify ownership
    existing = db.table("daily_journal").select("id").eq(
        "id", journal_id
    ).eq("user_id", user_id).execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Journal not found")

    # Prepare update data
    update_data = updates.model_dump(exclude_unset=True)

    # Convert lists to JSON-compatible format
    if 'daily_tasks' in update_data and update_data['daily_tasks']:
        update_data['daily_tasks'] = [t.model_dump() if hasattr(t, 'model_dump') else t for t in update_data['daily_tasks']]
    if 'commitments' in update_data and update_data['commitments']:
        update_data['commitments'] = [c.model_dump() if hasattr(c, 'model_dump') else c for c in update_data['commitments']]
    if 'quick_captures' in update_data and update_data['quick_captures']:
        update_data['quick_captures'] = [q.model_dump() if hasattr(q, 'model_dump') else q for q in update_data['quick_captures']]

    result = db.table("daily_journal").update(update_data).eq(
        "id", journal_id
    ).eq("user_id", user_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update journal")

    return result.data[0]


@router.post("/today/task")
async def add_task(
    task: TaskItem,
    db: Database,
    current_user: CurrentUser
):
    """Add a task to today's journal."""
    user_id = current_user["id"]
    today = date.today()

    # Get current journal
    journal = await get_today_journal(db, current_user)

    # Add task
    tasks = journal.get('daily_tasks', []) or []
    tasks.append(task.model_dump())

    # Update
    result = db.table("daily_journal").update({
        "daily_tasks": tasks
    }).eq("user_id", user_id).eq("date", today.isoformat()).execute()

    return {"success": True, "task": task.model_dump()}


@router.post("/today/capture")
async def add_quick_capture(
    capture: QuickCapture,
    db: Database,
    current_user: CurrentUser
):
    """Add a quick capture to today's journal."""
    user_id = current_user["id"]
    today = date.today()

    # Get current journal
    journal = await get_today_journal(db, current_user)

    # Add capture
    captures = journal.get('quick_captures', []) or []
    captures.append(capture.model_dump())

    # Update
    result = db.table("daily_journal").update({
        "quick_captures": captures
    }).eq("user_id", user_id).eq("date", today.isoformat()).execute()

    return {"success": True, "capture": capture.model_dump()}


@router.get("/inspirational/refresh")
async def refresh_inspirational_content(
    db: Database,
    current_user: CurrentUser
):
    """Get new random inspirational content (without saving)."""
    return get_random_inspirational_content(db)


@router.get("/inspirational/all")
async def get_all_inspirational(
    db: Database,
    current_user: CurrentUser,
    content_type: Optional[str] = None
):
    """Get all inspirational content, optionally filtered by type."""
    query = db.table("inspirational_content").select("*").eq("is_active", True)

    if content_type:
        query = query.eq("content_type", content_type)

    result = query.order("content_type").execute()

    return result.data or []


@router.get("/stats/streak")
async def get_journal_streak(
    db: Database,
    current_user: CurrentUser
):
    """Get current streak of completed journals."""
    user_id = current_user["id"]

    # Get all journals ordered by date desc
    result = db.table("daily_journal").select(
        "date, is_morning_completed, is_evening_completed, day_rating"
    ).eq("user_id", user_id).order("date", desc=True).limit(60).execute()

    journals = result.data or []

    if not journals:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "total_journals": 0,
            "completed_journals": 0
        }

    # Calculate streaks
    current_streak = 0
    longest_streak = 0
    temp_streak = 0
    completed = 0

    today = date.today()

    for i, journal in enumerate(journals):
        journal_date = datetime.strptime(journal['date'], '%Y-%m-%d').date()
        is_completed = journal.get('is_evening_completed', False)

        if is_completed:
            completed += 1
            temp_streak += 1

            # Check if this is current streak (includes today or yesterday)
            if i == 0:
                days_diff = (today - journal_date).days
                if days_diff <= 1:
                    current_streak = temp_streak
        else:
            longest_streak = max(longest_streak, temp_streak)
            temp_streak = 0
            if i == 0:
                current_streak = 0

    longest_streak = max(longest_streak, temp_streak)

    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_journals": len(journals),
        "completed_journals": completed
    }


@router.get("/summary/week")
async def get_week_summary(
    db: Database,
    current_user: CurrentUser
):
    """Get summary of the current week's journals."""
    user_id = current_user["id"]
    today = date.today()

    # Get start of week (Monday)
    start_of_week = today - __import__('datetime').timedelta(days=today.weekday())

    result = db.table("daily_journal").select("*").eq(
        "user_id", user_id
    ).gte("date", start_of_week.isoformat()).lte(
        "date", today.isoformat()
    ).order("date").execute()

    journals = result.data or []

    # Aggregate stats
    total_rating = 0
    rated_days = 0
    energy_counts = {"high": 0, "medium": 0, "low": 0}
    all_wins = []
    all_gratitudes = []

    for journal in journals:
        if journal.get('day_rating'):
            total_rating += journal['day_rating']
            rated_days += 1

        for energy_field in ['energy_morning', 'energy_noon', 'energy_afternoon', 'energy_night']:
            energy = journal.get(energy_field)
            if energy in energy_counts:
                energy_counts[energy] += 1

        all_wins.extend(journal.get('wins', []) or [])
        all_gratitudes.extend(journal.get('gratitudes', []) or [])

    return {
        "days_count": len(journals),
        "average_rating": round(total_rating / rated_days, 1) if rated_days > 0 else None,
        "energy_distribution": energy_counts,
        "total_wins": len(all_wins),
        "total_gratitudes": len(all_gratitudes),
        "journals": journals
    }


@router.get("/stats/insights")
async def get_journal_insights(
    db: Database,
    current_user: CurrentUser,
    days: int = Query(30, ge=7, le=365)
):
    """
    Get comprehensive insights and patterns from journal entries.
    Analyzes wins, gratitudes, energy patterns, ratings, and more.
    """
    user_id = current_user["id"]
    today = date.today()
    start_date = today - __import__('datetime').timedelta(days=days)

    # Fetch all journals in the date range
    result = db.table("daily_journal").select("*").eq(
        "user_id", user_id
    ).gte("date", start_date.isoformat()).lte(
        "date", today.isoformat()
    ).order("date", desc=True).execute()

    journals = result.data or []

    if not journals:
        return {
            "period_days": days,
            "total_journals": 0,
            "completion_rate": 0,
            "average_rating": None,
            "rating_trend": [],
            "energy_patterns": {},
            "best_day_of_week": None,
            "worst_day_of_week": None,
            "top_wins_themes": [],
            "top_gratitude_themes": [],
            "total_wins": 0,
            "total_gratitudes": 0,
            "big_rock_completion_rate": 0,
            "task_completion_rate": 0,
            "morning_routine_rate": 0,
            "evening_routine_rate": 0,
        }

    # Calculate basic stats
    completed_journals = len([j for j in journals if j.get('is_evening_completed')])
    completion_rate = round((completed_journals / days) * 100, 1)

    # Rating analysis
    ratings = [j['day_rating'] for j in journals if j.get('day_rating')]
    average_rating = round(sum(ratings) / len(ratings), 2) if ratings else None

    # Rating trend (last 7 entries with ratings)
    rating_trend = [
        {"date": j['date'], "rating": j['day_rating']}
        for j in journals if j.get('day_rating')
    ][:14]  # Last 14 data points

    # Energy patterns by time of day
    energy_patterns = {
        "morning": {"high": 0, "medium": 0, "low": 0},
        "noon": {"high": 0, "medium": 0, "low": 0},
        "afternoon": {"high": 0, "medium": 0, "low": 0},
        "night": {"high": 0, "medium": 0, "low": 0},
    }

    for journal in journals:
        if journal.get('energy_morning') in energy_patterns["morning"]:
            energy_patterns["morning"][journal['energy_morning']] += 1
        if journal.get('energy_noon') in energy_patterns["noon"]:
            energy_patterns["noon"][journal['energy_noon']] += 1
        if journal.get('energy_afternoon') in energy_patterns["afternoon"]:
            energy_patterns["afternoon"][journal['energy_afternoon']] += 1
        if journal.get('energy_night') in energy_patterns["night"]:
            energy_patterns["night"][journal['energy_night']] += 1

    # Best/Worst day of week analysis
    day_ratings = {}  # 0=Monday, 6=Sunday
    for journal in journals:
        if journal.get('day_rating'):
            journal_date = datetime.strptime(journal['date'], '%Y-%m-%d').date()
            weekday = journal_date.weekday()
            if weekday not in day_ratings:
                day_ratings[weekday] = []
            day_ratings[weekday].append(journal['day_rating'])

    day_names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    day_averages = {
        day: round(sum(ratings) / len(ratings), 2)
        for day, ratings in day_ratings.items()
    }

    best_day = max(day_averages.items(), key=lambda x: x[1])[0] if day_averages else None
    worst_day = min(day_averages.items(), key=lambda x: x[1])[0] if day_averages else None

    # Collect all wins and gratitudes for theme analysis
    all_wins = []
    all_gratitudes = []
    for journal in journals:
        all_wins.extend(journal.get('wins', []) or [])
        all_gratitudes.extend(journal.get('gratitudes', []) or [])

    # Simple word frequency analysis for themes (top words)
    def get_word_themes(items: list, top_n: int = 5) -> list:
        """Extract common themes from a list of strings."""
        if not items:
            return []
        # Combine all items and count words (simple approach)
        word_count = {}
        stop_words = {'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por',
                      'para', 'y', 'a', 'que', 'mi', 'me', 'se', 'su', 'sus', 'al', 'es',
                      'lo', 'como', 'más', 'pero', 'fue', 'hoy', 'muy', 'este', 'esta'}
        for item in items:
            words = item.lower().split()
            for word in words:
                clean_word = ''.join(c for c in word if c.isalnum())
                if len(clean_word) > 2 and clean_word not in stop_words:
                    word_count[clean_word] = word_count.get(clean_word, 0) + 1

        # Sort by frequency and return top N
        sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)
        return [{"word": word, "count": count} for word, count in sorted_words[:top_n]]

    top_wins_themes = get_word_themes(all_wins, 8)
    top_gratitude_themes = get_word_themes(all_gratitudes, 8)

    # Big Rock completion rate
    big_rocks_set = len([j for j in journals if j.get('big_rock_type')])
    big_rocks_completed = len([j for j in journals if j.get('big_rock_completed')])
    big_rock_rate = round((big_rocks_completed / big_rocks_set) * 100, 1) if big_rocks_set > 0 else 0

    # Task completion rate
    total_tasks = 0
    completed_tasks = 0
    for journal in journals:
        tasks = journal.get('daily_tasks', []) or []
        total_tasks += len(tasks)
        completed_tasks += len([t for t in tasks if t.get('completed')])
    task_completion_rate = round((completed_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0

    # Morning/Evening routine rates
    morning_completed = len([j for j in journals if j.get('is_morning_completed')])
    evening_completed = len([j for j in journals if j.get('is_evening_completed')])
    morning_routine_rate = round((morning_completed / len(journals)) * 100, 1)
    evening_routine_rate = round((evening_completed / len(journals)) * 100, 1)

    return {
        "period_days": days,
        "total_journals": len(journals),
        "completion_rate": completion_rate,
        "average_rating": average_rating,
        "rating_trend": rating_trend,
        "energy_patterns": energy_patterns,
        "day_of_week_ratings": {day_names[day]: avg for day, avg in day_averages.items()},
        "best_day_of_week": day_names[best_day] if best_day is not None else None,
        "worst_day_of_week": day_names[worst_day] if worst_day is not None else None,
        "top_wins_themes": top_wins_themes,
        "top_gratitude_themes": top_gratitude_themes,
        "total_wins": len(all_wins),
        "total_gratitudes": len(all_gratitudes),
        "big_rock_completion_rate": big_rock_rate,
        "task_completion_rate": task_completion_rate,
        "morning_routine_rate": morning_routine_rate,
        "evening_routine_rate": evening_routine_rate,
    }


# Initialize Anthropic client for AI summary
_anthropic_client = None


def get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _anthropic_client


JOURNAL_SUMMARY_PROMPT = """Eres un coach personal empático y perspicaz. Tu tarea es analizar los datos del diario personal del usuario y generar un resumen reflexivo y útil.

DATOS DEL PERÍODO ({period_days} días):
- Total de diarios: {total_journals}
- Tasa de completación: {completion_rate}%
- Calificación promedio: {average_rating}/5
- Big Rocks completados: {big_rock_rate}%
- Tareas completadas: {task_rate}%
- Rutina matutina: {morning_rate}%
- Rutina nocturna: {evening_rate}%

MEJOR DÍA DE LA SEMANA: {best_day}
PEOR DÍA DE LA SEMANA: {worst_day}

TEMAS FRECUENTES EN LOGROS:
{wins_themes}

TEMAS FRECUENTES EN GRATITUDES:
{gratitude_themes}

PATRONES DE ENERGÍA:
- Mañana: Alta {energy_morning_high}, Media {energy_morning_medium}, Baja {energy_morning_low}
- Mediodía: Alta {energy_noon_high}, Media {energy_noon_medium}, Baja {energy_noon_low}
- Tarde: Alta {energy_afternoon_high}, Media {energy_afternoon_medium}, Baja {energy_afternoon_low}
- Noche: Alta {energy_night_high}, Media {energy_night_medium}, Baja {energy_night_low}

---

Genera un resumen en español con las siguientes secciones:

1. **RESUMEN GENERAL** (2-3 oraciones)
   - Una visión general del período

2. **PUNTOS FUERTES** (3-4 puntos)
   - Lo que está funcionando bien
   - Patrones positivos detectados

3. **ÁREAS DE MEJORA** (2-3 puntos)
   - Oportunidades de crecimiento (sin ser crítico)
   - Sugerencias constructivas

4. **PATRÓN DE ENERGÍA**
   - Análisis breve de los momentos de mayor/menor energía
   - Una sugerencia práctica basada en los datos

5. **RECOMENDACIÓN DE LA SEMANA**
   - Una acción concreta y motivadora

Sé cálido, positivo pero honesto. Usa emojis moderadamente para hacer el contenido más visual."""


@router.post("/summary/ai-generate")
async def generate_ai_summary(
    db: Database,
    current_user: CurrentUser,
    days: int = Query(30, ge=7, le=90)
):
    """
    Generate an AI-powered summary and insights from journal entries.
    Uses Claude to analyze patterns and provide personalized recommendations.
    """
    user_id = current_user["id"]
    today = date.today()
    start_date = today - __import__('datetime').timedelta(days=days)

    # Fetch all journals in the date range
    result = db.table("daily_journal").select("*").eq(
        "user_id", user_id
    ).gte("date", start_date.isoformat()).lte(
        "date", today.isoformat()
    ).order("date", desc=True).execute()

    journals = result.data or []

    if len(journals) < 3:
        raise HTTPException(
            status_code=400,
            detail="Se necesitan al menos 3 entradas de diario para generar un resumen con IA"
        )

    # Calculate all the stats we need
    completed_journals = len([j for j in journals if j.get('is_evening_completed')])
    completion_rate = round((completed_journals / days) * 100, 1)

    ratings = [j['day_rating'] for j in journals if j.get('day_rating')]
    average_rating = round(sum(ratings) / len(ratings), 2) if ratings else "N/A"

    # Energy patterns
    energy_patterns = {
        "morning": {"high": 0, "medium": 0, "low": 0},
        "noon": {"high": 0, "medium": 0, "low": 0},
        "afternoon": {"high": 0, "medium": 0, "low": 0},
        "night": {"high": 0, "medium": 0, "low": 0},
    }

    for journal in journals:
        if journal.get('energy_morning') in energy_patterns["morning"]:
            energy_patterns["morning"][journal['energy_morning']] += 1
        if journal.get('energy_noon') in energy_patterns["noon"]:
            energy_patterns["noon"][journal['energy_noon']] += 1
        if journal.get('energy_afternoon') in energy_patterns["afternoon"]:
            energy_patterns["afternoon"][journal['energy_afternoon']] += 1
        if journal.get('energy_night') in energy_patterns["night"]:
            energy_patterns["night"][journal['energy_night']] += 1

    # Best/Worst day calculation
    day_ratings = {}
    for journal in journals:
        if journal.get('day_rating'):
            journal_date = datetime.strptime(journal['date'], '%Y-%m-%d').date()
            weekday = journal_date.weekday()
            if weekday not in day_ratings:
                day_ratings[weekday] = []
            day_ratings[weekday].append(journal['day_rating'])

    day_names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    day_averages = {
        day: round(sum(ratings) / len(ratings), 2)
        for day, ratings in day_ratings.items()
    }

    best_day = day_names[max(day_averages.items(), key=lambda x: x[1])[0]] if day_averages else "N/A"
    worst_day = day_names[min(day_averages.items(), key=lambda x: x[1])[0]] if day_averages else "N/A"

    # Wins and gratitude themes
    all_wins = []
    all_gratitudes = []
    for journal in journals:
        all_wins.extend(journal.get('wins', []) or [])
        all_gratitudes.extend(journal.get('gratitudes', []) or [])

    def format_themes(items: list) -> str:
        if not items:
            return "Sin datos suficientes"
        word_count = {}
        stop_words = {'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por',
                      'para', 'y', 'a', 'que', 'mi', 'me', 'se', 'su', 'sus', 'al', 'es',
                      'lo', 'como', 'más', 'pero', 'fue', 'hoy', 'muy', 'este', 'esta'}
        for item in items:
            words = item.lower().split()
            for word in words:
                clean_word = ''.join(c for c in word if c.isalnum())
                if len(clean_word) > 2 and clean_word not in stop_words:
                    word_count[clean_word] = word_count.get(clean_word, 0) + 1
        sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)[:6]
        return ", ".join([f"{w[0]} ({w[1]}x)" for w in sorted_words]) if sorted_words else "Variado"

    # Big Rock and task rates
    big_rocks_set = len([j for j in journals if j.get('big_rock_type')])
    big_rocks_completed = len([j for j in journals if j.get('big_rock_completed')])
    big_rock_rate = round((big_rocks_completed / big_rocks_set) * 100, 1) if big_rocks_set > 0 else 0

    total_tasks = 0
    completed_tasks = 0
    for journal in journals:
        tasks = journal.get('daily_tasks', []) or []
        total_tasks += len(tasks)
        completed_tasks += len([t for t in tasks if t.get('completed')])
    task_rate = round((completed_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0

    morning_completed = len([j for j in journals if j.get('is_morning_completed')])
    evening_completed = len([j for j in journals if j.get('is_evening_completed')])
    morning_rate = round((morning_completed / len(journals)) * 100, 1)
    evening_rate = round((evening_completed / len(journals)) * 100, 1)

    # Build the prompt
    prompt = JOURNAL_SUMMARY_PROMPT.format(
        period_days=days,
        total_journals=len(journals),
        completion_rate=completion_rate,
        average_rating=average_rating,
        big_rock_rate=big_rock_rate,
        task_rate=task_rate,
        morning_rate=morning_rate,
        evening_rate=evening_rate,
        best_day=best_day,
        worst_day=worst_day,
        wins_themes=format_themes(all_wins),
        gratitude_themes=format_themes(all_gratitudes),
        energy_morning_high=energy_patterns["morning"]["high"],
        energy_morning_medium=energy_patterns["morning"]["medium"],
        energy_morning_low=energy_patterns["morning"]["low"],
        energy_noon_high=energy_patterns["noon"]["high"],
        energy_noon_medium=energy_patterns["noon"]["medium"],
        energy_noon_low=energy_patterns["noon"]["low"],
        energy_afternoon_high=energy_patterns["afternoon"]["high"],
        energy_afternoon_medium=energy_patterns["afternoon"]["medium"],
        energy_afternoon_low=energy_patterns["afternoon"]["low"],
        energy_night_high=energy_patterns["night"]["high"],
        energy_night_medium=energy_patterns["night"]["medium"],
        energy_night_low=energy_patterns["night"]["low"],
    )

    # Call Claude API
    try:
        client = get_anthropic_client()
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )

        # Track usage
        if response.usage:
            await usage_tracker.track_usage(
                user_id=user_id,
                provider="anthropic",
                model="claude-sonnet-4-20250514",
                operation="journal_summary",
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                metadata={"days": days, "journals_count": len(journals)}
            )

        summary = response.content[0].text

        return {
            "summary": summary,
            "period_days": days,
            "journals_analyzed": len(journals),
            "generated_at": datetime.now().isoformat(),
            "stats": {
                "completion_rate": completion_rate,
                "average_rating": average_rating,
                "best_day": best_day,
                "worst_day": worst_day,
                "big_rock_rate": big_rock_rate,
                "task_rate": task_rate,
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar resumen con IA: {str(e)}"
        )
