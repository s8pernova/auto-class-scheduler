"""Schedule routes."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from backend.api.v1.schemas.schedules import (
    ScheduleGenerateRequest,
    ScheduleGenerateResponse,
    ScheduleGenerationSessionQueryRequest,
    ScheduleLimitsResponse,
    ScheduleSummaryResponse,
)
from backend.api.v1.services import schedules as schedule_service
from backend.config import get_settings
from backend.dependencies import RedisDep, SupabaseDep, UserIdDep

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.post("/generate", response_model=ScheduleGenerateResponse)
async def generate_schedules(
    payload: ScheduleGenerateRequest,
    client: SupabaseDep,
    redis: RedisDep,
    user_id: UserIdDep,
) -> ScheduleGenerateResponse:
    """Generate transient schedules from saved catalog candidate sections."""
    try:
        return await schedule_service.generate_schedules_from_request(
            client,
            redis,
            payload,
            user_id=user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/generation-sessions/{session_id}/query",
    response_model=ScheduleGenerateResponse,
)
async def query_generation_session(
    session_id: str,
    payload: ScheduleGenerationSessionQueryRequest,
    client: SupabaseDep,
    redis: RedisDep,
) -> ScheduleGenerateResponse:
    """Filter, sort, and page an existing generated-schedule session."""
    try:
        return await schedule_service.query_generated_schedule_session(
            client,
            redis,
            session_id=session_id,
            payload=payload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(
            status_code=404, detail="Generation session expired"
        ) from exc


@router.get("/limits", response_model=ScheduleLimitsResponse)
async def get_schedule_limits() -> ScheduleLimitsResponse:
    """Return public scheduler limits for frontend validation."""
    settings = get_settings()
    return ScheduleLimitsResponse(
        max_candidate_combinations=settings.max_candidate_combinations,
        max_results=settings.max_results,
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
    favorites_only: bool = False,
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
    return schedule_service.list_schedules(
        client,
        favorites_only=favorites_only,
        limit=limit,
        offset=offset,
        campus_patterns=campus_patterns,
        times=times,
    )
