from __future__ import annotations

import unittest
from datetime import time
from uuid import UUID

from backend.api.v1.schemas.schedules import (
    Meeting,
    ScheduleGenerateBlockedTimeInput,
    ScheduleGenerateMetadata,
    ScheduleGeneratePreferences,
    ScheduleGenerateRequest,
    ScheduleGenerateRequirements,
    ScheduleRequirementGroup,
    Section,
)
from backend.cache.fingerprints import (
    build_generation_search_fingerprint,
    build_owner_scope_hash,
)

CATALOG_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
MATH_MEETING_ID = UUID("11111111-1111-1111-1111-111111111111")
BIO_MEETING_ID = UUID("22222222-2222-2222-2222-222222222222")


class CacheFingerprintTests(unittest.TestCase):
    def test_owner_scope_hash_is_stable_and_opaque(self) -> None:
        first = build_owner_scope_hash(catalog_id=CATALOG_ID, user_id=USER_ID)
        second = build_owner_scope_hash(catalog_id=CATALOG_ID, user_id=USER_ID)

        self.assertEqual(first, second)
        self.assertEqual(len(first), 64)
        self.assertNotIn(str(USER_ID), first)

    def test_search_fingerprint_ignores_view_controls(self) -> None:
        sections_by_course = {
            "BIO 101": [
                _section(
                    meeting_id=BIO_MEETING_ID,
                    course_name="BIO 101",
                    day="W",
                    start=time(13),
                    end=time(14),
                    rating=None,
                )
            ],
            "MATH 101": [
                _section(
                    meeting_id=MATH_MEETING_ID,
                    course_name="MATH 101",
                    day="M",
                    start=time(9),
                    end=time(10),
                    rating=4.5,
                )
            ],
        }

        first = build_generation_search_fingerprint(
            payload=_request(max_results=25, blocked_day="M"),
            sections_by_course=sections_by_course,
        )
        second = build_generation_search_fingerprint(
            payload=_request(max_results=100, blocked_day="F"),
            sections_by_course=dict(reversed(sections_by_course.items())),
        )

        self.assertEqual(first, second)

    def test_search_fingerprint_changes_when_candidate_facts_change(self) -> None:
        payload = _request(max_results=25, blocked_day="M")
        first = build_generation_search_fingerprint(
            payload=payload,
            sections_by_course={
                "MATH 101": [
                    _section(
                        meeting_id=MATH_MEETING_ID,
                        course_name="MATH 101",
                        day="M",
                        start=time(9),
                        end=time(10),
                        rating=4.5,
                    )
                ]
            },
        )
        second = build_generation_search_fingerprint(
            payload=payload,
            sections_by_course={
                "MATH 101": [
                    _section(
                        meeting_id=MATH_MEETING_ID,
                        course_name="MATH 101",
                        day="M",
                        start=time(10),
                        end=time(11),
                        rating=4.5,
                    )
                ]
            },
        )

        self.assertNotEqual(first, second)


def _request(*, max_results: int, blocked_day: str) -> ScheduleGenerateRequest:
    return ScheduleGenerateRequest(
        metadata=ScheduleGenerateMetadata(catalog_id=CATALOG_ID),
        preferences=ScheduleGeneratePreferences(
            blocked_times=[
                ScheduleGenerateBlockedTimeInput(
                    days=blocked_day,
                    startTime=time(8),
                    endTime=time(9),
                )
            ],
        ),
        requirements=ScheduleGenerateRequirements(
            groups=[
                ScheduleRequirementGroup(
                    name="Science",
                    course_names=["MATH 101", "BIO 101"],
                    choose=1,
                )
            ],
        ),
        max_results=max_results,
    )


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
