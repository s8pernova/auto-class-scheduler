from __future__ import annotations

import unittest
from datetime import UTC, datetime, time, timedelta
from uuid import UUID

from backend.cache.models import (
    CachedCandidate,
    CachedGenerationSession,
    CachedMeetingInterval,
    CachedScheduleResult,
    CachedScheduleSummary,
    MeetingDay,
)
from backend.cache.query import (
    CachedBlockedTime,
    GenerationSessionFilters,
    GenerationSessionPage,
    GenerationSessionQueryResult,
    GenerationSessionSort,
    GenerationSessionSortField,
    SortDirection,
    query_generation_session,
)

MORNING_ID = UUID("11111111-1111-1111-1111-111111111111")
AFTERNOON_ID = UUID("22222222-2222-2222-2222-222222222222")
UNRATED_ID = UUID("33333333-3333-3333-3333-333333333333")
MULTIDAY_ID = UUID("44444444-4444-4444-4444-444444444444")


class GenerationSessionQueryTests(unittest.TestCase):
    def test_day_and_time_filters_apply_to_the_complete_session(self) -> None:
        session = _session()

        excluded = _query(
            session,
            filters=GenerationSessionFilters(
                excluded_days=(MeetingDay.MONDAY,),
            ),
        )
        window = _query(
            session,
            filters=GenerationSessionFilters(
                not_before=time(12),
                not_after=time(15),
            ),
        )

        self.assertEqual(_ids(excluded), ["afternoon"])
        self.assertEqual(_ids(window), ["afternoon"])

    def test_blocked_time_uses_half_open_interval_boundaries(self) -> None:
        session = _session()

        touching = _query(
            session,
            filters=GenerationSessionFilters(
                blocked_times=(
                    CachedBlockedTime(
                        day=MeetingDay.MONDAY,
                        start_time=time(10),
                        end_time=time(11),
                    ),
                )
            ),
        )
        overlapping = _query(
            session,
            filters=GenerationSessionFilters(
                blocked_times=(
                    CachedBlockedTime(
                        day=MeetingDay.MONDAY,
                        start_time=time(9, 30),
                        end_time=time(10, 30),
                    ),
                )
            ),
        )

        self.assertIn("morning", _ids(touching))
        self.assertNotIn("morning", _ids(overlapping))

    def test_meeting_day_and_gap_limits_use_cached_summaries(self) -> None:
        session = _session()

        result = _query(
            session,
            filters=GenerationSessionFilters(
                max_meeting_days=1,
                max_total_gap_minutes=60,
                max_single_gap_minutes=60,
            ),
        )

        self.assertEqual(_ids(result), ["morning", "unrated", "afternoon"])

    def test_rating_policy_handles_thresholds_and_unrated_instructors(self) -> None:
        session = _session()

        allow_unrated = _query(
            session,
            filters=GenerationSessionFilters(minimum_instructor_rating=4),
        )
        rated_only = _query(
            session,
            filters=GenerationSessionFilters(
                minimum_instructor_rating=4,
                allow_unrated_instructors=False,
            ),
        )

        self.assertEqual(_ids(allow_unrated), ["morning", "multiday", "unrated"])
        self.assertEqual(_ids(rated_only), ["morning", "multiday"])

    def test_sort_is_global_deterministic_and_keeps_missing_ratings_last(self) -> None:
        session = _session()

        descending = _query(
            session,
            sort=GenerationSessionSort(
                field=GenerationSessionSortField.AVERAGE_INSTRUCTOR_RATING,
                direction=SortDirection.DESC,
            ),
        )

        self.assertEqual(
            _ids(descending),
            ["morning", "multiday", "afternoon", "unrated"],
        )

    def test_pagination_happens_after_filtering_and_sorting(self) -> None:
        session = _session()
        result = query_generation_session(
            session,
            filters=GenerationSessionFilters(),
            sort=GenerationSessionSort(),
            page=GenerationSessionPage(offset=1, limit=2),
        )

        self.assertEqual(result.generated_count, 4)
        self.assertEqual(result.filtered_count, 4)
        self.assertEqual(result.returned_count, 2)
        self.assertEqual(_ids(result), ["multiday", "unrated"])


