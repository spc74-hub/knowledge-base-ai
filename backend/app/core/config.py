"""
Application configuration using Pydantic Settings.
"""
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Application
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    # Use "*" to allow bookmarklet from any origin
    ALLOWED_ORIGINS: List[str] = ["*"]

    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: str

    # Claude API
    ANTHROPIC_API_KEY: str

    # OpenAI API
    OPENAI_API_KEY: str

    # Redis (optional)
    REDIS_URL: str = "redis://localhost:6379"

    # Google Drive API (optional)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/google-drive/callback"

    class Config:
        env_file = ".env"

settings = Settings()
