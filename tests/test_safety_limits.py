from __future__ import annotations

import unittest
from datetime import time

from backend.api.v1.schemas.catalogs import (
    CatalogSectionInput,
    CatalogSectionMeetingInput,
    CatalogSectionsReplaceRequest,
)
from backend.api.v1.schemas.schedules import (
    ScheduleGenerateBlockedTimeInput,
    ScheduleGeneratePreferences,
    ScheduleGenerateRequest,
    ScheduleRequirementGroup,
)
from backend.api.v1.services.catalogs import validate_catalog_sections_payload
from backend.api.v1.services.favorites import _validate_saved_schedule_size
from backend.api.v1.services.schedules import (
    _validate_generation_request_limits,
    _validate_requirement_group_limits,
)
from backend.config import get_settings


def _meeting() -> CatalogSectionMeetingInput:
    return CatalogSectionMeetingInput(
        days="M",
        start_time=time(9, 0),
        end_time=time(10, 0),
    )


def _catalog_section(
    course_name: str = "CS 2505",
    *,
    metadata: dict | None = None,
    meetings: list[CatalogSectionMeetingInput] | None = None,
) -> CatalogSectionInput:
    return CatalogSectionInput(
        course_name=course_name,
        crn="12345",
        source_metadata=metadata or {},
        meetings=meetings or [_meeting()],
    )


class SafetyLimitTests(unittest.TestCase):
    def test_catalog_rejects_too_many_sections(self) -> None:
        settings = get_settings()
        payload = CatalogSectionsReplaceRequest(
            sections=[
                _catalog_section(f"CS {index}", metadata={"index": index})
                for index in range(settings.max_catalog_sections + 1)
            ]
        )

        with self.assertRaisesRegex(ValueError, "more than .* sections"):
            validate_catalog_sections_payload(payload)

    def test_catalog_rejects_too_many_course_buckets(self) -> None:
        settings = get_settings()
        payload = CatalogSectionsReplaceRequest(
            sections=[
                _catalog_section(f"CS {index}")
                for index in range(settings.max_catalog_courses + 1)
            ]
        )

        with self.assertRaisesRegex(ValueError, "course buckets"):
            validate_catalog_sections_payload(payload)

    def test_catalog_rejects_too_many_sections_per_course(self) -> None:
        settings = get_settings()
        payload = CatalogSectionsReplaceRequest(
            sections=[
                _catalog_section("CS 2505", metadata={"index": index})
                for index in range(settings.max_sections_per_course + 1)
            ]
        )

        with self.assertRaisesRegex(ValueError, "course bucket"):
            validate_catalog_sections_payload(payload)

    def test_catalog_rejects_too_many_meetings_per_section(self) -> None:
        settings = get_settings()
        payload = CatalogSectionsReplaceRequest(
            sections=[
                _catalog_section(
                    meetings=[
                        CatalogSectionMeetingInput(
                            days="M",
                            start_time=time(hour, 0),
                            end_time=time(hour + 1, 0),
                        )
                        for hour in range(settings.max_meetings_per_section + 1)
                    ]
                )
            ]
        )

        with self.assertRaisesRegex(ValueError, "more than .* meetings"):
            validate_catalog_sections_payload(payload)

    def test_catalog_rejects_too_many_total_meetings(self) -> None:
        settings = get_settings()
        meetings_per_section = settings.max_meetings_per_section
        section_count = (settings.max_catalog_meetings // meetings_per_section) + 1
        payload = CatalogSectionsReplaceRequest(
            sections=[
                _catalog_section(
                    f"CS {index % 6}",
                    metadata={"index": index},
                    meetings=[
                        CatalogSectionMeetingInput(
                            days="M",
                            start_time=time(hour, 0),
                            end_time=time(hour + 1, 0),
                        )
                        for hour in range(meetings_per_section)
                    ],
                )
                for index in range(section_count)
            ]
        )

        with self.assertRaisesRegex(ValueError, "more than .* meetings"):
            validate_catalog_sections_payload(payload)

    def test_catalog_rejects_large_source_metadata(self) -> None:
        settings = get_settings()
        payload = CatalogSectionsReplaceRequest(
            sections=[
                _catalog_section(
                    metadata={
                        "notes": "x"
                        * (settings.max_source_metadata_bytes_per_section + 1)
                    }
                )
            ]
        )

        with self.assertRaisesRegex(ValueError, "sourceMetadata"):
            validate_catalog_sections_payload(payload)

    def test_generation_rejects_too_many_blocked_times(self) -> None:
        settings = get_settings()
        payload = ScheduleGenerateRequest(
            preferences=ScheduleGeneratePreferences(
                blocked_times=[
                    ScheduleGenerateBlockedTimeInput(
                        days="M",
                        start_time=time(9, 0),
                        end_time=time(10, 0),
                    )
                    for _ in range(settings.max_blocked_times + 1)
                ]
            )
        )

        with self.assertRaisesRegex(ValueError, "blockedTimes"):
            _validate_generation_request_limits(payload)

    def test_generation_rejects_too_many_instructor_ratings(self) -> None:
        settings = get_settings()
        payload = ScheduleGenerateRequest(
            preferences=ScheduleGeneratePreferences(
                instructor_ratings={
                    f"Instructor {index}": 4.0
                    for index in range(settings.max_instructor_ratings + 1)
                }
            )
        )

        with self.assertRaisesRegex(ValueError, "instructorRatings"):
            _validate_generation_request_limits(payload)

    def test_generation_rejects_too_many_selected_course_buckets(self) -> None:
        settings = get_settings()
        groups = [
            ScheduleRequirementGroup(course_names=[f"CS {index}"])
            for index in range(settings.max_catalog_courses + 1)
        ]

        with self.assertRaisesRegex(ValueError, "course buckets"):
            _validate_requirement_group_limits(groups)

    def test_favorite_rejects_too_many_selected_sections(self) -> None:
        settings = get_settings()

        with self.assertRaisesRegex(ValueError, "course buckets"):
            _validate_saved_schedule_size(settings.max_catalog_courses + 1)


if __name__ == "__main__":
    unittest.main()
