"""Stable hashes for Redis-backed generation-session reuse.

Redis keys should not expose raw user identifiers or large request payloads.
Instead, we hash normalized identity and search-universe inputs. The resulting
hex strings are safe to place in Redis keys and stable across equivalent
requests.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from datetime import time
from hashlib import sha256
from typing import Any
from uuid import UUID

from backend.api.v1.schemas.schedules import ScheduleGenerateRequest, Section
from backend.cache.builders import DEFAULT_GENERATION_ALGORITHM_VERSION


def build_owner_scope_hash(
    *,
    catalog_id: UUID,
    user_id: UUID | None,
) -> str:
    """Hash the owner scope used to prevent cross-user cache reuse."""
    return stable_sha256(
        {
            "catalog_id": catalog_id,
            "user_id": user_id,
        }
    )


def build_generation_search_fingerprint(
    *,
    payload: ScheduleGenerateRequest,
    sections_by_course: Mapping[str, Sequence[Section]],
    algorithm_version: str = DEFAULT_GENERATION_ALGORITHM_VERSION,
) -> str:
    """Hash the generation universe for a request and loaded catalog facts.

    View controls such as blocked times and page size are intentionally excluded
    so the same generated universe can be filtered, sorted, and paged without
    regenerating.
    """
    catalog_id = payload.metadata.catalog_id
    if catalog_id is None:
        raise ValueError("catalogId is required to build a search fingerprint")

    return stable_sha256(
        {
            "algorithm_version": algorithm_version,
            "catalog_id": catalog_id,
            "requirements": _normalize_requirements(payload),
            "candidates": _normalize_candidates(sections_by_course),
        }
    )


def stable_sha256(value: Any) -> str:
    """Return a SHA-256 hash for a normalized JSON representation."""
    encoded = json.dumps(
        _normalize_value(value),
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return sha256(encoded).hexdigest()


def _normalize_requirements(payload: ScheduleGenerateRequest) -> list[dict[str, Any]]:
    groups = []
    for group in payload.requirements.groups:
        groups.append(
            {
                "choose": group.choose,
                "course_names": sorted(group.course_names),
            }
        )
    return sorted(
        groups,
        key=lambda group: (group["choose"], tuple(group["course_names"])),
    )


def _normalize_candidates(
    sections_by_course: Mapping[str, Sequence[Section]],
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for course_name, sections in sections_by_course.items():
        for section in sections:
            if section.catalog_section_meeting_id is None:
                raise ValueError(
                    "Generated sections must include catalogSectionMeetingId"
                )
            candidates.append(
                {
                    "course_name": course_name,
                    "catalog_section_id": section.catalog_section_id,
                    "catalog_section_meeting_id": section.catalog_section_meeting_id,
                    "rating": section.rating,
                    "meetings": [
                        {
                            "day": meeting.day.strip(),
                            "start": meeting.start,
                            "end": meeting.end,
                        }
                        for meeting in section.meetings
                    ],
                }
            )

    return sorted(
        candidates,
        key=lambda candidate: str(candidate["catalog_section_meeting_id"]),
    )


def _normalize_value(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, time):
        return value.isoformat()
    if isinstance(value, Mapping):
        return {
            str(key): _normalize_value(nested_value)
            for key, nested_value in value.items()
        }
    if isinstance(value, Sequence) and not isinstance(value, str | bytes | bytearray):
        return [_normalize_value(item) for item in value]
    return value
