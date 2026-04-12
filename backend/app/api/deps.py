"""
Common API dependencies.
Migrated from Supabase auth to JWT-based auth with SQLAlchemy.
"""
import hashlib
from typing import Annotated
from datetime import datetime, timezone

import jwt
from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.db.session import get_db
from app.db.compat import CompatDB


async def get_compat_db(session: AsyncSession = Depends(get_db)) -> CompatDB:
    """Get a Supabase-compatible DB wrapper."""
    return CompatDB(session)


def _hash_api_key(key: str) -> str:
    """Hash an API key for comparison."""
    return hashlib.sha256(key.encode()).hexdigest()


async def _validate_api_key(api_key: str, db: CompatDB) -> dict | None:
    """Validate an API key and return user info if valid."""
    if not api_key or not api_key.startswith("kb_"):
        return None

    key_hash = _hash_api_key(api_key)

    result = await db.table("user_api_keys").select(
        "id, user_id, is_active"
    ).eq("key_hash", key_hash).eq("is_active", True).execute()

    if not result.data:
        return None

    key_data = result.data[0]

    # Update last_used_at
    await db.table("user_api_keys").update({
        "last_used_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", key_data["id"]).execute()

    return {"id": key_data["user_id"], "email": None, "via_api_key": True}


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
    db: CompatDB = Depends(get_compat_db),
) -> dict:
    """
    Verify JWT token or API key and get current user.

    Supports:
    - Bearer JWT token
    - API key in X-API-Key header
    - API key in Bearer token (for Shortcuts compatibility)
    """
    # Try X-API-Key header first
    if x_api_key:
        user = await _validate_api_key(x_api_key, db)
        if user:
            return user

    # Try Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]

        # Check if it's an API key in Bearer format (kb_...)
        if token.startswith("kb_"):
            user = await _validate_api_key(token, db)
            if user:
                return user
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked API key",
            )

        # Otherwise treat as JWT token
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            user_id = payload.get("sub")
            email = payload.get("email")

            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload",
                )

            return {
                "id": user_id,
                "email": email,
            }

        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}",
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid authorization header",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user_optional(
    authorization: Annotated[str | None, Header()] = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
    db: CompatDB = Depends(get_compat_db),
) -> dict | None:
    """Get current user if authenticated, None otherwise."""
    if not authorization and not x_api_key:
        return None
    try:
        return await get_current_user(authorization, x_api_key, db)
    except HTTPException:
        return None


# Type aliases for cleaner code
CurrentUser = Annotated[dict, Depends(get_current_user)]
OptionalUser = Annotated[dict | None, Depends(get_current_user_optional)]
Database = Annotated[CompatDB, Depends(get_compat_db)]
