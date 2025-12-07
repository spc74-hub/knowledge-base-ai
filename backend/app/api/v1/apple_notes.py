"""
Apple Notes import endpoints.

NOTE: These endpoints only work when the backend is running locally on macOS.
They will return a 503 Service Unavailable error when accessed from cloud deployments.
"""
import json
import asyncio
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser
from app.services.apple_notes import (
    apple_notes_service,
    AppleNotesFolder,
    AppleNote,
    AppleNotesNotAvailableError,
    is_macos_with_osascript
)
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

    except AppleNotesNotAvailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
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

    except AppleNotesNotAvailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
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

    except AppleNotesNotAvailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
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
    """Import a single Apple Note to the knowledge base (deferred processing)."""
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

        # Check for duplicate by title + folder combination
        # This allows same title in different folders
        existing = db.table("contents").select("id").eq(
            "user_id", user_id
        ).eq("type", "note").eq("title", note.name).execute()

        # Check if any existing note has the same folder
        if existing.data:
            for ex in existing.data:
                # Get the existing note's metadata to check folder
                ex_full = db.table("contents").select("metadata").eq("id", ex["id"]).single().execute()
                if ex_full.data:
                    ex_folder = ex_full.data.get("metadata", {}).get("apple_notes_folder")
                    if ex_folder == note.folder:
                        return ImportResult(
                            note_id=note.id,
                            note_name=note.name,
                            success=False,
                            error=f"Note already exists in folder '{note.folder}'"
                        )

        # Calculate reading time
        word_count = len(text_content.split())
        reading_time = max(1, word_count // 200)

        # Add Apple Notes folder as a tag
        all_tags = list(set(tags + [f"apple-notes:{note.folder}"]))

        # Create content record WITHOUT AI processing (deferred)
        content_data = {
            "user_id": user_id,
            "url": f"apple-notes://{note.id}",
            "type": "note",
            "title": note.name,
            "raw_content": note.body or text_content,  # Keep HTML for rich content
            "summary": None,
            "schema_type": None,
            "schema_subtype": None,
            "iab_tier1": None,
            "iab_tier2": None,
            "iab_tier3": None,
            "concepts": [],
            "entities": {},
            "language": None,
            "sentiment": None,
            "technical_level": None,
            "content_format": None,
            "reading_time_minutes": reading_time,
            "metadata": {
                "source": "apple_notes",
                "apple_notes_id": note.id,
                "apple_notes_folder": note.folder,
                "creation_date": note.creation_date,
                "modification_date": note.modification_date
            },
            "user_tags": all_tags,
            "processing_status": "pending",  # Deferred processing
            "embedding": None
        }

        print(f"[IMPORT] Inserting note: {note.name} from folder {note.folder}")
        response = db.table("contents").insert(content_data).execute()
        print(f"[IMPORT] Response data: {response.data}")
        print(f"[IMPORT] Response count: {getattr(response, 'count', 'N/A')}")

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
        import traceback
        print(f"[IMPORT ERROR] Exception importing note: {original_name}")
        print(f"[IMPORT ERROR] Error: {str(e)}")
        traceback.print_exc()
        return ImportResult(
            note_id=original_id,
            note_name=original_name,
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

    try:
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
    except AppleNotesNotAvailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )

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
        print(f"[FOLDER IMPORT] Starting import for folder: {data.folder_name}")
        notes = apple_notes_service.get_notes_in_folder(data.folder_name)
        print(f"[FOLDER IMPORT] Found {len(notes)} notes in folder: {data.folder_name}")
    except AppleNotesNotAvailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get notes from folder: {str(e)}"
        )

    results: List[ImportResult] = []

    for idx, note in enumerate(notes):
        print(f"[FOLDER IMPORT] Processing note {idx+1}/{len(notes)}: {note.name}")
        # Fetch full note with content using name+folder (ID lookup doesn't work with x-coredata:// URLs)
        full_note = apple_notes_service.get_note_by_name_and_folder(note.name, data.folder_name)
        print(f"[FOLDER IMPORT] Full note fetched: {full_note is not None}")
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
    except AppleNotesNotAvailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
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


