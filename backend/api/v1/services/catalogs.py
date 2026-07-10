"""
Catalog service - Supabase edition.
"""

from __future__ import annotations

import json
import secrets
from collections import Counter
from datetime import datetime, timezone
from uuid import UUID

from backend.api.v1.schemas.catalogs import (
    CatalogCreate,
    CatalogInstructorPreferencesReplaceRequest,
    CatalogInstructorPreferencesResponse,
    CatalogResponse,
    CatalogSectionInput,
    CatalogSectionMeetingInput,
    CatalogSectionMeetingResponse,
    CatalogSectionResponse,
    CatalogSectionsReplaceRequest,
    normalize_instructor_name,
)
from backend.config import get_settings
from supabase import Client

CATALOG_WRITABLE_STATUSES = {"draft", "ready"}


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
    if resp is None or resp.data is None:
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

    section_rows = [section.model_dump(mode="json") for section in payload.sections]
    client.rpc(
        "replace_catalog_sections",
        {
            "p_catalog_id": str(catalog_id),
            "p_sections": section_rows,
        },
    ).execute()

    return list_catalog_sections(client, catalog_id)


def list_catalog_instructor_preferences(
    client: Client,
    catalog_id: UUID,
    *,
    user_id: UUID | None,
) -> CatalogInstructorPreferencesResponse:
    """Fetch saved instructor preferences for the current user and catalog."""
    if user_id is None:
        return CatalogInstructorPreferencesResponse()

    resp = (
        client.table("catalog_instructor_preferences")
        .select("instructor_name, preference_score")
        .eq("catalog_id", str(catalog_id))
        .eq("user_id", str(user_id))
        .order("instructor_name")
        .execute()
    )
    return CatalogInstructorPreferencesResponse(
        instructor_ratings={
            row["instructor_name"]: row["preference_score"]
            for row in resp.data or []
            if row.get("preference_score") is not None
        }
    )


def replace_catalog_instructor_preferences(
    client: Client,
    catalog_id: UUID,
    *,
    user_id: UUID,
    payload: CatalogInstructorPreferencesReplaceRequest,
) -> CatalogInstructorPreferencesResponse:
    """Replace the current user's saved instructor preferences for a catalog."""
    validate_catalog_instructor_preferences_payload(payload)

    (
        client.table("catalog_instructor_preferences")
        .delete()
        .eq("catalog_id", str(catalog_id))
        .eq("user_id", str(user_id))
        .execute()
    )

    preference_rows = _build_preference_rows(catalog_id, user_id, payload)
    if preference_rows:
        client.table("catalog_instructor_preferences").insert(preference_rows).execute()

    return list_catalog_instructor_preferences(client, catalog_id, user_id=user_id)


