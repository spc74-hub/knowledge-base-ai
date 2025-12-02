"""
Apple Notes import endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser
from app.services.apple_notes import apple_notes_service, AppleNotesFolder, AppleNote
from app.services.classifier import classifier_service
from app.services.summarizer import summarizer_service
from app.services.embeddings import embeddings_service
from app.services.usage_tracker import usage_tracker

router = APIRouter()


class FoldersResponse(BaseModel):
    """Response for listing Apple Notes folders."""
    folders: List[AppleNotesFolder]
    total_notes: int


class NotesListResponse(BaseModel):
    """Response for listing notes in a folder."""
    notes: List[AppleNote]
    folder: str
    count: int


class AllNotesResponse(BaseModel):
    """Response for listing all notes."""
    notes: List[AppleNote]
    count: int


class ImportRequest(BaseModel):
    """Request to import specific notes."""
    note_ids: List[str]
    tags: List[str] = []
    folder_id: Optional[str] = None  # For importing entire folder


class ImportFolderRequest(BaseModel):
    """Request to import all notes from a folder."""
    folder_name: str
    tags: List[str] = []


class ImportAllRequest(BaseModel):
    """Request to import all notes."""
    tags: List[str] = []


class ImportResult(BaseModel):
    """Result for a single note import."""
    note_id: str
    note_name: str
    success: bool
    content_id: Optional[str] = None
    error: Optional[str] = None


class ImportResponse(BaseModel):
    """Response for import operation."""
    total: int
    successful: int
    failed: int
    results: List[ImportResult]


@router.get("/folders", response_model=FoldersResponse)
async def list_folders(current_user: CurrentUser):
    """
    List all Apple Notes folders with note counts.
    """
    try:
        folders = apple_notes_service.get_folders()
        total_notes = sum(f.note_count for f in folders)

        return FoldersResponse(
            folders=folders,
            total_notes=total_notes
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Apple Notes folders: {str(e)}"
        )


@router.get("/notes", response_model=AllNotesResponse)
async def list_all_notes(current_user: CurrentUser):
    """
    List all notes from all folders (without content).
    """
    try:
        notes = apple_notes_service.get_all_notes()

        return AllNotesResponse(
            notes=notes,
            count=len(notes)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Apple Notes: {str(e)}"
        )


@router.get("/notes/{folder_name}", response_model=NotesListResponse)
async def list_notes_in_folder(folder_name: str, current_user: CurrentUser):
    """
    List all notes in a specific folder (without content).
    """
    try:
        notes = apple_notes_service.get_notes_in_folder(folder_name)

        return NotesListResponse(
            notes=notes,
            folder=folder_name,
            count=len(notes)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch notes from folder: {str(e)}"
        )


async def _import_single_note(
    note: AppleNote,
    user_id: str,
    db,
    tags: List[str]
) -> ImportResult:
    """Import a single Apple Note to the knowledge base."""
    original_id = note.id
    original_name = note.name
    original_folder = note.folder

    try:
        # Get note content if not already present
        if not note.body:
            # Use name and folder lookup since x-coredata:// IDs don't work reliably with AppleScript
            note = apple_notes_service.get_note_by_name_and_folder(original_name, original_folder)
            if not note:
                return ImportResult(
                    note_id=original_id,
                    note_name=original_name,
                    success=False,
                    error="Failed to fetch note content"
                )

        # Convert HTML to text for processing
        text_content = apple_notes_service.html_to_text(note.body or "")

        if not text_content.strip():
            return ImportResult(
                note_id=note.id,
                note_name=note.name,
                success=False,
                error="Note has no text content"
            )

        # Check for duplicate (by title and type)
        existing = db.table("contents").select("id").eq(
            "user_id", user_id
        ).eq("type", "note").eq("title", note.name).execute()

        if existing.data:
            return ImportResult(
                note_id=note.id,
                note_name=note.name,
                success=False,
                error="Note with this title already exists"
            )

        # Classify content
        classification = await classifier_service.classify(
            title=note.name,
            content=text_content,
            url="",
            user_id=user_id
        )

        # Generate summary
        summary = await summarizer_service.summarize(
            title=note.name,
            content=text_content,
            language=classification.language,
            user_id=user_id
        )

        # Calculate reading time
        word_count = len(text_content.split())
        reading_time = max(1, word_count // 200)

        # Generate embedding
        embedding_text = embeddings_service.prepare_content_for_embedding(
            title=note.name,
            summary=summary,
            content=text_content,
            concepts=classification.concepts,
            entities=classification.entities.model_dump() if classification.entities else None,
            metadata=None
        )
        embedding = await embeddings_service.generate_embedding(
            embedding_text,
            user_id=user_id,
            operation="content_embedding"
        )

        # Add Apple Notes folder as a tag
        all_tags = list(set(tags + [f"apple-notes:{note.folder}"]))

        # Create content record
        content_data = {
            "user_id": user_id,
            "url": f"apple-notes://{note.id}",
            "type": "note",
            "title": note.name,
            "raw_content": note.body or text_content,  # Keep HTML for rich content
            "summary": summary,
            "schema_type": classification.schema_type,
            "schema_subtype": classification.schema_subtype,
            "iab_tier1": classification.iab_tier1,
            "iab_tier2": classification.iab_tier2,
            "iab_tier3": classification.iab_tier3,
            "concepts": classification.concepts,
            "entities": classification.entities.model_dump() if classification.entities else {},
            "language": classification.language,
            "sentiment": classification.sentiment,
            "technical_level": classification.technical_level,
            "content_format": classification.content_format,
            "reading_time_minutes": reading_time,
            "metadata": {
                "source": "apple_notes",
                "apple_notes_id": note.id,
                "apple_notes_folder": note.folder,
                "creation_date": note.creation_date,
                "modification_date": note.modification_date
            },
            "user_tags": all_tags,
            "processing_status": "completed",
            "embedding": embedding
        }

        response = db.table("contents").insert(content_data).execute()

        if response.data:
            return ImportResult(
                note_id=note.id,
                note_name=note.name,
                success=True,
                content_id=response.data[0]["id"]
            )
        else:
            return ImportResult(
                note_id=note.id,
                note_name=note.name,
                success=False,
                error="Failed to save note to database"
            )

    except Exception as e:
        return ImportResult(
            note_id=note.id,
            note_name=note.name,
            success=False,
            error=str(e)
        )


@router.post("/import", response_model=ImportResponse)
async def import_notes(
    data: ImportRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Import specific notes by their IDs.
    """
    user_id = current_user["id"]
    usage_tracker.set_db(db)

    results: List[ImportResult] = []

    # Get notes by IDs
    for note_id in data.note_ids:
        note = apple_notes_service.get_note_by_id(note_id)
        if note:
            result = await _import_single_note(note, user_id, db, data.tags)
            results.append(result)
        else:
            results.append(ImportResult(
                note_id=note_id,
                note_name="Unknown",
                success=False,
                error="Note not found"
            ))

    successful = sum(1 for r in results if r.success)

    return ImportResponse(
        total=len(results),
        successful=successful,
        failed=len(results) - successful,
        results=results
    )


