"""
System Notes API endpoints.
Allows users to create and manage their own documentation/guide notes.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.api.deps import Database, CurrentUser

router = APIRouter()


class SystemNoteCreate(BaseModel):
    title: str
    content: str
    category: str = "general"  # general, workflow, tips, reference


class SystemNoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    position: Optional[int] = None


class SystemNoteResponse(BaseModel):
    id: str
    title: str
    content: str
    category: str
    position: int
    created_at: str
    updated_at: str


class SystemNotesListResponse(BaseModel):
    notes: List[SystemNoteResponse]
    total: int


@router.get("/", response_model=SystemNotesListResponse)
async def list_system_notes(
    current_user: CurrentUser,
    db: Database,
    category: Optional[str] = None,
):
    """List all system notes for the current user."""
    query = db.table("system_notes").select("*").eq("user_id", current_user["id"])

    if category:
        query = query.eq("category", category)

    result = await query.order("position", desc=False).order("created_at", desc=True).execute()

    notes = []
    for row in result.data:
        notes.append(SystemNoteResponse(
            id=row["id"],
            title=row["title"],
            content=row["content"],
            category=row.get("category", "general"),
            position=row.get("position", 0),
            created_at=str(row["created_at"]),
            updated_at=str(row.get("updated_at", row["created_at"])),
        ))

    return SystemNotesListResponse(notes=notes, total=len(notes))


@router.get("/{note_id}", response_model=SystemNoteResponse)
async def get_system_note(
    note_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Get a specific system note."""
    result = await db.table("system_notes").select("*").eq(
        "id", note_id
    ).eq(
        "user_id", current_user["id"]
    ).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )

    row = result.data[0]
    return SystemNoteResponse(
        id=row["id"],
        title=row["title"],
        content=row["content"],
        category=row.get("category", "general"),
        position=row.get("position", 0),
        created_at=str(row["created_at"]),
        updated_at=str(row.get("updated_at", row["created_at"])),
    )


@router.post("/", response_model=SystemNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_system_note(
    data: SystemNoteCreate,
    current_user: CurrentUser,
    db: Database,
):
    """Create a new system note."""
    # Get the highest position
    max_pos_result = await db.table("system_notes").select("position").eq(
        "user_id", current_user["id"]
    ).order("position", desc=True).limit(1).execute()

    next_position = 1
    if max_pos_result.data:
        next_position = (max_pos_result.data[0].get("position") or 0) + 1

    result = await db.table("system_notes").insert({
        "user_id": current_user["id"],
        "title": data.title,
        "content": data.content,
        "category": data.category,
        "position": next_position,
    }).execute()

    row = result.data[0]
    return SystemNoteResponse(
        id=row["id"],
        title=row["title"],
        content=row["content"],
        category=row.get("category", "general"),
        position=row.get("position", 0),
        created_at=str(row["created_at"]),
        updated_at=str(row.get("updated_at", row["created_at"])),
    )


@router.put("/{note_id}", response_model=SystemNoteResponse)
async def update_system_note(
    note_id: str,
    data: SystemNoteUpdate,
    current_user: CurrentUser,
    db: Database,
):
    """Update a system note."""
    # Check ownership
    existing = await db.table("system_notes").select("*").eq(
        "id", note_id
    ).eq(
        "user_id", current_user["id"]
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )

    # Build update data
    update_data = {}
    if data.title is not None:
        update_data["title"] = data.title
    if data.content is not None:
        update_data["content"] = data.content
    if data.category is not None:
        update_data["category"] = data.category
    if data.position is not None:
        update_data["position"] = data.position

    if not update_data:
        row = existing.data[0]
        return SystemNoteResponse(
            id=row["id"],
            title=row["title"],
            content=row["content"],
            category=row.get("category", "general"),
            position=row.get("position", 0),
            created_at=str(row["created_at"]),
            updated_at=str(row.get("updated_at", row["created_at"])),
        )

    result = await db.table("system_notes").update(update_data).eq("id", note_id).execute()
    row = result.data[0]

    return SystemNoteResponse(
        id=row["id"],
        title=row["title"],
        content=row["content"],
        category=row.get("category", "general"),
        position=row.get("position", 0),
        created_at=str(row["created_at"]),
        updated_at=str(row.get("updated_at", row["created_at"])),
    )


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_system_note(
    note_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Delete a system note."""
    # Check ownership
    existing = await db.table("system_notes").select("id").eq(
        "id", note_id
    ).eq(
        "user_id", current_user["id"]
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )

    await db.table("system_notes").delete().eq("id", note_id).execute()


CATEGORY_LABELS = {
    "general": "General",
    "workflow": "Flujo de Trabajo",
    "tips": "Tips y Trucos",
    "reference": "Referencia",
}


@router.get("/categories/list")
async def list_categories():
    """Get available categories for system notes."""
    return {
        "categories": [
            {"value": k, "label": v}
            for k, v in CATEGORY_LABELS.items()
        ]
    }
