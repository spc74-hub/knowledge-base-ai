"""
Database session configuration.
"""
from supabase import create_client, Client
from app.core.config import settings

_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    """
    Get Supabase client instance (singleton).
    """
    global _supabase_client

    if _supabase_client is None:
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY
        )

    return _supabase_client


def get_supabase_admin_client() -> Client:
    """
    Get Supabase client with service role (admin) permissions.
    Use only for operations that require bypassing RLS.
    """
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_KEY
    )
