"""
FastAPI dependency injection.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from backend.config import Settings
from supabase import Client, create_client


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


@lru_cache(maxsize=1)
def _create_supabase_client() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_key)


def get_supabase() -> Client:
    """FastAPI dependency — provides the Supabase client."""
    return _create_supabase_client()


# Type aliases for route signatures.
SupabaseDep = Annotated[Client, Depends(get_supabase)]
