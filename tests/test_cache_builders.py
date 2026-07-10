from __future__ import annotations

import unittest
from datetime import UTC, datetime, time
from uuid import UUID

from backend.api.v1.schemas.schedules import Meeting, Section
from backend.cache.builders import build_generation_session, build_schedule_summary
from backend.cache.models import MeetingDay

CATALOG_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
MATH_MEETING_ID = UUID("11111111-1111-1111-1111-111111111111")
BIO_MEETING_ID = UUID("22222222-2222-2222-2222-222222222222")
OWNER_SCOPE_HASH = "a" * 64
SEARCH_FINGERPRINT = "b" * 64


class CacheBuilderTests(unittest.TestCase):
    def test_build_generation_session_from_generated_schedules(self) -> None:
        math = _section(
            meeting_id=MATH_MEETING_ID,
            course_name="MATH 101",
            day="Mon",
            start=time(9),
            end=time(10),
            rating=4.5,
        )
        bio = _section(
            meeting_id=BIO_MEETING_ID,
            course_name="BIO 101",
            day="Wed",
            start=time(13),
            end=time(14, 15),
            rating=None,
        )

        session = build_generation_session(
            catalog_id=CATALOG_ID,
            sections_by_course={"MATH 101": [math], "BIO 101": [bio]},
            schedules=[[math, bio]],
            candidate_count=1,
            owner_scope_hash=OWNER_SCOPE_HASH,
            search_fingerprint=SEARCH_FINGERPRINT,
            ttl_seconds=1_800,
            created_at=datetime(2026, 7, 9, 12, tzinfo=UTC),
            session_id="schedgen_testsession",
        )

        self.assertEqual(session.session_id, "schedgen_testsession")
        self.assertEqual(session.generated_count, 1)
        self.assertEqual(len(session.candidates), 2)
        self.assertEqual(session.expires_at, datetime(2026, 7, 9, 12, 30, tzinfo=UTC))

        result = session.results[0]
        self.assertEqual(
            result.selected_catalog_section_meeting_ids,
            (MATH_MEETING_ID, BIO_MEETING_ID),
        )
        self.assertEqual(result.summary.meeting_days, (MeetingDay.MONDAY, MeetingDay.WEDNESDAY))
        self.assertEqual(result.summary.average_instructor_rating, 4.5)
        self.assertEqual(result.summary.rated_instructor_count, 1)
        self.assertEqual(result.summary.unrated_instructor_count, 1)

    def test_schedule_summary_computes_same_day_gaps(self) -> None:
        morning = _section(
            meeting_id=MATH_MEETING_ID,
            course_name="MATH 101",
            day="M",
            start=time(9),
            end=time(10),
            rating=4.0,
        )
        afternoon = _section(
            meeting_id=BIO_MEETING_ID,
            course_name="BIO 101",
            day="M",
            start=time(13),
            end=time(14),
            rating=5.0,
        )

        summary = build_schedule_summary([morning, afternoon])

        self.assertEqual(summary.total_gap_minutes, 180)
        self.assertEqual(summary.max_single_gap_minutes, 180)
        self.assertEqual(summary.average_instructor_rating, 4.5)


def _section(
    *,
    meeting_id: UUID,
    course_name: str,
    day: str,
    start: time,
    end: time,
    rating: float | None,
) -> Section:
    return Section(
        course_name=course_name,
        section_code=f"{course_name}-01",
        title="",
        credits=0,
        instructor="Professor Example",
        rating=rating,
        catalog_section_id=CATALOG_ID,
        catalog_section_meeting_id=meeting_id,
        meetings=[
            Meeting(
                day=day,
                start=start,
                end=end,
                campus="Unspecified",
            )
        ],
    )


if __name__ == "__main__":
    unittest.main()
