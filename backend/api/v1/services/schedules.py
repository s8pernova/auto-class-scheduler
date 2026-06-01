"""
Schedule query service - Supabase edition.
"""

from __future__ import annotations

import math
from uuid import UUID

from backend.api.v1.schemas.schedules import (
    GeneratedMeetingResponse,
    GeneratedScheduleResponse,
    GeneratedSectionResponse,
    MeetingResponse,
    ScheduleGenerateBlockedTimeInput,
    ScheduleGenerateRequest,
    ScheduleGenerateResponse,
    ScheduleSectionDetailResponse,
    ScheduleSummaryResponse,
)
from backend.api.v1.services import catalogs as catalog_service
from backend.core.generator import compute_schedule_summary
from backend.core.generator import generate_schedules as generate_section_combinations
from backend.core.models import Meeting, Section
from supabase import Client

DAY_CODE_TO_NAME = {
    "M": "Mon",
    "T": "Tue",
    "W": "Wed",
    "R": "Thu",
    "F": "Fri",
    "S": "Sat",
}
MAX_CANDIDATE_COMBINATIONS = 250_000

# Public API


def get_schedule_exists(client: Client, schedule_id: int) -> bool:
    """Return ``True`` if *schedule_id* exists in the database."""
    resp = (
        client.table("saved_schedules")
        .select("id", count="exact")
        .eq("id", schedule_id)
        .execute()
    )
    return (resp.count or 0) > 0


def generate_schedules_from_request(
    client: Client,
    payload: ScheduleGenerateRequest,
) -> ScheduleGenerateResponse:
    """Generate transient schedule options from a saved BYOC catalog."""
    catalog_id = payload.metadata.catalog_id
    if catalog_id is None:
        raise ValueError("catalogId is required to generate schedules")

    catalog = catalog_service.get_catalog(client, catalog_id)
    if catalog is None:
        raise ValueError("Catalog not found or not accessible")

    sections_by_course, target_courses = _load_catalog_generation_sections(
        client,
        catalog_id,
        instructor_ratings=payload.preferences.instructor_ratings,
    )
    if not target_courses:
        raise ValueError("Catalog has no saved candidate sections")

    candidate_count = math.prod(len(sections_by_course[key]) for key in target_courses)
    if candidate_count > MAX_CANDIDATE_COMBINATIONS:
        raise ValueError(
            "Schedule request has "
            f"{candidate_count:,} possible combinations. Reduce the number of "
            "courses or candidate sections before generating."
        )

    generated = generate_section_combinations(
        sections_by_course,
        target_courses,
    )
    valid = [
        schedule
        for schedule in generated
        if not _schedule_overlaps_blocked_times(
            schedule,
            payload.preferences.blocked_times,
        )
    ]
    returned = valid[: payload.max_results]

    schedules = [
        _build_generated_schedule_response(
            index=index,
            sections=sections,
        )
        for index, sections in enumerate(returned, start=1)
    ]

    return ScheduleGenerateResponse(
        candidate_count=candidate_count,
        valid_count=len(valid),
        returned_count=len(schedules),
        schedules=schedules,
    )


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
        # schedules that appear in `user_favorites` are returned.
        query = client.table("saved_schedules").select(
            "*, user_favorites!inner(favorited_at), saved_schedule_sections(*)"
        )
    else:
        query = client.table("saved_schedules").select("*, saved_schedule_sections(*)")

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


def _load_catalog_generation_sections(
    client: Client,
    catalog_id: UUID,
    *,
    instructor_ratings: dict[str, float | None],
) -> tuple[dict[str, list[Section]], list[str]]:
    catalog_sections = catalog_service.list_catalog_sections(client, catalog_id)

    sections_by_course: dict[str, list[Section]] = {}
    target_courses: list[str] = []
    section_counts_by_course: dict[str, int] = {}

    for catalog_section in catalog_sections:
        course_key = catalog_section.course_name
        if course_key not in sections_by_course:
            sections_by_course[course_key] = []
            target_courses.append(course_key)

        section_counts_by_course[course_key] = (
            section_counts_by_course.get(course_key, 0) + 1
        )
        section_index = section_counts_by_course[course_key]
        section_code = (
            catalog_section.crn or f"{catalog_section.course_name}-{section_index}"
        )
        instructor_name = catalog_section.instructor_name or ""
        rating = instructor_ratings.get(instructor_name) if instructor_name else None

        if not catalog_section.meetings:
            raise ValueError(
                "Catalog section "
                f"{catalog_section.course_name} "
                f"{section_code} has no meetings"
            )

        meetings = [
            Meeting(
                day=day,
                start=meeting.start_time,
                end=meeting.end_time,
                campus="Unspecified",
            )
            for meeting in catalog_section.meetings
            for day in _expand_meeting_days(meeting.days)
        ]

        sections_by_course[course_key].append(
            Section(
                course_name=catalog_section.course_name,
                section_code=section_code,
                title="",
                credits=0,
                instructor=instructor_name,
                rating=rating,
                meetings=meetings,
            )
        )

    return sections_by_course, target_courses


def _expand_meeting_days(days: str) -> list[str]:
    try:
        return [DAY_CODE_TO_NAME[day] for day in days]
    except KeyError as exc:
        raise ValueError(
            "Unknown meeting day code. Use M, T, W, R, F, S; use R for Thursday."
        ) from exc


