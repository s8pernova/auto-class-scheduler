"""Favorite-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(field_name: str) -> str:
    parts = field_name.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class FavoriteGeneratedScheduleRequest(_CamelModel):
    """Request to save and favorite one generated schedule result."""

    catalog_id: UUID
    catalog_section_ids: list[UUID] = Field(..., min_length=1)


class FavoriteResponse(_CamelModel):
    """Response returned when favoriting a schedule."""

    schedule_id: int
    favorited_at: datetime
    catalog_id: UUID | None = None
    message: str = "Schedule favorited successfully"
