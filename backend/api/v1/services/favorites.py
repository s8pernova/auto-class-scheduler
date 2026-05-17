"""
Favorites service — Supabase edition.
"""

from __future__ import annotations

from backend.api.v1.schemas.favorites import FavoriteResponse
from supabase import Client


def list_favorite_ids(client: Client) -> list[int]:
    """Return all favorited schedule IDs (most recent first)."""
    resp = (
        client.table("favorites")
        .select("schedule_id")
        .order("favorited_at", desc=True)
        .execute()
    )
    return [row["schedule_id"] for row in resp.data]


def create_favorite(client: Client, schedule_id: int) -> FavoriteResponse:
    """Upsert a favorite and return the persisted row."""
    resp = (
        client.table("favorites")
        .upsert(
            {"schedule_id": schedule_id},
            on_conflict="schedule_id",
        )
        .execute()
    )
    row = resp.data[0]
    return FavoriteResponse(
        schedule_id=row["schedule_id"],
        favorited_at=row["favorited_at"],
    )


def delete_favorite(client: Client, schedule_id: int) -> bool:
    """Remove a favorite.  Returns ``True`` if a row was deleted."""
    resp = client.table("favorites").delete().eq("schedule_id", schedule_id).execute()
    return len(resp.data) > 0
