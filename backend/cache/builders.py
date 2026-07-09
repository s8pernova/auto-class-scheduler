"""Build Redis generation-session payloads from scheduler output.

The scheduler currently works with API-facing ``Section`` objects. Redis should
store the smaller internal cache contract from ``backend.cache.models``. This
module is the adapter between those two representations.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, time, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from uuid import UUID

from backend.api.v1.schemas.schedules import Meeting, Section
from backend.cache.models import (
    CachedCandidate,
    CachedGenerationSession,
    CachedMeetingInterval,
    CachedScheduleResult,
    CachedScheduleSummary,
    MeetingDay,
)

DEFAULT_GENERATION_ALGORITHM_VERSION = "schedule-generator-v1"

_DAY_NAME_TO_CACHE_DAY = {
    "mon": MeetingDay.MONDAY,
    "monday": MeetingDay.MONDAY,
    "tue": MeetingDay.TUESDAY,
    "tues": MeetingDay.TUESDAY,
    "tuesday": MeetingDay.TUESDAY,
    "wed": MeetingDay.WEDNESDAY,
    "wednesday": MeetingDay.WEDNESDAY,
    "thu": MeetingDay.THURSDAY,
    "thur": MeetingDay.THURSDAY,
    "thurs": MeetingDay.THURSDAY,
    "thursday": MeetingDay.THURSDAY,
    "fri": MeetingDay.FRIDAY,
    "friday": MeetingDay.FRIDAY,
    "sat": MeetingDay.SATURDAY,
    "saturday": MeetingDay.SATURDAY,
}


def build_generation_session(
    *,
    catalog_id: UUID,
    sections_by_course: Mapping[str, Sequence[Section]],
    schedules: Sequence[Sequence[Section]],
    candidate_count: int,
    owner_scope_hash: str,
    search_fingerprint: str,
    ttl_seconds: int,
    algorithm_version: str = DEFAULT_GENERATION_ALGORITHM_VERSION,
    created_at: datetime | None = None,
    session_id: str | None = None,
) -> CachedGenerationSession:
    """Build a complete cached session from valid generated schedules.

    ``candidate_count`` is the complete search-space combination count, not the
    number of selectable catalog rows.
    """
    if ttl_seconds <= 0:
        raise ValueError("ttl_seconds must be positive")
    if candidate_count < len(schedules):
        raise ValueError("candidate_count cannot be smaller than generated schedules")

    created_at = _normalize_created_at(created_at)
    expires_at = created_at + timedelta(seconds=ttl_seconds)
    session_id = session_id or _new_session_id()

    return CachedGenerationSession(
        algorithm_version=algorithm_version,
        session_id=session_id,
        owner_scope_hash=owner_scope_hash,
        catalog_id=catalog_id,
        search_fingerprint=search_fingerprint,
        created_at=created_at,
        expires_at=expires_at,
        candidate_count=candidate_count,
        generated_count=len(schedules),
        candidates=_build_candidates(sections_by_course),
        results=tuple(
            _build_result(index=index, sections=sections)
            for index, sections in enumerate(schedules, start=1)
        ),
    )


def build_schedule_summary(sections: Sequence[Section]) -> CachedScheduleSummary:
    """Compute cached filter/sort metrics for one generated schedule."""
    if not sections:
        raise ValueError("sections are required")

    meetings = _collect_meetings(sections)
    meeting_days = tuple(day for day in MeetingDay if _meets_on_day(meetings, day))
    ratings = [section.rating for section in sections if section.rating is not None]
    unrated_count = sum(1 for section in sections if section.rating is None)
    total_gap_minutes, max_single_gap_minutes = _compute_gap_minutes(meetings)

    return CachedScheduleSummary(
        meeting_days=meeting_days,
        num_meeting_days=len(meeting_days),
        earliest_start=min(meeting.start_time for meeting in meetings),
        latest_end=max(meeting.end_time for meeting in meetings),
        total_gap_minutes=total_gap_minutes,
        max_single_gap_minutes=max_single_gap_minutes,
        average_instructor_rating=(
            round(sum(ratings) / len(ratings), 2) if ratings else None
        ),
        rated_instructor_count=len(ratings),
        unrated_instructor_count=unrated_count,
    )


def _build_candidates(
    sections_by_course: Mapping[str, Sequence[Section]],
) -> tuple[CachedCandidate, ...]:
    candidates_by_id: dict[UUID, CachedCandidate] = {}

    for sections in sections_by_course.values():
        for section in sections:
            catalog_section_meeting_id = _require_catalog_section_meeting_id(section)
            candidate = CachedCandidate(
                catalog_section_meeting_id=catalog_section_meeting_id,
                meetings=tuple(
                    _build_meeting_interval(meeting) for meeting in section.meetings
                ),
                instructor_rating=section.rating,
            )
            existing = candidates_by_id.get(catalog_section_meeting_id)
            if existing is not None and existing != candidate:
                raise ValueError(
                    "sections_by_course contains conflicting candidate facts for "
                    f"{catalog_section_meeting_id}"
                )
            candidates_by_id[catalog_section_meeting_id] = candidate

    return tuple(
        candidates_by_id[candidate_id] for candidate_id in sorted(candidates_by_id)
    )


def _build_result(
    *,
    index: int,
    sections: Sequence[Section],
) -> CachedScheduleResult:
    selected_ids = tuple(
        _require_catalog_section_meeting_id(section) for section in sections
    )
    signature = ":".join(str(candidate_id) for candidate_id in selected_ids)
    digest = sha256(signature.encode("utf-8")).hexdigest()[:16]

    return CachedScheduleResult(
        result_id=f"result_{index:05d}_{digest}",
        selected_catalog_section_meeting_ids=selected_ids,
        summary=build_schedule_summary(sections),
    )


def _collect_meetings(sections: Sequence[Section]) -> list[CachedMeetingInterval]:
    meetings = [
        _build_meeting_interval(meeting)
        for section in sections
        for meeting in section.meetings
    ]
    if not meetings:
        raise ValueError("sections must contain at least one meeting")
    return meetings


def _build_meeting_interval(meeting: Meeting) -> CachedMeetingInterval:
    return CachedMeetingInterval(
        day=_to_meeting_day(meeting.day),
        start_time=meeting.start,
        end_time=meeting.end,
    )


def _to_meeting_day(day: str) -> MeetingDay:
    normalized = day.strip().lower()
    if normalized in _DAY_NAME_TO_CACHE_DAY:
        return _DAY_NAME_TO_CACHE_DAY[normalized]
    try:
        return MeetingDay(day.strip().upper())
    except ValueError as exc:
        raise ValueError(
            "Unknown meeting day. Use M, T, W, R, F, S or weekday names."
        ) from exc


def _compute_gap_minutes(meetings: Sequence[CachedMeetingInterval]) -> tuple[int, int]:
    total_gap_minutes = 0
    max_single_gap_minutes = 0

    for day in MeetingDay:
        day_meetings = sorted(
            (meeting for meeting in meetings if meeting.day == day),
            key=lambda meeting: meeting.start_time,
        )
        for previous, current in zip(day_meetings, day_meetings[1:]):
            gap_minutes = max(
                0,
                _time_to_minutes(current.start_time)
                - _time_to_minutes(previous.end_time),
            )
            total_gap_minutes += gap_minutes
            max_single_gap_minutes = max(max_single_gap_minutes, gap_minutes)

    return total_gap_minutes, max_single_gap_minutes


def _meets_on_day(
    meetings: Sequence[CachedMeetingInterval],
    day: MeetingDay,
) -> bool:
    return any(meeting.day == day for meeting in meetings)


def _require_catalog_section_meeting_id(section: Section) -> UUID:
    if section.catalog_section_meeting_id is None:
        raise ValueError("Generated sections must include catalogSectionMeetingId")
    return section.catalog_section_meeting_id


def _normalize_created_at(created_at: datetime | None) -> datetime:
    if created_at is None:
        return datetime.now(UTC)
    if created_at.tzinfo is None or created_at.utcoffset() is None:
        raise ValueError("created_at must be timezone-aware")
    return created_at


def _new_session_id() -> str:
    return f"schedgen_{token_urlsafe(24)}"


def _time_to_minutes(value: time) -> int:
    return value.hour * 60 + value.minute
