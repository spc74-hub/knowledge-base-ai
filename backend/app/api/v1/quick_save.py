"""
Quick Save API endpoint for bookmarklet and iOS Shortcut integration.
Provides a simplified endpoint for saving URLs from external sources.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel, HttpUrl

from app.api.deps import Database, CurrentUser
from app.services.fetcher import fetcher_service
from app.services.classifier import classifier_service
from app.services.summarizer import summarizer_service
from app.services.embeddings import embeddings_service
from app.services.usage_tracker import usage_tracker
from app.services.url_normalizer import normalize_url, resolve_tiktok_short_url

router = APIRouter()


class QuickSaveRequest(BaseModel):
    url: HttpUrl
    tags: list[str] = []
    process_now: bool = False  # If True, process immediately; if False, just save for later


class QuickSaveResponse(BaseModel):
    success: bool
    message: str
    content_id: Optional[str] = None
    title: Optional[str] = None
    error: Optional[str] = None


@router.post("/", response_model=QuickSaveResponse)
async def quick_save_url(
    current_user: CurrentUser,
    db: Database,
    data: QuickSaveRequest = None,
    url: str = Query(None, description="URL to save (alternative to body)")
):
    """
    Quick save a URL - simplified endpoint for bookmarklet and iOS Shortcut.
    By default, only fetches and saves content without AI processing (instant).
    Set process_now=True to process immediately.

    Accepts URL either in JSON body or as query parameter for Shortcuts compatibility.
    """
    import asyncio
    import logging

    logger = logging.getLogger(__name__)

    try:
        # Support both JSON body and query parameter
        if url:
            # URL from query parameter (Shortcuts fallback)
            original_url = url
        elif data and data.url:
            # URL from JSON body
            original_url = str(data.url)
        else:
            return QuickSaveResponse(
                success=False,
                message="URL is required",
                error="missing_url"
            )

        # Resolve TikTok short URLs before normalizing
        resolved_url = await resolve_tiktok_short_url(original_url)
        url_str = normalize_url(resolved_url)
        user_id = current_user["id"]

        logger.info(f"Quick save request: {original_url} -> resolved: {resolved_url} -> normalized: {url_str}")

        # Check if normalized URL already exists
        existing = db.table("contents").select("id, title").eq("user_id", user_id).eq("url", url_str).execute()

        if existing.data:
            logger.info(f"URL already exists: {url_str}")
            return QuickSaveResponse(
                success=False,
                message="URL already saved",
                content_id=existing.data[0]["id"],
                title=existing.data[0]["title"],
                error="duplicate"
            )

        # Fetch content using ORIGINAL URL (yt-dlp needs full URL)
        # Apply timeout to prevent hanging on slow fetches
        try:
            fetch_result = await asyncio.wait_for(
                fetcher_service.fetch(original_url),
                timeout=60.0  # 60 second timeout for video platforms
            )
        except asyncio.TimeoutError:
            logger.error(f"Timeout fetching URL: {original_url}")
            return QuickSaveResponse(
                success=False,
                message="Timeout fetching content (try again later)",
                error="timeout"
            )

        if not fetch_result.success:
            logger.error(f"Fetch failed for {original_url}: {fetch_result.error}")
            return QuickSaveResponse(
                success=False,
                message=f"Failed to fetch content",
                error=fetch_result.error
            )

        # Calculate reading time
        word_count = len(fetch_result.content.split())
        reading_time = max(1, word_count // 200)

        # Base content data (without AI processing)
        content_data = {
            "user_id": user_id,
            "url": url_str,
            "type": fetch_result.type,
            "title": fetch_result.title,
            "raw_content": fetch_result.content[:50000],
            "reading_time_minutes": reading_time,
            "metadata": {
                **fetch_result.metadata,
                "saved_via": "quick_save"
            },
            "user_tags": data.tags if data else [],
            "processing_status": "pending",  # Mark as pending for later processing
            "view_count": fetch_result.view_count,
            "description": fetch_result.description
        }

        # If process_now is True, do full AI processing
        if data and data.process_now:
            usage_tracker.set_db(db)

            # Classify content
            classification = await classifier_service.classify(
                title=fetch_result.title,
                content=fetch_result.content,
                url=url_str,
                user_id=user_id
            )

            # Generate summary
            summary = await summarizer_service.summarize(
                title=fetch_result.title,
                content=fetch_result.content,
                language=classification.language,
                user_id=user_id
            )

            # Generate embedding
            embedding_text = embeddings_service.prepare_content_for_embedding(
                title=fetch_result.title,
                summary=summary,
                content=fetch_result.content,
                concepts=classification.concepts,
                entities=classification.entities.model_dump() if classification.entities else None,
                metadata=fetch_result.metadata
            )
            embedding = await embeddings_service.generate_embedding(
                embedding_text,
                user_id=user_id,
                operation="content_embedding"
            )

            # Add AI-processed fields
            content_data.update({
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
                "embedding": embedding,
                "processing_status": "completed"
            })

        response = db.table("contents").insert(content_data).execute()

        if not response.data:
            return QuickSaveResponse(
                success=False,
                message="Failed to save content",
                error="database_error"
            )

        status_msg = "saved and processed" if (data and data.process_now) else "saved (pending processing)"

        return QuickSaveResponse(
            success=True,
            message=f"URL {status_msg}!",
            content_id=response.data[0]["id"],
            title=fetch_result.title
        )

    except Exception as e:
        return QuickSaveResponse(
            success=False,
            message="An error occurred",
            error=str(e)
        )


@router.get("/shortcut")
async def quick_save_shortcut(
    url: str = Query(..., description="URL to save"),
    current_user: CurrentUser = None,
    db: Database = None
):
    """
    Simplified GET endpoint for iOS/macOS Shortcuts.
    Uses query parameter instead of JSON body for better compatibility.

    Usage in Shortcuts:
    GET https://api/quick-save/shortcut?url=[URL]
    Authorization: Bearer [token]
    """
    import asyncio
    import logging

    logger = logging.getLogger(__name__)

    try:
        # Resolve TikTok short URLs before normalizing
        original_url = url
        resolved_url = await resolve_tiktok_short_url(original_url)
        url_str = normalize_url(resolved_url)
        user_id = current_user["id"]

        logger.info(f"Shortcut quick save: {original_url} -> resolved: {resolved_url} -> normalized: {url_str}")

        # Check if URL already exists
        existing = db.table("contents").select("id, title").eq("user_id", user_id).eq("url", url_str).execute()

        if existing.data:
            return JSONResponse(content={
                "success": False,
                "message": "Ya guardado",
                "title": existing.data[0]["title"],
                "error": "duplicate"
            })

        # Fetch content with timeout
        try:
            fetch_result = await asyncio.wait_for(
                fetcher_service.fetch(original_url),
                timeout=60.0
            )
        except asyncio.TimeoutError:
            return JSONResponse(content={
                "success": False,
                "message": "Timeout al obtener contenido",
                "error": "timeout"
            })

        if not fetch_result.success:
            return JSONResponse(content={
                "success": False,
                "message": f"Error: {fetch_result.error}",
                "error": fetch_result.error
            })

        # Calculate reading time
        word_count = len(fetch_result.content.split())
        reading_time = max(1, word_count // 200)

        # Save without AI processing (instant save)
        content_data = {
            "user_id": user_id,
            "url": url_str,
            "type": fetch_result.type,
            "title": fetch_result.title,
            "raw_content": fetch_result.content[:50000],
            "reading_time_minutes": reading_time,
            "metadata": {
                **fetch_result.metadata,
                "saved_via": "ios_shortcut_v2"
            },
            "user_tags": [],
            "processing_status": "pending",
            "view_count": fetch_result.view_count,
            "description": fetch_result.description
        }

        response = db.table("contents").insert(content_data).execute()

        if not response.data:
            return JSONResponse(content={
                "success": False,
                "message": "Error al guardar",
                "error": "database_error"
            })

        return JSONResponse(content={
            "success": True,
            "message": "¡Guardado!",
            "title": fetch_result.title,
            "content_id": response.data[0]["id"]
        })

    except Exception as e:
        logger.error(f"Shortcut save error: {str(e)}")
        return JSONResponse(content={
            "success": False,
            "message": f"Error: {str(e)}",
            "error": str(e)
        })


@router.get("/bookmarklet.js")
async def get_bookmarklet_code():
    """
    Returns the bookmarklet JavaScript code.
    """
    # This will be customized per user when they visit the setup page
    js_code = """
