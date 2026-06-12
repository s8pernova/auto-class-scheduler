"""Favorites service - Supabase edition."""

from __future__ import annotations

import hashlib
from uuid import UUID

from backend.api.v1.schemas.catalogs import (
    CatalogSectionMeetingResponse,
    CatalogSectionResponse,
)
from backend.api.v1.schemas.favorites import (
    FavoriteGeneratedScheduleRequest,
    FavoriteResponse,
)
from backend.api.v1.schemas.schedules import Meeting, Section
from backend.api.v1.services import catalogs as catalog_service
from backend.api.v1.services.schedules import compute_schedule_summary
from backend.config import get_settings
from supabase import Client

DAY_CODE_TO_NAME = {
    "M": "Mon",
    "T": "Tue",
    "W": "Wed",
    "R": "Thu",
    "F": "Fri",
    "S": "Sat",
}


def list_favorite_ids(client: Client, *, user_id: UUID) -> list[int]:
    """Return the current user's favorited saved schedule IDs, most recent first."""
    resp = (
        client.table("user_favorites")
        .select("schedule_id")
        .eq("user_id", str(user_id))
        .order("favorited_at", desc=True)
        .execute()
    )
    return [row["schedule_id"] for row in resp.data or []]


def save_and_favorite_generated_schedule(
    client: Client,
    payload: FavoriteGeneratedScheduleRequest,
    *,
    user_id: UUID,
) -> FavoriteResponse:
    """Persist exactly one generated schedule result, then favorite it."""
    catalog = catalog_service.get_catalog(client, payload.catalog_id)
    if catalog is None:
        raise ValueError("Catalog not found or not accessible")
    if catalog.status != "published":
        raise ValueError("Schedules can only be favorited from published catalogs")

    requested_ids = [
        str(meeting_id) for meeting_id in payload.catalog_section_meeting_ids
    ]
    _validate_saved_schedule_size(len(requested_ids))
    if len(set(requested_ids)) != len(requested_ids):
        raise ValueError("Duplicate catalogSectionMeetingIds are not allowed")

    all_sections = catalog_service.list_catalog_sections(client, payload.catalog_id)
    meeting_candidates_by_id = {
        str(meeting.id): (section, meeting)
        for section in all_sections
        for meeting in section.meetings
    }
    missing_ids = [
        meeting_id
        for meeting_id in requested_ids
        if meeting_id not in meeting_candidates_by_id
    ]
    if missing_ids:
        raise ValueError("One or more selected catalog section rows were not found")

    selected_catalog_rows = [
        meeting_candidates_by_id[meeting_id] for meeting_id in requested_ids
    ]
    selected_catalog_sections = [section for section, _meeting in selected_catalog_rows]
    _validate_one_section_per_course(selected_catalog_sections)

    sections = [
        _to_domain_section(section, meeting)
        for section, meeting in selected_catalog_rows
    ]
    if _has_time_conflict(sections):
        raise ValueError("Selected sections contain a time conflict")

    summary = compute_schedule_summary(sections)
    schedule_hash = _build_schedule_hash(payload.catalog_id, requested_ids)
    schedule_id, schedule_created = _upsert_saved_schedule(
        client,
        catalog_id=payload.catalog_id,
        user_id=user_id,
        schedule_hash=schedule_hash,
        term_name=catalog.term_name,
        summary=summary,
    )
    try:
        _replace_saved_schedule_sections(
            client,
            schedule_id=schedule_id,
            catalog_rows=selected_catalog_rows,
            sections=sections,
        )

        return _create_favorite(
            client,
            schedule_id,
            user_id=user_id,
            catalog_id=payload.catalog_id,
        )
    except Exception:
        if schedule_created:
            _delete_saved_schedule(client, schedule_id, user_id=user_id)
        raise


def _create_favorite(
    client: Client,
    schedule_id: int,
    *,
    user_id: UUID,
    catalog_id: UUID | None = None,
) -> FavoriteResponse:
    """Upsert a favorite and return the persisted row."""
    resp = (
        client.table("user_favorites")
        .upsert(
            {"schedule_id": schedule_id, "user_id": str(user_id)},
            on_conflict="user_id,schedule_id",
        )
        .execute()
    )
    row = resp.data[0]
    return FavoriteResponse(
        schedule_id=row["schedule_id"],
        favorited_at=row["favorited_at"],
        catalog_id=catalog_id,
    )


def delete_favorite(client: Client, schedule_id: int, *, user_id: UUID) -> bool:
    """Delete a favorited saved schedule. Cascades to favorite and section rows."""
    if not _favorite_exists(client, schedule_id, user_id=user_id):
        return False

    _delete_saved_schedule(client, schedule_id, user_id=user_id)
    return not _favorite_exists(client, schedule_id, user_id=user_id)


