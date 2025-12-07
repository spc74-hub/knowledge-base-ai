"""
Standalone notes (diary/journal) management endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser

router = APIRouter()


# Request/Response Models
class NoteCreate(BaseModel):
    title: str
    content: str  # Markdown
    note_type: str = "reflection"  # reflection, idea, question, connection
    tags: List[str] = []
    linked_content_ids: List[str] = []
    linked_note_ids: List[str] = []
    source_content_id: Optional[str] = None  # Content from which the note was created


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    note_type: Optional[str] = None
    tags: Optional[List[str]] = None
    linked_content_ids: Optional[List[str]] = None
    linked_note_ids: Optional[List[str]] = None
    is_pinned: Optional[bool] = None


class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    note_type: str = "reflection"
    tags: List[str] = []
    linked_content_ids: List[str] = []
    linked_note_ids: List[str] = []
    source_content_id: Optional[str] = None
    is_pinned: bool = False
    created_at: str
    updated_at: str


class NoteDetailResponse(NoteResponse):
    linked_contents: List[dict] = []  # Content summaries
    linked_notes: List[dict] = []  # Note summaries


VALID_NOTE_TYPES = ["reflection", "idea", "question", "connection", "journal"]


@router.get("/", response_model=List[NoteResponse])
async def list_notes(
    current_user: CurrentUser,
    db: Database,
    note_type: Optional[str] = None,
    tags: Optional[str] = None,
    pinned_only: bool = False,
    q: Optional[str] = None,
    source_content_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    List all user's standalone notes.
    Optionally filter by source_content_id to get notes created from a specific content.
    """
    try:
        query = db.table("standalone_notes").select("*").eq("user_id", current_user["id"])

        if note_type:
            query = query.eq("note_type", note_type)
        if pinned_only:
            query = query.eq("is_pinned", True)
        if tags:
            tag_list = tags.split(",")
            query = query.contains("tags", tag_list)
        if q:
            query = query.or_(f"title.ilike.%{q}%,content.ilike.%{q}%")
        if source_content_id:
            query = query.eq("source_content_id", source_content_id)

        # Order: pinned first, then by created_at desc
        query = query.order("is_pinned", desc=True).order("created_at", desc=True)
        query = query.range(offset, offset + limit - 1)

        response = query.execute()

        return response.data or []

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/stats")
async def get_notes_stats(
    current_user: CurrentUser,
    db: Database
):
    """
    Get statistics about user's notes.
    """
    try:
        user_id = current_user["id"]

        # Total notes
        total = db.table("standalone_notes").select("id", count="exact").eq(
            "user_id", user_id
        ).execute()

        # By type
        stats = {note_type: 0 for note_type in VALID_NOTE_TYPES}
        for note_type in VALID_NOTE_TYPES:
            count = db.table("standalone_notes").select("id", count="exact").eq(
                "user_id", user_id
            ).eq("note_type", note_type).execute()
            stats[note_type] = count.count or 0

        # Pinned
        pinned = db.table("standalone_notes").select("id", count="exact").eq(
            "user_id", user_id
        ).eq("is_pinned", True).execute()

        return {
            "total": total.count or 0,
            "by_type": stats,
            "pinned_count": pinned.count or 0,
            "types": [
                {"value": "reflection", "label": "Reflexiones", "icon": "💭"},
                {"value": "idea", "label": "Ideas", "icon": "💡"},
                {"value": "question", "label": "Preguntas", "icon": "❓"},
                {"value": "connection", "label": "Conexiones", "icon": "🔗"},
                {"value": "journal", "label": "Diario", "icon": "📓"}
            ]
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{note_id}", response_model=NoteDetailResponse)
async def get_note(
    note_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Get a specific note with its linked items.
    """
    try:
        response = db.table("standalone_notes").select("*").eq(
            "id", note_id
        ).eq(
            "user_id", current_user["id"]
        ).single().execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Note not found"
            )

        note = response.data

        # Get linked contents
        linked_contents = []
        if note.get("linked_content_ids"):
            for content_id in note["linked_content_ids"]:
                try:
                    content = db.table("contents").select(
                        "id, title, type, url"
                    ).eq("id", content_id).eq("user_id", current_user["id"]).single().execute()
                    if content.data:
                        linked_contents.append(content.data)
                except Exception:
                    continue

        # Get linked notes
        linked_notes = []
        if note.get("linked_note_ids"):
            for ln_id in note["linked_note_ids"]:
                try:
                    ln = db.table("standalone_notes").select(
                        "id, title, note_type"
                    ).eq("id", ln_id).eq("user_id", current_user["id"]).single().execute()
                    if ln.data:
                        linked_notes.append(ln.data)
                except Exception:
                    continue

        note["linked_contents"] = linked_contents
        note["linked_notes"] = linked_notes

        return note

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    data: NoteCreate,
    current_user: CurrentUser,
    db: Database
):
    """
    Create a new standalone note.
    """
    try:
        # Validate note type
        if data.note_type not in VALID_NOTE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid note type. Must be one of: {', '.join(VALID_NOTE_TYPES)}"
            )

        note_data = {
            "user_id": current_user["id"],
            "title": data.title,
            "content": data.content,
            "note_type": data.note_type,
            "tags": data.tags,
            "linked_content_ids": data.linked_content_ids,
            "linked_note_ids": data.linked_note_ids,
            "source_content_id": data.source_content_id,
            "is_pinned": False
        }

        response = db.table("standalone_notes").insert(note_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create note"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: str,
    data: NoteUpdate,
    current_user: CurrentUser,
    db: Database
):
    """
    Update a note.
    """
    try:
        # Check ownership
        existing = db.table("standalone_notes").select("id").eq(
            "id", note_id
        ).eq(
            "user_id", current_user["id"]
        ).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Note not found"
            )

        update_data = data.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        # Validate note type if provided
        if "note_type" in update_data and update_data["note_type"] not in VALID_NOTE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid note type. Must be one of: {', '.join(VALID_NOTE_TYPES)}"
            )

        response = db.table("standalone_notes").update(update_data).eq("id", note_id).execute()

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/{note_id}")
async def delete_note(
    note_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Delete a note.
    """
    try:
        # Check ownership
        existing = db.table("standalone_notes").select("id").eq(
            "id", note_id
        ).eq(
            "user_id", current_user["id"]
        ).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Note not found"
            )

        db.table("standalone_notes").delete().eq("id", note_id).execute()

        return {"message": "Note deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{note_id}/pin")
async def toggle_pin_note(
    note_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Toggle pin status of a note.
    """
    try:
        # Get current status
        existing = db.table("standalone_notes").select("id, is_pinned").eq(
            "id", note_id
        ).eq(
            "user_id", current_user["id"]
        ).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Note not found"
            )

        new_pinned = not existing.data[0].get("is_pinned", False)

        db.table("standalone_notes").update({
            "is_pinned": new_pinned
        }).eq("id", note_id).execute()

        return {
            "id": note_id,
            "is_pinned": new_pinned,
            "message": "Nota fijada" if new_pinned else "Nota desanclada"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/bulk/delete")
async def bulk_delete_notes(
    note_ids: List[str],
    current_user: CurrentUser,
    db: Database
):
    """
    Delete multiple notes at once.
    """
    try:
        if not note_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No note IDs provided"
            )

        # Count before delete
        count_response = db.table("standalone_notes").select("id", count="exact").eq(
            "user_id", current_user["id"]
        ).in_("id", note_ids).execute()

        affected_count = count_response.count or 0

        # Delete
        db.table("standalone_notes").delete().eq(
            "user_id", current_user["id"]
        ).in_("id", note_ids).execute()

        return {
            "deleted": affected_count,
            "total": len(note_ids),
            "message": f"{affected_count} nota(s) eliminada(s)"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/cleanup-orphans")
async def cleanup_orphan_links(
    current_user: CurrentUser,
    db: Database
):
    """
    Clean up orphan content/note links from standalone notes.
    Removes references to contents or notes that no longer exist.
    """
    try:
        user_id = current_user["id"]

        # Get all notes with linked_content_ids or linked_note_ids
        notes_response = db.table("standalone_notes").select(
            "id, linked_content_ids, linked_note_ids"
        ).eq("user_id", user_id).execute()

        if not notes_response.data:
            return {"cleaned": 0, "message": "No hay notas que limpiar"}

        # Get all existing content IDs for this user
        contents_response = db.table("contents").select("id").eq("user_id", user_id).execute()
        existing_content_ids = set(c["id"] for c in (contents_response.data or []))

        # Get all existing note IDs for this user
        notes_ids_response = db.table("standalone_notes").select("id").eq("user_id", user_id).execute()
        existing_note_ids = set(n["id"] for n in (notes_ids_response.data or []))

        cleaned_count = 0

        for note in notes_response.data:
            note_id = note["id"]
            linked_content_ids = note.get("linked_content_ids") or []
            linked_note_ids = note.get("linked_note_ids") or []

            # Filter out orphan content IDs
            valid_content_ids = [cid for cid in linked_content_ids if cid in existing_content_ids]
            # Filter out orphan note IDs (and self-references)
            valid_note_ids = [nid for nid in linked_note_ids if nid in existing_note_ids and nid != note_id]

            # Check if anything changed
            if len(valid_content_ids) != len(linked_content_ids) or len(valid_note_ids) != len(linked_note_ids):
                db.table("standalone_notes").update({
                    "linked_content_ids": valid_content_ids,
                    "linked_note_ids": valid_note_ids
                }).eq("id", note_id).execute()
                cleaned_count += 1

        return {
            "cleaned": cleaned_count,
            "message": f"{cleaned_count} nota(s) con enlaces huérfanos limpiadas"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
