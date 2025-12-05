"""
Objectives API endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import date
from app.api.deps import CurrentUser, Database

router = APIRouter()

# =====================================================
# Schemas
# =====================================================

class ObjectiveCreate(BaseModel):
    title: str
    description: Optional[str] = None
    horizon: str = "yearly"  # daily, weekly, monthly, quarterly, yearly, lifetime
    target_date: Optional[date] = None
    status: str = "pending"  # future, pending, active, completed
    color: str = "#6366f1"
    icon: str = "🎯"
    parent_id: Optional[str] = None


class ObjectiveUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    horizon: Optional[str] = None
    target_date: Optional[date] = None
    status: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[str] = None


class ActionCreate(BaseModel):
    title: str


class ActionUpdate(BaseModel):
    title: Optional[str] = None
    is_completed: Optional[bool] = None


# =====================================================
# Objectives CRUD
# =====================================================

@router.get("/")
async def list_objectives(
    current_user: CurrentUser,
    db: Database,
    status: Optional[str] = None,
    include_children: bool = True,
):
    """List all objectives for the current user."""
    query = db.table("objectives").select(
        "*, objective_actions(id, title, is_completed, position)"
    ).eq("user_id", current_user["id"]).order("position")

    if status:
        query = query.eq("status", status)

    if not include_children:
        query = query.is_("parent_id", "null")

    result = query.execute()
    return {"objectives": result.data}


@router.get("/active")
async def get_active_objectives(
    current_user: CurrentUser,
    db: Database,
):
    """Get only active objectives (for dashboard)."""
    result = db.table("objectives").select(
        "*, objective_actions(id, title, is_completed, position)"
    ).eq("user_id", current_user["id"]).eq("status", "active").order("position").execute()

    return {"objectives": result.data}


@router.get("/stats")
async def get_objectives_stats(
    current_user: CurrentUser,
    db: Database,
):
    """Get statistics about objectives."""
    result = db.table("objectives").select("status, progress").eq(
        "user_id", current_user["id"]
    ).execute()

    stats = {
        "total": len(result.data),
        "by_status": {"future": 0, "pending": 0, "active": 0, "completed": 0},
        "average_progress": 0,
    }

    total_progress = 0
    for obj in result.data:
        obj_status = obj.get("status", "pending")
        if obj_status in stats["by_status"]:
            stats["by_status"][obj_status] += 1
        total_progress += obj.get("progress", 0)

    if stats["total"] > 0:
        stats["average_progress"] = total_progress // stats["total"]

    return stats


@router.post("/")
async def create_objective(
    data: ObjectiveCreate,
    current_user: CurrentUser,
    db: Database,
):
    """Create a new objective."""
    insert_data = {
        "user_id": current_user["id"],
        "title": data.title,
        "description": data.description,
        "horizon": data.horizon,
        "target_date": data.target_date.isoformat() if data.target_date else None,
        "status": data.status,
        "color": data.color,
        "icon": data.icon,
        "parent_id": data.parent_id,
    }

    result = db.table("objectives").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create objective")

    return result.data[0]


@router.get("/{objective_id}")
async def get_objective(
    objective_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Get a specific objective with all related data."""
    # Get objective with actions
    result = db.table("objectives").select(
        "*, objective_actions(id, title, is_completed, position, created_at)"
    ).eq("id", objective_id).eq("user_id", current_user["id"]).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Objective not found")

    objective = result.data

    # Get linked mental models
    mm_result = db.table("objective_mental_models").select(
        "mental_model_id, mental_models(id, name, slug, icon, color)"
    ).eq("objective_id", objective_id).execute()
    objective["mental_models"] = [r["mental_models"] for r in mm_result.data if r.get("mental_models")]

    # Get linked projects
    proj_result = db.table("objective_projects").select(
        "project_id, projects(id, name, status, color, icon)"
    ).eq("objective_id", objective_id).execute()
    objective["projects"] = [r["projects"] for r in proj_result.data if r.get("projects")]

    # Get linked contents count
    content_result = db.table("objective_contents").select(
        "content_id", count="exact"
    ).eq("objective_id", objective_id).execute()
    objective["contents_count"] = content_result.count or 0

    # Get sub-objectives
    children_result = db.table("objectives").select(
        "id, title, status, progress, icon, color"
    ).eq("parent_id", objective_id).order("position").execute()
    objective["children"] = children_result.data

    return objective


@router.put("/{objective_id}")
async def update_objective(
    objective_id: str,
    data: ObjectiveUpdate,
    current_user: CurrentUser,
    db: Database,
):
    """Update an objective."""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    if "target_date" in update_data and update_data["target_date"]:
        update_data["target_date"] = update_data["target_date"].isoformat()

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = db.table("objectives").update(update_data).eq(
        "id", objective_id
    ).eq("user_id", current_user["id"]).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Objective not found")

    return result.data[0]


