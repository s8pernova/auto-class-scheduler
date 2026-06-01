"""Favorite routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from backend.api.v1.schemas.favorites import (
    FavoriteGeneratedScheduleRequest,
    FavoriteResponse,
)
from backend.api.v1.services import favorites as fav_service
from backend.api.v1.services import schedules as schedule_service
from backend.dependencies import SupabaseDep, UserIdDep

router = APIRouter(prefix="/favorites", tags=["favorites"])


def _require_user(user_id: UserIdDep) -> UserIdDep:
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to manage favorites",
        )
    return user_id


@router.get("", response_model=list[int])
async def get_favorites(client: SupabaseDep, user_id: UserIdDep) -> list[int]:
    """Return all favorited saved schedule IDs for the current user."""
    current_user_id = _require_user(user_id)
    return fav_service.list_favorite_ids(client, user_id=current_user_id)


@router.post("", response_model=FavoriteResponse, status_code=201)
async def favorite_generated_schedule(
    payload: FavoriteGeneratedScheduleRequest,
    client: SupabaseDep,
    user_id: UserIdDep,
) -> FavoriteResponse:
    """Persist one generated schedule result and favorite it."""
    current_user_id = _require_user(user_id)
    try:
        return fav_service.save_and_favorite_generated_schedule(
            client,
            payload,
            user_id=current_user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/{schedule_id}", response_model=FavoriteResponse)
async def favorite_schedule(
    schedule_id: int,
    client: SupabaseDep,
    user_id: UserIdDep,
) -> FavoriteResponse:
    """Favorite an already-saved schedule."""
    current_user_id = _require_user(user_id)
    if not schedule_service.get_schedule_exists(client, schedule_id):
        raise HTTPException(
            status_code=404,
            detail=f"Schedule {schedule_id} not found",
        )
    return fav_service.create_favorite(
        client,
        schedule_id,
        user_id=current_user_id,
    )


@router.delete("/{schedule_id}")
async def unfavorite_schedule(
    schedule_id: int,
    client: SupabaseDep,
    user_id: UserIdDep,
) -> dict:
    """Remove a schedule from the current user's favorites."""
    current_user_id = _require_user(user_id)
    if not fav_service.delete_favorite(client, schedule_id, user_id=current_user_id):
        raise HTTPException(
            status_code=404,
            detail=f"Schedule {schedule_id} is not favorited",
        )
    return {"schedule_id": schedule_id, "message": "Unfavorited successfully"}
