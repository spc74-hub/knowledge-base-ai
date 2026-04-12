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
    include_empty: bool = True,
):
    """
    Get all actions across mental models, areas, objectives, and projects.
    Returns actions grouped by their parent object.
    If include_empty=True, also returns objects without any actions.
    """
    try:
        user_id = current_user["id"]
        groups_dict: dict = {}

        # Helper to add a group
        def add_group(ptype: str, pid: str, pname: str, picon: str, pcolor: str):
            key = f"{ptype}:{pid}"
            if key not in groups_dict:
                groups_dict[key] = {
                    "parent_type": ptype,
                    "parent_id": pid,
                    "parent_name": pname,
                    "parent_icon": picon or get_default_icon(ptype),
                    "parent_color": pcolor or "#6366f1",
                    "actions": [],
                    "pending_count": 0,
                    "completed_count": 0,
                }
            return key

        def get_default_icon(ptype: str) -> str:
            icons = {"area": "📋", "objective": "🎯", "project": "📁", "mental_model": "🧠"}
            return icons.get(ptype, "📄")

        # Process areas
        if not parent_type or parent_type == "area":
            # Get all areas first
            all_areas = await db.table("areas_of_responsibility").select(
                "id, name, icon, color"
            ).eq("user_id", user_id).execute()

            areas_map = {a["id"]: a for a in (all_areas.data or [])}

            # Add all areas as groups if include_empty
            if include_empty:
                for area in (all_areas.data or []):
                    add_group("area", area["id"], area["name"], area["icon"], area["color"])

            # Get actions and add them
            area_actions = await db.table("area_actions").select(
                "id, title, is_completed, position, completed_at, created_at, area_id"
            ).eq("user_id", user_id).execute()

            for action in (area_actions.data or []):
                area = areas_map.get(action["area_id"])
                if area:
                    key = add_group("area", action["area_id"], area["name"], area["icon"], area["color"])

                    # Skip completed if not including them
                    if not include_completed and action["is_completed"]:
                        continue

                    groups_dict[key]["actions"].append(UnifiedAction(
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
                    if action["is_completed"]:
                        groups_dict[key]["completed_count"] += 1
                    else:
                        groups_dict[key]["pending_count"] += 1

        # Process objectives
        if not parent_type or parent_type == "objective":
            all_objectives = await db.table("objectives").select(
                "id, title, icon, color"
            ).eq("user_id", user_id).execute()

            objectives_map = {o["id"]: o for o in (all_objectives.data or [])}

            if include_empty:
                for obj in (all_objectives.data or []):
                    add_group("objective", obj["id"], obj["title"], obj["icon"], obj["color"])

            objective_actions = await db.table("objective_actions").select(
                "id, title, is_completed, position, completed_at, created_at, objective_id"
            ).eq("user_id", user_id).execute()

            for action in (objective_actions.data or []):
                objective = objectives_map.get(action["objective_id"])
                if objective:
                    key = add_group("objective", action["objective_id"], objective["title"], objective["icon"], objective["color"])

                    if not include_completed and action["is_completed"]:
                        continue

                    groups_dict[key]["actions"].append(UnifiedAction(
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
                    if action["is_completed"]:
                        groups_dict[key]["completed_count"] += 1
                    else:
                        groups_dict[key]["pending_count"] += 1

        # Process projects
        if not parent_type or parent_type == "project":
            all_projects = await db.table("projects").select(
                "id, name, icon, color"
            ).eq("user_id", user_id).execute()

            projects_map = {p["id"]: p for p in (all_projects.data or [])}

            if include_empty:
                for proj in (all_projects.data or []):
                    add_group("project", proj["id"], proj["name"], proj["icon"], proj["color"])

            project_actions = await db.table("project_actions").select(
                "id, title, is_completed, position, completed_at, created_at, project_id"
            ).eq("user_id", user_id).execute()

            for action in (project_actions.data or []):
                project = projects_map.get(action["project_id"])
                if project:
                    key = add_group("project", action["project_id"], project["name"], project["icon"], project["color"])

                    if not include_completed and action["is_completed"]:
                        continue

                    groups_dict[key]["actions"].append(UnifiedAction(
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
                    if action["is_completed"]:
                        groups_dict[key]["completed_count"] += 1
                    else:
                        groups_dict[key]["pending_count"] += 1

        # Process mental models
        if not parent_type or parent_type == "mental_model":
            all_mm = await db.table("mental_models").select(
                "id, name, icon, color"
            ).eq("user_id", user_id).execute()

            mm_map = {m["id"]: m for m in (all_mm.data or [])}

            if include_empty:
                for mm in (all_mm.data or []):
                    add_group("mental_model", mm["id"], mm["name"], mm["icon"], mm["color"])

            mm_actions = await db.table("mental_model_actions").select(
                "id, title, is_completed, position, completed_at, created_at, mental_model_id"
            ).eq("user_id", user_id).execute()

            for action in (mm_actions.data or []):
                mm = mm_map.get(action["mental_model_id"])
                if mm:
                    key = add_group("mental_model", action["mental_model_id"], mm["name"], mm["icon"], mm["color"])

                    if not include_completed and action["is_completed"]:
                        continue

                    groups_dict[key]["actions"].append(UnifiedAction(
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
                    if action["is_completed"]:
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
