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


class NotesSearchRequest(BaseModel):
    """Request for searching notes with facets."""
    query: Optional[str] = None
    note_types: Optional[List[str]] = None
    has_source_content: Optional[bool] = None  # True = linked, False = orphan, None = all
    is_pinned: Optional[bool] = None
    limit: int = 50
    offset: int = 0


@router.post("/search")
async def search_notes_with_facets(
    data: NotesSearchRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Search standalone notes with facets for Explorer integration.
    Returns notes with their source content info and facet counts.
    Optimized for performance with pagination.
    """
    try:
        user_id = current_user["id"]

        # Build base query for notes
        query = db.table("standalone_notes").select(
            "id, title, content, note_type, tags, source_content_id, is_pinned, created_at, updated_at"
        ).eq("user_id", user_id)

        # Apply filters
        if data.note_types:
            query = query.in_("note_type", data.note_types)

        if data.has_source_content is True:
            query = query.neq("source_content_id", None)
        elif data.has_source_content is False:
            query = query.is_("source_content_id", "null")

        if data.is_pinned is not None:
            query = query.eq("is_pinned", data.is_pinned)

        if data.query:
            query = query.or_(f"title.ilike.%{data.query}%,content.ilike.%{data.query}%")

        # Execute paginated query
        query = query.order("is_pinned", desc=True).order("created_at", desc=True)
        query = query.range(data.offset, data.offset + data.limit - 1)

        response = query.execute()
        notes = response.data or []

        # Get source content info for notes that have it
        source_content_ids = list(set(
            n["source_content_id"] for n in notes if n.get("source_content_id")
        ))

        source_contents_map = {}
        if source_content_ids:
            contents_response = db.table("contents").select(
                "id, title, type, url"
            ).in_("id", source_content_ids).execute()

            for c in (contents_response.data or []):
                source_contents_map[c["id"]] = c

        # Enrich notes with source content info
        for note in notes:
            if note.get("source_content_id") and note["source_content_id"] in source_contents_map:
                note["source_content"] = source_contents_map[note["source_content_id"]]
            else:
                note["source_content"] = None

        # Get facet counts (all notes, not filtered)
        # This query is separate and gets total counts for facets
        all_notes_query = db.table("standalone_notes").select(
            "note_type, source_content_id, is_pinned"
        ).eq("user_id", user_id)

        all_notes_response = all_notes_query.execute()
        all_notes = all_notes_response.data or []

        # Calculate facets
        note_type_counts = {}
        linked_count = 0
        orphan_count = 0
        pinned_count = 0

        for n in all_notes:
            nt = n.get("note_type", "reflection")
            note_type_counts[nt] = note_type_counts.get(nt, 0) + 1

            if n.get("source_content_id"):
                linked_count += 1
            else:
                orphan_count += 1

            if n.get("is_pinned"):
                pinned_count += 1

        facets = {
            "note_types": [
                {"value": "reflection", "label": "Reflexiones", "icon": "💭", "count": note_type_counts.get("reflection", 0)},
                {"value": "idea", "label": "Ideas", "icon": "💡", "count": note_type_counts.get("idea", 0)},
                {"value": "question", "label": "Preguntas", "icon": "❓", "count": note_type_counts.get("question", 0)},
                {"value": "connection", "label": "Conexiones", "icon": "🔗", "count": note_type_counts.get("connection", 0)},
                {"value": "journal", "label": "Diario", "icon": "📓", "count": note_type_counts.get("journal", 0)},
            ],
            "linkage": [
                {"value": "linked", "label": "Con contenido", "icon": "🔗", "count": linked_count},
                {"value": "orphan", "label": "Independientes", "icon": "📝", "count": orphan_count},
            ],
            "total_notes": len(all_notes),
            "pinned_count": pinned_count,
        }

        return {
            "data": notes,
            "facets": facets,
            "meta": {
                "total_results": len(all_notes),  # Total without filters
                "returned_results": len(notes),
                "offset": data.offset,
                "limit": data.limit,
            }
        }

    except Exception as e:
        import traceback
        print(f"Notes search error: {e}")
        print(traceback.format_exc())
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
