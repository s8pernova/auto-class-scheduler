"""
Catalog service - Supabase edition.
"""

from __future__ import annotations

from uuid import UUID

from backend.api.v1.schemas.catalogs import CatalogCreate, CatalogResponse
from supabase import Client


def create_catalog(
    client: Client,
    payload: CatalogCreate,
    *,
    user_id: UUID | None = None,
) -> CatalogResponse:
    """Insert a new catalog and return the persisted row."""
    row = payload.model_dump()
    if user_id is not None:
        row["created_by"] = str(user_id)

    resp = client.table("catalogs").insert(row).execute()
    return CatalogResponse(**resp.data[0])


def get_catalog(client: Client, catalog_id: UUID) -> CatalogResponse | None:
    """Fetch a single catalog by ID. Returns ``None`` if not found."""
    resp = (
        client.table("catalogs")
        .select("*")
        .eq("id", str(catalog_id))
        .maybe_single()
        .execute()
    )
    if resp.data is None:
        return None
    return CatalogResponse(**resp.data)
