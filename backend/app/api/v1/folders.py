"""
Folder management endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser

router = APIRouter()


# Request/Response Models
class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    color: str = "#6B7280"
    icon: str = "📁"


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[int] = None


class FolderResponse(BaseModel):
    id: str
    name: str
    parent_id: Optional[str] = None
    color: str
    icon: str
    position: int
    created_at: str
    content_count: Optional[int] = 0


class FolderTreeResponse(BaseModel):
    id: str
    name: str
    parent_id: Optional[str] = None
    color: str
    icon: str
    position: int
    children: List["FolderTreeResponse"] = []
    content_count: int = 0


class MoveContentRequest(BaseModel):
    content_ids: List[str]
    folder_id: Optional[str] = None  # None = move to root


@router.get("/", response_model=List[FolderResponse])
async def list_folders(current_user: CurrentUser, db: Database):
    """
    List all folders for the current user.
    """
    try:
        response = await db.table("folders").select("*").eq(
            "user_id", current_user["id"]
        ).order("position").order("name").execute()

        folders = response.data or []

        # Get content counts for each folder
        for folder in folders:
            count_response = await db.table("contents").select(
                "id", count="exact"
            ).eq("folder_id", folder["id"]).execute()
            folder["content_count"] = count_response.count or 0

        return folders

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/tree", response_model=List[FolderTreeResponse])
async def get_folder_tree(current_user: CurrentUser, db: Database):
    """
    Get folders as a nested tree structure.
    """
    try:
        response = await db.table("folders").select("*").eq(
            "user_id", current_user["id"]
        ).order("position").order("name").execute()

        folders = response.data or []

        # Get content counts
        folder_counts = {}
        for folder in folders:
            count_response = await db.table("contents").select(
                "id", count="exact"
            ).eq("folder_id", folder["id"]).execute()
            folder_counts[folder["id"]] = count_response.count or 0

        # Build tree
        def build_tree(parent_id: Optional[str] = None) -> List[dict]:
            children = []
            for folder in folders:
                if folder.get("parent_id") == parent_id:
                    node = {
                        **folder,
                        "content_count": folder_counts.get(folder["id"], 0),
                        "children": build_tree(folder["id"])
                    }
                    children.append(node)
            return children

        return build_tree(None)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(data: FolderCreate, current_user: CurrentUser, db: Database):
    """
    Create a new folder.
    """
    try:
        # Validate parent folder exists and belongs to user
        if data.parent_id:
            parent = await db.table("folders").select("id").eq(
                "id", data.parent_id
            ).eq("user_id", current_user["id"]).execute()

            if not parent.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Parent folder not found"
                )

        # Get max position for ordering
        max_pos = await db.table("folders").select("position").eq(
            "user_id", current_user["id"]
        ).order("position", desc=True).limit(1).execute()

        next_position = (max_pos.data[0]["position"] + 1) if max_pos.data else 0

        folder_data = {
            "user_id": current_user["id"],
            "name": data.name,
            "parent_id": data.parent_id,
            "color": data.color,
            "icon": data.icon,
            "position": next_position
        }

        response = await db.table("folders").insert(folder_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create folder"
            )

        folder = response.data[0]
        folder["content_count"] = 0
        return folder

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{folder_id}", response_model=FolderResponse)
async def get_folder(folder_id: str, current_user: CurrentUser, db: Database):
    """
    Get a specific folder.
    """
    try:
        response = await db.table("folders").select("*").eq(
            "id", folder_id
        ).eq("user_id", current_user["id"]).single().execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )

        folder = response.data
        count_response = await db.table("contents").select(
            "id", count="exact"
        ).eq("folder_id", folder_id).execute()
        folder["content_count"] = count_response.count or 0

        return folder

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: str,
    data: FolderUpdate,
    current_user: CurrentUser,
    db: Database
):
    """
    Update a folder.
    """
    try:
        # Check ownership
        existing = await db.table("folders").select("id").eq(
            "id", folder_id
        ).eq("user_id", current_user["id"]).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )

        # Validate parent folder if changing
        if data.parent_id is not None:
            # Prevent setting self as parent
            if data.parent_id == folder_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot set folder as its own parent"
                )

            if data.parent_id:
                parent = await db.table("folders").select("id").eq(
                    "id", data.parent_id
                ).eq("user_id", current_user["id"]).execute()

                if not parent.data:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Parent folder not found"
                    )

        update_data = data.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        response = await db.table("folders").update(update_data).eq(
            "id", folder_id
        ).execute()

        folder = response.data[0]
        count_response = await db.table("contents").select(
            "id", count="exact"
        ).eq("folder_id", folder_id).execute()
        folder["content_count"] = count_response.count or 0

        return folder

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/{folder_id}")
async def delete_folder(
    folder_id: str,
    current_user: CurrentUser,
    db: Database,
    move_contents_to: Optional[str] = None
):
    """
    Delete a folder. Contents will be moved to specified folder or root.
    """
    try:
        # Check ownership
        existing = await db.table("folders").select("id").eq(
            "id", folder_id
        ).eq("user_id", current_user["id"]).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )

        # Move contents to new location (or root if None)
        db.table("contents").update(
            {"folder_id": move_contents_to}
        ).eq("folder_id", folder_id).execute()

        # Move subfolders to parent (or root)
        db.table("folders").update(
            {"parent_id": move_contents_to}
        ).eq("parent_id", folder_id).execute()

        # Delete the folder
        await db.table("folders").delete().eq("id", folder_id).execute()

        return {"message": "Folder deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/move-contents")
async def move_contents_to_folder(
    data: MoveContentRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Move multiple contents to a folder (or root if folder_id is None).
    """
    try:
        # Validate folder exists if specified
        if data.folder_id:
            folder = await db.table("folders").select("id").eq(
                "id", data.folder_id
            ).eq("user_id", current_user["id"]).execute()

            if not folder.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Target folder not found"
                )

        # Update contents
        moved = 0
        for content_id in data.content_ids:
            result = db.table("contents").update(
                {"folder_id": data.folder_id}
            ).eq("id", content_id).eq("user_id", current_user["id"]).execute()

            if result.data:
                moved += 1

        return {
            "message": f"Moved {moved} items",
            "moved": moved,
            "total": len(data.content_ids)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{folder_id}/contents")
async def get_folder_contents(
    folder_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Get all contents in a specific folder.
    """
    try:
        # Verify folder ownership
        folder = await db.table("folders").select("id").eq(
            "id", folder_id
        ).eq("user_id", current_user["id"]).execute()

        if not folder.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )

        response = await db.table("contents").select("*").eq(
            "folder_id", folder_id
        ).eq("user_id", current_user["id"]).order(
            "created_at", desc=True
        ).execute()

        return {"contents": response.data or []}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
