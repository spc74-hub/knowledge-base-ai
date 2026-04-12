"""
Authentication endpoints.
JWT-based auth replacing Supabase auth.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from app.api.deps import Database, CurrentUser
from app.core.config import settings

router = APIRouter()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _create_token(user_id: str, email: str) -> dict:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": expires,
    }
    access_token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    # Refresh token (longer lived)
    refresh_payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(days=30),
        "type": "refresh",
    }
    refresh_token = jwt.encode(refresh_payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": int(expires.timestamp()),
    }


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user: dict
    session: dict


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: Database):
    """Register a new user."""
    try:
        # Check if user already exists
        existing = await db.table("users").select("id").eq("email", data.email).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists"
            )

        # Create user
        password_hash = _hash_password(data.password)
        result = await db.table("users").insert({
            "email": data.email,
            "password_hash": password_hash,
            "name": data.name,
        }).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )

        user = result.data[0]
        session = _create_token(user["id"], data.email)

        return {
            "user": {
                "id": user["id"],
                "email": data.email,
                "name": data.name,
                "created_at": user.get("created_at"),
            },
            "session": session,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest, db: Database):
    """Login with email and password."""
    try:
        result = await db.table("users").select("*").eq("email", data.email).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        user = result.data[0]

        if not _verify_password(data.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        session = _create_token(user["id"], user["email"])

        return {
            "user": {
                "id": user["id"],
                "email": user["email"],
            },
            "session": session,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )


@router.post("/logout")
async def logout(current_user: CurrentUser):
    """Logout current user (client-side token removal)."""
    return {"message": "Logged out successfully"}


@router.post("/refresh")
async def refresh_token(data: RefreshRequest):
    """Refresh access token."""
    try:
        payload = jwt.decode(
            data.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        user_id = payload.get("sub")
        email = payload.get("email")

        tokens = _create_token(user_id, email)

        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "expires_at": tokens["expires_at"],
        }

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.get("/me")
async def get_current_user_info(current_user: CurrentUser):
    """Get current user information."""
    return {
        "id": current_user["id"],
        "email": current_user.get("email"),
    }
