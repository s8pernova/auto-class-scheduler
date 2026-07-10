from __future__ import annotations

import unittest
from datetime import time
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import UUID

from backend.api.v1.schemas.schedules import (
    ScheduleGenerateBlockedTimeInput,
    ScheduleGenerateMetadata,
    ScheduleGenerationSessionCreateRequest,
    ScheduleGenerationSessionFilters,
    ScheduleGenerationSessionInitialPage,
    ScheduleGenerationSessionPage,
    ScheduleGenerationSessionQueryRequest,
)
from backend.api.v1.services import schedules as schedule_service

CATALOG_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
SECTION_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
MORNING_MEETING_ID = UUID("11111111-1111-1111-1111-111111111111")
AFTERNOON_MEETING_ID = UUID("22222222-2222-2222-2222-222222222222")
USER_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
OTHER_USER_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")


class ScheduleGenerationCacheTests(unittest.IsolatedAsyncioTestCase):
    async def test_generate_stores_session_and_reuses_it(self) -> None:
        redis = FakeRedis()
        payload = ScheduleGenerationSessionCreateRequest(
            metadata=ScheduleGenerateMetadata(catalog_id=CATALOG_ID),
            filters=ScheduleGenerationSessionFilters(
                blocked_times=[
                    ScheduleGenerateBlockedTimeInput(
                        days="M",
                        start_time=time(8),
                        end_time=time(9, 30),
                    )
                ]
            ),
            page=ScheduleGenerationSessionInitialPage(limit=10),
        )

        with _patched_catalog():
            first = await schedule_service.generate_schedules_from_request(
                Mock(),
                redis,
                payload,
                user_id=USER_ID,
            )
            second = await schedule_service.generate_schedules_from_request(
                Mock(),
                redis,
                payload,
                user_id=USER_ID,
            )

        self.assertEqual(first.session_id, second.session_id)
        self.assertEqual(first.generated_count, 2)
        self.assertEqual(first.filtered_count, 1)
        self.assertEqual(first.returned_count, 1)
        self.assertEqual(
            first.schedules[0].sections[0].catalog_section_meeting_id,
            AFTERNOON_MEETING_ID,
        )
        self.assertEqual(redis.write_count, 2)

    async def test_query_generated_session_filters_cached_universe(self) -> None:
        redis = FakeRedis()
        with _patched_catalog():
            generated = await schedule_service.generate_schedules_from_request(
                Mock(),
                redis,
                ScheduleGenerationSessionCreateRequest(
                    metadata=ScheduleGenerateMetadata(catalog_id=CATALOG_ID),
                    page=ScheduleGenerationSessionInitialPage(limit=10),
                ),
                user_id=USER_ID,
            )

        queried = await schedule_service.query_generated_schedule_session(
            FakeSupabase(),
            redis,
            session_id=generated.session_id or "",
            payload=ScheduleGenerationSessionQueryRequest(
                filters=ScheduleGenerationSessionFilters(
                    not_before=time(12),
                ),
            ),
            user_id=USER_ID,
        )

        self.assertEqual(queried.generated_count, 2)
        self.assertEqual(queried.filtered_count, 1)
        self.assertEqual(queried.returned_count, 1)
        self.assertEqual(
            queried.schedules[0].sections[0].catalog_section_meeting_id,
            AFTERNOON_MEETING_ID,
        )

    async def test_query_rejects_a_different_owner_scope(self) -> None:
        redis = FakeRedis()
        with _patched_catalog():
            generated = await schedule_service.generate_schedules_from_request(
                Mock(),
                redis,
                ScheduleGenerationSessionCreateRequest(
                    metadata=ScheduleGenerateMetadata(catalog_id=CATALOG_ID),
                ),
                user_id=USER_ID,
            )

        with self.assertRaises(schedule_service.GenerationSessionAccessDeniedError):
            await schedule_service.query_generated_schedule_session(
                FakeSupabase(),
                redis,
                session_id=generated.session_id,
                payload=ScheduleGenerationSessionQueryRequest(),
                user_id=OTHER_USER_ID,
            )

    async def test_query_uses_an_opaque_cursor_for_the_next_page(self) -> None:
        redis = FakeRedis()
        with _patched_catalog():
            first = await schedule_service.generate_schedules_from_request(
                Mock(),
                redis,
                ScheduleGenerationSessionCreateRequest(
                    metadata=ScheduleGenerateMetadata(catalog_id=CATALOG_ID),
                    page=ScheduleGenerationSessionInitialPage(limit=1),
                ),
                user_id=USER_ID,
            )

        self.assertEqual(first.returned_count, 1)
        self.assertIsNotNone(first.next_cursor)

        second = await schedule_service.query_generated_schedule_session(
            FakeSupabase(),
            redis,
            session_id=first.session_id,
            payload=ScheduleGenerationSessionQueryRequest(
                page=ScheduleGenerationSessionPage(
                    cursor=first.next_cursor,
                    limit=1,
                )
            ),
            user_id=USER_ID,
        )

        self.assertEqual(second.returned_count, 1)
        self.assertIsNone(second.next_cursor)
        self.assertNotEqual(first.schedules[0].result_id, second.schedules[0].result_id)


