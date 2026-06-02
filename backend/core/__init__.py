"""Core domain package - schedule generation, validation, and persistence."""

from backend.core.generator import (
    compute_schedule_summary,
)
from backend.core.models import Meeting, Section

__all__ = [
    "Meeting",
    "Section",
    "compute_schedule_summary",
]