(function() {
    var token = localStorage.getItem('kbase_token');
    if (!token) {
        alert('Please login to Knowledge Base first');
        window.open('%FRONTEND_URL%/login', '_blank');
        return;
    }

    var url = encodeURIComponent(window.location.href);
    var title = encodeURIComponent(document.title);

    var popup = window.open('', 'kbase_save', 'width=400,height=300,menubar=no,toolbar=no');
    popup.document.write('<html><head><title>Saving...</title><style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5;}.loader{text-align:center;}.spinner{width:40px;height:40px;border:3px solid #e0e0e0;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;}@keyframes spin{to{transform:rotate(360deg);}}</style></head><body><div class="loader"><div class="spinner"></div><p>Saving to Knowledge Base...</p></div></body></html>');

    fetch('%API_URL%/api/v1/quick-save/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ url: decodeURIComponent(url) })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            popup.document.body.innerHTML = '<div style="text-align:center;padding:40px;font-family:-apple-system,system-ui,sans-serif;"><h2 style="color:#22c55e;">Saved!</h2><p>' + data.title + '</p><button onclick="window.close()" style="background:#3b82f6;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;">Close</button></div>';
        } else {
            popup.document.body.innerHTML = '<div style="text-align:center;padding:40px;font-family:-apple-system,system-ui,sans-serif;"><h2 style="color:#ef4444;">Error</h2><p>' + data.message + '</p><button onclick="window.close()" style="background:#6b7280;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;">Close</button></div>';
        }
    })
    .catch(err => {
        popup.document.body.innerHTML = '<div style="text-align:center;padding:40px;font-family:-apple-system,system-ui,sans-serif;"><h2 style="color:#ef4444;">Error</h2><p>Failed to save. Please try again.</p><button onclick="window.close()" style="background:#6b7280;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;">Close</button></div>';
    });
})();
""".strip()

    return JSONResponse(content={"code": js_code})


@router.get("/callback")
async def quick_save_callback(
    url: str = Query(...),
    token: str = Query(...),
    db: Database = None
):
    """
    Callback endpoint for iOS Shortcut.
    Returns HTML with result that the Shortcut can parse.
    """
    try:
        # Verify token and get user
        from app.db.session import get_supabase_client
        auth_client = get_supabase_client()
        user_response = auth_client.auth.get_user(token)

        if not user_response or not user_response.user:
            return HTMLResponse(
                content="<html><body><h1>Error</h1><p>Invalid token. Please login again.</p></body></html>",
                status_code=401
            )

        user_id = user_response.user.id

        # Check duplicate
        from app.db.session import get_supabase_admin_client
        admin_db = get_supabase_admin_client()

        existing = admin_db.table("contents").select("id, title").eq("user_id", user_id).eq("url", url).execute()

        if existing.data:
            return HTMLResponse(content=f"""
