"""
Schedule query service - Supabase edition.
"""

from __future__ import annotations

import itertools
import math
from uuid import UUID

from redis.asyncio import Redis

from backend.api.v1.schemas.schedules import (
    GeneratedMeetingResponse,
    GeneratedScheduleResponse,
    GeneratedScheduleSortField,
    GeneratedSectionResponse,
    Meeting,
    MeetingResponse,
    ScheduleGenerateBlockedTimeInput,
    ScheduleGenerateRequest,
    ScheduleGenerateResponse,
    ScheduleGenerationSessionFilters,
    ScheduleGenerationSessionQueryRequest,
    ScheduleGenerationSessionSort,
    ScheduleRequirementGroup,
    ScheduleSectionDetailResponse,
    ScheduleSummaryResponse,
    Section,
    SortDirection,
)
from backend.api.v1.services import catalogs as catalog_service
from backend.cache.builders import build_generation_session
from backend.cache.fingerprints import (
    build_generation_search_fingerprint,
    build_owner_scope_hash,
)
from backend.cache.models import MeetingDay
from backend.cache.query import (
    CachedBlockedTime,
    GenerationSessionFilters,
    GenerationSessionPage,
    GenerationSessionSort,
    GenerationSessionSortField,
    query_generation_session,
)
from backend.cache.query import (
    SortDirection as CacheSortDirection,
)
from backend.cache.serialization import GenerationSessionSerializationError
from backend.cache.store import GenerationSessionCacheMissError, GenerationSessionStore
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

DAY_CODE_TO_CACHE_DAY = {
    "M": MeetingDay.MONDAY,
    "T": MeetingDay.TUESDAY,
    "W": MeetingDay.WEDNESDAY,
    "R": MeetingDay.THURSDAY,
    "F": MeetingDay.FRIDAY,
    "S": MeetingDay.SATURDAY,
}

PUBLIC_SORT_FIELD_TO_CACHE_SORT_FIELD = {
    GeneratedScheduleSortField.EARLIEST_START: GenerationSessionSortField.EARLIEST_START,
    GeneratedScheduleSortField.LATEST_END: GenerationSessionSortField.LATEST_END,
    GeneratedScheduleSortField.NUM_MEETING_DAYS: GenerationSessionSortField.NUM_MEETING_DAYS,
    GeneratedScheduleSortField.TOTAL_GAP_MINUTES: GenerationSessionSortField.TOTAL_GAP_MINUTES,
    GeneratedScheduleSortField.AVERAGE_INSTRUCTOR_RATING: (
        GenerationSessionSortField.AVERAGE_INSTRUCTOR_RATING
    ),
}


