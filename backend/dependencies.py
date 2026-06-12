"""
FastAPI dependency injection.
"""

from __future__ import annotations

from typing import Annotated, Optional
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.config import get_settings
from supabase import Client, ClientOptions, create_client

security = HTTPBearer(auto_error=False)


def get_supabase(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Client:
    """FastAPI dependency - provides a per-request Supabase client."""
    s = get_settings()

    if credentials:
        options = ClientOptions(
            headers={"Authorization": f"Bearer {credentials.credentials}"}
        )
        return create_client(s.supabase_url, s.supabase_publishable_key, options=options)

    return create_client(s.supabase_url, s.supabase_publishable_key)


def get_current_user_id(
    client: Client = Depends(get_supabase),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[UUID]:
    """Dependency that extracts the current user's UUID from the JWT."""
    if not credentials:
        return None
    try:
        user_resp = client.auth.get_user(credentials.credentials)
        if user_resp and user_resp.user:
            return UUID(user_resp.user.id)
    except Exception:
        # Invalid token, expired, etc.
        return None
    return None


# Type aliases for route signatures.
SupabaseDep = Annotated[Client, Depends(get_supabase)]
UserIdDep = Annotated[Optional[UUID], Depends(get_current_user_id)]