<!DOCTYPE html>
<html>
<head><title>Already Saved</title></head>
<body>
<h1>Already Saved</h1>
<p>This URL is already in your Knowledge Base.</p>
<p><strong>{existing.data[0]["title"]}</strong></p>
</body>
</html>
            """)

        # Process URL
        usage_tracker.set_db(admin_db)

        fetch_result = await fetcher_service.fetch(url)

        if not fetch_result.success:
            return HTMLResponse(content=f"""
<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body>
<h1>Error</h1>
<p>Failed to fetch content: {fetch_result.error}</p>
</body>
</html>
            """)

        # Full processing pipeline
        classification = await classifier_service.classify(
            title=fetch_result.title,
            content=fetch_result.content,
            url=url,
            user_id=user_id
        )

        summary = await summarizer_service.summarize(
            title=fetch_result.title,
            content=fetch_result.content,
            language=classification.language,
            user_id=user_id
        )

        word_count = len(fetch_result.content.split())
        reading_time = max(1, word_count // 200)

        embedding_text = embeddings_service.prepare_content_for_embedding(
            title=fetch_result.title,
            summary=summary,
            content=fetch_result.content,
            concepts=classification.concepts,
            entities=classification.entities.model_dump() if classification.entities else None,
            metadata=fetch_result.metadata
        )
        embedding = await embeddings_service.generate_embedding(
            embedding_text,
            user_id=user_id,
            operation="content_embedding"
        )

        content_data = {
            "user_id": user_id,
            "url": url,
            "type": fetch_result.type,
            "title": fetch_result.title,
            "raw_content": fetch_result.content[:50000],
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
                **fetch_result.metadata,
                "saved_via": "ios_shortcut"
            },
            "user_tags": [],
            "processing_status": "completed",
            "embedding": embedding,
            "view_count": fetch_result.view_count,
            "description": fetch_result.description
        }

        response = admin_db.table("contents").insert(content_data).execute()

        if response.data:
            return HTMLResponse(content=f"""
<!DOCTYPE html>
<html>
<head><title>Saved!</title></head>
<body>
<h1>Saved Successfully!</h1>
<p><strong>{fetch_result.title}</strong></p>
<p>Category: {classification.iab_tier1 or 'Uncategorized'}</p>
</body>
</html>
            """)
        else:
            return HTMLResponse(content="""
<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body>
<h1>Error</h1>
<p>Failed to save content to database.</p>
</body>
</html>
            """)

    except Exception as e:
        return HTMLResponse(content=f"""
<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body>
<h1>Error</h1>
<p>{str(e)}</p>
</body>
</html>
        """)
