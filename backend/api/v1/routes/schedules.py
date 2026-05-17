"""Schedule routes."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from backend.api.v1.schemas.schedules import ScheduleSummaryResponse
from backend.api.v1.services import schedules as schedule_service
from backend.dependencies import SupabaseDep

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("", response_model=list[ScheduleSummaryResponse])
async def get_schedules(
    client: SupabaseDep,
    favorites_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    campuses: Optional[list[str]] = Query(None),
    times: Optional[list[str]] = Query(None),
) -> list[ScheduleSummaryResponse]:
    """Return a paginated list of schedules with full section details.

    Query params:
        favorites_only: Only return favorited schedules.
        limit / offset: Pagination.
        campuses: Filter by campus (``Annandale``, ``Alexandria``, ``Online``).
        times: Filter by time-of-day (``Morning``, ``Afternoon``, ``Evening``).
    """
    return schedule_service.list_schedules(
        client,
        favorites_only=favorites_only,
        limit=limit,
        offset=offset,
        campuses=campuses,
        times=times,
    )
