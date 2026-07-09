"""Redis store for cached generation sessions.

This module owns Redis reads and writes for cached generation sessions. It does
not know how schedules are generated, filtered, sorted, hydrated, or rendered.
Those concerns live in service/query modules.
"""

from __future__ import annotations

from dataclasses import dataclass

from redis.asyncio import Redis

from backend.cache.keys import generation_session_key, generation_session_lookup_key
from backend.cache.models import CachedGenerationSession
from backend.cache.serialization import (
    deserialize_generation_session,
    serialize_generation_session,
)


class GenerationSessionCacheMissError(KeyError):
    """Requested generation session is absent or expired from Redis."""


@dataclass(frozen=True, slots=True)
class GenerationSessionStore:
    """Typed Redis access for bounded generation-session payloads."""

    client: Redis
    namespace: str
    ttl_seconds: int
    max_results: int
    max_bytes: int

    def __post_init__(self) -> None:
        _validate_positive_limit("ttl_seconds", self.ttl_seconds)
        _validate_positive_limit("max_results", self.max_results)
        _validate_positive_limit("max_bytes", self.max_bytes)

    async def put_session(self, session: CachedGenerationSession) -> None:
        """Store a complete session and its reuse lookup with a fixed TTL."""
        payload = serialize_generation_session(
            session,
            max_results=self.max_results,
            max_bytes=self.max_bytes,
        )
        session_key = generation_session_key(self.namespace, session.session_id)
        lookup_key = generation_session_lookup_key(
            self.namespace,
            owner_scope_hash=session.owner_scope_hash,
            search_fingerprint=session.search_fingerprint,
        )

        async with self.client.pipeline(transaction=True) as pipe:
            pipe.set(session_key, payload, ex=self.ttl_seconds)
            pipe.set(lookup_key, session.session_id, ex=self.ttl_seconds)
            await pipe.execute()

    async def get_session(self, session_id: str) -> CachedGenerationSession:
        """Load a session without refreshing its TTL."""
        payload = await self.client.get(
            generation_session_key(self.namespace, session_id)
        )
        if payload is None:
            raise GenerationSessionCacheMissError(session_id)
        return deserialize_generation_session(payload, max_bytes=self.max_bytes)

    async def find_session_id(
        self,
        *,
        owner_scope_hash: str,
        search_fingerprint: str,
    ) -> str | None:
        """Return a reusable session id for a stable search, if still cached."""
        payload = await self.client.get(
            generation_session_lookup_key(
                self.namespace,
                owner_scope_hash=owner_scope_hash,
                search_fingerprint=search_fingerprint,
            )
        )
        if payload is None:
            return None
        if isinstance(payload, bytes):
            return payload.decode("utf-8")
        return str(payload)

    async def delete_session(self, session: CachedGenerationSession) -> None:
        """Delete a session and its lookup entry.

        This is mostly for tests and explicit invalidation. Normal cleanup comes
        from Redis TTL expiry.
        """
        await self.client.delete(
            generation_session_key(self.namespace, session.session_id),
            generation_session_lookup_key(
                self.namespace,
                owner_scope_hash=session.owner_scope_hash,
                search_fingerprint=session.search_fingerprint,
            ),
        )


def _validate_positive_limit(name: str, value: int) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be positive")
