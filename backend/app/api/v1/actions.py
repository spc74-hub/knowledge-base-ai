"""
Unified Actions API endpoints.
Provides a centralized view of all actions across mental models, areas, objectives, and projects.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime, timezone

from app.api.deps import Database, CurrentUser

router = APIRouter(prefix="/actions", tags=["actions"])


# =====================================================
# Pydantic Models
# =====================================================

class UnifiedAction(BaseModel):
    id: str
    title: str
    is_completed: bool
    position: int
    completed_at: Optional[str] = None
    created_at: str
    # Parent info
    parent_type: Literal["area", "objective", "project", "mental_model"]
    parent_id: str
    parent_name: str
    parent_icon: str
    parent_color: str


class GroupedActions(BaseModel):
    parent_type: str
    parent_id: str
    parent_name: str
    parent_icon: str
    parent_color: str
    actions: List[UnifiedAction]
    pending_count: int
    completed_count: int


class AllActionsResponse(BaseModel):
    groups: List[GroupedActions]
    total_pending: int
    total_completed: int


# =====================================================
# Endpoints
# =====================================================

@router.get("/all", response_model=AllActionsResponse)
async def get_all_actions(
    db: Database,
    current_user: CurrentUser,
    include_completed: bool = True,
    parent_type: Optional[str] = None,
):
    """
    Get all actions across mental models, areas, objectives, and projects.
    Returns actions grouped by their parent object.
    """
    try:
        user_id = current_user["id"]
        all_actions: List[UnifiedAction] = []

        # Fetch area actions
        if not parent_type or parent_type == "area":
            area_actions = db.table("area_actions").select(
                "id, title, is_completed, position, completed_at, created_at, area_id"
            ).eq("user_id", user_id).execute()

            if area_actions.data:
                area_ids = list(set(a["area_id"] for a in area_actions.data))
                areas = db.table("areas_of_responsibility").select(
                    "id, name, icon, color"
                ).in_("id", area_ids).execute()
                areas_map = {a["id"]: a for a in (areas.data or [])}

                for action in area_actions.data:
                    area = areas_map.get(action["area_id"])
                    if area:
                        all_actions.append(UnifiedAction(
                            id=action["id"],
                            title=action["title"],
                            is_completed=action["is_completed"],
                            position=action["position"],
                            completed_at=action.get("completed_at"),
                            created_at=action["created_at"],
                            parent_type="area",
                            parent_id=action["area_id"],
                            parent_name=area["name"],
                            parent_icon=area["icon"] or "📋",
                            parent_color=area["color"] or "#6366f1",
                        ))

        # Fetch objective actions
        if not parent_type or parent_type == "objective":
            objective_actions = db.table("objective_actions").select(
                "id, title, is_completed, position, completed_at, created_at, objective_id"
            ).eq("user_id", user_id).execute()

            if objective_actions.data:
                objective_ids = list(set(a["objective_id"] for a in objective_actions.data))
                objectives = db.table("objectives").select(
                    "id, title, icon, color"
                ).in_("id", objective_ids).execute()
                objectives_map = {o["id"]: o for o in (objectives.data or [])}

                for action in objective_actions.data:
                    objective = objectives_map.get(action["objective_id"])
                    if objective:
                        all_actions.append(UnifiedAction(
                            id=action["id"],
                            title=action["title"],
                            is_completed=action["is_completed"],
                            position=action["position"],
                            completed_at=action.get("completed_at"),
                            created_at=action["created_at"],
                            parent_type="objective",
                            parent_id=action["objective_id"],
                            parent_name=objective["title"],
                            parent_icon=objective["icon"] or "🎯",
                            parent_color=objective["color"] or "#6366f1",
                        ))

        # Fetch project actions
        if not parent_type or parent_type == "project":
            project_actions = db.table("project_actions").select(
                "id, title, is_completed, position, completed_at, created_at, project_id"
            ).eq("user_id", user_id).execute()

            if project_actions.data:
                project_ids = list(set(a["project_id"] for a in project_actions.data))
                projects = db.table("projects").select(
                    "id, name, icon, color"
                ).in_("id", project_ids).execute()
                projects_map = {p["id"]: p for p in (projects.data or [])}

                for action in project_actions.data:
                    project = projects_map.get(action["project_id"])
                    if project:
                        all_actions.append(UnifiedAction(
                            id=action["id"],
                            title=action["title"],
                            is_completed=action["is_completed"],
                            position=action["position"],
                            completed_at=action.get("completed_at"),
                            created_at=action["created_at"],
                            parent_type="project",
                            parent_id=action["project_id"],
                            parent_name=project["name"],
                            parent_icon=project["icon"] or "📁",
                            parent_color=project["color"] or "#6366f1",
                        ))

        # Fetch mental model actions
        if not parent_type or parent_type == "mental_model":
            mm_actions = db.table("mental_model_actions").select(
                "id, title, is_completed, position, completed_at, created_at, mental_model_id"
            ).eq("user_id", user_id).execute()

            if mm_actions.data:
                mm_ids = list(set(a["mental_model_id"] for a in mm_actions.data))
                mental_models = db.table("mental_models").select(
                    "id, name, icon, color"
                ).in_("id", mm_ids).execute()
                mm_map = {m["id"]: m for m in (mental_models.data or [])}

                for action in mm_actions.data:
                    mm = mm_map.get(action["mental_model_id"])
                    if mm:
                        all_actions.append(UnifiedAction(
                            id=action["id"],
                            title=action["title"],
                            is_completed=action["is_completed"],
                            position=action["position"],
                            completed_at=action.get("completed_at"),
                            created_at=action["created_at"],
                            parent_type="mental_model",
                            parent_id=action["mental_model_id"],
                            parent_name=mm["name"],
                            parent_icon=mm["icon"] or "🧠",
                            parent_color=mm["color"] or "#6366f1",
                        ))

        # Filter completed if needed
        if not include_completed:
            all_actions = [a for a in all_actions if not a.is_completed]

        # Group by parent
        groups_dict: dict = {}
        for action in all_actions:
            key = f"{action.parent_type}:{action.parent_id}"
            if key not in groups_dict:
                groups_dict[key] = {
                    "parent_type": action.parent_type,
                    "parent_id": action.parent_id,
                    "parent_name": action.parent_name,
                    "parent_icon": action.parent_icon,
                    "parent_color": action.parent_color,
                    "actions": [],
                    "pending_count": 0,
                    "completed_count": 0,
                }
            groups_dict[key]["actions"].append(action)
            if action.is_completed:
                groups_dict[key]["completed_count"] += 1
            else:
                groups_dict[key]["pending_count"] += 1

        # Sort actions within each group by position
        for group in groups_dict.values():
            group["actions"].sort(key=lambda a: a.position)

        # Convert to list and sort by parent type then name
        type_order = {"area": 0, "objective": 1, "project": 2, "mental_model": 3}
        groups = list(groups_dict.values())
        groups.sort(key=lambda g: (type_order.get(g["parent_type"], 99), g["parent_name"]))

        # Calculate totals
        total_pending = sum(g["pending_count"] for g in groups)
        total_completed = sum(g["completed_count"] for g in groups)

        return AllActionsResponse(
            groups=[GroupedActions(**g) for g in groups],
            total_pending=total_pending,
            total_completed=total_completed,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
