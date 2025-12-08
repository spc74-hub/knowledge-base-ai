"""
Common API dependencies.
"""
import hashlib
from typing import Annotated
from datetime import datetime
from fastapi import Depends, HTTPException, Header, status
from supabase import Client

from app.core.config import settings
from app.db.session import get_supabase_client


async def get_db() -> Client:
    """Get Supabase client with admin permissions for backend operations."""
    from app.db.session import get_supabase_admin_client
    return get_supabase_admin_client()


def _hash_api_key(key: str) -> str:
    """Hash an API key for comparison."""
    return hashlib.sha256(key.encode()).hexdigest()


async def _validate_api_key(api_key: str) -> dict | None:
    """
    Validate an API key and return user info if valid.
    Uses admin client to bypass RLS.
    """
    if not api_key or not api_key.startswith("kb_"):
        return None

    from app.db.session import get_supabase_admin_client
    key_hash = _hash_api_key(api_key)
    admin_db = get_supabase_admin_client()

    result = admin_db.table("user_api_keys").select(
        "id, user_id, is_active"
    ).eq("key_hash", key_hash).eq("is_active", True).execute()

    if not result.data:
        return None

    key_data = result.data[0]

    # Update last_used_at
    admin_db.table("user_api_keys").update({
        "last_used_at": datetime.utcnow().isoformat()
    }).eq("id", key_data["id"]).execute()

    return {"id": key_data["user_id"], "email": None, "via_api_key": True}


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> dict:
    """
    Verify token or API key and get current user.

    Supports:
    - Bearer JWT token (from Supabase auth)
    - API key in X-API-Key header
    - API key in Bearer token (for Shortcuts compatibility)

    Args:
        authorization: Bearer token from header
        x_api_key: API key from X-API-Key header

    Returns:
        User dict with id and email

    Raises:
        HTTPException: If authentication fails
    """
    # Try X-API-Key header first
    if x_api_key:
        user = await _validate_api_key(x_api_key)
        if user:
            return user

    # Try Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]

        # Check if it's an API key in Bearer format (kb_...)
        if token.startswith("kb_"):
            user = await _validate_api_key(token)
            if user:
                return user
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked API key",
            )

        # Otherwise treat as JWT token
        try:
            auth_client = get_supabase_client()
            user_response = auth_client.auth.get_user(token)

            if not user_response or not user_response.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                )

            return {
                "id": user_response.user.id,
                "email": user_response.user.email,
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authentication failed: {str(e)}",
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid authorization header",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user_optional(
    authorization: Annotated[str | None, Header()] = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> dict | None:
    """
    Get current user if authenticated, None otherwise.
    Useful for endpoints that work both authenticated and anonymously.
    """
    if not authorization and not x_api_key:
        return None

    try:
        return await get_current_user(authorization, x_api_key)
    except HTTPException:
        return None


# Type aliases for cleaner code
CurrentUser = Annotated[dict, Depends(get_current_user)]
OptionalUser = Annotated[dict | None, Depends(get_current_user_optional)]
Database = Annotated[Client, Depends(get_db)]
