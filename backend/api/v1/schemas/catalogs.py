"""Catalog-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime, time
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _to_camel(field_name: str) -> str:
    parts = field_name.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        extra="forbid",
    )


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


class CatalogCreate(BaseModel):
    """Payload for creating a new catalog."""

    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    source_type: str = Field(
        default="manual",
        pattern=r"^(csv|paste|manual|importer|demo)$",
    )
    school_name: Optional[str] = Field(default=None, max_length=200)
    term_name: Optional[str] = Field(default=None, max_length=100)


class CatalogResponse(BaseModel):
    """Catalog returned from the API."""

    id: UUID
    name: str
    description: Optional[str] = None
    source_type: str
    school_name: Optional[str] = None
    term_name: Optional[str] = None
    status: str
    row_count: int
    source_metadata: dict[str, Any]
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    last_imported_at: Optional[datetime] = None


class CatalogSectionMeetingInput(_CamelModel):
    """One meeting block for a saved catalog section."""

    days: str = Field(..., min_length=1)
    start_time: time
    end_time: time
    sort_order: int = Field(default=0, ge=0)

    @field_validator("days")
    @classmethod
    def validate_days(cls, value: str) -> str:
        return _normalize_days(value)

    @model_validator(mode="after")
    def validate_time_order(self) -> "CatalogSectionMeetingInput":
        if self.end_time <= self.start_time:
            raise ValueError("endTime must be after startTime")
        return self


class CatalogSectionInput(_CamelModel):
    """One candidate section to persist in normalized catalog storage."""

    subject_code: str = Field(..., min_length=1, max_length=20)
    course_number: int = Field(..., ge=0, le=9999)
    section_code: str | None = Field(default=None, max_length=50)
    crn: str | None = Field(default=None, max_length=50)
    instructor_name: str | None = Field(default=None, max_length=200)
    sort_order: int = Field(default=0, ge=0)
    source_metadata: dict[str, Any] = Field(default_factory=dict)
    meetings: list[CatalogSectionMeetingInput] = Field(..., min_length=1)

    @field_validator("subject_code")
    @classmethod
    def normalize_subject_code(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("section_code", "crn", "instructor_name", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        return stripped or None


class CatalogSectionsReplaceRequest(_CamelModel):
    """Full replacement payload for a catalog's candidate sections."""

    sections: list[CatalogSectionInput] = Field(default_factory=list)


class CatalogSectionMeetingResponse(_CamelModel):
    """Persisted meeting block for a catalog section."""

    id: UUID
    section_id: UUID
    days: str
    start_time: time
    end_time: time
    sort_order: int


class CatalogSectionResponse(_CamelModel):
    """Persisted catalog section with nested meeting blocks."""

    id: UUID
    catalog_id: UUID
    subject_code: str
    course_number: int
    section_code: str | None = None
    crn: str | None = None
    instructor_name: str | None = None
    sort_order: int
    source_metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    meetings: list[CatalogSectionMeetingResponse] = Field(default_factory=list)
