"""Favorite-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FavoriteResponse(BaseModel):
    """Response returned when favoriting a schedule."""

    catalog_id: UUID
    schedule_id: str
    favorited_at: datetime
    message: str = "Schedule favorited successfully"
