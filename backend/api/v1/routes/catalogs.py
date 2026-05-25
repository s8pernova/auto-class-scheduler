"""Catalog routes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException

from backend.api.v1.schemas.catalogs import CatalogCreate, CatalogResponse
from backend.api.v1.services import catalogs as catalog_service
from backend.dependencies import SupabaseDep, UserIdDep

router = APIRouter(prefix="/catalogs", tags=["catalogs"])


@router.post("", response_model=CatalogResponse, status_code=201)
async def create_catalog(
    payload: CatalogCreate,
    client: SupabaseDep,
    user_id: UserIdDep,
) -> CatalogResponse:
    """Create a new catalog."""
    return catalog_service.create_catalog(client, payload, user_id=user_id)


@router.get("/{catalog_id}", response_model=CatalogResponse)
async def get_catalog(
    catalog_id: UUID,
    client: SupabaseDep,
) -> CatalogResponse:
    """Fetch a catalog by ID."""
    catalog = catalog_service.get_catalog(client, catalog_id)
    if catalog is None:
        raise HTTPException(status_code=404, detail="Catalog not found")
    return catalog
