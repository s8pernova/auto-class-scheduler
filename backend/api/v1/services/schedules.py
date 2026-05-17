"""
Schedule query service - Supabase edition.
"""

from __future__ import annotations

from backend.api.v1.schemas.schedules import (
    MeetingResponse,
    ScheduleSectionDetailResponse,
    ScheduleSummaryResponse,
)
from supabase import Client

# Public API


def get_schedule_exists(client: Client, schedule_id: int) -> bool:
    """Return ``True`` if *schedule_id* exists in the database."""
    resp = (
        client.table("schedules")
        .select("id", count="exact")
        .eq("id", schedule_id)
        .execute()
    )
    return (resp.count or 0) > 0


def list_schedules(
    client: Client,
    *,
    favorites_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    campuses: list[str] | None = None,
    times: list[str] | None = None,
) -> list[ScheduleSummaryResponse]:
    """Paginated schedule listing with optional filters."""

    # 1. Query schedules (with embedded sections)
    if favorites_only:
        # !inner turns the LEFT JOIN into an INNER JOIN - only
        # schedules that appear in `favorites` are returned.
        query = client.table("schedules").select(
            "*, favorites!inner(favorited_at), schedule_sections(*)"
        )
    else:
        query = client.table("schedules").select("*, schedule_sections(*)")

    # Campus filter
    campus_patterns = _resolve_campus_patterns(campuses)
    if campus_patterns:
        query = query.in_("campus_pattern", campus_patterns)

    # Time-of-day filter (OR logic via PostgREST syntax)
    time_filter = _build_time_filter(times)
    if time_filter:
        query = query.or_(time_filter)

    query = (
        query.order("total_instructor_score", desc=True, nullsfirst=False)
        .limit(limit)
        .offset(offset)
    )
    schedules_data = query.execute().data
    if not schedules_data:
        return []

    # 2. Fetch possible_classes for meeting / instructor data
    classes_lookup = _build_classes_lookup(client, schedules_data)

    # 3. Assemble response objects
    return _assemble_responses(schedules_data, classes_lookup)


# Internal Helpers


# NOTE: LEGACY CODE
def _resolve_campus_patterns(campuses: list[str] | None) -> list[str] | None:
    if not campuses:
        return None
    patterns: set[str] = set()
    if "Annandale" in campuses:
        patterns.add("Annandale-only")
    if "Alexandria" in campuses:
        patterns.add("Alexandria-only")
    if "Online" in campuses:
        patterns.add("Online-only")
    if "Annandale" in campuses and "Alexandria" in campuses:
        patterns.add("Mixed")
    return list(patterns) if patterns else None


def _build_time_filter(times: list[str] | None) -> str | None:
    if not times:
        return None
    clauses: list[str] = []
    if "Morning" in times:
        clauses.append("earliest_start.lt.12:00:00")
    if "Afternoon" in times:
        clauses.append("and(earliest_start.gte.12:00:00,earliest_start.lt.17:00:00)")
    if "Evening" in times:
        clauses.append("earliest_start.gte.17:00:00")
    return ",".join(clauses) if clauses else None


SectionKey = tuple[str, int, str]  # (subject_code, course_number, section_code)


def _build_classes_lookup(
    client: Client,
    schedules_data: list[dict],
) -> dict[SectionKey, dict]:
    """Fetch possible_classes rows and index by section key."""
    # Collect the unique section keys we need.
    section_keys: set[SectionKey] = set()
    for sched in schedules_data:
        for sec in sched.get("schedule_sections", []):
            section_keys.add(
                (sec["subject_code"], sec["course_number"], sec["section_code"])
            )

    if not section_keys:
        return {}

    # Narrow the query to only the subject_codes we care about.
    subjects = list({k[0] for k in section_keys})
    resp = (
        client.table("possible_classes")
        .select(
            "subject_code, course_number, section_code, "
            "modality, instructor_name, instructor_rating, "
            "day_of_week, start_time, end_time, campus"
        )
        .in_("subject_code", subjects)
        .execute()
    )

    lookup: dict[SectionKey, dict] = {}
    for row in resp.data:
        key: SectionKey = (
            row["subject_code"],
            row["course_number"],
            row["section_code"],
        )
        if key not in section_keys:
            continue
        if key not in lookup:
            lookup[key] = {
                "modality": row["modality"],
                "instructor_name": row["instructor_name"],
                "instructor_rating": row["instructor_rating"],
                "meetings": [],
            }
        if row["day_of_week"] is not None:
            lookup[key]["meetings"].append(
                MeetingResponse(
                    day_of_week=row["day_of_week"],
                    start_time=row["start_time"],
                    end_time=row["end_time"],
                    campus=row["campus"],
                )
            )

    return lookup


def _assemble_responses(
    schedules_data: list[dict],
    classes_lookup: dict[SectionKey, dict],
) -> list[ScheduleSummaryResponse]:
    results: list[ScheduleSummaryResponse] = []

    for sched in schedules_data:
        sections: list[ScheduleSectionDetailResponse] = []
        for sec in sched.get("schedule_sections", []):
            key: SectionKey = (
                sec["subject_code"],
                sec["course_number"],
                sec["section_code"],
            )
            extra = classes_lookup.get(key, {})
            sections.append(
                ScheduleSectionDetailResponse(
                    subject_code=sec["subject_code"],
                    course_number=sec["course_number"],
                    section_code=sec["section_code"],
                    course_title=sec["course_title"],
                    credits=sec["credits"],
                    modality=extra.get("modality"),
                    instructor_name=extra.get("instructor_name"),
                    instructor_rating=extra.get("instructor_rating"),
                    meetings=extra.get("meetings", []),
                )
            )

        results.append(
            ScheduleSummaryResponse(
                schedule_id=sched["id"],
                total_credits=sched["total_credits"],
                total_instructor_score=sched["total_instructor_score"],
                num_sections=sched["num_sections"],
                meets_mon=sched["meets_mon"],
                meets_tue=sched["meets_tue"],
                meets_wed=sched["meets_wed"],
                meets_thu=sched["meets_thu"],
                meets_fri=sched["meets_fri"],
                meets_sat=sched["meets_sat"],
                earliest_start=sched["earliest_start"],
                latest_end=sched["latest_end"],
                campus_pattern=sched["campus_pattern"],
                created_at=sched["created_at"],
                sections=sections,
            )
        )

    return results
