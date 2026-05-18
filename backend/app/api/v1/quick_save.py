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
from app.services.url_normalizer import normalize_url, resolve_tiktok_short_url

router = APIRouter()


class QuickSaveRequest(BaseModel):
    url: HttpUrl
    tags: list[str] = []
    process_now: bool = False  # Deprecated: AI processing pipeline removed. Kept for API compat; ignored.
    source_metadata: Optional[dict] = None  # Back-pointer from external sources (e.g. ContentHub bridge)
    title: Optional[str] = None  # If provided, skip external fetch (caller already has metadata)
    summary: Optional[str] = None  # Optional summary when caller provides title


class QuickSaveResponse(BaseModel):
    success: bool
    message: str
    content_id: Optional[str] = None
    title: Optional[str] = None
    error: Optional[str] = None


def _infer_type_from_url(url: str) -> str:
    """Best-effort type inference when caller provides title and we skip the fetch."""
    u = url.lower()
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "tiktok" in u:
        return "tiktok"
    if "twitter.com" in u or "x.com" in u:
        return "twitter"
    if "substack" in u:
        return "substack"
    return "web"


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
        existing = await db.table("contents").select("id, title").eq("user_id", user_id).eq("url", url_str).execute()

        if existing.data:
            logger.info(f"URL already exists: {url_str}")
            return QuickSaveResponse(
                success=False,
                message="URL already saved",
                content_id=existing.data[0]["id"],
                title=existing.data[0]["title"],
                error="duplicate"
            )

        # === Branch A: caller provided title (e.g. ContentHub bridge) — skip external fetch ===
        if data and data.title:
            content_data = {
                "user_id": user_id,
                "url": url_str,
                "type": _infer_type_from_url(url_str),
                "title": data.title,
                "summary": data.summary,
                "user_tags": data.tags,
                "source_metadata": data.source_metadata or {},
                "metadata": {"saved_via": "quick_save_no_fetch"},
            }
            response = await db.table("contents").insert(content_data).execute()
            if not response.data:
                return QuickSaveResponse(
                    success=False,
                    message="Failed to save content",
                    error="database_error"
                )
            return QuickSaveResponse(
                success=True,
                message="URL saved!",
                content_id=response.data[0]["id"],
                title=data.title,
            )

        # === Branch B: legacy fetch path (bookmarklet, iOS Shortcut, manual UI) ===
        # Fetch content using ORIGINAL URL (yt-dlp needs full URL)
        # Apply timeout to prevent hanging on slow fetches
        fetch_result = None
        try:
            fetch_result = await asyncio.wait_for(
                fetcher_service.fetch(original_url),
                timeout=60.0  # 60 second timeout for video platforms
            )
        except asyncio.TimeoutError:
            logger.warning(f"Timeout fetching {original_url} — falling back to URL-only save")

        if fetch_result and fetch_result.success:
            content_data = {
                "user_id": user_id,
                "url": url_str,
                "type": fetch_result.type,
                "title": fetch_result.title,
                "metadata": {
                    **fetch_result.metadata,
                    "saved_via": "quick_save"
                },
                "user_tags": data.tags if data else [],
                "view_count": fetch_result.view_count,
                "description": fetch_result.description,
                "source_metadata": (data.source_metadata if data and data.source_metadata else {}),
            }
            inserted_title = fetch_result.title
        else:
            # Fetch failed (timeout or fetcher error) — save URL-only fallback so we don't drop the capture
            if fetch_result:
                logger.warning(f"Fetch failed for {original_url}: {fetch_result.error} — saving URL-only")
            content_data = {
                "user_id": user_id,
                "url": url_str,
                "type": _infer_type_from_url(url_str),
                "title": original_url,
                "user_tags": data.tags if data else [],
                "metadata": {"saved_via": "quick_save", "fetch_failed": True},
                "source_metadata": (data.source_metadata if data and data.source_metadata else {}),
            }
            inserted_title = original_url

        response = await db.table("contents").insert(content_data).execute()

        if not response.data:
            return QuickSaveResponse(
                success=False,
                message="Failed to save content",
                error="database_error"
            )

        return QuickSaveResponse(
            success=True,
            message="URL saved!",
            content_id=response.data[0]["id"],
            title=inserted_title,
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
        existing = await db.table("contents").select("id, title").eq("user_id", user_id).eq("url", url_str).execute()

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

        # Save without AI processing (instant save)
        content_data = {
            "user_id": user_id,
            "url": url_str,
            "type": fetch_result.type,
            "title": fetch_result.title,
            "metadata": {
                **fetch_result.metadata,
                "saved_via": "ios_shortcut_v2"
            },
            "user_tags": [],
            "view_count": fetch_result.view_count,
            "description": fetch_result.description,
        }

        response = await db.table("contents").insert(content_data).execute()

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
        # Verify JWT token and get user
        import jwt as pyjwt
        from app.core.config import settings

        try:
            payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            user_id = payload.get("sub")
            if not user_id:
                return HTMLResponse(
                    content="<html><body><h1>Error</h1><p>Invalid token. Please login again.</p></body></html>",
                    status_code=401
                )
        except Exception:
            return HTMLResponse(
                content="<html><body><h1>Error</h1><p>Invalid token. Please login again.</p></body></html>",
                status_code=401
            )

        existing = await db.table("contents").select("id, title").eq("user_id", user_id).eq("url", url).execute()

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

        # Fetch and save (AI pipeline removed — see CHANGELOG 2026-05-18)
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

        content_data = {
            "user_id": user_id,
            "url": url,
            "type": fetch_result.type,
            "title": fetch_result.title,
            "metadata": {
                **fetch_result.metadata,
                "saved_via": "ios_shortcut"
            },
            "user_tags": [],
            "view_count": fetch_result.view_count,
            "description": fetch_result.description,
        }

        response = await db.table("contents").insert(content_data).execute()

        if response.data:
            return HTMLResponse(content=f"""
<!DOCTYPE html>
<html>
<head><title>Saved!</title></head>
<body>
<h1>Saved Successfully!</h1>
<p><strong>{fetch_result.title}</strong></p>
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
