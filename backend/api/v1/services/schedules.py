"""
Schedule query service - Supabase edition.
"""

from __future__ import annotations

import math

from backend.api.v1.schemas.schedules import (
    GeneratedMeetingResponse,
    GeneratedScheduleResponse,
    GeneratedSectionResponse,
    MeetingResponse,
    ScheduleGenerateBlockedTimeInput,
    ScheduleGenerateRequest,
    ScheduleGenerateResponse,
    ScheduleGenerateSectionInput,
    ScheduleSectionDetailResponse,
    ScheduleSummaryResponse,
)
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


def generate_schedules_from_request(
    payload: ScheduleGenerateRequest,
) -> ScheduleGenerateResponse:
    """Generate transient schedule options from BYOC section input."""
    sections_by_course: dict[tuple[str, int], list[Section]] = {}
    section_inputs_by_id: dict[int, ScheduleGenerateSectionInput] = {}

    for course in payload.courses:
        course_key = (course.subject_code, course.course_number)
        course_sections: list[Section] = []

        for index, section_input in enumerate(course.sections, start=1):
            section_code = (
                section_input.section_code
                or section_input.crn
                or f"{course.subject_code}-{course.course_number}-{index}"
            )
            campus = section_input.campus or "Unspecified"
            meetings = [
                Meeting(
                    day=day,
                    start=meeting.start_time,
                    end=meeting.end_time,
                    campus=campus,
                )
                for meeting in section_input.meetings
                for day in _expand_meeting_days(meeting.days)
            ]

            section = Section(
                subject=course.subject_code,
                number=course.course_number,
                section_code=section_code,
                title=course.course_title or "",
                credits=section_input.credits or 0,
                instructor=section_input.instructor_name or "",
                rating=section_input.instructor_rating,
                meetings=meetings,
            )
            section_inputs_by_id[id(section)] = section_input
            course_sections.append(section)

        sections_by_course[course_key] = course_sections

    target_courses = [
        (course.subject_code, course.course_number) for course in payload.courses
    ]
    candidate_count = math.prod(len(sections_by_course[key]) for key in target_courses)
    generated = generate_section_combinations(
        sections_by_course,
        target_courses,
        allow_campus_switch=payload.preferences.allow_campus_switch,
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
            section_inputs_by_id=section_inputs_by_id,
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


def _expand_meeting_days(days: str) -> list[str]:
    return [DAY_CODE_TO_NAME[day] for day in days]


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
    section_inputs_by_id: dict[int, ScheduleGenerateSectionInput],
) -> GeneratedScheduleResponse:
    summary = compute_schedule_summary(sections)

    return GeneratedScheduleResponse(
        result_id=f"generated-{index}",
        **summary,
        sections=[
            _build_generated_section_response(section, section_inputs_by_id)
            for section in sections
        ],
    )


def _build_generated_section_response(
    section: Section,
    section_inputs_by_id: dict[int, ScheduleGenerateSectionInput],
) -> GeneratedSectionResponse:
    source_input = section_inputs_by_id.get(id(section))
    modality = source_input.modality if source_input else None

    return GeneratedSectionResponse(
        subject_code=section.subject,
        course_number=section.number,
        section_code=section.section_code,
        course_title=section.title,
        credits=section.credits,
        modality=modality,
        instructor_name=section.instructor or None,
        meetings=[
            GeneratedMeetingResponse(
                day_of_week=meeting.day,
                start_time=meeting.start,
                end_time=meeting.end,
                campus=meeting.campus,
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
