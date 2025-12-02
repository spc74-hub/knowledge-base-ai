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
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
    ]

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

    class Config:
        env_file = ".env"

settings = Settings()
