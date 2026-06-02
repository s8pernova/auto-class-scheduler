"""
Schedule generation engine.

Computes summary statistics for generated schedules.
"""

from __future__ import annotations

from backend.core.models import Section


def compute_schedule_summary(sections: list[Section]) -> dict:
    """Derive aggregate stats for a single schedule combination."""
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    meetings = [m for s in sections for m in s.meetings]

    credits = sum(s.credits for s in sections)
    ratings = [s.rating for s in sections if s.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None

    days_hit = {day: any(m.day == day for m in meetings) for day in days}

    campuses = {m.campus for m in meetings if m.campus}
    if not campuses:
        campus_pattern = "Unspecified"
    elif len(campuses) == 1:
        campus_pattern = f"{next(iter(campuses))}-only"
    else:
        campus_pattern = "Mixed"

    return {
        "total_credits": credits,
        "total_instructor_score": avg_rating,
        "num_sections": len(sections),
        "meets_mon": days_hit["Mon"],
        "meets_tue": days_hit["Tue"],
        "meets_wed": days_hit["Wed"],
        "meets_thu": days_hit["Thu"],
        "meets_fri": days_hit["Fri"],
        "meets_sat": days_hit["Sat"],
        "earliest_start": min(m.start for m in meetings).isoformat(),
        "latest_end": max(m.end for m in meetings).isoformat(),
        "campus_pattern": campus_pattern,
    }
