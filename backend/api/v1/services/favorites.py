"""
Favorites service - Supabase edition.
"""

from __future__ import annotations

from backend.api.v1.schemas.favorites import FavoriteResponse
from supabase import Client


def list_favorite_ids(client: Client) -> list[int]:
    """Return all favorited schedule IDs (most recent first)."""
    resp = (
        client.table("user_favorites")
        .select("schedule_id")
        .order("favorited_at", desc=True)
        .execute()
    )
    return [row["schedule_id"] for row in resp.data]


def create_favorite(client: Client, schedule_id: int) -> FavoriteResponse:
    """Upsert a favorite and return the persisted row."""
    # Retrieve user ID to resolve conflict targeting and unique constraint
    user_resp = client.auth.get_user()
    user_id = user_resp.user.id if user_resp and user_resp.user else None

    resp = (
        client.table("user_favorites")
        .upsert(
            {"schedule_id": schedule_id, "user_id": user_id},
            on_conflict="user_id,schedule_id",
        )
        .execute()
    )
    row = resp.data[0]
    return FavoriteResponse(
        schedule_id=row["schedule_id"],
        favorited_at=row["favorited_at"],
    )


def delete_favorite(client: Client, schedule_id: int) -> bool:
    """Remove a favorite. Returns ``True`` if a row was deleted."""
    resp = client.table("user_favorites").delete().eq("schedule_id", schedule_id).execute()
    return len(resp.data) > 0
