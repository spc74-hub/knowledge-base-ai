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
    parent_project_id: Optional[str] = None  # For subprojects


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # active, completed, archived, on_hold
    deadline: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[int] = None
    parent_project_id: Optional[str] = None  # Move to different parent


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
    parent_project_id: Optional[str] = None
    content_count: int = 0  # Number of linked contents
    children_count: int = 0  # Number of subprojects
    created_at: str
    updated_at: str


class ProjectDetailResponse(ProjectResponse):
    contents: List[dict] = []  # Linked contents summary
    children: List["ProjectResponse"] = []  # Subprojects


class ProjectTreeResponse(BaseModel):
    id: str
    name: str
    icon: str
    color: str
    status: str
    parent_project_id: Optional[str] = None
    children: List["ProjectTreeResponse"] = []
    content_count: int = 0


VALID_STATUSES = ["active", "completed", "archived", "on_hold"]


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    current_user: CurrentUser,
    db: Database,
    status: Optional[str] = None,
    include_archived: bool = False,
    parent_id: Optional[str] = Query(None, description="Filter by parent project ID. Use 'root' for root projects only.")
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

        # Filter by parent
        if parent_id == "root":
            query = query.is_("parent_project_id", "null")
        elif parent_id:
            query = query.eq("parent_project_id", parent_id)

        query = query.order("position", desc=False).order("created_at", desc=True)

        response = query.execute()

        # Get content counts and children counts for each project
        projects = []
        for project in response.data or []:
            content_response = db.table("contents").select("id", count="exact").eq(
                "project_id", project["id"]
            ).eq("is_archived", False).execute()
            project["content_count"] = content_response.count or 0

            children_response = db.table("projects").select("id", count="exact").eq(
                "parent_project_id", project["id"]
            ).execute()
            project["children_count"] = children_response.count or 0

            projects.append(project)

        return projects

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/tree", response_model=List[ProjectTreeResponse])
async def get_projects_tree(
    current_user: CurrentUser,
    db: Database,
    include_archived: bool = False
):
    """
    Get all projects as a tree structure.
    """
    try:
        query = db.table("projects").select("*").eq("user_id", current_user["id"])

        if not include_archived:
            query = query.neq("status", "archived")

        query = query.order("position", desc=False).order("created_at", desc=True)
        response = query.execute()

        all_projects = response.data or []

        # Get content counts for all projects
        project_content_counts = {}
        for project in all_projects:
            count_response = db.table("contents").select("id", count="exact").eq(
                "project_id", project["id"]
            ).eq("is_archived", False).execute()
            project_content_counts[project["id"]] = count_response.count or 0

        # Build tree structure
        def build_tree(parent_id: Optional[str] = None) -> List[dict]:
            children = []
            for project in all_projects:
                if project.get("parent_project_id") == parent_id:
                    node = {
                        "id": project["id"],
                        "name": project["name"],
                        "icon": project.get("icon", "📁"),
                        "color": project.get("color", "#6366f1"),
                        "status": project.get("status", "active"),
                        "parent_project_id": project.get("parent_project_id"),
                        "content_count": project_content_counts.get(project["id"], 0),
                        "children": build_tree(project["id"])
                    }
                    children.append(node)
            return children

        tree = build_tree(None)
        return tree

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Get a specific project with its linked contents and subprojects.
    """
    try:
        response = db.table("projects").select("*").eq(
            "id", project_id
        ).eq(
            "user_id", current_user["id"]
        ).single().execute()

        if not response.data:
            raise HTTPException(
                status_code=404,
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

        # Get children (subprojects)
        children_response = db.table("projects").select("*").eq(
            "parent_project_id", project_id
        ).order("position", desc=False).execute()

        children = []
        for child in children_response.data or []:
            child_content_response = db.table("contents").select("id", count="exact").eq(
                "project_id", child["id"]
            ).eq("is_archived", False).execute()
            child["content_count"] = child_content_response.count or 0
            child["children_count"] = 0  # Can be expanded if needed
            children.append(child)

        project["children"] = children
        project["children_count"] = len(children)

        return project

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    current_user: CurrentUser,
    db: Database
):
    """
    Create a new project or subproject.
    """
    try:
        # If parent_project_id provided, verify it exists and belongs to user
        if data.parent_project_id:
            parent_check = db.table("projects").select("id").eq(
                "id", data.parent_project_id
            ).eq("user_id", current_user["id"]).execute()
            if not parent_check.data:
                raise HTTPException(
                    status_code=404,
                    detail="Parent project not found"
                )

        # Get next position among siblings (same parent)
        pos_query = db.table("projects").select("position").eq(
            "user_id", current_user["id"]
        )
        if data.parent_project_id:
            pos_query = pos_query.eq("parent_project_id", data.parent_project_id)
        else:
            pos_query = pos_query.is_("parent_project_id", "null")

        pos_response = pos_query.order("position", desc=True).limit(1).execute()

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
            "status": "active",
            "parent_project_id": data.parent_project_id
        }

        response = db.table("projects").insert(project_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to create project"
            )

        project = response.data[0]
        project["content_count"] = 0
        project["children_count"] = 0

        return project

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
                status_code=404,
                detail="Project not found"
            )

        update_data = data.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(
                status_code=400,
                detail="No fields to update"
            )

        # Validate status if provided
        if "status" in update_data and update_data["status"] not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"
            )

        # Validate parent_project_id if provided
        if "parent_project_id" in update_data:
            new_parent = update_data["parent_project_id"]
            # Can't set self as parent
            if new_parent == project_id:
                raise HTTPException(
                    status_code=400,
                    detail="A project cannot be its own parent"
                )
            # If not null, verify parent exists
            if new_parent:
                parent_check = db.table("projects").select("id").eq(
                    "id", new_parent
                ).eq("user_id", current_user["id"]).execute()
                if not parent_check.data:
                    raise HTTPException(
                        status_code=404,
                        detail="Parent project not found"
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

        # Get children count
        children_response = db.table("projects").select("id", count="exact").eq(
            "parent_project_id", project_id
        ).execute()
        project["children_count"] = children_response.count or 0

        return project

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


class ReorderRequest(BaseModel):
    project_id: str
    new_parent_id: Optional[str] = None  # None means root
    new_position: int


@router.post("/reorder")
async def reorder_project(
    data: ReorderRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Move a project to a new parent and/or position (for drag & drop).
    """
    try:
        # Verify project exists and belongs to user
        project_check = db.table("projects").select("id, parent_project_id, position").eq(
            "id", data.project_id
        ).eq("user_id", current_user["id"]).execute()

        if not project_check.data:
            raise HTTPException(status_code=404, detail="Project not found")

        current_project = project_check.data[0]
        old_parent_id = current_project.get("parent_project_id")
        old_position = current_project.get("position", 0)

        # Validate new parent if provided
        if data.new_parent_id:
            if data.new_parent_id == data.project_id:
                raise HTTPException(status_code=400, detail="Cannot set project as its own parent")
            parent_check = db.table("projects").select("id").eq(
                "id", data.new_parent_id
            ).eq("user_id", current_user["id"]).execute()
            if not parent_check.data:
                raise HTTPException(status_code=404, detail="Parent project not found")

        # Get siblings in the target parent
        siblings_query = db.table("projects").select("id, position").eq(
            "user_id", current_user["id"]
        ).neq("id", data.project_id)

        if data.new_parent_id:
            siblings_query = siblings_query.eq("parent_project_id", data.new_parent_id)
        else:
            siblings_query = siblings_query.is_("parent_project_id", "null")

        siblings = siblings_query.order("position", desc=False).execute()

        # Reorder siblings to make room
        for i, sibling in enumerate(siblings.data or []):
            new_pos = i if i < data.new_position else i + 1
            if sibling["position"] != new_pos:
                db.table("projects").update({"position": new_pos}).eq("id", sibling["id"]).execute()

        # Update the moved project
        db.table("projects").update({
            "parent_project_id": data.new_parent_id,
            "position": data.new_position
        }).eq("id", data.project_id).execute()

        return {"success": True, "message": "Project reordered successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/favorite")
