"""
Google Drive import endpoints.
Handles OAuth flow and file listing/import from Google Drive.
"""
import json
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser
from app.services.google_drive import google_drive_service, SUPPORTED_MIME_TYPES, AUDIO_MIME_TYPES
from app.core.config import settings

router = APIRouter()

# In-memory token storage (in production, use database)
# Key: user_id, Value: token_data
_user_tokens: Dict[str, Dict[str, Any]] = {}


class DriveFile(BaseModel):
    """Represents a file from Google Drive."""
    id: str
    name: str
    mimeType: str
    isFolder: bool
    isSupported: bool
    fileType: str
    webViewLink: Optional[str] = None
    modifiedTime: Optional[str] = None
    size: Optional[str] = None


class FilesListResponse(BaseModel):
    """Response for listing Drive files."""
    files: List[DriveFile]
    nextPageToken: Optional[str] = None
    folderPath: List[Dict[str, str]] = []


class ImportRequest(BaseModel):
    """Request to import files from Google Drive."""
    file_ids: List[str]
    tags: List[str] = []


class ImportResult(BaseModel):
    """Result for a single file import."""
    file_id: str
    file_name: str
    success: bool
    content_id: Optional[str] = None
    error: Optional[str] = None


class ImportResponse(BaseModel):
    """Response for import operation."""
    total: int
    successful: int
    failed: int
    results: List[ImportResult]


class AuthStatusResponse(BaseModel):
    """Response for auth status check."""
    connected: bool
    email: Optional[str] = None


@router.get("/auth/url")
async def get_auth_url(current_user: CurrentUser):
    """
    Get Google OAuth authorization URL.
    Frontend should redirect user to this URL.
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Drive integration not configured"
        )

    # Use user_id as state for security
    state = current_user["id"]
    auth_url = google_drive_service.get_auth_url(state=state)

    return {"auth_url": auth_url}


@router.get("/callback")
async def oauth_callback(code: str, state: Optional[str] = None):
    """
    Handle OAuth callback from Google.
    Exchanges code for tokens and stores them.
    """
    try:
        token_data = google_drive_service.exchange_code(code)

        # Store tokens for user (state contains user_id)
        if state:
            _user_tokens[state] = token_data

        # Redirect back to frontend import page
        frontend_url = settings.FRONTEND_URL
        return RedirectResponse(
            url=f"{frontend_url}/import?source=google-drive&connected=true"
        )

    except Exception as e:
        frontend_url = settings.FRONTEND_URL
        return RedirectResponse(
            url=f"{frontend_url}/import?source=google-drive&error={str(e)}"
        )


@router.get("/auth/status", response_model=AuthStatusResponse)
async def check_auth_status(current_user: CurrentUser):
    """
    Check if user is connected to Google Drive.
    """
    user_id = current_user["id"]
    token_data = _user_tokens.get(user_id)

    if token_data and token_data.get("access_token"):
        return AuthStatusResponse(connected=True)

    return AuthStatusResponse(connected=False)


@router.post("/auth/disconnect")
async def disconnect(current_user: CurrentUser):
    """
    Disconnect Google Drive (remove stored tokens).
    """
    user_id = current_user["id"]

    if user_id in _user_tokens:
        del _user_tokens[user_id]

    return {"success": True, "message": "Disconnected from Google Drive"}


@router.get("/files", response_model=FilesListResponse)
async def list_files(
    current_user: CurrentUser,
    folder_id: Optional[str] = None,
    page_token: Optional[str] = None,
    search: Optional[str] = None,
    order_by: str = "modifiedTime desc"
):
    """
    List files from Google Drive.

    Args:
        folder_id: Filter by folder (ignored when searching)
        page_token: Pagination token
        search: Search term to filter files by name
        order_by: Sort order (modifiedTime desc, name, name desc, createdTime desc)
    """
    user_id = current_user["id"]
    token_data = _user_tokens.get(user_id)

    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not connected to Google Drive. Please authenticate first."
        )

    try:
        result = google_drive_service.list_files(
            token_data=token_data,
            folder_id=folder_id,
            page_token=page_token,
            search_query=search,
            order_by=order_by
        )

        # Get folder path if we're in a subfolder
        folder_path = []
        if folder_id:
            folder_path = google_drive_service.get_folder_path(token_data, folder_id)

        return FilesListResponse(
            files=[DriveFile(**f) for f in result["files"]],
            nextPageToken=result.get("nextPageToken"),
            folderPath=folder_path
        )

    except Exception as e:
        # Check if token expired
        if "invalid_grant" in str(e).lower() or "token" in str(e).lower():
            # Clear invalid token
            if user_id in _user_tokens:
                del _user_tokens[user_id]
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired. Please reconnect to Google Drive."
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing files: {str(e)}"
        )


async def _import_single_file(
    file_id: str,
    user_id: str,
    db,
    token_data: Dict[str, Any],
    tags: List[str]
) -> ImportResult:
    """Import a single file from Google Drive."""
    try:
        # Get file content and metadata
        file_data = google_drive_service.get_file_content(token_data, file_id)

        file_name = file_data["name"]
        content = file_data.get("content", "")
        web_link = file_data.get("webViewLink", f"https://drive.google.com/file/d/{file_id}")

        # Sanitize content - remove null characters that PostgreSQL can't handle
        if content:
            content = content.replace('\x00', '').replace('\u0000', '')

        if not content or content.startswith("["):
            # No extractable content
            return ImportResult(
                file_id=file_id,
                file_name=file_name,
                success=False,
                error="No text content could be extracted from this file"
            )

        # Check for duplicate by URL
        existing = db.table("contents").select("id").eq(
            "user_id", user_id
        ).eq("url", web_link).execute()

        if existing.data:
            return ImportResult(
                file_id=file_id,
                file_name=file_name,
                success=False,
                error="File already imported"
            )

        # Calculate reading time
        word_count = len(content.split())
        reading_time = max(1, word_count // 200)

        # Determine content type based on mime type
        # Valid types in database: 'web', 'youtube', 'tiktok', 'twitter', 'pdf', 'note', 'docx', 'email', 'audio'
        mime_type = file_data.get("mimeType", "")
        if mime_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         'application/msword',
                         'application/vnd.google-apps.document']:
            content_type = "docx"
        elif mime_type == 'message/rfc822':
            content_type = "email"
        elif mime_type in AUDIO_MIME_TYPES:
            content_type = "audio"
        else:
            content_type = "pdf"  # Default for PDFs and other documents

        # Add Google Drive tag
        all_tags = list(set(tags + ["google-drive"]))

        # Create content record with deferred processing
        content_data = {
            "user_id": user_id,
            "url": web_link,
            "type": content_type,
            "title": file_name,
            "raw_content": content,
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
                "source": "google_drive",
                "google_drive_id": file_id,
                "mime_type": mime_type,
                "file_type": file_data.get("fileType", "Unknown"),
                "modified_time": file_data.get("modifiedTime")
            },
            "user_tags": all_tags,
            "processing_status": "pending",
            "embedding": None
        }

        response = db.table("contents").insert(content_data).execute()

        if response.data:
            return ImportResult(
                file_id=file_id,
                file_name=file_name,
                success=True,
                content_id=response.data[0]["id"]
            )
        else:
            return ImportResult(
                file_id=file_id,
                file_name=file_name,
                success=False,
                error="Failed to save to database"
            )

    except Exception as e:
        return ImportResult(
            file_id=file_id,
            file_name=f"File {file_id}",
            success=False,
            error=str(e)
        )


@router.post("/import", response_model=ImportResponse)
async def import_files(
    data: ImportRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Import specific files by their IDs.
    """
    user_id = current_user["id"]
    token_data = _user_tokens.get(user_id)

    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not connected to Google Drive. Please authenticate first."
        )

    results: List[ImportResult] = []

    for file_id in data.file_ids:
        result = await _import_single_file(
            file_id=file_id,
            user_id=user_id,
            db=db,
            token_data=token_data,
            tags=data.tags
        )
        results.append(result)

    successful = sum(1 for r in results if r.success)

    return ImportResponse(
        total=len(results),
        successful=successful,
        failed=len(results) - successful,
        results=results
    )


