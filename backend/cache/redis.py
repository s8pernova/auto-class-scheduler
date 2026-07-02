"""Redis client construction and lifecycle.

Keep Redis connection concerns in this module. Generation-session key design,
serialization, filtering, and pagination belong in separate service modules.
"""

from __future__ import annotations

from redis.asyncio import Redis


def create_redis_client(redis_url: str) -> Redis:
    """Create the application's shared asynchronous Redis client"""

    return Redis.from_url(
        redis_url,
        decode_responses=False,
        socket_connect_timeout=2,
        socket_timeout=2,
        health_check_interval=30,
    )


async def verify_redis_connection(client: Redis) -> None:
    """Fail application startup when the required Redis service is unavailable"""

    await client.ping()


async def close_redis_client(client: Redis) -> None:
    """Close the shared client and its connection pool during app shutdown"""

    await client.aclose()
