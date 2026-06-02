from __future__ import annotations

import unittest
from datetime import time
from uuid import uuid4

from backend.api.v1.schemas.schedules import Meeting, ScheduleRequirementGroup, Section
from backend.api.v1.services.schedules import (
    _count_requirement_candidates,
    _generate_requirement_group_schedules,
    _resolve_requirement_groups,
)


def _section(course_name: str, section_code: str, start_hour: int) -> Section:
    return Section(
        catalog_section_id=uuid4(),
        course_name=course_name,
        section_code=section_code,
        title=course_name,
        credits=3,
        instructor="",
        meetings=[
            Meeting(
                day="Mon",
                start=time(start_hour, 0),
                end=time(start_hour + 1, 0),
                campus="Unspecified",
            )
        ],
    )


class ScheduleRequirementTests(unittest.TestCase):
    def test_omitted_groups_require_every_catalog_course(self) -> None:
        sections_by_course = {
            "CS 2505": [_section("CS 2505", "1001", 9)],
            "MATH 2114": [_section("MATH 2114", "2001", 11)],
        }

        groups = _resolve_requirement_groups(
            [],
            catalog_courses=["CS 2505", "MATH 2114"],
            sections_by_course=sections_by_course,
        )
        schedules = _generate_requirement_group_schedules(groups, sections_by_course)

        self.assertEqual(_count_requirement_candidates(groups, sections_by_course), 1)
        self.assertEqual(len(schedules), 1)
        self.assertEqual(
            [section.course_name for section in schedules[0]],
            ["CS 2505", "MATH 2114"],
        )

    def test_requirement_group_can_choose_one_elective_course_bucket(self) -> None:
        sections_by_course = {
            "CS 2505": [_section("CS 2505", "1001", 9)],
            "PHIL 1304": [
                _section("PHIL 1304", "3001", 11),
                _section("PHIL 1304", "3002", 13),
            ],
            "STS 1504": [_section("STS 1504", "4001", 15)],
        }
        request_groups = [
            ScheduleRequirementGroup(course_names=["CS 2505"]),
            ScheduleRequirementGroup(
                name="Humanities elective",
                course_names=["PHIL 1304", "STS 1504"],
                choose=1,
            ),
        ]

        groups = _resolve_requirement_groups(
            request_groups,
            catalog_courses=list(sections_by_course),
            sections_by_course=sections_by_course,
        )
        schedules = _generate_requirement_group_schedules(groups, sections_by_course)

        self.assertEqual(_count_requirement_candidates(groups, sections_by_course), 3)
        self.assertEqual(len(schedules), 3)
        self.assertEqual(
            {schedule[1].course_name for schedule in schedules},
            {"PHIL 1304", "STS 1504"},
        )

    def test_overlapping_groups_do_not_select_same_course_twice(self) -> None:
        sections_by_course = {
            "PHIL 1304": [_section("PHIL 1304", "3001", 11)],
            "STS 1504": [_section("STS 1504", "4001", 13)],
        }
        groups = [
            ScheduleRequirementGroup(course_names=["PHIL 1304", "STS 1504"]),
            ScheduleRequirementGroup(course_names=["PHIL 1304"]),
        ]

        schedules = _generate_requirement_group_schedules(groups, sections_by_course)

        self.assertEqual(len(schedules), 1)
        self.assertEqual(
            [section.course_name for section in schedules[0]],
            ["STS 1504", "PHIL 1304"],
        )


if __name__ == "__main__":
    unittest.main()