@router.post("/import-all-stream")
async def import_all_notes_stream(
    data: ImportAllRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Import all notes from all folders with real-time progress streaming (SSE).
    Returns Server-Sent Events with progress updates.
    Processes folder by folder for better performance and progress feedback.
    """
    user_id = current_user["id"]
    usage_tracker.set_db(db)

    async def generate_progress():
        try:
            # IMPORTANT: Send initial event immediately to establish SSE connection
            yield f"data: {json.dumps({'type': 'status', 'message': 'Conectando con Apple Notes...'})}\n\n"
            await asyncio.sleep(0.05)  # Force flush to client

            yield f"data: {json.dumps({'type': 'status', 'message': 'Obteniendo lista de carpetas...'})}\n\n"
            await asyncio.sleep(0.05)  # Force flush

            try:
                # Get folders first (fast operation)
                loop = asyncio.get_event_loop()
                folders = await loop.run_in_executor(None, apple_notes_service.get_folders)
            except AppleNotesNotAvailableError as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                return
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Error al obtener carpetas: {str(e)}'})}\n\n"
                return

            # Calculate total notes from folder counts
            total = sum(f.note_count for f in folders)
            yield f"data: {json.dumps({'type': 'total', 'total': total, 'folders': len(folders), 'message': f'Encontradas {len(folders)} carpetas con {total} notas'})}\n\n"
            await asyncio.sleep(0.05)  # Force flush

            successful = 0
            failed = 0
            duplicates = 0
            empty = 0
            current = 0

            # Process folder by folder
            for folder_idx, folder in enumerate(folders):
                folder_name = folder.name

                yield f"data: {json.dumps({'type': 'folder_start', 'folder': folder_name, 'folder_index': folder_idx + 1, 'total_folders': len(folders), 'note_count': folder.note_count})}\n\n"
                await asyncio.sleep(0.02)

                try:
                    # Get notes in this folder (faster than get_all_notes)
                    loop = asyncio.get_event_loop()
                    folder_notes = await loop.run_in_executor(
                        None,
                        lambda fn=folder_name: apple_notes_service.get_notes_in_folder(fn)
                    )
                except Exception as e:
                    # Skip this folder on error
                    yield f"data: {json.dumps({'type': 'folder_error', 'folder': folder_name, 'error': str(e)})}\n\n"
                    current += folder.note_count
                    failed += folder.note_count
                    continue

                # Process each note in the folder
                for note in folder_notes:
                    current += 1

                    # Fetch full note with content
                    try:
                        loop = asyncio.get_event_loop()
                        full_note = await loop.run_in_executor(
                            None,
                            lambda n=note, fn=folder_name: apple_notes_service.get_note_by_name_and_folder(n.name, fn)
                        )
                    except Exception:
                        full_note = None

                    if full_note:
                        result = await _import_single_note(full_note, user_id, db, data.tags)

                        if result.success:
                            successful += 1
                            status_type = "success"
                        elif result.error and ("already exists" in result.error.lower() or "duplicate key" in result.error.lower()):
                            duplicates += 1
                            status_type = "duplicate"
                        elif result.error and "no text content" in result.error.lower():
                            empty += 1
                            status_type = "empty"
                        else:
                            failed += 1
                            status_type = "failed"
                    else:
                        failed += 1
                        status_type = "failed"
                        result = ImportResult(
                            note_id=note.id,
                            note_name=note.name,
                            success=False,
                            error="Failed to fetch note content"
                        )

                    # Send progress update
                    progress_data = {
                        "type": "progress",
                        "current": current,
                        "total": total,
                        "percent": round((current / total) * 100, 1) if total > 0 else 0,
                        "successful": successful,
                        "failed": failed,
                        "duplicates": duplicates,
                        "empty": empty,
                        "status": status_type,
                        "note_name": note.name[:50] + "..." if len(note.name) > 50 else note.name,
                        "folder": folder_name,
                        "error": result.error if not result.success else None
                    }
                    yield f"data: {json.dumps(progress_data)}\n\n"

                    # Small delay to prevent overwhelming the client
                    await asyncio.sleep(0.01)

            # Final summary
            summary = {
                "type": "complete",
                "total": current,
                "successful": successful,
                "failed": failed,
                "duplicates": duplicates,
                "empty": empty,
                "message": f"Importación completada: {successful} exitosas, {duplicates} duplicadas, {empty} vacías, {failed} fallidas"
            }
            yield f"data: {json.dumps(summary)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Error inesperado: {str(e)}'})}\n\n"

    return StreamingResponse(
        generate_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
