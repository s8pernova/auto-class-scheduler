from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI, Request
from redis.asyncio import Redis

from backend.app import lifespan
from backend.dependencies import get_redis_client


class RedisDependencyTests(unittest.TestCase):
    def test_dependency_returns_lifespan_client(self) -> None:
        app = FastAPI()
        redis_client = AsyncMock(spec=Redis)
        app.state.redis = redis_client
        request = Request({"type": "http", "app": app})

        self.assertIs(get_redis_client(request), redis_client)


class RedisLifespanTests(unittest.IsolatedAsyncioTestCase):
    async def test_lifespan_verifies_attaches_and_closes_client(self) -> None:
        app = FastAPI()
        redis_client = AsyncMock(spec=Redis)

        with (
            patch(
                "backend.app.get_settings",
                return_value=SimpleNamespace(redis_url="redis://example.test:6379/0"),
            ),
            patch("backend.app.create_redis_client", return_value=redis_client),
            patch(
                "backend.app.verify_redis_connection",
                new=AsyncMock(),
            ) as verify_connection,
            patch(
                "backend.app.close_redis_client",
                new=AsyncMock(),
            ) as close_client,
        ):
            async with lifespan(app):
                self.assertIs(app.state.redis, redis_client)
                verify_connection.assert_awaited_once_with(redis_client)

            close_client.assert_awaited_once_with(redis_client)

    async def test_lifespan_closes_client_when_startup_verification_fails(
        self,
    ) -> None:
        app = FastAPI()
        redis_client = AsyncMock(spec=Redis)
        connection_error = ConnectionError("Redis unavailable")

        with (
            patch(
                "backend.app.get_settings",
                return_value=SimpleNamespace(redis_url="redis://example.test:6379/0"),
            ),
            patch("backend.app.create_redis_client", return_value=redis_client),
            patch(
                "backend.app.verify_redis_connection",
                new=AsyncMock(side_effect=connection_error),
            ),
            patch(
                "backend.app.close_redis_client",
                new=AsyncMock(),
            ) as close_client,
        ):
            with self.assertRaisesRegex(ConnectionError, "Redis unavailable"):
                async with lifespan(app):
                    self.fail("The lifespan should not start without Redis")

            close_client.assert_awaited_once_with(redis_client)


if __name__ == "__main__":
    unittest.main()