def _schedule_overlaps_blocked_times(
    sections: list[Section],
    blocked_times: list[ScheduleGenerateBlockedTimeInput],
) -> bool:
    if not blocked_times:
        return False

    meetings = [meeting for section in sections for meeting in section.meetings]
    blocked_meetings = [
        Meeting(
            day=day,
            start=blocked_time.start_time,
            end=blocked_time.end_time,
            campus="Blocked",
        )
        for blocked_time in blocked_times
        for day in _expand_meeting_days(blocked_time.days)
    ]

    return any(
        _meetings_overlap(meeting, blocked)
        for meeting in meetings
        for blocked in blocked_meetings
    )


def _meetings_overlap(first: Meeting, second: Meeting) -> bool:
    return first.day == second.day and max(first.start, second.start) < min(
        first.end, second.end
    )


def _build_generated_schedule_response(
    *,
    index: int,
    sections: list[Section],
) -> GeneratedScheduleResponse:
    summary = compute_schedule_summary(sections)

    return GeneratedScheduleResponse(
        result_id=f"generated-{index}",
        total_instructor_score=summary["total_instructor_score"],
        num_sections=summary["num_sections"],
        meets_mon=summary["meets_mon"],
        meets_tue=summary["meets_tue"],
        meets_wed=summary["meets_wed"],
        meets_thu=summary["meets_thu"],
        meets_fri=summary["meets_fri"],
        meets_sat=summary["meets_sat"],
        earliest_start=summary["earliest_start"],
        latest_end=summary["latest_end"],
        sections=[_build_generated_section_response(section) for section in sections],
    )


def _build_generated_section_response(section: Section) -> GeneratedSectionResponse:
    return GeneratedSectionResponse(
        course_name=section.course_name,
        section_code=section.section_code,
        instructor_name=section.instructor or None,
        meetings=[
            GeneratedMeetingResponse(
                day_of_week=meeting.day,
                start_time=meeting.start,
                end_time=meeting.end,
            )
            for meeting in section.meetings
        ],
    )


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


def _build_classes_lookup(
    client: Client,
    schedules_data: list[dict],
) -> dict[str, dict]:
    """Fetch catalog_sections and meetings to index by catalog_section_id."""
    section_ids: set[str] = set()
    for sched in schedules_data:
        for sec in sched.get("saved_schedule_sections", []):
            sect_id = sec.get("catalog_section_id")
            if sect_id:
                section_ids.add(str(sect_id))

    if not section_ids:
        return {}

    # Fetch catalog sections details
    sections_resp = (
        client.table("catalog_sections")
        .select("id, instructor_name, source_metadata")
        .in_("id", list(section_ids))
        .execute()
    )
    sections_by_id = {row["id"]: row for row in sections_resp.data or []}

    # Fetch meetings details
    meetings_resp = (
        client.table("catalog_section_meetings")
        .select("section_id, days, start_time, end_time")
        .in_("section_id", list(section_ids))
        .execute()
    )

    lookup: dict[str, dict] = {}
    for sect_id in section_ids:
        sect_data = sections_by_id.get(sect_id, {})
        metadata = sect_data.get("source_metadata") or {}

        modality = metadata.get("modality")
        instructor_rating = metadata.get("instructor_rating")
        if instructor_rating is None:
            instructor_rating = metadata.get("rating")

        lookup[sect_id] = {
            "modality": modality,
            "instructor_name": sect_data.get("instructor_name")
            or metadata.get("instructor_name"),
            "instructor_rating": instructor_rating,
            "meetings": [],
            "source_metadata": metadata,
        }

    for row in meetings_resp.data or []:
        sect_id = str(row["section_id"])
        if sect_id not in lookup:
            continue

        days = row["days"] or ""
        start = row["start_time"]
        end = row["end_time"]

        for day_code in days:
            day_name = DAY_CODE_TO_NAME.get(day_code)
            if day_name:
                lookup[sect_id]["meetings"].append(
                    MeetingResponse(
                        day_of_week=day_name,
                        start_time=start,
                        end_time=end,
                        campus=lookup[sect_id]["source_metadata"].get(
                            "campus", "Unspecified"
                        ),
                    )
                )

    return lookup


def _assemble_responses(
    schedules_data: list[dict],
    classes_lookup: dict[str, dict],
) -> list[ScheduleSummaryResponse]:
    results: list[ScheduleSummaryResponse] = []

    for sched in schedules_data:
        sections: list[ScheduleSectionDetailResponse] = []
        for sec in sched.get("saved_schedule_sections", []):
            sect_id = (
                str(sec["catalog_section_id"])
                if sec.get("catalog_section_id")
                else None
            )
            extra = classes_lookup.get(sect_id) if sect_id else None

            if extra:
                modality = extra.get("modality")
                instructor_name = extra.get("instructor_name")
                instructor_rating = extra.get("instructor_rating")
                meetings = extra.get("meetings", [])
            else:
                modality = None
                instructor_name = None
                instructor_rating = None
                meetings = []

            sections.append(
                ScheduleSectionDetailResponse(
                    subject_code=sec["subject_code"],
                    course_number=sec["course_number"],
                    section_code=sec["section_code"],
                    course_title=sec["course_title"],
                    credits=sec["credits"],
                    modality=modality,
                    instructor_name=instructor_name,
                    instructor_rating=instructor_rating,
                    meetings=meetings,
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
