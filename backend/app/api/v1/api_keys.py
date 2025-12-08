"""
API Keys management for permanent authentication tokens.
Used by iOS Shortcuts, bookmarklets, and other integrations.
"""
import secrets
import hashlib
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Header, Depends
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser
from app.db.session import get_supabase_admin_client

router = APIRouter()


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.
    Returns: (full_key, key_hash, key_prefix)
    """
    # Generate 32 random bytes = 64 hex chars
    random_part = secrets.token_hex(32)
    full_key = f"kb_{random_part}"  # kb_ prefix for identification
    key_prefix = full_key[:11]  # kb_ + first 8 chars
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, key_hash, key_prefix


def hash_api_key(key: str) -> str:
    """Hash an API key for comparison."""
    return hashlib.sha256(key.encode()).hexdigest()


class APIKeyCreate(BaseModel):
    name: str = "Default API Key"


class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    created_at: str
    last_used_at: Optional[str] = None
    is_active: bool


class APIKeyCreated(BaseModel):
    id: str
    name: str
    key: str  # Only returned on creation!
    key_prefix: str
    message: str


@router.post("/", response_model=APIKeyCreated)
async def create_api_key(
    current_user: CurrentUser,
    db: Database,
    data: APIKeyCreate = APIKeyCreate()
):
    """
    Create a new API key for the current user.
    The full key is only shown once - save it immediately!
    """
    user_id = current_user["id"]

    # Check existing active keys (limit to 5 per user)
    existing = db.table("user_api_keys").select("id").eq(
        "user_id", user_id
    ).eq("is_active", True).execute()

    if len(existing.data or []) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 5 active API keys allowed. Revoke an existing key first."
        )

    # Generate new key
    full_key, key_hash, key_prefix = generate_api_key()

    # Save to database
    result = db.table("user_api_keys").insert({
        "user_id": user_id,
        "name": data.name,
        "key_hash": key_hash,
        "key_prefix": key_prefix
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create API key"
        )

    return APIKeyCreated(
        id=result.data[0]["id"],
        name=data.name,
        key=full_key,
        key_prefix=key_prefix,
        message="Save this key now! It won't be shown again."
    )


@router.get("/", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: CurrentUser,
    db: Database
):
    """List all API keys for the current user."""
    result = db.table("user_api_keys").select(
        "id, name, key_prefix, created_at, last_used_at, is_active"
    ).eq("user_id", current_user["id"]).order("created_at", desc=True).execute()

    return [
        APIKeyResponse(
            id=key["id"],
            name=key["name"],
            key_prefix=key["key_prefix"],
            created_at=key["created_at"],
            last_used_at=key.get("last_used_at"),
            is_active=key["is_active"]
        )
        for key in (result.data or [])
    ]


@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: CurrentUser,
    db: Database
):
    """Revoke an API key."""
    result = db.table("user_api_keys").update({
        "is_active": False,
        "revoked_at": datetime.utcnow().isoformat()
    }).eq("id", key_id).eq("user_id", current_user["id"]).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    return {"success": True, "message": "API key revoked"}


async def validate_api_key(api_key: str) -> Optional[dict]:
    """
    Validate an API key and return user info if valid.
    Uses admin client to bypass RLS.
    """
    if not api_key or not api_key.startswith("kb_"):
        return None

    key_hash = hash_api_key(api_key)
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

    return {"id": key_data["user_id"]}


async def get_user_from_api_key_or_token(
    authorization: str = Header(None),
    x_api_key: str = Header(None, alias="X-API-Key")
) -> Optional[dict]:
    """
    Get user from either API key (X-API-Key header) or Bearer token.
    API key takes precedence if both are provided.
    """
    # Try API key first
    if x_api_key:
        user = await validate_api_key(x_api_key)
        if user:
            return user

    # Try Bearer token in Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        # Check if it's an API key in Bearer format
        if token.startswith("kb_"):
            user = await validate_api_key(token)
            if user:
                return user

    return None
