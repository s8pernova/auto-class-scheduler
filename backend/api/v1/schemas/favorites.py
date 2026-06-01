"""Favorite-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from backend.api.v1.schemas.base import CamelModel


class FavoriteGeneratedScheduleRequest(CamelModel):
    """Request to save and favorite one generated schedule result."""

    catalog_id: UUID
    catalog_section_ids: list[UUID] = Field(..., min_length=1)


class FavoriteResponse(CamelModel):
    """Response returned when favoriting a schedule."""

    schedule_id: int
    favorited_at: datetime
    catalog_id: UUID | None = None
    message: str = "Schedule favorited successfully"