def validate_catalog_sections_payload(payload: CatalogSectionsReplaceRequest) -> None:
    """Enforce configured BYOC catalog size limits before hitting Supabase."""
    settings = get_settings()
    sections = payload.sections

    if len(sections) > settings.max_catalog_courses:
        raise ValueError(
            f"Catalogs cannot include more than {settings.max_catalog_courses} "
            "course buckets"
        )

    course_names = [section.course_name for section in sections]
    duplicate_course_names = [
        course_name for course_name, count in Counter(course_names).items() if count > 1
    ]
    if duplicate_course_names:
        raise ValueError(
            "Catalog course buckets must be unique: "
            + ", ".join(duplicate_course_names)
        )

    total_meetings = 0
    for section in sections:
        meeting_count = len(section.meetings)
        total_meetings += meeting_count
        if meeting_count > settings.max_sections_per_course:
            raise ValueError(
                "A course bucket cannot include more than "
                f"{settings.max_sections_per_course} section rows"
            )

        if total_meetings > settings.max_catalog_sections:
            raise ValueError(
                "Catalogs cannot include more than "
                f"{settings.max_catalog_sections} sections"
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


def validate_catalog_instructor_preferences_payload(
    payload: CatalogInstructorPreferencesReplaceRequest,
) -> None:
    """Enforce configured instructor preference input limits."""
    settings = get_settings()
    if len(payload.instructor_ratings) > settings.max_instructor_ratings:
        raise ValueError(
            "instructorRatings cannot include more than "
            f"{settings.max_instructor_ratings} entries"
        )


def publish_catalog(
    client: Client,
    catalog_id: UUID,
    *,
    user_id: UUID,
) -> CatalogResponse:
    """Publish an owned catalog as an immutable shared snapshot."""
    catalog = get_catalog(client, catalog_id)
    if catalog is None:
        raise ValueError("Catalog not found or not accessible")
    if catalog.created_by != user_id:
        raise ValueError("Catalog not found or not writable")
    if catalog.source_type == "demo":
        raise ValueError("Demo catalogs cannot be published")
    if catalog.status == "published":
        return catalog
    if catalog.status not in CATALOG_WRITABLE_STATUSES:
        raise ValueError("Only draft or ready catalogs can be published")
    if catalog.row_count <= 0:
        raise ValueError("Catalogs need at least one section before publishing")

    timestamp = datetime.now(timezone.utc).isoformat()
    row = {
        "status": "published",
        "share_slug": _generate_unique_share_slug(client),
        "published_at": timestamp,
        "updated_at": timestamp,
    }

    resp = (
        client.table("catalogs")
        .update(row)
        .eq("id", str(catalog_id))
        .select("*")
        .execute()
    )
    if not resp.data:
        raise ValueError("Catalog not found or not writable")
    return CatalogResponse(**resp.data[0])


def get_catalog_by_share_slug(
    client: Client,
    share_slug: str,
) -> CatalogResponse | None:
    normalized_slug = share_slug.strip().lower()
    resp = (
        client.table("catalogs")
        .select("*")
        .eq("share_slug", normalized_slug)
        .eq("status", "published")
        .maybe_single()
        .execute()
    )
    if resp is None or resp.data is None:
        return None
    return CatalogResponse(**resp.data)


def fork_catalog(
    client: Client,
    catalog_id: UUID,
    *,
    user_id: UUID,
    name: str | None = None,
) -> CatalogResponse:
    """Copy a published or demo catalog into a new editable draft."""
    source = get_catalog(client, catalog_id)
    if source is None:
        raise ValueError("Catalog not found or not accessible")
    if source.status != "published" and source.source_type != "demo":
        raise ValueError("Only published or demo catalogs can be forked")

    section_payload = _build_fork_sections_payload(
        list_catalog_sections(client, source.id)
    )
    validate_catalog_sections_payload(section_payload)

    row = {
        "name": name or f"{source.name} (copy)",
        "description": source.description,
        "source_type": "manual",
        "school_name": source.school_name,
        "term_name": source.term_name,
        "status": "draft",
        "source_metadata": source.source_metadata,
        "created_by": str(user_id),
        "forked_from_catalog_id": str(source.id),
    }

    inserted = client.table("catalogs").insert(row).execute()
    if not inserted.data:
        raise ValueError("Forked catalog could not be created")
    forked = CatalogResponse(**inserted.data[0])

    replace_catalog_sections(client, forked.id, section_payload)
    _copy_catalog_instructor_preferences(client, source.id, forked.id, user_id=user_id)

    refreshed = get_catalog(client, forked.id)
    if refreshed is None:
        raise ValueError("Forked catalog could not be reloaded")
    return refreshed


def _generate_share_slug() -> str:
    """Generate one URL-safe lowercase slug accepted by the DB constraint."""
    return secrets.token_urlsafe(12).lower()


def _generate_unique_share_slug(client: Client) -> str:
    """Generate a share slug that does not already exist."""
    for _ in range(10):
        slug = _generate_share_slug()
        existing = (
            client.table("catalogs")
            .select("id")
            .eq("share_slug", slug)
            .maybe_single()
            .execute()
        )
        if existing is None or existing.data is None:
            return slug

    raise ValueError("Could not generate a unique catalog share slug")


def _build_fork_sections_payload(
    sections: list[CatalogSectionResponse],
) -> CatalogSectionsReplaceRequest:
    """Convert persisted section responses back into replace-input payloads."""
    return CatalogSectionsReplaceRequest(
        sections=[
            CatalogSectionInput(
                course_name=section.course_name,
                sort_order=section.sort_order,
                source_metadata=section.source_metadata,
                meetings=[
                    CatalogSectionMeetingInput(
                        crn=meeting.crn,
                        instructor_name=meeting.instructor_name,
                        days=meeting.days,
                        start_time=meeting.start_time,
                        end_time=meeting.end_time,
                        sort_order=meeting.sort_order,
                    )
                    for meeting in section.meetings
                ],
            )
            for section in sections
        ],
    )


def _copy_catalog_instructor_preferences(
    client: Client,
    source_catalog_id: UUID,
    target_catalog_id: UUID,
    *,
    user_id: UUID,
) -> None:
    source_preferences = list_catalog_instructor_preferences(
        client,
        source_catalog_id,
        user_id=user_id,
    )
    if not source_preferences.instructor_ratings:
        return

    replace_catalog_instructor_preferences(
        client,
        target_catalog_id,
        user_id=user_id,
        payload=CatalogInstructorPreferencesReplaceRequest(
            instructor_ratings=source_preferences.instructor_ratings,
        ),
    )


def _build_preference_rows(
    catalog_id: UUID,
    user_id: UUID,
    payload: CatalogInstructorPreferencesReplaceRequest,
) -> list[dict[str, str | float]]:
    rows: list[dict[str, str | float]] = []
    for instructor_name, preference_score in payload.instructor_ratings.items():
        if preference_score is None:
            continue

        normalized_name = normalize_instructor_name(instructor_name)
        rows.append(
            {
                "catalog_id": str(catalog_id),
                "user_id": str(user_id),
                "instructor_name": normalized_name,
                "normalized_instructor_name": normalized_name.lower(),
                "preference_score": preference_score,
            }
        )

    return rows
