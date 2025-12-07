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
    linked_project_id: Optional[str] = None  # Project linked to this note
    linked_model_id: Optional[str] = None  # Mental model linked to this note


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    note_type: Optional[str] = None
    tags: Optional[List[str]] = None
    linked_content_ids: Optional[List[str]] = None
    linked_note_ids: Optional[List[str]] = None
    is_pinned: Optional[bool] = None
    is_completed: Optional[bool] = None
    linked_project_id: Optional[str] = None
    linked_model_id: Optional[str] = None


class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    note_type: str = "reflection"
    tags: List[str] = []
    linked_content_ids: List[str] = []
    linked_note_ids: List[str] = []
    source_content_id: Optional[str] = None
    linked_project_id: Optional[str] = None
    linked_model_id: Optional[str] = None
    is_pinned: bool = False
    is_completed: bool = False
    created_at: str
    updated_at: str


class NoteDetailResponse(NoteResponse):
    linked_contents: List[dict] = []  # Content summaries
    linked_notes: List[dict] = []  # Note summaries
    linked_project: Optional[dict] = None  # Project info
    linked_model: Optional[dict] = None  # Mental model info


VALID_NOTE_TYPES = ["reflection", "idea", "question", "connection", "journal", "action"]


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
                {"value": "journal", "label": "Diario", "icon": "📓"},
                {"value": "action", "label": "Acciones", "icon": "✅"}
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

        # Get linked project
        note["linked_project"] = None
        if note.get("linked_project_id"):
            try:
                project = db.table("projects").select(
                    "id, name, icon, color, status"
                ).eq("id", note["linked_project_id"]).eq("user_id", current_user["id"]).single().execute()
                if project.data:
                    note["linked_project"] = project.data
            except Exception:
                pass

        # Get linked mental model
        note["linked_model"] = None
        if note.get("linked_model_id"):
            try:
                model = db.table("taxonomy_tags").select(
                    "id, tag, taxonomy_value, description"
                ).eq("id", note["linked_model_id"]).eq("user_id", current_user["id"]).single().execute()
                if model.data:
                    note["linked_model"] = model.data
            except Exception:
                pass

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
            "linked_project_id": data.linked_project_id,
            "linked_model_id": data.linked_model_id,
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


