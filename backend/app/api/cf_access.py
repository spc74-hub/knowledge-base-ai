"""
Cloudflare Access auto-login (Option B).

Trades a Cloudflare Access identity for a kbia JWT, so the frontend can skip the
password login once Access has already authenticated the user (email code).

Security: this is ONLY safe because it verifies the *signed* assertion that
Cloudflare injects (`Cf-Access-Jwt-Assertion`) against the team's public keys and
checks the `aud` matches THIS app — so a client can't forge it. It must live
OUTSIDE the bypassed `/api/v1` path (mounted at `/api/cf-access`), otherwise
Cloudflare would not inject the assertion header.
"""
import jwt
from jwt import PyJWKClient
from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import Database
from app.api.v1.auth import _create_token
from app.core.config import settings

router = APIRouter()

# Lazy JWKS client (fetches + caches Cloudflare's public keys on first use).
_jwks_client = (
    PyJWKClient(f"{settings.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs")
    if settings.CF_ACCESS_AUD
    else None
)


@router.post("/cf-access")
async def cf_access_login(request: Request, db: Database):
    """Issue a kbia session from a verified Cloudflare Access identity (no password)."""
    if not settings.CF_ACCESS_AUD or _jwks_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloudflare Access login not configured",
        )

    assertion = request.headers.get("Cf-Access-Jwt-Assertion")
    if not assertion:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No Cloudflare Access assertion present",
        )

    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(assertion)
        claims = jwt.decode(
            assertion,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.CF_ACCESS_AUD,
            issuer=settings.CF_ACCESS_TEAM_DOMAIN,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Cloudflare Access assertion",
        )

    email = claims.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cloudflare Access assertion has no email",
        )

    result = await db.table("users").select("*").eq("email", email).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No kbia account for this identity",
        )

    user = result.data[0]
    session = _create_token(user["id"], user["email"])
    return {
        "user": {"id": user["id"], "email": user["email"]},
        "session": session,
    }
