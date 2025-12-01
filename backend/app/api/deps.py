"""
Common API dependencies.
"""
from typing import Annotated
from fastapi import Depends, HTTPException, Header, status
from supabase import Client

from app.core.config import settings
from app.db.session import get_supabase_client


async def get_db() -> Client:
    """Get Supabase client with admin permissions for backend operations."""
    from app.db.session import get_supabase_admin_client
    return get_supabase_admin_client()


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    """
    Verify token and get current user.

    Args:
        authorization: Bearer token from header

    Returns:
        User dict with id and email

    Raises:
        HTTPException: If token is invalid or missing
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ")[1]

    try:
        # Use regular client for auth verification
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

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )


async def get_current_user_optional(
    authorization: Annotated[str | None, Header()] = None,
) -> dict | None:
    """
    Get current user if authenticated, None otherwise.
    Useful for endpoints that work both authenticated and anonymously.
    """
    if not authorization:
        return None

    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None


# Type aliases for cleaner code
CurrentUser = Annotated[dict, Depends(get_current_user)]
OptionalUser = Annotated[dict | None, Depends(get_current_user_optional)]
Database = Annotated[Client, Depends(get_db)]
