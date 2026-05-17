"""Schedule-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime, time

from pydantic import BaseModel

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
