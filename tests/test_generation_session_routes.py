from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, Mock, patch
from uuid import UUID

from fastapi import HTTPException

from backend.api.v1.routes.generation_sessions import (
    query_generation_session_results,
)
from backend.api.v1.schemas.schedules import ScheduleGenerationSessionQueryRequest
from backend.api.v1.services.schedules import GenerationSessionAccessDeniedError
from backend.cache.store import GenerationSessionCacheMissError

USER_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")


class GenerationSessionRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_expired_session_returns_typed_gone_response(self) -> None:
        with patch(
            "backend.api.v1.routes.generation_sessions.schedule_service."
            "query_generated_schedule_session",
            new=AsyncMock(side_effect=GenerationSessionCacheMissError("expired")),
        ):
            with self.assertRaises(HTTPException) as raised:
                await query_generation_session_results(
                    "schedgen_expired",
                    ScheduleGenerationSessionQueryRequest(),
                    Mock(),
                    Mock(),
                    USER_ID,
                )

        self.assertEqual(raised.exception.status_code, 410)
        self.assertEqual(
            raised.exception.detail["code"],
            "generation_session_expired",
        )

    async def test_foreign_session_is_hidden_as_not_found(self) -> None:
        with patch(
            "backend.api.v1.routes.generation_sessions.schedule_service."
            "query_generated_schedule_session",
            new=AsyncMock(
                side_effect=GenerationSessionAccessDeniedError("foreign")
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                await query_generation_session_results(
                    "schedgen_foreign",
                    ScheduleGenerationSessionQueryRequest(),
                    Mock(),
                    Mock(),
                    USER_ID,
                )

        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(raised.exception.detail, "Generation session not found")


if __name__ == "__main__":
    unittest.main()
