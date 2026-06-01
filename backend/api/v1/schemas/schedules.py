"""Schedule-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime, time
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from backend.api.v1.schemas.base import CamelModel


def _parse_time_input(value: Any) -> time:
    """Accept normalized API times and common user-facing time strings."""
    if isinstance(value, time):
        return value
    if not isinstance(value, str):
        raise ValueError("Time must be a string")

    normalized = value.strip().upper()
    for fmt in ("%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M%p"):
        try:
            return datetime.strptime(normalized, fmt).time()
        except ValueError:
            continue

    raise ValueError("Time must be HH:MM, HH:MM:SS, or h:MM AM/PM")


def _normalize_days(value: str) -> str:
    normalized = value.upper().replace(" ", "").replace(",", "")
    allowed = {"M", "T", "W", "R", "F", "S"}
    unknown = sorted(set(normalized) - allowed)

    if not normalized:
        raise ValueError("Meeting days are required")
    if unknown:
        raise ValueError(
            "Unknown meeting day code(s): "
            + ", ".join(unknown)
            + ". Use M, T, W, R, F, S; use R for Thursday.",
        )

    return "".join(day for day in "MTWRFS" if day in normalized)


class ScheduleGenerateMetadata(CamelModel):
    """Saved catalog identity for a generation request."""

    catalog_id: UUID | None = None


class ScheduleGenerateBlockedTimeInput(CamelModel):
    """A time range the generated schedule should avoid."""

    days: str = Field(..., min_length=1, examples=["F"])
    start_time: time = Field(..., examples=["09:00"])
    end_time: time = Field(..., examples=["11:00"])

    @field_validator("days")
    @classmethod
    def validate_days(cls, value: str) -> str:
        return _normalize_days(value)

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def validate_time(cls, value: Any) -> time:
        return _parse_time_input(value)

    @model_validator(mode="after")
    def validate_time_order(self) -> "ScheduleGenerateBlockedTimeInput":
        if self.end_time <= self.start_time:
            raise ValueError("endTime must be after startTime")
        return self


class ScheduleGeneratePreferences(CamelModel):
    """Preferences and hard filters supplied with a generation request."""

    blocked_times: list[ScheduleGenerateBlockedTimeInput] = Field(
        default_factory=list,
    )
    instructor_ratings: dict[str, float | None] = Field(default_factory=dict)

    @field_validator("instructor_ratings")
    @classmethod
    def validate_instructor_ratings(
        cls,
        value: dict[str, float | None],
    ) -> dict[str, float | None]:
        for rating in value.values():
            if rating is not None and not 0 <= rating <= 5:
                raise ValueError("Instructor ratings must be between 0 and 5")
        return value


class ScheduleGenerateRequest(CamelModel):
    """Request body for generating schedules from saved catalog sections."""

    metadata: ScheduleGenerateMetadata = Field(
        default_factory=ScheduleGenerateMetadata,
    )
    preferences: ScheduleGeneratePreferences = Field(
        default_factory=ScheduleGeneratePreferences,
    )
    max_results: int = Field(default=100, ge=1, le=500)


class GeneratedMeetingResponse(CamelModel):
    """Meeting detail returned for a generated transient schedule."""

    day_of_week: str
    start_time: time
    end_time: time


class GeneratedSectionResponse(CamelModel):
    """Section detail returned for a generated transient schedule."""

    catalog_section_id: UUID
    course_name: str
    section_code: str
    instructor_name: str | None = None
    meetings: list[GeneratedMeetingResponse] = Field(default_factory=list)


class GeneratedScheduleResponse(CamelModel):
    """One generated, unsaved schedule option."""

    result_id: str
    total_instructor_score: float | None = None
    num_sections: int
    meets_mon: bool
    meets_tue: bool
    meets_wed: bool
    meets_thu: bool
    meets_fri: bool
    meets_sat: bool
    earliest_start: time
    latest_end: time
    sections: list[GeneratedSectionResponse] = Field(default_factory=list)


class ScheduleGenerateResponse(CamelModel):
    """Transient generation results for a BYOC schedule request."""

    candidate_count: int
    valid_count: int
    returned_count: int
    schedules: list[GeneratedScheduleResponse] = Field(default_factory=list)


# Nested Components


class MeetingResponse(BaseModel):
    """A single meeting time-slot for a section."""

    day_of_week: str
    start_time: time
    end_time: time
    campus: str


class ScheduleSectionDetailResponse(BaseModel):
    """Section information including instructor and meeting details."""

    catalog_section_id: UUID | None = None
    course_name: str | None = None
    subject_code: str | None = None
    course_number: int | None = None
    section_code: str | None = None
    course_title: str | None = None
    credits: int = 0
    modality: str | None = None
    instructor_name: str | None = None
    instructor_rating: float | None = None
    meetings: list[MeetingResponse] = Field(default_factory=list)


class ScheduleSectionResponse(BaseModel):
    """Minimal section info (without meetings)."""

    catalog_section_id: UUID | None = None
    course_name: str | None = None
    subject_code: str | None = None
    course_number: int | None = None
    section_code: str | None = None
    course_title: str | None = None
    credits: int = 0


# Top-Level Schedule Responses


class _ScheduleBase(BaseModel):
    """Shared schedule fields."""

    schedule_id: int
    total_credits: int
    total_instructor_score: float | None = None
    num_sections: int
    meets_mon: bool
    meets_tue: bool
    meets_wed: bool
    meets_thu: bool
    meets_fri: bool
    meets_sat: bool
    earliest_start: time
    latest_end: time
    campus_pattern: str
    created_at: datetime


class ScheduleSummaryResponse(_ScheduleBase):
    """Schedule summary with full section + meeting details."""

    sections: list[ScheduleSectionDetailResponse] = Field(default_factory=list)


class ScheduleDetailResponse(_ScheduleBase):
    """Schedule with minimal section info (no meetings)."""

    sections: list[ScheduleSectionResponse] = Field(default_factory=list)
