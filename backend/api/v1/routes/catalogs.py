"""Catalog routes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from backend.api.v1.schemas.catalogs import (
    CatalogCreate,
    CatalogForkRequest,
    CatalogInstructorPreferencesReplaceRequest,
    CatalogInstructorPreferencesResponse,
    CatalogResponse,
    CatalogSectionResponse,
    CatalogSectionsReplaceRequest,
)
from backend.api.v1.services import catalogs as catalog_service
from backend.dependencies import SupabaseDep, UserIdDep

router = APIRouter(prefix="/catalogs", tags=["catalogs"])


def _require_user(user_id: UserIdDep) -> UUID:
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user_id


@router.post("", response_model=CatalogResponse, status_code=201)
async def create_catalog(
    payload: CatalogCreate,
    client: SupabaseDep,
    user_id: UserIdDep,
) -> CatalogResponse:
    """Create a new catalog."""
    current_user_id = _require_user(user_id)
    return catalog_service.create_catalog(client, payload, user_id=current_user_id)


@router.get("/shared/{share_slug}", response_model=CatalogResponse)
async def get_shared_catalog(
    share_slug: str,
    client: SupabaseDep,
) -> CatalogResponse:
    """Fetch a published catalog by share slug."""
    catalog = catalog_service.get_catalog_by_share_slug(client, share_slug)
    if catalog is None:
        raise HTTPException(status_code=404, detail="Shared catalog not found")
    return catalog


@router.post("/{catalog_id}/publish", response_model=CatalogResponse)
async def publish_catalog(
    catalog_id: UUID,
    client: SupabaseDep,
    user_id: UserIdDep,
) -> CatalogResponse:
    """Publish an owned catalog as an immutable shared snapshot."""
    current_user_id = _require_user(user_id)
    try:
        return catalog_service.publish_catalog(
            client,
            catalog_id,
            user_id=current_user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/{catalog_id}/fork", response_model=CatalogResponse, status_code=201)
async def fork_catalog(
    catalog_id: UUID,
    client: SupabaseDep,
    user_id: UserIdDep,
    payload: CatalogForkRequest | None = None,
) -> CatalogResponse:
    """Fork a published or demo catalog into a new editable catalog."""
    current_user_id = _require_user(user_id)
    fork_request = payload or CatalogForkRequest()
    try:
        return catalog_service.fork_catalog(
            client,
            catalog_id,
            user_id=current_user_id,
            name=fork_request.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


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


@router.get(
    "/{catalog_id}/instructor-preferences",
    response_model=CatalogInstructorPreferencesResponse,
)
async def list_catalog_instructor_preferences(
    catalog_id: UUID,
    client: SupabaseDep,
    user_id: UserIdDep,
) -> CatalogInstructorPreferencesResponse:
    """Fetch saved instructor preferences for the current user and catalog."""
    catalog = catalog_service.get_catalog(client, catalog_id)
    if catalog is None:
        raise HTTPException(status_code=404, detail="Catalog not found")

    return catalog_service.list_catalog_instructor_preferences(
        client,
        catalog_id,
        user_id=user_id,
    )


@router.put(
    "/{catalog_id}/instructor-preferences",
    response_model=CatalogInstructorPreferencesResponse,
)
async def replace_catalog_instructor_preferences(
    catalog_id: UUID,
    payload: CatalogInstructorPreferencesReplaceRequest,
    client: SupabaseDep,
    user_id: UserIdDep,
) -> CatalogInstructorPreferencesResponse:
    """Replace saved instructor preferences for the current user and catalog."""
    current_user_id = _require_user(user_id)

    catalog = catalog_service.get_catalog(client, catalog_id)
    if catalog is None:
        raise HTTPException(status_code=404, detail="Catalog not found")

    try:
        return catalog_service.replace_catalog_instructor_preferences(
            client,
            catalog_id,
            user_id=current_user_id,
            payload=payload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.put("/{catalog_id}/sections", response_model=list[CatalogSectionResponse])
async def replace_catalog_sections(
    catalog_id: UUID,
    payload: CatalogSectionsReplaceRequest,
    client: SupabaseDep,
    user_id: UserIdDep,
) -> list[CatalogSectionResponse]:
    """Replace all normalized candidate sections for a catalog."""
    _require_user(user_id)

    catalog = catalog_service.get_catalog(client, catalog_id)
    if catalog is None:
        raise HTTPException(status_code=404, detail="Catalog not found")
    if catalog.source_type == "demo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo catalogs cannot be modified",
        )
    if catalog.status == "published":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Published catalogs cannot be modified; fork it first",
        )

    try:
        return catalog_service.replace_catalog_sections(client, catalog_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
