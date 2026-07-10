"""Catalog-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime, time
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from backend.api.v1.schemas.base import CamelModel

CatalogSourceType = Literal["csv", "paste", "manual", "importer", "demo"]
CatalogStatus = Literal["draft", "ready", "published", "error", "archived"]


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


def normalize_instructor_name(value: str) -> str:
    """Normalize instructor names for preference de-duplication."""
    return " ".join(value.strip().split())


class CatalogCreate(BaseModel):
    """Payload for creating a new catalog."""

    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    source_type: CatalogSourceType = "manual"
    school_name: Optional[str] = Field(default=None, max_length=200)
    term_name: Optional[str] = Field(default=None, max_length=100)


class CatalogResponse(BaseModel):
    """Catalog returned from the API."""

    id: UUID
    name: str
    description: Optional[str] = None
    source_type: CatalogSourceType
    school_name: Optional[str] = None
    term_name: Optional[str] = None
    status: CatalogStatus
    share_slug: Optional[str] = None
    published_at: Optional[datetime] = None
    forked_from_catalog_id: Optional[UUID] = None
    row_count: int
    source_metadata: dict[str, Any]
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    last_imported_at: Optional[datetime] = None


class CatalogSectionMeetingInput(CamelModel):
    """One main-box row for a saved catalog requirement."""

    crn: str | None = Field(default=None, max_length=50)
    instructor_name: str | None = Field(default=None, max_length=200)
    days: str = Field(..., min_length=1)
    start_time: time
    end_time: time
    sort_order: int = Field(default=0, ge=0)

    @field_validator("crn", "instructor_name", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        return stripped or None

    @field_validator("days")
    @classmethod
    def validate_days(cls, value: str) -> str:
        return _normalize_days(value)

    @model_validator(mode="after")
    def validate_time_order(self) -> "CatalogSectionMeetingInput":
        if self.end_time <= self.start_time:
            raise ValueError("endTime must be after startTime")
        return self


class CatalogSectionInput(CamelModel):
    """One requirement bucket to persist in normalized catalog storage."""

    course_name: str = Field(..., min_length=1, max_length=200)
    sort_order: int = Field(default=0, ge=0)
    source_metadata: dict[str, Any] = Field(default_factory=dict)
    meetings: list[CatalogSectionMeetingInput] = Field(..., min_length=1)

    @field_validator("course_name")
    @classmethod
    def normalize_course_name(cls, value: str) -> str:
        normalized = " ".join(value.strip().split())
        if not normalized:
            raise ValueError("Course name is required")
        return normalized


class CatalogSectionsReplaceRequest(CamelModel):
    """Full replacement payload for a catalog's candidate sections."""

    sections: list[CatalogSectionInput] = Field(default_factory=list)


class CatalogInstructorPreferencesReplaceRequest(CamelModel):
    """Full replacement payload for a user's saved instructor preferences."""

    instructor_ratings: dict[str, float | None] = Field(default_factory=dict)

    @field_validator("instructor_ratings", mode="before")
    @classmethod
    def normalize_instructor_names(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value

        normalized_ratings: dict[str, Any] = {}
        normalized_keys: set[str] = set()
        for raw_name, score in value.items():
            if not isinstance(raw_name, str):
                raise ValueError("Instructor names must be strings")

            instructor_name = normalize_instructor_name(raw_name)
            normalized_key = instructor_name.lower()
            if not instructor_name:
                raise ValueError("Instructor names cannot be blank")
            if normalized_key in normalized_keys:
                raise ValueError("Instructor preference names must be unique")

            normalized_keys.add(normalized_key)
            normalized_ratings[instructor_name] = score

        return normalized_ratings

    @field_validator("instructor_ratings")
    @classmethod
    def validate_instructor_ratings(
        cls,
        value: dict[str, float | None],
    ) -> dict[str, float | None]:
        for instructor_name, rating in value.items():
            if len(instructor_name) > 200:
                raise ValueError("Instructor names cannot exceed 200 characters")
            if rating is not None and not 0 <= rating <= 5:
                raise ValueError("Instructor ratings must be between 0 and 5")
        return value


class CatalogInstructorPreferencesResponse(CamelModel):
    """Saved instructor preferences for the current user and catalog."""

    instructor_ratings: dict[str, float] = Field(default_factory=dict)


class CatalogSectionMeetingResponse(CamelModel):
    """Persisted main-box row for a catalog requirement."""

    id: UUID
    section_id: UUID
    crn: str | None = None
    instructor_id: UUID | None = None
    instructor_name: str | None = None
    days: str
    start_time: time
    end_time: time
    sort_order: int


class CatalogSectionResponse(CamelModel):
    """Persisted catalog requirement with nested main-box rows."""

    id: UUID
    catalog_id: UUID
    course_name: str
    sort_order: int
    source_metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    meetings: list[CatalogSectionMeetingResponse] = Field(default_factory=list)


class CatalogForkRequest(CamelModel):
    """Request to fork a published/shared catalog into a new draft."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
