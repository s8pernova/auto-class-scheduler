"""
v1 API router.

Aggregates all v1 route modules under a single ``/api/v1`` prefix.
"""

from fastapi import APIRouter

from backend.api.v1.routes.catalogs import router as catalogs_router
from backend.api.v1.routes.favorites import router as favorites_router
from backend.api.v1.routes.generation_sessions import (
    router as generation_sessions_router,
)
from backend.api.v1.routes.health import router as health_router
from backend.api.v1.routes.schedules import router as schedules_router

router = APIRouter(prefix="/api/v1")

router.include_router(health_router)
router.include_router(catalogs_router)
router.include_router(generation_sessions_router)
router.include_router(schedules_router)
router.include_router(favorites_router)
