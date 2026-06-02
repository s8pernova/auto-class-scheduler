"""
Catalog service - Supabase edition.
"""

from __future__ import annotations

import json
from collections import Counter
from uuid import UUID

from backend.api.v1.schemas.catalogs import (
    CatalogCreate,
    CatalogResponse,
    CatalogSectionMeetingResponse,
    CatalogSectionResponse,
    CatalogSectionsReplaceRequest,
)
from backend.config import get_settings
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
    validate_catalog_sections_payload(payload)

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


def validate_catalog_sections_payload(payload: CatalogSectionsReplaceRequest) -> None:
    """Enforce configured BYOC catalog size limits before hitting Supabase."""
    settings = get_settings()
    sections = payload.sections

    if len(sections) > settings.max_catalog_sections:
        raise ValueError(
            "Catalogs cannot include more than "
            f"{settings.max_catalog_sections} sections"
        )

    course_names = [section.course_name for section in sections]
    if len(set(course_names)) > settings.max_catalog_courses:
        raise ValueError(
            f"Catalogs cannot include more than {settings.max_catalog_courses} "
            "course buckets"
        )

    section_counts = Counter(course_names)
    overloaded_courses = [
        course_name
        for course_name, count in section_counts.items()
        if count > settings.max_sections_per_course
    ]
    if overloaded_courses:
        raise ValueError(
            "A course bucket cannot include more than "
            f"{settings.max_sections_per_course} sections: "
            + ", ".join(overloaded_courses)
        )

    total_meetings = 0
    for section in sections:
        meeting_count = len(section.meetings)
        total_meetings += meeting_count
        if meeting_count > settings.max_meetings_per_section:
            raise ValueError(
                "A catalog section cannot include more than "
                f"{settings.max_meetings_per_section} meetings"
            )

        metadata_bytes = len(
            json.dumps(
                section.source_metadata,
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
        )
        if metadata_bytes > settings.max_source_metadata_bytes_per_section:
            raise ValueError(
                "sourceMetadata cannot exceed "
                f"{settings.max_source_metadata_bytes_per_section} bytes per section"
            )

    if total_meetings > settings.max_catalog_meetings:
        raise ValueError(
            f"Catalogs cannot include more than {settings.max_catalog_meetings} "
            "meetings"
        )
