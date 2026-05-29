"""Catalog routes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from backend.api.v1.schemas.catalogs import (
    CatalogCreate,
    CatalogResponse,
    CatalogSectionResponse,
    CatalogSectionsReplaceRequest,
)
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
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to create a catalog",
        )

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


@router.get("/{catalog_id}/sections", response_model=list[CatalogSectionResponse])
async def list_catalog_sections(
    catalog_id: UUID,
    client: SupabaseDep,
) -> list[CatalogSectionResponse]:
    """Fetch normalized candidate sections for a catalog."""
    catalog = catalog_service.get_catalog(client, catalog_id)
    if catalog is None:
        raise HTTPException(status_code=404, detail="Catalog not found")

    return catalog_service.list_catalog_sections(client, catalog_id)


@router.put("/{catalog_id}/sections", response_model=list[CatalogSectionResponse])
async def replace_catalog_sections(
    catalog_id: UUID,
    payload: CatalogSectionsReplaceRequest,
    client: SupabaseDep,
    user_id: UserIdDep,
) -> list[CatalogSectionResponse]:
    """Replace all normalized candidate sections for a catalog."""
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to update catalog sections",
        )

    catalog = catalog_service.get_catalog(client, catalog_id)
    if catalog is None:
        raise HTTPException(status_code=404, detail="Catalog not found")
    if catalog.source_type == "demo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo catalogs cannot be modified",
        )

    return catalog_service.replace_catalog_sections(client, catalog_id, payload)
