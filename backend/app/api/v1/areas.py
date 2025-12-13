"""
Areas of Responsibility API endpoints.
Handles CRUD operations for areas, sub-areas, and area-mental model relationships.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

from app.api.deps import Database, CurrentUser

router = APIRouter(prefix="/areas", tags=["areas"])


# =====================================================
# Pydantic Models
# =====================================================

class AreaCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "📋"
    color: Optional[str] = "#6366f1"
    status: Optional[str] = "active"


class AreaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    display_order: Optional[int] = None


class SubAreaCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "📌"


class SubAreaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    display_order: Optional[int] = None


class AreaMentalModelLink(BaseModel):
    mental_model_id: str


class ActionCreate(BaseModel):
    title: str


class ActionUpdate(BaseModel):
    title: Optional[str] = None
    is_completed: Optional[bool] = None


class ReorderRequest(BaseModel):
    ordered_ids: List[str]


# =====================================================
# Area CRUD Endpoints
# =====================================================

@router.get("")
async def get_areas(
    db: Database,
    current_user: CurrentUser,
    status_filter: Optional[str] = None,
    include_stats: bool = True,
):
    """Get all areas for the current user with optional stats."""
    try:
        user_id = current_user["id"]

        query = db.table("areas_of_responsibility").select(
            "*, area_actions(id, title, is_completed, position)"
        ).eq("user_id", user_id)

        if status_filter:
            query = query.eq("status", status_filter)

        query = query.order("display_order", desc=False).order("created_at", desc=False)

        result = query.execute()
        areas = result.data or []

        if include_stats:
            for area in areas:
                # Get counts for linked items
                objectives_count = db.table("objectives").select("id", count="exact").eq("area_id", area["id"]).execute()
                projects_count = db.table("projects").select("id", count="exact").eq("area_id", area["id"]).execute()
                contents_count = db.table("contents").select("id", count="exact").eq("area_id", area["id"]).execute()
                notes_count = db.table("standalone_notes").select("id", count="exact").eq("area_id", area["id"]).execute()
                sub_areas_count = db.table("sub_areas").select("id", count="exact").eq("area_id", area["id"]).execute()
                mental_models_count = db.table("area_mental_models").select("id", count="exact").eq("area_id", area["id"]).execute()
                habits_count = db.table("habits").select("id", count="exact").eq("area_id", area["id"]).eq("is_active", True).execute()

                area["stats"] = {
                    "objectives": objectives_count.count or 0,
                    "projects": projects_count.count or 0,
                    "contents": contents_count.count or 0,
                    "notes": notes_count.count or 0,
                    "sub_areas": sub_areas_count.count or 0,
                    "mental_models": mental_models_count.count or 0,
                    "habits": habits_count.count or 0,
                }

        return {"data": areas}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{area_id}")
async def get_area(area_id: str, db: Database, current_user: CurrentUser):
    """Get a single area with all related data."""
    try:
        user_id = current_user["id"]

        # Get area with actions
        result = db.table("areas_of_responsibility").select(
            "*, area_actions(id, title, is_completed, position, created_at)"
        ).eq("id", area_id).eq("user_id", user_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Area not found")

        area = dict(result.data)

        # Get sub-areas
        sub_areas = db.table("sub_areas").select("*").eq("area_id", area_id).order("display_order").execute()
        area["sub_areas"] = sub_areas.data or []

        # Get linked mental models
        mm_links = db.table("area_mental_models").select("mental_model_id").eq("area_id", area_id).execute()
        if mm_links.data:
            mm_ids = [link["mental_model_id"] for link in mm_links.data]
            mental_models = db.table("mental_models").select("id, name, description, icon, color").in_("id", mm_ids).execute()
            area["mental_models"] = mental_models.data or []
        else:
            area["mental_models"] = []

        # Get linked objectives
        objectives = db.table("objectives").select("id, title, description, status, progress, icon, color, horizon, target_date").eq("area_id", area_id).order("created_at", desc=True).execute()
        area["objectives"] = objectives.data or []

        # Get linked projects
        projects = db.table("projects").select("id, name, description, status, icon, color").eq("area_id", area_id).order("updated_at", desc=True).execute()
        area["projects"] = projects.data or []

        # Get linked habits
        habits = db.table("habits").select("id, name, icon, color, is_active").eq("area_id", area_id).order("created_at", desc=True).execute()
        area["habits"] = habits.data or []

        # Get linked contents (limit to recent 10)
        contents = db.table("contents").select("id, title, type, schema_type, created_at, is_favorite").eq("area_id", area_id).order("created_at", desc=True).limit(10).execute()
        area["recent_contents"] = contents.data or []

        # Get linked notes (via junction table)
        try:
            notes_result = db.table("area_notes").select(
                "note_id, standalone_notes(id, title, content, note_type, tags, is_pinned, created_at)"
            ).eq("area_id", area_id).execute()
            area["notes"] = [r["standalone_notes"] for r in notes_result.data if r.get("standalone_notes")]
        except Exception as e:
            print(f"Error fetching notes for area: {e}")
            area["notes"] = []

        return area

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("")
async def create_area(area: AreaCreate, db: Database, current_user: CurrentUser):
    """Create a new area of responsibility."""
    try:
        user_id = current_user["id"]

        # Get max display_order
        max_order = db.table("areas_of_responsibility").select("display_order").eq("user_id", user_id).order("display_order", desc=True).limit(1).execute()

        next_order = 0
        if max_order.data and max_order.data[0].get("display_order") is not None:
            next_order = max_order.data[0]["display_order"] + 1

        area_data = {
            "user_id": user_id,
            "name": area.name,
            "description": area.description,
            "icon": area.icon,
            "color": area.color,
            "status": area.status,
            "display_order": next_order,
        }

        result = db.table("areas_of_responsibility").insert(area_data).execute()

        return {"data": result.data[0], "message": "Area created successfully"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/{area_id}")
@router.patch("/{area_id}")
async def update_area(area_id: str, area: AreaUpdate, db: Database, current_user: CurrentUser):
    """Update an area (supports both PUT and PATCH)."""
    try:
        user_id = current_user["id"]

        # Verify ownership
        existing = db.table("areas_of_responsibility").select("id").eq("id", area_id).eq("user_id", user_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Area not found")

        update_data = {k: v for k, v in area.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        result = db.table("areas_of_responsibility").update(update_data).eq("id", area_id).execute()

        return {"data": result.data[0], "message": "Area updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/{area_id}")
async def delete_area(area_id: str, db: Database, current_user: CurrentUser):
    """Delete an area. Linked items will have their area_id set to NULL."""
    try:
        user_id = current_user["id"]

        # Verify ownership
        existing = db.table("areas_of_responsibility").select("id").eq("id", area_id).eq("user_id", user_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Area not found")

        # Delete area (cascade will handle sub_areas and area_mental_models)
        db.table("areas_of_responsibility").delete().eq("id", area_id).execute()

        return {"message": "Area deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/reorder")
async def reorder_areas(request: ReorderRequest, db: Database, current_user: CurrentUser):
    """Reorder areas by providing an ordered list of IDs."""
    try:
        user_id = current_user["id"]

        for index, area_id in enumerate(request.ordered_ids):
            db.table("areas_of_responsibility").update({"display_order": index}).eq("id", area_id).eq("user_id", user_id).execute()

        return {"message": "Areas reordered successfully"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# =====================================================
# Sub-Area Endpoints
# =====================================================

@router.get("/{area_id}/sub-areas")
async def get_sub_areas(area_id: str, db: Database, current_user: CurrentUser):
    """Get all sub-areas for an area."""
    try:
        user_id = current_user["id"]

        # Verify area ownership
        area = db.table("areas_of_responsibility").select("id").eq("id", area_id).eq("user_id", user_id).execute()

        if not area.data:
            raise HTTPException(status_code=404, detail="Area not found")

        result = db.table("sub_areas").select("*").eq("area_id", area_id).order("display_order").execute()

        return {"data": result.data or []}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{area_id}/sub-areas")
async def create_sub_area(area_id: str, sub_area: SubAreaCreate, db: Database, current_user: CurrentUser):
    """Create a new sub-area."""
    try:
        user_id = current_user["id"]

        # Verify area ownership
        area = db.table("areas_of_responsibility").select("id").eq("id", area_id).eq("user_id", user_id).execute()

        if not area.data:
            raise HTTPException(status_code=404, detail="Area not found")

        # Get max display_order
        max_order = db.table("sub_areas").select("display_order").eq("area_id", area_id).order("display_order", desc=True).limit(1).execute()

        next_order = 0
        if max_order.data and max_order.data[0].get("display_order") is not None:
            next_order = max_order.data[0]["display_order"] + 1

        sub_area_data = {
            "area_id": area_id,
            "user_id": user_id,
            "name": sub_area.name,
            "description": sub_area.description,
            "icon": sub_area.icon,
            "display_order": next_order,
        }

        result = db.table("sub_areas").insert(sub_area_data).execute()

        return {"data": result.data[0], "message": "Sub-area created successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/{area_id}/sub-areas/{sub_area_id}")
async def update_sub_area(area_id: str, sub_area_id: str, sub_area: SubAreaUpdate, db: Database, current_user: CurrentUser):
    """Update a sub-area."""
    try:
        user_id = current_user["id"]

        # Verify ownership
        existing = db.table("sub_areas").select("id").eq("id", sub_area_id).eq("area_id", area_id).eq("user_id", user_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Sub-area not found")

        update_data = {k: v for k, v in sub_area.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        result = db.table("sub_areas").update(update_data).eq("id", sub_area_id).execute()

        return {"data": result.data[0], "message": "Sub-area updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/{area_id}/sub-areas/{sub_area_id}")
async def delete_sub_area(area_id: str, sub_area_id: str, db: Database, current_user: CurrentUser):
    """Delete a sub-area."""
    try:
        user_id = current_user["id"]

        # Verify ownership
        existing = db.table("sub_areas").select("id").eq("id", sub_area_id).eq("area_id", area_id).eq("user_id", user_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Sub-area not found")

        db.table("sub_areas").delete().eq("id", sub_area_id).execute()

        return {"message": "Sub-area deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# =====================================================
# Mental Model Link Endpoints
# =====================================================

@router.post("/{area_id}/mental-models")
async def link_mental_model(area_id: str, link: AreaMentalModelLink, db: Database, current_user: CurrentUser):
    """Link a mental model to an area."""
    try:
        user_id = current_user["id"]

        # Verify area ownership
        area = db.table("areas_of_responsibility").select("id").eq("id", area_id).eq("user_id", user_id).execute()

        if not area.data:
            raise HTTPException(status_code=404, detail="Area not found")

        # Verify mental model ownership
        mm = db.table("mental_models").select("id").eq("id", link.mental_model_id).eq("user_id", user_id).execute()

        if not mm.data:
            raise HTTPException(status_code=404, detail="Mental model not found")

        # Check if already linked
        existing = db.table("area_mental_models").select("id").eq("area_id", area_id).eq("mental_model_id", link.mental_model_id).execute()

        if existing.data:
            raise HTTPException(status_code=400, detail="Mental model already linked to this area")

        result = db.table("area_mental_models").insert({
            "area_id": area_id,
            "mental_model_id": link.mental_model_id,
        }).execute()

        return {"data": result.data[0], "message": "Mental model linked successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/{area_id}/mental-models/{mental_model_id}")
async def unlink_mental_model(area_id: str, mental_model_id: str, db: Database, current_user: CurrentUser):
    """Unlink a mental model from an area."""
    try:
        user_id = current_user["id"]

        # Verify area ownership
        area = db.table("areas_of_responsibility").select("id").eq("id", area_id).eq("user_id", user_id).execute()

        if not area.data:
            raise HTTPException(status_code=404, detail="Area not found")

        db.table("area_mental_models").delete().eq("area_id", area_id).eq("mental_model_id", mental_model_id).execute()

        return {"message": "Mental model unlinked successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# =====================================================
# Bulk Link Endpoints
# =====================================================

@router.post("/{area_id}/link-objective/{objective_id}")
async def link_objective_to_area(area_id: str, objective_id: str, db: Database, current_user: CurrentUser):
    """Link an objective to an area."""
    try:
        user_id = current_user["id"]

        # Verify area ownership
        area = db.table("areas_of_responsibility").select("id").eq("id", area_id).eq("user_id", user_id).execute()
        if not area.data:
            raise HTTPException(status_code=404, detail="Area not found")

        # Update objective
        result = db.table("objectives").update({"area_id": area_id}).eq("id", objective_id).eq("user_id", user_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Objective not found")

        return {"message": "Objective linked to area successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{area_id}/link-project/{project_id}")
async def link_project_to_area(area_id: str, project_id: str, db: Database, current_user: CurrentUser):
    """Link a project to an area."""
    try:
        user_id = current_user["id"]

        # Verify area ownership
        area = db.table("areas_of_responsibility").select("id").eq("id", area_id).eq("user_id", user_id).execute()
        if not area.data:
            raise HTTPException(status_code=404, detail="Area not found")

        # Update project
        result = db.table("projects").update({"area_id": area_id}).eq("id", project_id).eq("user_id", user_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")

        return {"message": "Project linked to area successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{area_id}/unlink-objective/{objective_id}")
async def unlink_objective_from_area(area_id: str, objective_id: str, db: Database, current_user: CurrentUser):
    """Unlink an objective from an area."""
    try:
        user_id = current_user["id"]

        db.table("objectives").update({"area_id": None}).eq("id", objective_id).eq("user_id", user_id).eq("area_id", area_id).execute()

        return {"message": "Objective unlinked from area"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{area_id}/unlink-project/{project_id}")
async def unlink_project_from_area(area_id: str, project_id: str, db: Database, current_user: CurrentUser):
    """Unlink a project from an area."""
    try:
        user_id = current_user["id"]

        db.table("projects").update({"area_id": None}).eq("id", project_id).eq("user_id", user_id).eq("area_id", area_id).execute()

        return {"message": "Project unlinked from area"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# Actions CRUD
# =====================================================

@router.post("/{area_id}/actions")
async def create_action(
    area_id: str,
    data: ActionCreate,
    current_user: CurrentUser,
    db: Database,
):
    """Add an action to an area."""
    user_id = current_user["id"]

    # Verify area exists and belongs to user
    area_check = db.table("areas_of_responsibility").select("id").eq(
        "id", area_id
    ).eq("user_id", user_id).execute()

    if not area_check.data:
        raise HTTPException(status_code=404, detail="Area not found")

    # Get next position
    pos_result = db.table("area_actions").select("position").eq(
        "area_id", area_id
    ).order("position", desc=True).limit(1).execute()

    next_pos = (pos_result.data[0]["position"] + 1) if pos_result.data else 0

    result = db.table("area_actions").insert({
        "area_id": area_id,
        "user_id": user_id,
        "title": data.title,
        "position": next_pos,
    }).execute()

    return result.data[0]


@router.put("/{area_id}/actions/{action_id}")
async def update_action(
    area_id: str,
    action_id: str,
    data: ActionUpdate,
    current_user: CurrentUser,
    db: Database,
):
    """Update an action."""
    user_id = current_user["id"]
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    if "is_completed" in update_data and update_data["is_completed"]:
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    result = db.table("area_actions").update(update_data).eq(
        "id", action_id
    ).eq("area_id", area_id).eq("user_id", user_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Action not found")

    return result.data[0]


@router.delete("/{area_id}/actions/{action_id}")
async def delete_action(
    area_id: str,
    action_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Delete an action."""
    user_id = current_user["id"]

    result = db.table("area_actions").delete().eq(
        "id", action_id
    ).eq("area_id", area_id).eq("user_id", user_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Action not found")

    return {"success": True}


# =====================================================
# Notes Linking
# =====================================================

@router.post("/{area_id}/link-notes")
async def link_notes_to_area(
    area_id: str,
    note_ids: List[str],
    current_user: CurrentUser,
    db: Database,
):
    """Link multiple notes to an area."""
    user_id = current_user["id"]

    # Verify area belongs to user
    area_check = db.table("areas_of_responsibility").select("id").eq(
        "id", area_id
    ).eq("user_id", user_id).execute()

    if not area_check.data:
        raise HTTPException(status_code=404, detail="Area not found")

    linked = 0
    for note_id in note_ids:
        try:
            db.table("area_notes").insert({
                "area_id": area_id,
                "note_id": note_id,
                "user_id": user_id,
            }).execute()
            linked += 1
        except Exception as e:
            if "duplicate" not in str(e).lower():
                print(f"Error linking note {note_id}: {e}")

    return {"success": True, "linked": linked}


@router.delete("/{area_id}/unlink-note/{note_id}")
async def unlink_note_from_area(
    area_id: str,
    note_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Unlink a note from an area."""
    user_id = current_user["id"]

    db.table("area_notes").delete().eq(
        "area_id", area_id
    ).eq("note_id", note_id).eq("user_id", user_id).execute()

    return {"success": True}
