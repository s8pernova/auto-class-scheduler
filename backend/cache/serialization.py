"""Serialization boundary for Redis-backed generation sessions.

Redis stores bytes. The rest of the backend should work with typed
``CachedGenerationSession`` objects. This module is the explicit crossing point
between those two worlds, and it enforces configured safety limits before data is
written to or trusted from Redis.
"""

from __future__ import annotations

from pydantic import ValidationError

from backend.cache.models import CachedGenerationSession


class GenerationSessionSerializationError(ValueError):
    """Base error for invalid generation-session cache payloads."""


class GenerationSessionTooLargeError(GenerationSessionSerializationError):
    """A generation session exceeds a configured cache limit."""


class InvalidGenerationSessionPayloadError(GenerationSessionSerializationError):
    """Redis contained malformed or incompatible generation-session data."""


def serialize_generation_session(
    session: CachedGenerationSession,
    *,
    max_results: int,
    max_bytes: int,
) -> bytes:
    """Encode a validated generation session as bounded UTF-8 JSON bytes."""
    _validate_positive_limit("max_results", max_results)
    _validate_positive_limit("max_bytes", max_bytes)

    if session.generated_count > max_results:
        raise GenerationSessionTooLargeError(
            "Generation session contains "
            f"{session.generated_count} results; maximum is {max_results}"
        )

    payload = session.model_dump_json().encode("utf-8")

    if len(payload) > max_bytes:
        raise GenerationSessionTooLargeError(
            f"Encoded generation session is {len(payload)} bytes; "
            f"maximum is {max_bytes}"
        )

    return payload


def deserialize_generation_session(
    payload: bytes,
    *,
    max_bytes: int,
) -> CachedGenerationSession:
    """Decode and validate bounded UTF-8 JSON bytes from Redis."""
    _validate_positive_limit("max_bytes", max_bytes)

    if len(payload) > max_bytes:
        raise GenerationSessionTooLargeError(
            f"Cached generation session is {len(payload)} bytes; maximum is {max_bytes}"
        )

    try:
        return CachedGenerationSession.model_validate_json(payload)
    except ValidationError as exc:
        raise InvalidGenerationSessionPayloadError(
            "Cached generation session is malformed or incompatible"
        ) from exc


def _validate_positive_limit(name: str, value: int) -> None:
    """Reject impossible configuration before it reaches Redis behavior."""
    if value <= 0:
        raise ValueError(f"{name} must be positive")
