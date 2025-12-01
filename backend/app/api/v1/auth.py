"""
Authentication endpoints.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.api.deps import Database, CurrentUser

router = APIRouter()


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
    """
    Register a new user.
    """
    try:
        response = db.auth.sign_up({
            "email": data.email,
            "password": data.password,
            "options": {
                "data": {
                    "name": data.name
                }
            }
        })

        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration failed"
            )

        return {
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "name": data.name,
                "created_at": response.user.created_at
            },
            "session": {
                "access_token": response.session.access_token if response.session else None,
                "refresh_token": response.session.refresh_token if response.session else None,
                "expires_at": response.session.expires_at if response.session else None
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest, db: Database):
    """
    Login with email and password.
    """
    try:
        response = db.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })

        if not response.user or not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        return {
            "user": {
                "id": response.user.id,
                "email": response.user.email
            },
            "session": {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "expires_at": response.session.expires_at
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )


@router.post("/logout")
async def logout(current_user: CurrentUser, db: Database):
    """
    Logout current user.
    """
    try:
        db.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/refresh")
async def refresh_token(data: RefreshRequest, db: Database):
    """
    Refresh access token.
    """
    try:
        response = db.auth.refresh_session(data.refresh_token)

        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "expires_at": response.session.expires_at
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.get("/me")
async def get_current_user_info(current_user: CurrentUser):
    """
    Get current user information.
    """
    return {
        "id": current_user["id"],
        "email": current_user["email"]
    }