async def generate_schedules_from_request(
    client: Client,
    redis: Redis,
    payload: ScheduleGenerateRequest,
    *,
    user_id: UUID | None,
) -> ScheduleGenerateResponse:
    """Generate transient schedule options from a saved BYOC catalog."""
    settings = get_settings()
    _validate_generation_request_limits(payload)

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

    owner_scope_hash = build_owner_scope_hash(catalog_id=catalog_id, user_id=user_id)
    search_fingerprint = build_generation_search_fingerprint(
        payload=payload,
        sections_by_course=sections_by_course,
    )
    store = GenerationSessionStore(
        client=redis,
        namespace=settings.generation_cache_namespace,
        ttl_seconds=settings.generation_session_ttl_seconds,
        max_results=settings.generation_session_max_results,
        max_bytes=settings.generation_session_max_bytes,
    )

    requirement_groups = _resolve_requirement_groups(
        payload.requirements.groups,
        catalog_courses=target_courses,
        sections_by_course=sections_by_course,
    )
    _validate_requirement_group_limits(requirement_groups)

    candidate_count = _count_requirement_candidates(
        requirement_groups,
        sections_by_course,
    )
    if candidate_count > settings.max_candidate_combinations:
        raise ValueError(
            "Schedule request has "
            f"{candidate_count:,} possible combinations. Reduce the number of "
            "courses or candidate sections before generating."
        )

    session = None
    cached_session_id = await store.find_session_id(
        owner_scope_hash=owner_scope_hash,
        search_fingerprint=search_fingerprint,
    )
    if cached_session_id is not None:
        try:
            session = await store.get_session(cached_session_id)
        except (GenerationSessionCacheMissError, GenerationSessionSerializationError):
            session = None

    if session is None:
        generated = _generate_requirement_group_schedules(
            requirement_groups,
            sections_by_course,
        )
        session = build_generation_session(
            catalog_id=catalog_id,
            sections_by_course=sections_by_course,
            schedules=generated,
            candidate_count=candidate_count,
            owner_scope_hash=owner_scope_hash,
            search_fingerprint=search_fingerprint,
            ttl_seconds=settings.generation_session_ttl_seconds,
        )
        await store.put_session(session)

    query_result = query_generation_session(
        session,
        filters=_build_initial_generation_filters(payload),
        sort=GenerationSessionSort(),
        page=GenerationSessionPage(
            offset=0,
            limit=min(payload.max_results, settings.generation_page_max),
        ),
    )
    sections_by_meeting_id = _index_sections_by_meeting_id(sections_by_course)

    schedules = [
        _build_generated_schedule_response(
            index=index,
            sections=[
                sections_by_meeting_id[catalog_section_meeting_id]
                for catalog_section_meeting_id in (
                    result.selected_catalog_section_meeting_ids
                )
            ],
            result_id=result.result_id,
        )
        for index, result in enumerate(query_result.results, start=1)
    ]

    return ScheduleGenerateResponse(
        session_id=session.session_id,
        candidate_count=session.candidate_count,
        generated_count=session.generated_count,
        filtered_count=query_result.filtered_count,
        valid_count=query_result.filtered_count,
        returned_count=len(schedules),
        page_offset=query_result.offset,
        page_limit=query_result.limit,
        schedules=schedules,
    )


