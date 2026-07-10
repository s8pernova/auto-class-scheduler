"""
FastAPI dependency injection.
"""

from __future__ import annotations

from typing import Annotated, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis

from backend.config import get_settings
from supabase import Client, ClientOptions, create_client

security = HTTPBearer(auto_error=False)


def get_supabase(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Client:
    """Dependency that provides a per-request Supabase client."""
    settings = get_settings()

    if credentials:
        options = ClientOptions(
            headers={"Authorization": f"Bearer {credentials.credentials}"}
        )
        return create_client(
            settings.supabase_url, settings.supabase_publishable_key, options=options
        )

    return create_client(settings.supabase_url, settings.supabase_publishable_key)


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


def get_required_current_user_id(
    user_id: Optional[UUID] = Depends(get_current_user_id),
) -> UUID:
    """Require a valid authenticated or anonymous Supabase user."""
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user_id


def get_redis_client(request: Request) -> Redis:
    """Provide the shared Redis client owned by the application lifespan."""
    return request.app.state.redis


# Type aliases for route signatures.
SupabaseDep = Annotated[Client, Depends(get_supabase)]
UserIdDep = Annotated[Optional[UUID], Depends(get_current_user_id)]
RequiredUserIdDep = Annotated[UUID, Depends(get_required_current_user_id)]
RedisDep = Annotated[Redis, Depends(get_redis_client)]