@router.post("/{note_id}/complete")
async def toggle_complete_note(
    note_id: str,
    current_user: CurrentUser,
    db: Database
):
    """
    Toggle completion status of an action note.
    """
    try:
        # Get current status
        existing = db.table("standalone_notes").select("id, is_completed, note_type").eq(
            "id", note_id
        ).eq(
            "user_id", current_user["id"]
        ).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Note not found"
            )

        new_completed = not existing.data[0].get("is_completed", False)

        db.table("standalone_notes").update({
            "is_completed": new_completed
        }).eq("id", note_id).execute()

        return {
            "id": note_id,
            "is_completed": new_completed,
            "message": "Accion completada" if new_completed else "Accion pendiente"
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
    note_types: Optional[List[str]] = None  # includes 'full_note' for contents with type='note'
    has_source_content: Optional[bool] = None  # True = linked, False = orphan, None = all
    linkage_type: Optional[str] = None  # 'content', 'project', 'model', 'independent'
    is_pinned: Optional[bool] = None
    include_full_notes: Optional[bool] = True  # Whether to include contents with type='note'
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
            "id, title, content, note_type, tags, source_content_id, linked_project_id, linked_model_id, is_pinned, created_at, updated_at"
        ).eq("user_id", user_id)

        # Apply filters
        if data.note_types:
            query = query.in_("note_type", data.note_types)

        # Legacy filter (keep for backwards compatibility)
        if data.has_source_content is True:
            query = query.neq("source_content_id", None)
        elif data.has_source_content is False:
            query = query.is_("source_content_id", "null")

        # New linkage type filter
        if data.linkage_type == 'content':
            query = query.not_.is_("source_content_id", "null")
        elif data.linkage_type == 'project':
            query = query.not_.is_("linked_project_id", "null")
        elif data.linkage_type == 'model':
            query = query.not_.is_("linked_model_id", "null")
        elif data.linkage_type == 'independent':
            query = query.is_("source_content_id", "null").is_("linked_project_id", "null").is_("linked_model_id", "null")

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

        # Get project info for notes that have it
        project_ids = list(set(
            n["linked_project_id"] for n in notes if n.get("linked_project_id")
        ))

        projects_map = {}
        if project_ids:
            projects_response = db.table("projects").select(
                "id, name, icon, color"
            ).in_("id", project_ids).execute()

            for p in (projects_response.data or []):
                projects_map[p["id"]] = p

        # Get mental model info for notes that have it
        model_ids = list(set(
            n["linked_model_id"] for n in notes if n.get("linked_model_id")
        ))

        models_map = {}
        if model_ids:
            models_response = db.table("taxonomy_tags").select(
                "id, tag, taxonomy_value"
            ).in_("id", model_ids).execute()

            for m in (models_response.data or []):
                models_map[m["id"]] = m

        # Enrich notes with linked info
        for note in notes:
            if note.get("source_content_id") and note["source_content_id"] in source_contents_map:
                note["source_content"] = source_contents_map[note["source_content_id"]]
            else:
                note["source_content"] = None

            if note.get("linked_project_id") and note["linked_project_id"] in projects_map:
                note["linked_project"] = projects_map[note["linked_project_id"]]
            else:
                note["linked_project"] = None

            if note.get("linked_model_id") and note["linked_model_id"] in models_map:
                note["linked_model"] = models_map[note["linked_model_id"]]
            else:
                note["linked_model"] = None

        # Get Full Notes (contents with type='note') if requested
        include_full = data.include_full_notes is not False
        want_full_notes = not data.note_types or 'full_note' in data.note_types

        full_notes_data = []
        full_notes_count = 0

        if include_full and want_full_notes:
            # Get full notes from contents table
            full_notes_query = db.table("contents").select(
                "id, title, summary, is_favorite, project_id, created_at, updated_at"
            ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False)

            if data.query:
                full_notes_query = full_notes_query.or_(f"title.ilike.%{data.query}%,summary.ilike.%{data.query}%")

            if data.is_pinned is not None:
                full_notes_query = full_notes_query.eq("is_favorite", data.is_pinned)

            full_notes_query = full_notes_query.order("created_at", desc=True)
            full_notes_response = full_notes_query.execute()

            # Transform full notes to match standalone_notes format
            for fn in (full_notes_response.data or []):
                full_notes_data.append({
                    "id": fn["id"],
                    "title": fn["title"],
                    "content": fn.get("summary", "")[:200] or "",  # Use summary as preview
                    "note_type": "full_note",
                    "tags": [],
                    "source_content_id": None,
                    "linked_project_id": fn.get("project_id"),
                    "linked_model_id": None,
                    "is_pinned": fn.get("is_favorite", False),
                    "is_full_note": True,
                    "created_at": fn["created_at"],
                    "updated_at": fn["updated_at"],
                })

            full_notes_count = len(full_notes_data)

        # Combine results if full_note is the only filter or no type filter
        if data.note_types and 'full_note' in data.note_types and len(data.note_types) == 1:
            # Only full notes requested
            combined_notes = full_notes_data
        elif not data.note_types or 'full_note' in data.note_types:
            # Combine both types
            combined_notes = notes + full_notes_data
            combined_notes.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        else:
            combined_notes = notes

        # Apply pagination to combined results
        paginated_notes = combined_notes[data.offset:data.offset + data.limit]

        # Get facet counts (all notes, not filtered)
        # This query is separate and gets total counts for facets
        all_notes_query = db.table("standalone_notes").select(
            "note_type, source_content_id, linked_project_id, linked_model_id, is_pinned"
        ).eq("user_id", user_id)

        all_notes_response = all_notes_query.execute()
        all_notes = all_notes_response.data or []

        # Get full notes count for facets
        full_notes_total_response = db.table("contents").select(
            "id", count="exact"
        ).eq("user_id", user_id).eq("type", "note").eq("is_archived", False).execute()
        full_notes_total = full_notes_total_response.count or 0

        # Calculate facets
        note_type_counts = {}
        content_linked_count = 0
        project_linked_count = 0
        model_linked_count = 0
        independent_count = 0
        pinned_count = 0

        for n in all_notes:
            nt = n.get("note_type", "reflection")
            note_type_counts[nt] = note_type_counts.get(nt, 0) + 1

            has_content = n.get("source_content_id") is not None
            has_project = n.get("linked_project_id") is not None
            has_model = n.get("linked_model_id") is not None

            if has_content:
                content_linked_count += 1
            if has_project:
                project_linked_count += 1
            if has_model:
                model_linked_count += 1
            if not has_content and not has_project and not has_model:
                independent_count += 1

            if n.get("is_pinned"):
                pinned_count += 1

        total_all = len(all_notes) + full_notes_total

        facets = {
            "note_types": [
                {"value": "reflection", "label": "Reflexiones", "icon": "💭", "count": note_type_counts.get("reflection", 0)},
                {"value": "idea", "label": "Ideas", "icon": "💡", "count": note_type_counts.get("idea", 0)},
                {"value": "question", "label": "Preguntas", "icon": "❓", "count": note_type_counts.get("question", 0)},
                {"value": "connection", "label": "Conexiones", "icon": "🔗", "count": note_type_counts.get("connection", 0)},
                {"value": "journal", "label": "Diario", "icon": "📓", "count": note_type_counts.get("journal", 0)},
                {"value": "action", "label": "Acciones", "icon": "✅", "count": note_type_counts.get("action", 0)},
                {"value": "full_note", "label": "Notas completas", "icon": "📄", "count": full_notes_total},
            ],
            "linkage": [
                {"value": "content", "label": "Con contenido", "icon": "📄", "count": content_linked_count},
                {"value": "project", "label": "Con proyecto", "icon": "📁", "count": project_linked_count},
                {"value": "model", "label": "Con modelo mental", "icon": "🧠", "count": model_linked_count},
                {"value": "independent", "label": "Independientes", "icon": "📝", "count": independent_count},
            ],
            "total_notes": total_all,
            "pinned_count": pinned_count,
        }

        return {
            "data": paginated_notes,
            "facets": facets,
            "meta": {
                "total_results": total_all,
                "returned_results": len(paginated_notes),
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