def list_schedules(
    client: Client,
    *,
    favorites_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    campus_patterns: list[str] | None = None,
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

    # 2. Fetch catalog section meeting / instructor data
    classes_lookup = _build_classes_lookup(client, schedules_data)

    # 3. Assemble response objects
    return _assemble_responses(schedules_data, classes_lookup)


async def query_generated_schedule_session(
    client: Client,
    redis: Redis,
    *,
    session_id: str,
    payload: ScheduleGenerationSessionQueryRequest,
) -> ScheduleGenerateResponse:
    """Filter, sort, page, and hydrate an existing cached generation session."""
    settings = get_settings()
    page_limit = min(payload.page.limit, settings.generation_page_max)
    store = GenerationSessionStore(
        client=redis,
        namespace=settings.generation_cache_namespace,
        ttl_seconds=settings.generation_session_ttl_seconds,
        max_results=settings.generation_session_max_results,
        max_bytes=settings.generation_session_max_bytes,
    )
    session = await store.get_session(session_id)
    query_result = query_generation_session(
        session,
        filters=_build_generation_session_filters(payload.filters),
        sort=_build_generation_session_sort(payload.sort),
        page=GenerationSessionPage(
            offset=payload.page.offset,
            limit=page_limit,
        ),
    )
    sections_by_meeting_id = _hydrate_generated_sections(
        client,
        [
            catalog_section_meeting_id
            for result in query_result.results
            for catalog_section_meeting_id in result.selected_catalog_section_meeting_ids
        ],
    )

    schedules = [
        _build_generated_schedule_response(
            index=index,
            sections=[
                sections_by_meeting_id[catalog_section_meeting_id]
                for catalog_section_meeting_id in (
                    result.selected_catalog_section_meeting_ids
                )
            ],
            result_id=result.result_id,
        )
        for index, result in enumerate(query_result.results, start=1)
    ]

    return ScheduleGenerateResponse(
        session_id=session.session_id,
        candidate_count=session.candidate_count,
        generated_count=session.generated_count,
        filtered_count=query_result.filtered_count,
        valid_count=query_result.filtered_count,
        returned_count=len(schedules),
        page_offset=query_result.offset,
        page_limit=query_result.limit,
        schedules=schedules,
    )


# Internal Helpers


def compute_schedule_summary(sections: list[Section]) -> dict:
    """Derive aggregate stats for a single schedule combination."""
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    meetings = [meeting for section in sections for meeting in section.meetings]

    credits = sum(section.credits for section in sections)
    ratings = [section.rating for section in sections if section.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None

    days_hit = {day: any(meeting.day == day for meeting in meetings) for day in days}

    campuses = {meeting.campus for meeting in meetings if meeting.campus}
    if not campuses:
        campus_pattern = "Unspecified"
    elif len(campuses) == 1:
        campus_pattern = f"{next(iter(campuses))}-only"
    else:
        campus_pattern = "Mixed"

    return {
        "total_credits": credits,
        "total_instructor_score": avg_rating,
        "num_sections": len(sections),
        "meets_mon": days_hit["Mon"],
        "meets_tue": days_hit["Tue"],
        "meets_wed": days_hit["Wed"],
        "meets_thu": days_hit["Thu"],
        "meets_fri": days_hit["Fri"],
        "meets_sat": days_hit["Sat"],
        "earliest_start": min(meeting.start for meeting in meetings).isoformat(),
        "latest_end": max(meeting.end for meeting in meetings).isoformat(),
        "campus_pattern": campus_pattern,
    }


def _validate_generation_request_limits(payload: ScheduleGenerateRequest) -> None:
    settings = get_settings()
    if payload.max_results > settings.max_results:
        raise ValueError(f"maxResults cannot be greater than {settings.max_results}")
    if len(payload.preferences.blocked_times) > settings.max_blocked_times:
        raise ValueError(
            f"blockedTimes cannot include more than {settings.max_blocked_times} items"
        )
    if len(payload.preferences.instructor_ratings) > settings.max_instructor_ratings:
        raise ValueError(
            "instructorRatings cannot include more than "
            f"{settings.max_instructor_ratings} entries"
        )


def _validate_requirement_group_limits(
    requirement_groups: list[ScheduleRequirementGroup],
) -> None:
    settings = get_settings()
    selected_course_count = sum(group.choose for group in requirement_groups)
    if selected_course_count > settings.max_catalog_courses:
        raise ValueError(
            f"Schedule requests cannot select more than {settings.max_catalog_courses} "
            "course buckets"
        )


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

        if not catalog_section.meetings:
            raise ValueError(
                f"Catalog section {catalog_section.course_name} has no candidate rows"
            )

        for catalog_meeting in catalog_section.meetings:
            section_counts_by_course[course_key] = (
                section_counts_by_course.get(course_key, 0) + 1
            )
            section_index = section_counts_by_course[course_key]
            section_code = (
                catalog_meeting.crn or f"{catalog_section.course_name}-{section_index}"
            )
            instructor_name = catalog_meeting.instructor_name or ""
            rating = (
                instructor_ratings.get(instructor_name) if instructor_name else None
            )
            meetings = [
                Meeting(
                    day=day,
                    start=catalog_meeting.start_time,
                    end=catalog_meeting.end_time,
                    campus="Unspecified",
                )
                for day in _expand_meeting_days(catalog_meeting.days)
            ]

            sections_by_course[course_key].append(
                Section(
                    catalog_section_id=catalog_section.id,
                    catalog_section_meeting_id=catalog_meeting.id,
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


def _resolve_requirement_groups(
    request_groups: list[ScheduleRequirementGroup],
    *,
    catalog_courses: list[str],
    sections_by_course: dict[str, list[Section]],
) -> list[ScheduleRequirementGroup]:
    """Return explicit CNF groups, or the legacy all-courses-required groups."""
    if not request_groups:
        return [
            ScheduleRequirementGroup(course_names=[course_name])
            for course_name in catalog_courses
        ]

    catalog_course_names = set(sections_by_course)
    resolved_groups: list[ScheduleRequirementGroup] = []
    for group in request_groups:
        missing = [
            course_name
            for course_name in group.course_names
            if course_name not in catalog_course_names
        ]
        if missing:
            raise ValueError(
                "Requirement group references unknown courseName(s): "
                + ", ".join(missing)
            )
        resolved_groups.append(group)

    return resolved_groups


def _count_requirement_candidates(
    requirement_groups: list[ScheduleRequirementGroup],
    sections_by_course: dict[str, list[Section]],
) -> int:
    group_counts = [
        _count_group_candidates(group, sections_by_course)
        for group in requirement_groups
    ]
    return math.prod(group_counts)


def _count_group_candidates(
    group: ScheduleRequirementGroup,
    sections_by_course: dict[str, list[Section]],
) -> int:
    return sum(
        math.prod(len(sections_by_course[course_name]) for course_name in course_names)
        for course_names in itertools.combinations(group.course_names, group.choose)
    )


def _generate_requirement_group_schedules(
    requirement_groups: list[ScheduleRequirementGroup],
    sections_by_course: dict[str, list[Section]],
) -> list[list[Section]]:
    group_options = [
        _build_group_section_options(group, sections_by_course)
        for group in requirement_groups
    ]

    schedules: list[list[Section]] = []
    for group_choice in itertools.product(*group_options):
        sections = [
            section
            for selected_group_sections in group_choice
            for section in selected_group_sections
        ]
        if _has_duplicate_courses_or_sections(sections):
            continue
        if _has_time_conflict(sections):
            continue
        schedules.append(sections)

    return schedules


def _build_group_section_options(
    group: ScheduleRequirementGroup,
    sections_by_course: dict[str, list[Section]],
) -> list[list[Section]]:
    options: list[list[Section]] = []
    for course_names in itertools.combinations(group.course_names, group.choose):
        section_pools = [
            sections_by_course[course_name] for course_name in course_names
        ]
        options.extend([list(combo) for combo in itertools.product(*section_pools)])
    return options


def _has_duplicate_courses_or_sections(sections: list[Section]) -> bool:
    course_names = [section.course_name for section in sections]
    if len(set(course_names)) != len(course_names):
        return True

    catalog_section_meeting_ids = [
        section.catalog_section_meeting_id
        for section in sections
        if section.catalog_section_meeting_id is not None
    ]
    return len(set(catalog_section_meeting_ids)) != len(catalog_section_meeting_ids)


def _has_time_conflict(sections: list[Section]) -> bool:
    meetings = [meeting for section in sections for meeting in section.meetings]
    for index, first in enumerate(meetings):
        for second in meetings[index + 1 :]:
            if _meetings_overlap(first, second):
                return True
    return False


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


def _build_initial_generation_filters(
    payload: ScheduleGenerateRequest,
) -> GenerationSessionFilters:
    return GenerationSessionFilters(
        blocked_times=_build_cached_blocked_times(payload.preferences.blocked_times),
    )


def _build_generation_session_filters(
    filters: ScheduleGenerationSessionFilters,
) -> GenerationSessionFilters:
    return GenerationSessionFilters(
        blocked_times=tuple(_build_cached_blocked_times(filters.blocked_times)),
        excluded_days=tuple(
            DAY_CODE_TO_CACHE_DAY[day] for day in filters.excluded_days
        ),
        not_before=filters.not_before,
        not_after=filters.not_after,
        max_meeting_days=filters.max_meeting_days,
        max_total_gap_minutes=filters.max_total_gap_minutes,
        max_single_gap_minutes=filters.max_single_gap_minutes,
        minimum_instructor_rating=filters.minimum_instructor_rating,
        allow_unrated_instructors=filters.allow_unrated_instructors,
    )


def _build_generation_session_sort(
    sort: ScheduleGenerationSessionSort,
) -> GenerationSessionSort:
    return GenerationSessionSort(
        field=PUBLIC_SORT_FIELD_TO_CACHE_SORT_FIELD[sort.field],
        direction=(
            CacheSortDirection.DESC
            if sort.direction == SortDirection.DESC
            else CacheSortDirection.ASC
        ),
    )


def _build_cached_blocked_times(
    blocked_times: list[ScheduleGenerateBlockedTimeInput],
) -> tuple[CachedBlockedTime, ...]:
    return tuple(
        CachedBlockedTime(
            day=DAY_CODE_TO_CACHE_DAY[day],
            start_time=blocked_time.start_time,
            end_time=blocked_time.end_time,
        )
        for blocked_time in blocked_times
        for day in blocked_time.days
    )


def _index_sections_by_meeting_id(
    sections_by_course: dict[str, list[Section]],
) -> dict[UUID, Section]:
    sections_by_meeting_id: dict[UUID, Section] = {}
    for sections in sections_by_course.values():
        for section in sections:
            if section.catalog_section_meeting_id is None:
                raise ValueError(
                    "Generated sections must include catalogSectionMeetingId"
                )
            sections_by_meeting_id[section.catalog_section_meeting_id] = section
    return sections_by_meeting_id


def _hydrate_generated_sections(
    client: Client,
    catalog_section_meeting_ids: list[UUID],
) -> dict[UUID, Section]:
    if not catalog_section_meeting_ids:
        return {}

    unique_meeting_ids = sorted(set(catalog_section_meeting_ids))
    meeting_rows = (
        client.table("catalog_section_meetings")
        .select("id, section_id, crn, instructor_name, days, start_time, end_time")
        .in_("id", [str(meeting_id) for meeting_id in unique_meeting_ids])
        .execute()
        .data
        or []
    )
    section_ids = sorted({str(row["section_id"]) for row in meeting_rows})
    section_rows = (
        client.table("catalog_sections")
        .select("id, course_name")
        .in_("id", section_ids)
        .execute()
        .data
        or []
    )
    sections_by_id = {str(row["id"]): row for row in section_rows}

    hydrated: dict[UUID, Section] = {}
    for row in meeting_rows:
        meeting_id = UUID(str(row["id"]))
        section_id = UUID(str(row["section_id"]))
        section_row = sections_by_id.get(str(section_id), {})
        meetings = [
            Meeting(
                day=day,
                start=row["start_time"],
                end=row["end_time"],
                campus="Unspecified",
            )
            for day in _expand_meeting_days(row["days"] or "")
        ]
        hydrated[meeting_id] = Section(
            catalog_section_id=section_id,
            catalog_section_meeting_id=meeting_id,
            course_name=section_row.get("course_name") or "Unknown course",
            section_code=row.get("crn") or str(meeting_id),
            title="",
            credits=0,
            instructor=row.get("instructor_name") or "",
            meetings=meetings,
        )

    missing_ids = set(unique_meeting_ids).difference(hydrated)
    if missing_ids:
        raise ValueError("Cached generation session references missing catalog rows")

    return hydrated


def _meetings_overlap(first: Meeting, second: Meeting) -> bool:
    return first.day == second.day and max(first.start, second.start) < min(
        first.end, second.end
    )


def _build_generated_schedule_response(
    *,
    index: int,
    sections: list[Section],
    result_id: str | None = None,
) -> GeneratedScheduleResponse:
    summary = compute_schedule_summary(sections)

    return GeneratedScheduleResponse(
        result_id=result_id or f"generated-{index}",
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
    if section.catalog_section_id is None:
        raise ValueError("Generated catalog sections must include catalogSectionId")
    if section.catalog_section_meeting_id is None:
        raise ValueError(
            "Generated catalog sections must include catalogSectionMeetingId"
        )

    return GeneratedSectionResponse(
        catalog_section_id=section.catalog_section_id,
        catalog_section_meeting_id=section.catalog_section_meeting_id,
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
    """Fetch catalog bucket and meeting details for saved schedule sections."""
    section_ids: set[str] = set()
    meeting_ids: set[str] = set()
    for sched in schedules_data:
        for sec in sched.get("saved_schedule_sections", []):
            sect_id = sec.get("catalog_section_id")
            if sect_id:
                section_ids.add(str(sect_id))
            meeting_id = sec.get("catalog_section_meeting_id")
            if meeting_id:
                meeting_ids.add(str(meeting_id))

    if not section_ids and not meeting_ids:
        return {}

    meetings_rows: list[dict] = []
    if meeting_ids:
        meetings_rows.extend(
            (
                client.table("catalog_section_meetings")
                .select(
                    "id, section_id, crn, instructor_name, days, start_time, end_time"
                )
                .in_("id", list(meeting_ids))
                .execute()
                .data
                or []
            )
        )
        section_ids.update(str(row["section_id"]) for row in meetings_rows)
    else:
        meetings_rows.extend(
            (
                client.table("catalog_section_meetings")
                .select(
                    "id, section_id, crn, instructor_name, days, start_time, end_time"
                )
                .in_("section_id", list(section_ids))
                .execute()
                .data
                or []
            )
        )

    sections_by_id: dict[str, dict] = {}
    if section_ids:
        sections_resp = (
            client.table("catalog_sections")
            .select("id, course_name, source_metadata")
            .in_("id", list(section_ids))
            .execute()
        )
        sections_by_id = {row["id"]: row for row in sections_resp.data or []}

    lookup: dict[str, dict] = {}
    for row in meetings_rows:
        sect_id = str(row["section_id"])
        meeting_id = str(row["id"])
        sect_data = sections_by_id.get(sect_id, {})
        metadata = sect_data.get("source_metadata") or {}

        modality = metadata.get("modality")
        instructor_rating = metadata.get("instructor_rating")
        if instructor_rating is None:
            instructor_rating = metadata.get("rating")

        details = {
            "catalog_section_id": sect_id,
            "catalog_section_meeting_id": meeting_id,
            "course_name": sect_data.get("course_name"),
            "section_code": row.get("crn") or meeting_id,
            "modality": modality,
            "instructor_name": row.get("instructor_name")
            or metadata.get("instructor_name"),
            "instructor_rating": instructor_rating,
            "meetings": [],
            "source_metadata": metadata,
        }
        lookup[meeting_id] = details
        lookup.setdefault(sect_id, details)

        days = row["days"] or ""
        start = row["start_time"]
        end = row["end_time"]

        for day_code in days:
            day_name = DAY_CODE_TO_NAME.get(day_code)
            if day_name:
                details["meetings"].append(
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
            meeting_id = (
                str(sec["catalog_section_meeting_id"])
                if sec.get("catalog_section_meeting_id")
                else None
            )
            extra = (
                classes_lookup.get(meeting_id)
                if meeting_id
                else classes_lookup.get(sect_id)
                if sect_id
                else None
            )

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

            course_name = sec.get("course_name") or (extra or {}).get("course_name")
            section_code = (
                sec.get("section_code")
                or sec.get("crn")
                or (extra or {}).get("section_code")
            )
            course_title = sec.get("course_title") or course_name

            sections.append(
                ScheduleSectionDetailResponse(
                    catalog_section_id=sect_id,
                    catalog_section_meeting_id=meeting_id,
                    course_name=course_name,
                    subject_code=sec.get("subject_code"),
                    course_number=sec.get("course_number"),
                    section_code=section_code,
                    course_title=course_title,
                    credits=sec.get("credits") or 0,
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
