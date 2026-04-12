"""
File upload endpoints for importing documents (PDF, Word, Email).
"""
import hashlib
import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser
from app.services.document_parser import document_parser, DocumentParseError

router = APIRouter()


class FileUploadResult(BaseModel):
    """Result of a single file upload."""
    filename: str
    success: bool
    content_id: Optional[str] = None
    title: Optional[str] = None
    error: Optional[str] = None


class FileUploadResponse(BaseModel):
    """Response for file upload endpoint."""
    total: int
    successful: int
    failed: int
    results: List[FileUploadResult]


@router.post("/upload", response_model=FileUploadResponse)
async def upload_files(
    files: List[UploadFile] = File(...),
    tags: Optional[str] = Form(None),
    current_user: CurrentUser = None,
    db: Database = None
):
    """
    Upload one or more files (PDF, DOCX, EML) and create content entries.
    Files are parsed for text content and stored in the database.
    Processing is deferred to the queue.
    """
    user_id = current_user["id"]
    results: List[FileUploadResult] = []

    # Parse tags if provided
    tags_list = []
    if tags:
        tags_list = [t.strip() for t in tags.split(',') if t.strip()]

    for file in files:
        try:
            # Validate file type
            filename = file.filename or "unknown"
            ext = filename.lower().split('.')[-1] if '.' in filename else ''

            if ext not in ('pdf', 'docx', 'doc', 'eml'):
                results.append(FileUploadResult(
                    filename=filename,
                    success=False,
                    error=f"Tipo de archivo no soportado: .{ext}. Soportados: PDF, DOCX, EML"
                ))
                continue

            # Read file content
            content_bytes = await file.read()

            if len(content_bytes) == 0:
                results.append(FileUploadResult(
                    filename=filename,
                    success=False,
                    error="El archivo está vacío"
                ))
                continue

            # Check file size (max 50MB)
            if len(content_bytes) > 50 * 1024 * 1024:
                results.append(FileUploadResult(
                    filename=filename,
                    success=False,
                    error="El archivo excede el tamaño máximo de 50MB"
                ))
                continue

            # Parse the document
            try:
                title, text_content, metadata = document_parser.parse_file(content_bytes, filename)
            except DocumentParseError as e:
                results.append(FileUploadResult(
                    filename=filename,
                    success=False,
                    error=str(e)
                ))
                continue

            # Generate a unique URL for the file
            # Using hash of content + filename to detect duplicates
            content_hash = hashlib.sha256(content_bytes).hexdigest()[:16]
            file_url = f"file://{content_hash}/{filename}"

            # Determine content type
            file_type = document_parser.get_file_type(filename)

            # Prepare content data
            content_data = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "url": file_url,
                "title": title,
                "type": file_type,
                "raw_content": text_content[:50000] if len(text_content) > 50000 else text_content,  # Limit raw content
                "metadata": metadata,
                "user_tags": tags_list,
                "processing_status": "pending",
                "maturity_level": "captured",
                "is_favorite": False,
                "is_archived": False,
            }

            # Insert into database
            try:
                response = await db.table("contents").insert(content_data).execute()

                if response.data:
                    results.append(FileUploadResult(
                        filename=filename,
                        success=True,
                        content_id=response.data[0]["id"],
                        title=title
                    ))
                else:
                    results.append(FileUploadResult(
                        filename=filename,
                        success=False,
                        error="Error al guardar en la base de datos"
                    ))
            except Exception as db_error:
                error_str = str(db_error)
                if "duplicate key" in error_str.lower() or "unique_user_url" in error_str.lower():
                    results.append(FileUploadResult(
                        filename=filename,
                        success=False,
                        error="Este archivo ya ha sido importado anteriormente"
                    ))
                else:
                    results.append(FileUploadResult(
                        filename=filename,
                        success=False,
                        error=f"Error de base de datos: {error_str}"
                    ))

        except Exception as e:
            results.append(FileUploadResult(
                filename=file.filename or "unknown",
                success=False,
                error=f"Error inesperado: {str(e)}"
            ))

    successful = sum(1 for r in results if r.success)

    return FileUploadResponse(
        total=len(results),
        successful=successful,
        failed=len(results) - successful,
        results=results
    )


@router.get("/supported-types")
async def get_supported_types():
    """Return list of supported file types."""
    return {
        "types": [
            {"extension": "pdf", "name": "PDF", "icon": "📕", "mime": "application/pdf"},
            {"extension": "docx", "name": "Word", "icon": "📘", "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
            {"extension": "doc", "name": "Word (legacy)", "icon": "📘", "mime": "application/msword"},
            {"extension": "eml", "name": "Email", "icon": "📧", "mime": "message/rfc822"},
        ],
        "max_size_mb": 50,
    }
