"""
Database writer for generated schedules.
"""

from __future__ import annotations

from backend.core.generator import compute_schedule_summary
from backend.core.models import Section
from supabase import Client


def write_schedules_to_db(
    client: Client,
    schedules: list[list[Section]],
) -> int:
    """Persist generated schedules and their sections to Supabase.

    Returns the number of schedules written.
    """
    for sched in schedules:
        summary = compute_schedule_summary(sched)

        # Insert schedule, get back the generated ID.
        resp = client.table("schedules").insert(summary).execute()
        schedule_id = resp.data[0]["id"]

        # Batch-insert all sections for this schedule.
        sections_data = [
            {
                "schedule_id": schedule_id,
                "subject_code": sec.subject,
                "course_number": sec.number,
                "section_code": sec.section_code,
                "course_title": sec.title,
                "credits": sec.credits,
            }
            for sec in sched
        ]
        client.table("schedule_sections").insert(sections_data).execute()

    return len(schedules)
