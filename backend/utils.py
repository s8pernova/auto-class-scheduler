"""
Shared utility functions.
"""

from __future__ import annotations

from datetime import datetime, time, timezone


def parse_time_str(s: str) -> time:
    """Parse a time string in ``HH:MM`` or ``HH:MM:SS`` format."""
    fmt = "%H:%M:%S" if len(s) > 5 else "%H:%M"
    return datetime.strptime(s, fmt).time()


def utcnow() -> datetime:
    """Return the current UTC-aware timestamp."""
    return datetime.now(timezone.utc)