async def toggle_project_favorite(
    project_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Toggle favorite status for a project.
    """
    try:
        existing = db.table("projects").select("id, is_favorite").eq(
            "id", project_id
        ).eq("user_id", current_user["id"]).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        current_favorite = existing.data[0].get("is_favorite", False)
        new_favorite = not current_favorite

        db.table("projects").update({"is_favorite": new_favorite}).eq("id", project_id).execute()

        return {"success": True, "is_favorite": new_favorite}

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


@router.post("/{project_id}/link-notes")
async def link_notes_to_project(
    project_id: str,
    note_ids: List[str],
    current_user: CurrentUser,
    db: Database
):
    """
    Link multiple standalone notes to a project.
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

        # Update notes
        linked = 0
        for note_id in note_ids:
            try:
                result = db.table("standalone_notes").update({
                    "linked_project_id": project_id
                }).eq("id", note_id).eq("user_id", current_user["id"]).execute()

                if result.data:
                    linked += 1
            except Exception:
                continue

        return {
            "linked": linked,
            "total": len(note_ids),
            "project_id": project_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{project_id}/unlink-notes")
async def unlink_notes_from_project(
    project_id: str,
    note_ids: List[str],
    current_user: CurrentUser,
    db: Database
):
    """
    Unlink multiple standalone notes from a project.
    """
    try:
        # Update notes
        unlinked = 0
        for note_id in note_ids:
            try:
                result = db.table("standalone_notes").update({
                    "linked_project_id": None
                }).eq("id", note_id).eq(
                    "user_id", current_user["id"]
                ).eq("linked_project_id", project_id).execute()

                if result.data:
                    unlinked += 1
            except Exception:
                continue

        return {
            "unlinked": unlinked,
            "total": len(note_ids)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{project_id}/notes")
async def get_project_notes(
    project_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Get all standalone notes linked to a project.
    """
    try:
        # Verify project exists and belongs to user
        project_check = db.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", current_user["id"]).execute()

        if not project_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        # Get linked notes
        notes_response = db.table("standalone_notes").select(
            "id, title, content, note_type, tags, is_pinned, created_at, updated_at"
        ).eq("linked_project_id", project_id).eq(
            "user_id", current_user["id"]
        ).order("is_pinned", desc=True).order("created_at", desc=True).execute()

        return notes_response.data or []

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
