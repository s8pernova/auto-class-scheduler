"""
Schedule generation engine.

Loads sections from Supabase, generates all conflict-free
combinations, and computes summary statistics.
"""

from __future__ import annotations

import itertools
import math

from backend.core.models import Meeting, Section
from backend.utils import parse_time_str
from supabase import Client

# Conflict Detection


def _meetings_conflict(m1: Meeting, m2: Meeting) -> bool:
    if m1.day != m2.day:
        return False
    return max(m1.start, m2.start) < min(m1.end, m2.end)


# NOTE: LEGACY CODE
# Other schools may use "Online", "Remote", etc.
def _campus_switch_same_day(m1: Meeting, m2: Meeting) -> bool:
    if m1.day != m2.day:
        return False
    if m1.campus == "Zoom" or m2.campus == "Zoom":
        return False
    return m1.campus != m2.campus


def _schedule_is_valid(
    sections: list[Section],
    *,
    allow_campus_switch: bool = False,
) -> bool:
    all_meetings = [m for sec in sections for m in sec.meetings]
    for i in range(len(all_meetings)):
        for j in range(i + 1, len(all_meetings)):
            if not allow_campus_switch and _campus_switch_same_day(
                all_meetings[i], all_meetings[j]
            ):
                return False
            if _meetings_conflict(all_meetings[i], all_meetings[j]):
                return False
    return True


# Section Loading


def load_sections(
    client: Client,
    *,
    term: str | None = None,
    campuses: list[str] | None = None,
    modalities: list[str] | None = None,
    exclude_honors: bool = False,
    seats_available_only: bool = False,
) -> dict[tuple[str, int], list[Section]]:
    """Fetch all possible classes from Supabase, grouped by course.

    Args:
        client: Supabase client.
        term: Only load classes for this term (e.g. ``'Fall 2026'``).
        campuses: Only include sections at these campuses.
        modalities: Only include sections with these modalities.
        exclude_honors: Drop honors sections.
        seats_available_only: Only include sections with open seats.
    """
    query = (
        client.table("possible_classes")
        .select(
            "subject_code, course_number, section_code, course_title, "
            "credits, campus, modality, instructor_name, instructor_rating, "
            "day_of_week, start_time, end_time"
        )
        .order("subject_code")
        .order("course_number")
        .order("section_code")
    )

    # PostgREST-level filters
    if term:
        query = query.eq("term_name", term)
    if campuses:
        query = query.in_("campus", campuses)
    if modalities:
        query = query.in_("modality", modalities)
    if exclude_honors:
        query = query.eq("is_honors", False)
    if seats_available_only:
        query = query.gt("seats_available", 0)

    resp = query.execute()

    # Group rows by (subject, number, section) to build Section objects.
    grouped: dict[tuple[str, int, str], list[dict]] = {}
    for row in resp.data:
        key = (row["subject_code"], row["course_number"], row["section_code"])
        grouped.setdefault(key, []).append(row)

    sections_by_course: dict[tuple[str, int], list[Section]] = {}
    for (sub, num, sec), rows in grouped.items():
        first = rows[0]

        meetings = [
            Meeting(
                day=r["day_of_week"],
                start=parse_time_str(r["start_time"]),
                end=parse_time_str(r["end_time"]),
                campus=r["campus"],
            )
            for r in rows
        ]

        rating_raw = first["instructor_rating"]
        if rating_raw is None or (
            isinstance(rating_raw, float) and math.isnan(rating_raw)
        ):
            rating = None
        else:
            rating = float(rating_raw)

        sec_obj = Section(
            subject=sub,
            number=int(num),
            section_code=sec,
            title=first["course_title"] or "",
            credits=int(first["credits"]),
            instructor=first["instructor_name"] or "",
            rating=rating,
            meetings=meetings,
        )
        sections_by_course.setdefault((sub, int(num)), []).append(sec_obj)

    return sections_by_course


# Schedule Generation


def generate_schedules(
    sections_by_course: dict[tuple[str, int], list[Section]],
    target_courses: list[tuple[str, int]],
    *,
    allow_campus_switch: bool = False,
) -> list[list[Section]]:
    """Return every conflict-free combination of sections for *target_courses*."""
    pools = [sections_by_course[key] for key in target_courses]
    return [
        list(combo)
        for combo in itertools.product(*pools)
        if _schedule_is_valid(list(combo), allow_campus_switch=allow_campus_switch)
    ]


def compute_schedule_summary(sections: list[Section]) -> dict:
    """Derive aggregate stats for a single schedule combination."""
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    meetings = [m for s in sections for m in s.meetings]

    credits = sum(s.credits for s in sections)
    ratings = [s.rating for s in sections if s.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None

    days_hit = {day: any(m.day == day for m in meetings) for day in days}

    # NOTE: LEGACY CODE
    in_person = {m.campus for m in meetings if m.campus != "Zoom"}
    if len(in_person) == 0:
        campus_pattern = "Online-only"
    elif len(in_person) == 1:
        campus_pattern = f"{next(iter(in_person))}-only"
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
