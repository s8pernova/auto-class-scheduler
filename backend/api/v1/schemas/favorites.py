"""Favorite-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class FavoriteResponse(BaseModel):
    """Response returned when favoriting a schedule."""

    schedule_id: int
    favorited_at: datetime
    message: str = "Schedule favorited successfully"
