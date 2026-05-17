"""
CLI entry point - generate all valid schedules and persist them.

Usage::

    python -m backend.main
"""

from __future__ import annotations

from backend.config import Settings
from backend.core import generate_schedules, load_sections, write_schedules_to_db
from backend.dependencies import get_supabase


def main() -> None:
    """Load possible courses, generate conflict-free schedules, and write to Supabase."""
    client = get_supabase()
    settings = Settings()

    sections_by_course = load_sections(client)
    valid = generate_schedules(sections_by_course, settings.target_courses)
    count = write_schedules_to_db(client, valid)

    print(f"Generated {count} valid schedules")


# TODO: replace with real cli later
if __name__ == "__main__":
    main()
