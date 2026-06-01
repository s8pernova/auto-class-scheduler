"""Core domain models for schedule generation."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import time
from typing import Optional
from uuid import UUID


@dataclass(frozen=True, slots=True)
class Meeting:
    """A single meeting time-block (one day + time-range + campus)."""

    day: str
    start: time
    end: time
    campus: str


@dataclass(slots=True)
class Section:
    """One section of a course, with all its meeting blocks."""

    course_name: str
    section_code: str
    title: str
    credits: int
    instructor: str
    meetings: list[Meeting] = field(default_factory=list)
    rating: Optional[float] = None
    catalog_section_id: UUID | None = None
