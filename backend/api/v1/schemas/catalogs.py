"""Catalog-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


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

