"""
Catalog service - Supabase edition.
"""

from __future__ import annotations

from uuid import UUID

from backend.api.v1.schemas.catalogs import (
    CatalogCreate,
    CatalogResponse,
    CatalogSectionMeetingResponse,
    CatalogSectionResponse,
    CatalogSectionsReplaceRequest,
)
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


def list_catalog_sections(
    client: Client,
    catalog_id: UUID,
) -> list[CatalogSectionResponse]:
    """Fetch saved candidate sections and meetings for a catalog."""
    sections_resp = (
        client.table("catalog_sections")
        .select("*")
        .eq("catalog_id", str(catalog_id))
        .order("sort_order")
        .execute()
    )
    section_rows = sections_resp.data or []
    if not section_rows:
        return []

    section_ids = [row["id"] for row in section_rows]
    meetings_resp = (
        client.table("catalog_section_meetings")
        .select("*")
        .in_("section_id", section_ids)
        .order("sort_order")
        .execute()
    )

    meetings_by_section: dict[str, list[CatalogSectionMeetingResponse]] = {}
    for meeting_row in meetings_resp.data or []:
        section_id = meeting_row["section_id"]
        meetings_by_section.setdefault(section_id, []).append(
            CatalogSectionMeetingResponse(**meeting_row)
        )

    return [
        CatalogSectionResponse(
            **section_row,
            meetings=meetings_by_section.get(section_row["id"], []),
        )
        for section_row in section_rows
    ]


def replace_catalog_sections(
    client: Client,
    catalog_id: UUID,
    payload: CatalogSectionsReplaceRequest,
) -> list[CatalogSectionResponse]:
    """Atomically replace all saved candidate sections for a catalog."""
    section_rows = [
        section.model_dump(mode="json")
        for section in payload.sections
    ]
    client.rpc(
        "replace_catalog_sections",
        {
            "p_catalog_id": str(catalog_id),
            "p_sections": section_rows,
        },
    ).execute()

    return list_catalog_sections(client, catalog_id)
