"""Catalog-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CatalogCreate(BaseModel):
    """Payload for creating a new catalog."""

    name: str = Field(..., min_length=1, max_length=200)
    source_type: str = Field(
        default="manual",
        pattern=r"^(csv|paste|manual|importer|shared|demo)$",
    )
    school_name: Optional[str] = Field(default=None, max_length=200)
    term_name: Optional[str] = Field(default=None, max_length=100)


class CatalogResponse(BaseModel):
    """Catalog returned from the API."""

    id: UUID
    name: str
    source_type: str
    school_name: Optional[str] = None
    term_name: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
