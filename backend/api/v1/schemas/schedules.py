"""Schedule-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime, time
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _to_camel(field_name: str) -> str:
    parts = field_name.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class _CamelModel(BaseModel):
    """Base model for new JSON request/response bodies.

    Python code uses snake_case fields, while the external JSON contract can use
    camelCase names such as ``subjectCode`` and ``startTime``.
    """

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        extra="forbid",
    )


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


class ScheduleGenerateMetadata(_CamelModel):
    """Request metadata that describes where the BYOC draft came from."""

    catalog_id: UUID | None = None
    name: str | None = Field(default=None, max_length=200)
    school_name: str | None = Field(default=None, max_length=200)
    term_name: str | None = Field(default=None, max_length=100)


class ScheduleGenerateMeetingInput(_CamelModel):
    """One meeting pattern for a candidate section."""

    days: str = Field(..., min_length=1, examples=["MWF", "TR"])
    start_time: time = Field(..., examples=["17:00", "5:00 PM"])
    end_time: time = Field(..., examples=["18:40", "6:40 PM"])

    @field_validator("days")
    @classmethod
    def validate_days(cls, value: str) -> str:
        return _normalize_days(value)

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def validate_time(cls, value: Any) -> time:
        return _parse_time_input(value)

    @model_validator(mode="after")
    def validate_time_order(self) -> "ScheduleGenerateMeetingInput":
        if self.end_time <= self.start_time:
            raise ValueError("endTime must be after startTime")
        return self


class ScheduleGenerateSectionInput(_CamelModel):
    """One candidate section that can satisfy a course."""

    section_code: str | None = Field(default=None, max_length=50)
    crn: str | None = Field(default=None, max_length=50)
    instructor_name: str | None = Field(default=None, max_length=200)
    instructor_rating: float | None = Field(default=None, ge=0, le=5)
    campus: str | None = Field(default=None, max_length=100)
    modality: str | None = Field(default=None, max_length=100)
    credits: int | None = Field(default=None, ge=0, le=30)
    meetings: list[ScheduleGenerateMeetingInput] = Field(..., min_length=1)


class ScheduleGenerateCourseInput(_CamelModel):
    """A course with the candidate sections entered by the user."""

    subject_code: str = Field(..., min_length=1, max_length=20)
    course_number: int = Field(..., ge=0, le=9999)
    course_title: str | None = Field(default=None, max_length=300)
    sections: list[ScheduleGenerateSectionInput] = Field(..., min_length=1)

    @field_validator("subject_code")
    @classmethod
    def normalize_subject_code(cls, value: str) -> str:
        return value.strip().upper()


class ScheduleGenerateBlockedTimeInput(_CamelModel):
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


class ScheduleGeneratePreferences(_CamelModel):
    """Preferences and hard filters supplied with a generation request."""

    blocked_times: list[ScheduleGenerateBlockedTimeInput] = Field(
        default_factory=list,
    )
    allow_campus_switch: bool = False
    allow_full_sections: bool | None = None
    allow_restricted_sections: bool | None = None
    campuses: list[str] = Field(default_factory=list)
    times: list[str] = Field(default_factory=list)


class ScheduleGenerateRequest(_CamelModel):
    """Request body for generating schedules from user-entered sections."""

    metadata: ScheduleGenerateMetadata = Field(
        default_factory=ScheduleGenerateMetadata,
    )
    courses: list[ScheduleGenerateCourseInput] = Field(..., min_length=1)
    preferences: ScheduleGeneratePreferences = Field(
        default_factory=ScheduleGeneratePreferences,
    )
    max_results: int = Field(default=100, ge=1, le=500)


class GeneratedMeetingResponse(_CamelModel):
    """Meeting detail returned for a generated transient schedule."""

    day_of_week: str
    start_time: time
    end_time: time
    campus: str


class GeneratedSectionResponse(_CamelModel):
    """Section detail returned for a generated transient schedule."""

    subject_code: str
    course_number: int
    section_code: str
    course_title: str
    credits: int
    modality: str | None = None
    instructor_name: str | None = None
    meetings: list[GeneratedMeetingResponse] = Field(default_factory=list)


class GeneratedScheduleResponse(_CamelModel):
    """One generated, unsaved schedule option."""

    result_id: str
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
    sections: list[GeneratedSectionResponse] = Field(default_factory=list)


class ScheduleGenerateResponse(_CamelModel):
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

    subject_code: str
    course_number: int
    section_code: str
    course_title: str
    credits: int
    modality: str | None = None
    instructor_name: str | None = None
    instructor_rating: float | None = None
    meetings: list[MeetingResponse] = []


class ScheduleSectionResponse(BaseModel):
    """Minimal section info (without meetings)."""

    subject_code: str
    course_number: int
    section_code: str
    course_title: str
    credits: int


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

    sections: list[ScheduleSectionDetailResponse] = []


class ScheduleDetailResponse(_ScheduleBase):
    """Schedule with minimal section info (no meetings)."""

    sections: list[ScheduleSectionResponse] = []
