"""Schedule routes."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from backend.api.v1.schemas.schedules import (
    ScheduleLimitsResponse,
    ScheduleSummaryResponse,
)
from backend.api.v1.services import schedules as schedule_service
from backend.config import get_settings
from backend.dependencies import SupabaseDep, UserIdDep

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("/limits", response_model=ScheduleLimitsResponse)
async def get_schedule_limits() -> ScheduleLimitsResponse:
    """Return public scheduler limits for frontend validation."""
    settings = get_settings()
    return ScheduleLimitsResponse(
        max_candidate_combinations=settings.max_candidate_combinations,
        max_catalog_courses=settings.max_catalog_courses,
        max_catalog_sections=settings.max_catalog_sections,
        max_sections_per_course=settings.max_sections_per_course,
        max_source_metadata_bytes_per_section=settings.max_source_metadata_bytes_per_section,
        max_blocked_times=settings.max_blocked_times,
        max_instructor_ratings=settings.max_instructor_ratings,
    )


@router.get("", response_model=list[ScheduleSummaryResponse])
async def get_schedules(
    client: SupabaseDep,
    user_id: UserIdDep,
    favorites_only: bool = False,
    catalog_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
    campus_patterns: Optional[list[str]] = Query(None, alias="campusPatterns"),
    times: Optional[list[str]] = Query(None),
) -> list[ScheduleSummaryResponse]:
    """Return a paginated list of schedules with full section details.

    Query params:
        favorites_only: Only return favorited schedules.
        limit / offset: Pagination.
        campus_patterns: Filter by saved campus pattern.
        times: Filter by time-of-day (``Morning``, ``Afternoon``, ``Evening``).
    """
    favorite_user_id: UUID | None = None
    if favorites_only:
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to view favorites",
            )
        if catalog_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="catalog_id is required to view favorites",
            )
        favorite_user_id = user_id

    return schedule_service.list_schedules(
        client,
        favorites_only=favorites_only,
        user_id=favorite_user_id,
        catalog_id=catalog_id,
        limit=limit,
        offset=offset,
        campus_patterns=campus_patterns,
        times=times,
    )