def _favorite_exists(client: Client, schedule_id: int, *, user_id: UUID) -> bool:
    resp = (
        client.table("user_favorites")
        .select("schedule_id")
        .eq("schedule_id", schedule_id)
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    return bool(resp.data)


def _delete_saved_schedule(client: Client, schedule_id: int, *, user_id: UUID) -> None:
    (
        client.table("saved_schedules")
        .delete()
        .eq("id", schedule_id)
        .eq("user_id", str(user_id))
        .execute()
    )


def _validate_one_section_per_course(
    catalog_sections: list[CatalogSectionResponse],
) -> None:
    course_names = [section.course_name for section in catalog_sections]
    _validate_saved_schedule_size(len(course_names))
    if len(set(course_names)) != len(course_names):
        raise ValueError("A saved schedule can include only one section per courseName")


def _validate_saved_schedule_size(section_count: int) -> None:
    max_courses = get_settings().max_catalog_courses
    if section_count > max_courses:
        raise ValueError(
            f"A saved schedule cannot include more than {max_courses} course buckets"
        )


def _to_domain_section(
    catalog_section: CatalogSectionResponse,
    catalog_meeting: CatalogSectionMeetingResponse,
) -> Section:
    metadata = catalog_section.source_metadata or {}
    section_code = catalog_meeting.crn or str(catalog_meeting.id)

    meetings = [
        Meeting(
            day=day,
            start=catalog_meeting.start_time,
            end=catalog_meeting.end_time,
            campus=str(metadata.get("campus") or "Unspecified"),
        )
        for day in _expand_meeting_days(catalog_meeting.days)
    ]
    if not meetings:
        raise ValueError(
            f"Catalog section {catalog_section.course_name} has no meetings"
        )

    return Section(
        catalog_section_id=catalog_section.id,
        catalog_section_meeting_id=catalog_meeting.id,
        course_name=catalog_section.course_name,
        section_code=section_code,
        title=str(metadata.get("course_title") or catalog_section.course_name),
        credits=_int_from_metadata(metadata.get("credits")),
        instructor=catalog_meeting.instructor_name or "",
        rating=_rating_from_metadata(metadata),
        meetings=meetings,
    )


def _expand_meeting_days(days: str) -> list[str]:
    try:
        return [DAY_CODE_TO_NAME[day] for day in days]
    except KeyError as exc:
        raise ValueError(
            "Unknown meeting day code. Use M, T, W, R, F, S; use R for Thursday."
        ) from exc


def _has_time_conflict(sections: list[Section]) -> bool:
    meetings = [meeting for section in sections for meeting in section.meetings]
    for index, first in enumerate(meetings):
        for second in meetings[index + 1 :]:
            if first.day == second.day and max(first.start, second.start) < min(
                first.end, second.end
            ):
                return True
    return False


def _build_schedule_hash(catalog_id: UUID, catalog_section_meeting_ids: list[str]) -> str:
    parts = [str(catalog_id), *sorted(catalog_section_meeting_ids)]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def _upsert_saved_schedule(
    client: Client,
    *,
    catalog_id: UUID,
    user_id: UUID,
    schedule_hash: str,
    term_name: str | None,
    summary: dict,
) -> tuple[int, bool]:
    existing = (
        client.table("saved_schedules")
        .select("id")
        .eq("user_id", str(user_id))
        .eq("catalog_id", str(catalog_id))
        .eq("schedule_hash", schedule_hash)
        .maybe_single()
        .execute()
    )

    row = {
        "user_id": str(user_id),
        "catalog_id": str(catalog_id),
        "schedule_hash": schedule_hash,
        "term_name": term_name,
        "total_credits": summary["total_credits"],
        "total_instructor_score": summary["total_instructor_score"],
        "num_sections": summary["num_sections"],
        "meets_mon": summary["meets_mon"],
        "meets_tue": summary["meets_tue"],
        "meets_wed": summary["meets_wed"],
        "meets_thu": summary["meets_thu"],
        "meets_fri": summary["meets_fri"],
        "meets_sat": summary["meets_sat"],
        "earliest_start": summary["earliest_start"],
        "latest_end": summary["latest_end"],
        "campus_pattern": summary["campus_pattern"],
    }

    if existing is not None and existing.data:
        schedule_id = int(existing.data["id"])
        client.table("saved_schedules").update(row).eq("id", schedule_id).execute()
        return schedule_id, False

    inserted = client.table("saved_schedules").insert(row).execute()
    return int(inserted.data[0]["id"]), True


def _replace_saved_schedule_sections(
    client: Client,
    *,
    schedule_id: int,
    catalog_rows: list[tuple[CatalogSectionResponse, CatalogSectionMeetingResponse]],
    sections: list[Section],
) -> None:
    (
        client.table("saved_schedule_sections")
        .delete()
        .eq("schedule_id", schedule_id)
        .execute()
    )

    rows = []
    for sort_order, ((catalog_section, catalog_meeting), section) in enumerate(
        zip(catalog_rows, sections, strict=True)
    ):
        rows.append(
            {
                "schedule_id": schedule_id,
                "catalog_section_id": str(catalog_section.id),
                "catalog_section_meeting_id": str(catalog_meeting.id),
                "course_name": catalog_section.course_name,
                "crn": catalog_meeting.crn,
                "subject_code": None,
                "course_number": None,
                "section_code": section.section_code,
                "course_title": section.title,
                "credits": section.credits,
                "sort_order": sort_order,
            }
        )

    if rows:
        client.table("saved_schedule_sections").insert(rows).execute()


def _int_from_metadata(value: object) -> int:
    try:
        return int(value) if value is not None else 0
    except (TypeError, ValueError):
        return 0


def _rating_from_metadata(metadata: dict) -> float | None:
    raw = metadata.get("instructor_rating", metadata.get("rating"))
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None
