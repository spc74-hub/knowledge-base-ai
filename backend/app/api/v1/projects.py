"""
Projects management endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from datetime import datetime, timezone

from app.api.deps import Database, CurrentUser

router = APIRouter()


# Request/Response Models
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    deadline: Optional[str] = None  # ISO format
    color: str = "#6366f1"
    icon: str = "📁"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # active, completed, archived, on_hold
    deadline: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[int] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str = "active"
    deadline: Optional[str] = None
    completed_at: Optional[str] = None
    color: str = "#6366f1"
    icon: str = "📁"
    position: int = 0
    content_count: int = 0  # Number of linked contents
    created_at: str
    updated_at: str


class ProjectDetailResponse(ProjectResponse):
    contents: List[dict] = []  # Linked contents summary


VALID_STATUSES = ["active", "completed", "archived", "on_hold"]


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    current_user: CurrentUser,
    db: Database,
    status: Optional[str] = None,
    include_archived: bool = False
):
    """
    List all user projects.
    """
    try:
        query = db.table("projects").select("*").eq("user_id", current_user["id"])

        if status:
            query = query.eq("status", status)
        elif not include_archived:
            query = query.neq("status", "archived")

        query = query.order("position", desc=False).order("created_at", desc=True)

        response = query.execute()

        # Get content counts for each project
        projects = []
        for project in response.data or []:
            count_response = db.table("contents").select("id", count="exact").eq(
                "project_id", project["id"]
            ).eq("is_archived", False).execute()

            project["content_count"] = count_response.count or 0
            projects.append(project)

        return projects

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Get a specific project with its linked contents.
    """
    try:
        response = db.table("projects").select("*").eq(
            "id", project_id
        ).eq(
            "user_id", current_user["id"]
        ).single().execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        project = response.data

        # Get linked contents
        contents_response = db.table("contents").select(
            "id, title, type, is_favorite, maturity_level, created_at"
        ).eq("project_id", project_id).eq("is_archived", False).order(
            "created_at", desc=True
        ).execute()

        project["contents"] = contents_response.data or []
        project["content_count"] = len(project["contents"])

        return project

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    current_user: CurrentUser,
    db: Database
):
    """
    Create a new project.
    """
    try:
        # Get next position
        pos_response = db.table("projects").select("position").eq(
            "user_id", current_user["id"]
        ).order("position", desc=True).limit(1).execute()

        next_position = 0
        if pos_response.data:
            next_position = (pos_response.data[0].get("position") or 0) + 1

        project_data = {
            "user_id": current_user["id"],
            "name": data.name,
            "description": data.description,
            "deadline": data.deadline,
            "color": data.color,
            "icon": data.icon,
            "position": next_position,
            "status": "active"
        }

        response = db.table("projects").insert(project_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create project"
            )

        project = response.data[0]
        project["content_count"] = 0

        return project

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    current_user: CurrentUser,
    db: Database
):
    """
    Update a project.
    """
    try:
        # Check ownership
        existing = db.table("projects").select("id, status").eq(
            "id", project_id
        ).eq(
            "user_id", current_user["id"]
        ).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        update_data = data.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        # Validate status if provided
        if "status" in update_data and update_data["status"] not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"
            )

        # Set completed_at if status changed to completed
        if update_data.get("status") == "completed" and existing.data[0].get("status") != "completed":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        elif update_data.get("status") and update_data["status"] != "completed":
            update_data["completed_at"] = None

        response = db.table("projects").update(update_data).eq("id", project_id).execute()

        project = response.data[0]

        # Get content count
        count_response = db.table("contents").select("id", count="exact").eq(
            "project_id", project_id
        ).eq("is_archived", False).execute()
        project["content_count"] = count_response.count or 0

        return project

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Delete a project. Linked contents will have project_id set to null.
    """
    try:
        # Check ownership
        existing = db.table("projects").select("id").eq(
            "id", project_id
        ).eq(
            "user_id", current_user["id"]
        ).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        # Delete project (contents will have project_id set to null via ON DELETE SET NULL)
        db.table("projects").delete().eq("id", project_id).execute()

        return {"message": "Project deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{project_id}/link")
async def link_contents_to_project(
    project_id: str,
    content_ids: List[str],
    current_user: CurrentUser,
    db: Database
):
    """
    Link multiple contents to a project.
    """
    try:
        # Check project ownership
        existing = db.table("projects").select("id").eq(
            "id", project_id
        ).eq(
            "user_id", current_user["id"]
        ).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        # Update contents
        linked = 0
        for content_id in content_ids:
            try:
                result = db.table("contents").update({
                    "project_id": project_id
                }).eq("id", content_id).eq("user_id", current_user["id"]).execute()

                if result.data:
                    linked += 1
            except Exception:
                continue

        return {
            "linked": linked,
            "total": len(content_ids),
            "project_id": project_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{project_id}/unlink")
async def unlink_contents_from_project(
    project_id: str,
    content_ids: List[str],
    current_user: CurrentUser,
    db: Database
):
    """
    Unlink multiple contents from a project.
    """
    try:
        # Update contents
        unlinked = 0
        for content_id in content_ids:
            try:
                result = db.table("contents").update({
                    "project_id": None
                }).eq("id", content_id).eq(
                    "user_id", current_user["id"]
                ).eq("project_id", project_id).execute()

                if result.data:
                    unlinked += 1
            except Exception:
                continue

        return {
            "unlinked": unlinked,
            "total": len(content_ids)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
