"""
Top-level API router.

Mounts all versioned sub-routers.  Add future versions here (v2, v3, …).
"""

from fastapi import APIRouter

from backend.api.v1.router import router as v1_router

router = APIRouter()

router.include_router(v1_router)