def _patched_catalog():
    catalog_section = SimpleNamespace(
        id=SECTION_ID,
        course_name="MATH 101",
        meetings=[
            SimpleNamespace(
                id=MORNING_MEETING_ID,
                crn="1001",
                instructor_name="Professor Morning",
                days="M",
                start_time=time(8),
                end_time=time(9),
            ),
            SimpleNamespace(
                id=AFTERNOON_MEETING_ID,
                crn="1002",
                instructor_name="Professor Afternoon",
                days="M",
                start_time=time(13),
                end_time=time(14),
            ),
        ],
    )
    return patch.multiple(
        "backend.api.v1.services.schedules.catalog_service",
        get_catalog=Mock(return_value=SimpleNamespace(id=CATALOG_ID)),
        list_catalog_sections=Mock(return_value=[catalog_section]),
    )


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, bytes | str] = {}
        self.write_count = 0

    async def get(self, key: str) -> bytes | str | None:
        return self.values.get(key)

    async def delete(self, *keys: str) -> int:
        deleted = 0
        for key in keys:
            if key in self.values:
                deleted += 1
                del self.values[key]
        return deleted

    def pipeline(self, *, transaction: bool) -> FakePipeline:
        return FakePipeline(self, transaction=transaction)


class FakeSupabase:
    def table(self, table_name: str) -> FakeTable:
        return FakeTable(table_name)


class FakeTable:
    def __init__(self, table_name: str) -> None:
        self.table_name = table_name
        self.ids: set[str] = set()

    def select(self, fields: str) -> FakeTable:
        return self

    def in_(self, column: str, values: list[str]) -> FakeTable:
        self.ids = set(values)
        return self

    def execute(self) -> SimpleNamespace:
        if self.table_name == "catalog_section_meetings":
            return SimpleNamespace(
                data=[
                    row
                    for row in _meeting_rows()
                    if row["id"] in self.ids
                ]
            )
        if self.table_name == "catalog_sections":
            return SimpleNamespace(
                data=[
                    row
                    for row in _section_rows()
                    if row["id"] in self.ids
                ]
            )
        raise AssertionError(f"Unexpected table: {self.table_name}")


def _meeting_rows() -> list[dict]:
    return [
        {
            "id": str(MORNING_MEETING_ID),
            "section_id": str(SECTION_ID),
            "crn": "1001",
            "instructor_name": "Professor Morning",
            "days": "M",
            "start_time": time(8),
            "end_time": time(9),
        },
        {
            "id": str(AFTERNOON_MEETING_ID),
            "section_id": str(SECTION_ID),
            "crn": "1002",
            "instructor_name": "Professor Afternoon",
            "days": "M",
            "start_time": time(13),
            "end_time": time(14),
        },
    ]


def _section_rows() -> list[dict]:
    return [
        {
            "id": str(SECTION_ID),
            "course_name": "MATH 101",
        }
    ]


class FakePipeline:
    def __init__(self, redis: FakeRedis, *, transaction: bool) -> None:
        self.redis = redis
        self.transaction = transaction
        self.operations: list[tuple[str, bytes | str]] = []

    async def __aenter__(self) -> FakePipeline:
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    def set(self, key: str, value: bytes | str, *, ex: int) -> None:
        if ex <= 0:
            raise ValueError("ex must be positive")
        self.operations.append((key, value))

    async def execute(self) -> list[bool]:
        for key, value in self.operations:
            self.redis.values[key] = value
            self.redis.write_count += 1
        return [True for _ in self.operations]


if __name__ == "__main__":
    unittest.main()