@router.post("/import-stream")
async def import_files_stream(
    data: ImportRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Import files with real-time progress streaming (SSE).
    """
    user_id = current_user["id"]
    token_data = _user_tokens.get(user_id)

    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not connected to Google Drive. Please authenticate first."
        )

    async def generate_progress():
        try:
            total = len(data.file_ids)
            successful = 0
            failed = 0
            duplicates = 0

            yield f"data: {json.dumps({'type': 'total', 'total': total})}\n\n"

            for idx, file_id in enumerate(data.file_ids):
                result = await _import_single_file(
                    file_id=file_id,
                    user_id=user_id,
                    db=db,
                    token_data=token_data,
                    tags=data.tags
                )

                if result.success:
                    successful += 1
                    status_type = "success"
                elif result.error and "already imported" in result.error.lower():
                    duplicates += 1
                    status_type = "duplicate"
                else:
                    failed += 1
                    status_type = "failed"

                progress_data = {
                    "type": "progress",
                    "current": idx + 1,
                    "total": total,
                    "percent": round(((idx + 1) / total) * 100, 1),
                    "successful": successful,
                    "failed": failed,
                    "duplicates": duplicates,
                    "status": status_type,
                    "file_name": result.file_name[:50] + "..." if len(result.file_name) > 50 else result.file_name,
                    "error": result.error if not result.success else None
                }
                yield f"data: {json.dumps(progress_data)}\n\n"

                await asyncio.sleep(0.01)

            # Final summary
            summary = {
                "type": "complete",
                "total": total,
                "successful": successful,
                "failed": failed,
                "duplicates": duplicates,
                "message": f"Import complete: {successful} successful, {duplicates} duplicates, {failed} failed"
            }
            yield f"data: {json.dumps(summary)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
