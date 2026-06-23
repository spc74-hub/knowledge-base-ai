"""
Application configuration using Pydantic Settings.
Migrated from Supabase to self-hosted PostgreSQL.
"""
from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    # Application
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24 * 7  # 7 days

    # Cloudflare Access auto-login (Option B). When CF_ACCESS_AUD is set, the
    # /api/cf-access endpoint trades a verified CF Access identity for a kbia JWT
    # (no password). AUD comes from the Cloudflare app's "AUD tag".
    CF_ACCESS_TEAM_DOMAIN: str = "https://spcapps.cloudflareaccess.com"
    CF_ACCESS_AUD: Optional[str] = None
    # Use "*" to allow bookmarklet from any origin
    ALLOWED_ORIGINS: List[str] = ["*"]

    # Database (PostgreSQL with asyncpg)
    DATABASE_URL: str = "postgresql+asyncpg://spcadmin:PASSWORD@spcapps-postgres:5432/kbia"

    # Claude API
    ANTHROPIC_API_KEY: str = ""

    # OpenAI API
    OPENAI_API_KEY: str = ""

    # Redis (optional)
    REDIS_URL: str = "redis://localhost:6379"

    # Google Drive API (optional)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/google-drive/callback"

    class Config:
        env_file = ".env"


settings = Settings()