@router.delete("/{objective_id}")
async def delete_objective(
    objective_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Delete an objective."""
    result = db.table("objectives").delete().eq(
        "id", objective_id
    ).eq("user_id", current_user["id"]).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Objective not found")

    return {"success": True}


# =====================================================
# Actions CRUD
# =====================================================

@router.post("/{objective_id}/actions")
async def create_action(
    objective_id: str,
    data: ActionCreate,
    current_user: CurrentUser,
    db: Database,
):
    """Add an action to an objective."""
    # Verify objective exists and belongs to user
    obj_check = db.table("objectives").select("id").eq(
        "id", objective_id
    ).eq("user_id", current_user["id"]).execute()

    if not obj_check.data:
        raise HTTPException(status_code=404, detail="Objective not found")

    # Get next position
    pos_result = db.table("objective_actions").select("position").eq(
        "objective_id", objective_id
    ).order("position", desc=True).limit(1).execute()

    next_pos = (pos_result.data[0]["position"] + 1) if pos_result.data else 0

    result = db.table("objective_actions").insert({
        "objective_id": objective_id,
        "user_id": current_user["id"],
        "title": data.title,
        "position": next_pos,
    }).execute()

    return result.data[0]


@router.put("/{objective_id}/actions/{action_id}")
async def update_action(
    objective_id: str,
    action_id: str,
    data: ActionUpdate,
    current_user: CurrentUser,
    db: Database,
):
    """Update an action."""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    if "is_completed" in update_data and update_data["is_completed"]:
        from datetime import datetime
        update_data["completed_at"] = datetime.utcnow().isoformat()

    result = db.table("objective_actions").update(update_data).eq(
        "id", action_id
    ).eq("objective_id", objective_id).eq("user_id", current_user["id"]).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Action not found")

    return result.data[0]


@router.delete("/{objective_id}/actions/{action_id}")
async def delete_action(
    objective_id: str,
    action_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Delete an action."""
    result = db.table("objective_actions").delete().eq(
        "id", action_id
    ).eq("objective_id", objective_id).eq("user_id", current_user["id"]).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Action not found")

    return {"success": True}


# =====================================================
# Link/Unlink Relations
# =====================================================

@router.post("/{objective_id}/link/mental-model/{model_id}")
async def link_mental_model(
    objective_id: str,
    model_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Link a mental model to an objective."""
    try:
        db.table("objective_mental_models").insert({
            "objective_id": objective_id,
            "mental_model_id": model_id,
            "user_id": current_user["id"],
        }).execute()
        return {"success": True}
    except Exception as e:
        if "duplicate" in str(e).lower():
            return {"success": True, "message": "Already linked"}
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{objective_id}/link/mental-model/{model_id}")
async def unlink_mental_model(
    objective_id: str,
    model_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Unlink a mental model from an objective."""
    db.table("objective_mental_models").delete().eq(
        "objective_id", objective_id
    ).eq("mental_model_id", model_id).eq("user_id", current_user["id"]).execute()
    return {"success": True}


@router.post("/{objective_id}/link/project/{project_id}")
async def link_project(
    objective_id: str,
    project_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Link a project to an objective."""
    try:
        db.table("objective_projects").insert({
            "objective_id": objective_id,
            "project_id": project_id,
            "user_id": current_user["id"],
        }).execute()
        return {"success": True}
    except Exception as e:
        if "duplicate" in str(e).lower():
            return {"success": True, "message": "Already linked"}
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{objective_id}/link/project/{project_id}")
async def unlink_project(
    objective_id: str,
    project_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Unlink a project from an objective."""
    db.table("objective_projects").delete().eq(
        "objective_id", objective_id
    ).eq("project_id", project_id).eq("user_id", current_user["id"]).execute()
    return {"success": True}


@router.post("/{objective_id}/link/content/{content_id}")
async def link_content(
    objective_id: str,
    content_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Link a content to an objective."""
    try:
        db.table("objective_contents").insert({
            "objective_id": objective_id,
            "content_id": content_id,
            "user_id": current_user["id"],
        }).execute()
        return {"success": True}
    except Exception as e:
        if "duplicate" in str(e).lower():
            return {"success": True, "message": "Already linked"}
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{objective_id}/link/content/{content_id}")
async def unlink_content(
    objective_id: str,
    content_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Unlink a content from an objective."""
    db.table("objective_contents").delete().eq(
        "objective_id", objective_id
    ).eq("content_id", content_id).eq("user_id", current_user["id"]).execute()
    return {"success": True}


@router.get("/{objective_id}/contents")
async def get_objective_contents(
    objective_id: str,
    current_user: CurrentUser,
    db: Database,
    limit: int = 20,
    offset: int = 0,
):
    """Get contents linked to an objective."""
    result = db.table("objective_contents").select(
        "content_id, contents(id, title, summary, content_type, source_url, created_at)"
    ).eq("objective_id", objective_id).eq(
        "user_id", current_user["id"]
    ).range(offset, offset + limit - 1).execute()

    contents = [r["contents"] for r in result.data if r.get("contents")]
    return {"contents": contents}
