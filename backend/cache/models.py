"""Versioned internal models for Redis-backed generation sessions.

These models define the cache storage contract. They are intentionally
separate from public API schemas and durable PostgreSQL models.
"""

from __future__ import annotations

from datetime import datetime, time
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CacheModel(BaseModel):
    """Strict, immutable base for internal cache payloads."""

    model_config = ConfigDict(extra="forbid", frozen=True)


class MeetingDay(StrEnum):
    """Canonical meeting-day codes supported by schedule generation."""

    MONDAY = "M"
    TUESDAY = "T"
    WEDNESDAY = "W"
    THURSDAY = "R"
    FRIDAY = "F"
    SATURDAY = "S"


class CachedMeetingInterval(CacheModel):
    """One exact meeting interval used by cached filter evaluation."""

    day: MeetingDay
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_time_order(self) -> "CachedMeetingInterval":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class CachedCandidate(CacheModel):
    """Compact facts for one selectable catalog meeting row."""

    catalog_section_meeting_id: UUID
    meetings: tuple[CachedMeetingInterval, ...] = Field(min_length=1)
    instructor_rating: float | None = Field(default=None, ge=0, le=5)


class CachedScheduleSummary(CacheModel):
    """Precomputed fields used to filter and sort one generated result."""

    meeting_days: tuple[MeetingDay, ...] = Field(min_length=1)
    num_meeting_days: int = Field(ge=1)
    earliest_start: time
    latest_end: time
    total_gap_minutes: int = Field(ge=0)
    max_single_gap_minutes: int = Field(ge=0)
    average_instructor_rating: float | None = Field(default=None, ge=0, le=5)
    rated_instructor_count: int = Field(ge=0)
    unrated_instructor_count: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_summary_consistency(self) -> "CachedScheduleSummary":
        canonical_days = tuple(
            day for day in MeetingDay if day in set(self.meeting_days)
        )
        if self.meeting_days != canonical_days:
            raise ValueError("meeting_days must be unique and in canonical order")
        if self.num_meeting_days != len(self.meeting_days):
            raise ValueError("num_meeting_days must match meeting_days")
        if self.latest_end <= self.earliest_start:
            raise ValueError("latest_end must be after earliest_start")
        if self.max_single_gap_minutes > self.total_gap_minutes:
            raise ValueError(
                "max_single_gap_minutes cannot exceed total_gap_minutes"
            )
        if self.rated_instructor_count == 0:
            if self.average_instructor_rating is not None:
                raise ValueError(
                    "average_instructor_rating requires a rated instructor"
                )
        elif self.average_instructor_rating is None:
            raise ValueError(
                "average_instructor_rating is required for rated instructors"
            )
        return self


class CachedScheduleResult(CacheModel):
    """One generated result referencing compact session candidate facts."""

    result_id: str = Field(min_length=1, max_length=128)
    selected_catalog_section_meeting_ids: tuple[UUID, ...] = Field(min_length=1)
    summary: CachedScheduleSummary

    @model_validator(mode="after")
    def validate_selected_ids(self) -> "CachedScheduleResult":
        if len(set(self.selected_catalog_section_meeting_ids)) != len(
            self.selected_catalog_section_meeting_ids
        ):
            raise ValueError(
                "selected_catalog_section_meeting_ids cannot contain duplicates"
            )
        return self


class CachedGenerationSession(CacheModel):
    """Complete, versioned generation universe stored under one Redis key."""

    schema_version: Literal[1] = 1
    algorithm_version: str = Field(min_length=1, max_length=64)
    session_id: str = Field(
        min_length=10,
        max_length=128,
        pattern=r"^schedgen_[A-Za-z0-9_-]+$",
    )
    owner_scope_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    catalog_id: UUID
    search_fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    created_at: datetime
    expires_at: datetime
    candidate_count: int = Field(ge=0)
    generated_count: int = Field(ge=0)
    candidates: tuple[CachedCandidate, ...] = Field(min_length=1)
    results: tuple[CachedScheduleResult, ...] = ()

    @model_validator(mode="after")
    def validate_session_consistency(self) -> "CachedGenerationSession":
        if self.created_at.tzinfo is None or self.created_at.utcoffset() is None:
            raise ValueError("created_at must be timezone-aware")
        if self.expires_at.tzinfo is None or self.expires_at.utcoffset() is None:
            raise ValueError("expires_at must be timezone-aware")
        if self.expires_at <= self.created_at:
            raise ValueError("expires_at must be after created_at")
        if self.generated_count != len(self.results):
            raise ValueError("generated_count must match the number of results")
        if self.generated_count > self.candidate_count:
            raise ValueError("generated_count cannot exceed candidate_count")

        candidate_ids = [
            candidate.catalog_section_meeting_id for candidate in self.candidates
        ]
        if len(set(candidate_ids)) != len(candidate_ids):
            raise ValueError("candidates cannot contain duplicate IDs")

        known_candidate_ids = set(candidate_ids)
        result_ids: set[str] = set()
        for result in self.results:
            if result.result_id in result_ids:
                raise ValueError("results cannot contain duplicate result IDs")
            result_ids.add(result.result_id)

            unknown_ids = set(result.selected_catalog_section_meeting_ids).difference(
                known_candidate_ids
            )
            if unknown_ids:
                raise ValueError("results must reference known candidate IDs")

        return self
