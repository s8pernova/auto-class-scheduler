"""Transient schedule-generation session routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from backend.api.v1.schemas.schedules import (
    ScheduleGenerationSessionCreateRequest,
    ScheduleGenerationSessionQueryRequest,
    ScheduleGenerationSessionResponse,
)
from backend.api.v1.services import schedules as schedule_service
from backend.cache.store import GenerationSessionCacheMissError
from backend.dependencies import RedisDep, RequiredUserIdDep, SupabaseDep

router = APIRouter(
    prefix="/schedule-generation-sessions",
    tags=["schedule-generation-sessions"],
)


@router.post(
    "",
    response_model=ScheduleGenerationSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_generation_session(
    payload: ScheduleGenerationSessionCreateRequest,
    client: SupabaseDep,
    redis: RedisDep,
    user_id: RequiredUserIdDep,
) -> ScheduleGenerationSessionResponse:
    """Create or reuse a generated-schedule session and return its first page."""
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
    "/{session_id}/results",
    response_model=ScheduleGenerationSessionResponse,
)
async def query_generation_session_results(
    session_id: str,
    payload: ScheduleGenerationSessionQueryRequest,
    client: SupabaseDep,
    redis: RedisDep,
    user_id: RequiredUserIdDep,
) -> ScheduleGenerationSessionResponse:
    """Filter, sort, and page an owned generated-schedule session."""
    try:
        return await schedule_service.query_generated_schedule_session(
            client,
            redis,
            session_id=session_id,
            payload=payload,
            user_id=user_id,
        )
    except schedule_service.GenerationSessionAccessDeniedError as exc:
        raise HTTPException(status_code=404, detail="Generation session not found") from exc
    except GenerationSessionCacheMissError as exc:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail={
                "code": "generation_session_expired",
                "message": "Generation session expired; regenerate schedules to continue",
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
