"""Pure filter, sort, and pagination logic for cached generation sessions.

This module deliberately does not talk to Redis, Supabase, FastAPI, or React.
Given a typed cached session plus typed view controls, it returns the matching
cached result rows. Keeping this pure is what makes ADR 18 testable and keeps
future generator optimizations from changing API semantics.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import time
from enum import StrEnum
from uuid import UUID

from pydantic import Field, model_validator

from backend.cache.models import (
    CachedCandidate,
    CachedGenerationSession,
    CachedMeetingInterval,
    CachedScheduleResult,
    CacheModel,
    MeetingDay,
)


class GenerationSessionSortField(StrEnum):
    """Supported single-field sort keys for cached generated schedules."""

    EARLIEST_START = "earliest_start"
    LATEST_END = "latest_end"
    NUM_MEETING_DAYS = "num_meeting_days"
    TOTAL_GAP_MINUTES = "total_gap_minutes"
    AVERAGE_INSTRUCTOR_RATING = "average_instructor_rating"


class SortDirection(StrEnum):
    """Sort direction for a supported generated-schedule sort key."""

    ASC = "asc"
    DESC = "desc"


class CachedBlockedTime(CacheModel):
    """A day-specific time range that generated schedules may not overlap."""

    day: MeetingDay
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_time_order(self) -> "CachedBlockedTime":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class GenerationSessionFilters(CacheModel):
    """Typed filters that can be evaluated from cached session facts."""

    excluded_days: tuple[MeetingDay, ...] = ()
    blocked_times: tuple[CachedBlockedTime, ...] = ()
    not_before: time | None = None
    not_after: time | None = None
    max_meeting_days: int | None = Field(default=None, ge=1)
    max_total_gap_minutes: int | None = Field(default=None, ge=0)
    max_single_gap_minutes: int | None = Field(default=None, ge=0)
    minimum_instructor_rating: float | None = Field(default=None, ge=0, le=5)
    allow_unrated_instructors: bool = True

    @model_validator(mode="after")
    def validate_time_window(self) -> "GenerationSessionFilters":
        if (
            self.not_before is not None
            and self.not_after is not None
            and self.not_after <= self.not_before
        ):
            raise ValueError("not_after must be after not_before")
        if len(set(self.excluded_days)) != len(self.excluded_days):
            raise ValueError("excluded_days cannot contain duplicates")
        return self


class GenerationSessionSort(CacheModel):
    """Single-field deterministic sort for cached generated schedules."""

    field: GenerationSessionSortField = GenerationSessionSortField.EARLIEST_START
    direction: SortDirection = SortDirection.ASC


class GenerationSessionPage(CacheModel):
    """Offset pagination request over filtered cached results."""

    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1)


@dataclass(frozen=True, slots=True)
class GenerationSessionQueryResult:
    """Results and counts after applying filters, sort, and pagination."""

    generated_count: int
    filtered_count: int
    returned_count: int
    offset: int
    limit: int
    results: tuple[CachedScheduleResult, ...]


def query_generation_session(
    session: CachedGenerationSession,
    *,
    filters: GenerationSessionFilters,
    sort: GenerationSessionSort,
    page: GenerationSessionPage,
) -> GenerationSessionQueryResult:
    """Apply ADR 18 view controls to a complete cached generation session."""
    candidates_by_id = _index_candidates(session)
    filtered = tuple(
        result
        for result in session.results
        if _matches_filters(result, candidates_by_id, filters)
    )
    sorted_results = tuple(_sort_results(filtered, sort))
    page_results = sorted_results[page.offset : page.offset + page.limit]

    return GenerationSessionQueryResult(
        generated_count=session.generated_count,
        filtered_count=len(filtered),
        returned_count=len(page_results),
        offset=page.offset,
        limit=page.limit,
        results=page_results,
    )


def _matches_filters(
    result: CachedScheduleResult,
    candidates_by_id: dict[UUID, CachedCandidate],
    filters: GenerationSessionFilters,
) -> bool:
    summary = result.summary
    selected_candidates = [
        candidates_by_id[candidate_id]
        for candidate_id in result.selected_catalog_section_meeting_ids
    ]
    meetings = [
        meeting for candidate in selected_candidates for meeting in candidate.meetings
    ]

    if filters.excluded_days and any(
        meeting.day in filters.excluded_days for meeting in meetings
    ):
        return False

    if filters.blocked_times and any(
        _interval_overlaps_blocked_time(meeting, blocked_time)
        for meeting in meetings
        for blocked_time in filters.blocked_times
    ):
        return False

    if filters.not_before and any(
        meeting.start_time < filters.not_before for meeting in meetings
    ):
        return False

    if filters.not_after and any(
        meeting.end_time > filters.not_after for meeting in meetings
    ):
        return False

    if (
        filters.max_meeting_days is not None
        and summary.num_meeting_days > filters.max_meeting_days
    ):
        return False

    if (
        filters.max_total_gap_minutes is not None
        and summary.total_gap_minutes > filters.max_total_gap_minutes
    ):
        return False

    if (
        filters.max_single_gap_minutes is not None
        and summary.max_single_gap_minutes > filters.max_single_gap_minutes
    ):
        return False

    return _matches_rating_filters(selected_candidates, filters)


def _matches_rating_filters(
    selected_candidates: list[CachedCandidate],
    filters: GenerationSessionFilters,
) -> bool:
    for candidate in selected_candidates:
        rating = candidate.instructor_rating
        if rating is None:
            if not filters.allow_unrated_instructors:
                return False
            continue
        if (
            filters.minimum_instructor_rating is not None
            and rating < filters.minimum_instructor_rating
        ):
            return False
    return True


def _sort_results(
    results: tuple[CachedScheduleResult, ...],
    sort: GenerationSessionSort,
) -> list[CachedScheduleResult]:
    return sorted(
        results,
        key=lambda result: _sort_key(result, sort),
    )


def _sort_key(
    result: CachedScheduleResult,
    sort: GenerationSessionSort,
) -> tuple[int, int | float, tuple[str, ...]]:
    raw_value = _sort_value(result, sort.field)
    missing = int(raw_value is None)
    value = raw_value or 0
    if sort.direction == SortDirection.DESC:
        value = -value

    return (
        missing,
        value,
        tuple(
            str(candidate_id)
            for candidate_id in result.selected_catalog_section_meeting_ids
        ),
    )


def _sort_value(
    result: CachedScheduleResult,
    field: GenerationSessionSortField,
) -> int | float | None:
    summary = result.summary
    if field == GenerationSessionSortField.EARLIEST_START:
        return _time_to_minutes(summary.earliest_start)
    if field == GenerationSessionSortField.LATEST_END:
        return _time_to_minutes(summary.latest_end)
    if field == GenerationSessionSortField.NUM_MEETING_DAYS:
        return summary.num_meeting_days
    if field == GenerationSessionSortField.TOTAL_GAP_MINUTES:
        return summary.total_gap_minutes
    if field == GenerationSessionSortField.AVERAGE_INSTRUCTOR_RATING:
        return summary.average_instructor_rating
    raise ValueError(f"Unsupported generation session sort field: {field}")


def _interval_overlaps_blocked_time(
    meeting: CachedMeetingInterval,
    blocked_time: CachedBlockedTime,
) -> bool:
    return meeting.day == blocked_time.day and max(
        meeting.start_time,
        blocked_time.start_time,
    ) < min(meeting.end_time, blocked_time.end_time)


def _index_candidates(
    session: CachedGenerationSession,
) -> dict[UUID, CachedCandidate]:
    return {
        candidate.catalog_section_meeting_id: candidate
        for candidate in session.candidates
    }


def _time_to_minutes(value: time) -> int:
    return value.hour * 60 + value.minute
