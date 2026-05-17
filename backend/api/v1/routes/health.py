"""Health-check route."""

from fastapi import APIRouter

from backend.api.v1.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Lightweight liveness probe."""
    return HealthResponse(status="ok")