@router.post("/import-folder", response_model=ImportResponse)
async def import_folder(
    data: ImportFolderRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Import all notes from a specific folder.
    """
    user_id = current_user["id"]
    usage_tracker.set_db(db)

    try:
        notes = apple_notes_service.get_notes_in_folder(data.folder_name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get notes from folder: {str(e)}"
        )

    results: List[ImportResult] = []

    for note in notes:
        # Fetch full note with content using name+folder (ID lookup doesn't work with x-coredata:// URLs)
        full_note = apple_notes_service.get_note_by_name_and_folder(note.name, data.folder_name)
        if full_note:
            result = await _import_single_note(full_note, user_id, db, data.tags)
            results.append(result)
        else:
            results.append(ImportResult(
                note_id=note.id,
                note_name=note.name,
                success=False,
                error="Failed to fetch note content"
            ))

    successful = sum(1 for r in results if r.success)

    return ImportResponse(
        total=len(results),
        successful=successful,
        failed=len(results) - successful,
        results=results
    )


@router.post("/import-all", response_model=ImportResponse)
async def import_all_notes(
    data: ImportAllRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Import all notes from all folders.
    """
    user_id = current_user["id"]
    usage_tracker.set_db(db)

    try:
        notes = apple_notes_service.get_all_notes()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get notes: {str(e)}"
        )

    results: List[ImportResult] = []

    for note in notes:
        # Fetch full note with content using name+folder (ID lookup doesn't work with x-coredata:// URLs)
        full_note = apple_notes_service.get_note_by_name_and_folder(note.name, note.folder)
        if full_note:
            result = await _import_single_note(full_note, user_id, db, data.tags)
            results.append(result)
        else:
            results.append(ImportResult(
                note_id=note.id,
                note_name=note.name,
                success=False,
                error="Failed to fetch note content"
            ))

    successful = sum(1 for r in results if r.success)

    return ImportResponse(
        total=len(results),
        successful=successful,
        failed=len(results) - successful,
        results=results
    )
