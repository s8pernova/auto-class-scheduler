"""Opaque cursor encoding for immutable generation-session result pages."""

from __future__ import annotations

import json
from base64 import urlsafe_b64decode, urlsafe_b64encode
from binascii import Error as Base64Error
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class InvalidGenerationCursorError(ValueError):
    """A result-page cursor is malformed or belongs to different controls."""


class _CursorPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    version: int = Field(alias="v")
    offset: int = Field(alias="o", ge=0)
    query_fingerprint: str = Field(alias="q", pattern=r"^[0-9a-f]{64}$")


def encode_generation_cursor(*, offset: int, query_fingerprint: str) -> str:
    """Encode the next result offset and its view-control fingerprint."""
    payload = _CursorPayload(v=1, o=offset, q=query_fingerprint)
    encoded = json.dumps(
        payload.model_dump(by_alias=True),
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return urlsafe_b64encode(encoded).decode("ascii").rstrip("=")


def decode_generation_cursor(
    cursor: str | None,
    *,
    expected_query_fingerprint: str,
) -> int:
    """Return a cursor offset after validating its version and query scope."""
    if cursor is None:
        return 0

    try:
        padding = "=" * (-len(cursor) % 4)
        decoded = urlsafe_b64decode((cursor + padding).encode("ascii"))
        raw: Any = json.loads(decoded)
        payload = _CursorPayload.model_validate(raw)
    except (
        UnicodeEncodeError,
        UnicodeDecodeError,
        Base64Error,
        json.JSONDecodeError,
        ValidationError,
    ) as exc:
        raise InvalidGenerationCursorError("Invalid result-page cursor") from exc

    if payload.version != 1:
        raise InvalidGenerationCursorError("Unsupported result-page cursor version")
    if payload.query_fingerprint != expected_query_fingerprint:
        raise InvalidGenerationCursorError(
            "Result-page cursor does not match the current filters and sort"
        )
    return payload.offset