def _query(
    session: CachedGenerationSession,
    *,
    filters: GenerationSessionFilters | None = None,
    sort: GenerationSessionSort | None = None,
) -> GenerationSessionQueryResult:
    return query_generation_session(
        session,
        filters=filters or GenerationSessionFilters(),
        sort=sort or GenerationSessionSort(),
        page=GenerationSessionPage(offset=0, limit=100),
    )


def _ids(result: GenerationSessionQueryResult) -> list[str]:
    return [item.result_id for item in result.results]


def _session() -> CachedGenerationSession:
    created_at = datetime(2026, 7, 10, 12, tzinfo=UTC)
    candidates = (
        _candidate(MORNING_ID, MeetingDay.MONDAY, time(9), time(10), rating=4.8),
        _candidate(AFTERNOON_ID, MeetingDay.WEDNESDAY, time(13), time(14), rating=2.5),
        _candidate(UNRATED_ID, MeetingDay.MONDAY, time(11), time(12), rating=None),
        CachedCandidate(
            catalog_section_meeting_id=MULTIDAY_ID,
            instructor_rating=4.8,
            meetings=(
                CachedMeetingInterval(
                    day=MeetingDay.MONDAY,
                    start_time=time(9),
                    end_time=time(10),
                ),
                CachedMeetingInterval(
                    day=MeetingDay.MONDAY,
                    start_time=time(12),
                    end_time=time(13),
                ),
                CachedMeetingInterval(
                    day=MeetingDay.THURSDAY,
                    start_time=time(9),
                    end_time=time(10),
                ),
            ),
        ),
    )
    results = (
        _result("morning", MORNING_ID, (MeetingDay.MONDAY,), time(9), time(10), 0, 0, 4.8, 1, 0),
        _result("afternoon", AFTERNOON_ID, (MeetingDay.WEDNESDAY,), time(13), time(14), 0, 0, 2.5, 1, 0),
        _result("unrated", UNRATED_ID, (MeetingDay.MONDAY,), time(11), time(12), 0, 0, None, 0, 1),
        _result("multiday", MULTIDAY_ID, (MeetingDay.MONDAY, MeetingDay.THURSDAY), time(9), time(13), 120, 120, 4.8, 1, 0),
    )
    return CachedGenerationSession(
        algorithm_version="test-v1",
        session_id="schedgen_querytests",
        owner_scope_hash="a" * 64,
        catalog_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        search_fingerprint="b" * 64,
        created_at=created_at,
        expires_at=created_at + timedelta(minutes=30),
        candidate_count=4,
        generated_count=4,
        candidates=candidates,
        results=results,
    )


def _candidate(
    candidate_id: UUID,
    day: MeetingDay,
    start: time,
    end: time,
    *,
    rating: float | None,
) -> CachedCandidate:
    return CachedCandidate(
        catalog_section_meeting_id=candidate_id,
        instructor_rating=rating,
        meetings=(CachedMeetingInterval(day=day, start_time=start, end_time=end),),
    )


def _result(
    result_id: str,
    candidate_id: UUID,
    meeting_days: tuple[MeetingDay, ...],
    earliest_start: time,
    latest_end: time,
    total_gap_minutes: int,
    max_single_gap_minutes: int,
    average_rating: float | None,
    rated_count: int,
    unrated_count: int,
) -> CachedScheduleResult:
    return CachedScheduleResult(
        result_id=result_id,
        selected_catalog_section_meeting_ids=(candidate_id,),
        summary=CachedScheduleSummary(
            meeting_days=meeting_days,
            num_meeting_days=len(meeting_days),
            earliest_start=earliest_start,
            latest_end=latest_end,
            total_gap_minutes=total_gap_minutes,
            max_single_gap_minutes=max_single_gap_minutes,
            average_instructor_rating=average_rating,
            rated_instructor_count=rated_count,
            unrated_instructor_count=unrated_count,
        ),
    )


if __name__ == "__main__":
    unittest.main()
