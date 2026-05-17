"""Favorite routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.api.v1.schemas.favorites import FavoriteResponse
from backend.api.v1.services import favorites as fav_service
from backend.api.v1.services import schedules as schedule_service
from backend.dependencies import SupabaseDep

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[int])
async def get_favorites(client: SupabaseDep) -> list[int]:
    """Return all favorited schedule IDs."""
    return fav_service.list_favorite_ids(client)


@router.post("/{schedule_id}", response_model=FavoriteResponse)
async def favorite_schedule(
    schedule_id: int,
    client: SupabaseDep,
) -> FavoriteResponse:
    """Favorite a schedule (idempotent - re-favoriting refreshes the timestamp)."""
    if not schedule_service.get_schedule_exists(client, schedule_id):
        raise HTTPException(
            status_code=404,
            detail=f"Schedule {schedule_id} not found",
        )
    return fav_service.create_favorite(client, schedule_id)


@router.delete("/{schedule_id}")
async def unfavorite_schedule(
    schedule_id: int,
    client: SupabaseDep,
) -> dict:
    """Remove a schedule from favorites."""
    if not fav_service.delete_favorite(client, schedule_id):
        raise HTTPException(
            status_code=404,
            detail=f"Schedule {schedule_id} is not favorited",
        )
    return {"schedule_id": schedule_id, "message": "Unfavorited successfully"}
