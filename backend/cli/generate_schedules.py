"""
Generate all valid class schedules and persist them to Supabase.

Usage::

    python -m backend.cli.generate_schedules --courses CSC:223 MTH:265 PHY:241
    python -m backend.cli.generate_schedules --term "Fall 2026" --dry-run
    python -m backend.cli.generate_schedules --campus Annandale --allow-campus-switch -v
"""

from __future__ import annotations

import json
import sys
import time as time_mod
from argparse import ArgumentParser, Namespace
from typing import Optional

from backend.config import Settings
from backend.core import generate_schedules, load_sections, write_schedules_to_db
from backend.core.generator import compute_schedule_summary
from backend.core.models import Section
from backend.dependencies import get_supabase
from supabase import Client

# Argument Parsing


def _parse_course(value: str) -> tuple[str, int]:
    """Parse ``'CSC:223'`` into ``('CSC', 223)``."""
    try:
        subject, number = value.split(":")
        return subject.upper(), int(number)
    except (ValueError, AttributeError):
        raise ValueError(
            f"Invalid course format '{value}' — expected SUBJECT:NUMBER (e.g. CSC:223)"
        )


def build_parser() -> ArgumentParser:
    """Define every CLI flag.  No logic — just the interface."""
    parser = ArgumentParser(
        prog="generate_schedules",
        description=(
            "Generate all conflict-free class schedule combinations "
            "and persist them to Supabase."
        ),
    )

    # Course Selection
    course_group = parser.add_argument_group("course selection")
    course_group.add_argument(
        "-c",
        "--courses",
        nargs="+",
        metavar="SUBJ:NUM",
        help=(
            "Courses to include in schedule generation (e.g. CSC:223 MTH:265). "
            "Overrides the defaults in Settings.target_courses."
        ),
    )
    course_group.add_argument(
        "--term",
        metavar="TERM",
        help="Filter possible_classes to a specific term (e.g. 'Fall 2026').",
    )

    # Constraint Toggles
    constraint_group = parser.add_argument_group("constraints")
    constraint_group.add_argument(
        "--allow-campus-switch",
        action="store_true",
        default=False,
        help="Allow schedules with same-day campus switches (default: disallowed).",
    )
    constraint_group.add_argument(
        "--campus",
        nargs="+",
        metavar="CAMPUS",
        help="Only include sections at these campuses (e.g. Annandale Alexandria Zoom).",
    )
    constraint_group.add_argument(
        "--modality",
        nargs="+",
        metavar="MODE",
        help="Only include sections with these modalities (e.g. IP HY Online).",
    )
    constraint_group.add_argument(
        "--min-rating",
        type=float,
        metavar="N",
        help="Exclude sections whose instructor rating is below N (1-4 scale).",
    )
    constraint_group.add_argument(
        "--exclude-honors",
        action="store_true",
        default=False,
        help="Exclude honors sections.",
    )
    constraint_group.add_argument(
        "--seats-available",
        action="store_true",
        default=False,
        help="Only include sections that have seats available (seats_available > 0).",
    )

    # Output Control
    output_group = parser.add_argument_group("output")
    output_group.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Generate schedules but don't write to the database.",
    )
    output_group.add_argument(
        "--clear",
        action="store_true",
        default=False,
        help="Delete all existing schedules before writing new ones.",
    )
    output_group.add_argument(
        "--limit",
        type=int,
        metavar="N",
        help="Write at most N schedules (useful for testing).",
    )
    output_group.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        default=False,
        help="Print details about each generated schedule.",
    )
    output_group.add_argument(
        "--json",
        action="store_true",
        default=False,
        dest="json_output",
        help="Output results as JSON instead of human-readable text.",
    )

    return parser


# Helpers


def _resolve_target_courses(
    args: Namespace, settings: Settings
) -> list[tuple[str, int]]:
    """Return the target courses list from CLI args or config defaults."""
    if args.courses:
        return [_parse_course(c) for c in args.courses]
    return settings.target_courses


def _filter_by_min_rating(
    sections_by_course: dict[tuple[str, int], list[Section]],
    min_rating: float,
) -> dict[tuple[str, int], list[Section]]:
    """Drop sections whose instructor rating is below *min_rating*."""
    return {
        key: pool
        for key, sections in sections_by_course.items()
        if (
            pool := [
                sec
                for sec in sections
                if sec.rating is not None and sec.rating >= min_rating
            ]
        )
    }


def _check_missing_courses(
    target_courses: list[tuple[str, int]],
    sections_by_course: dict,
) -> list[str]:
    """Return human-readable names of target courses absent from the data."""
    return [f"{s}:{n}" for s, n in target_courses if (s, n) not in sections_by_course]


def _clear_existing_schedules(client: Client) -> int:
    """Delete all rows from schedules (cascades to schedule_sections)."""
    count_resp = client.table("schedules").select("id", count="exact").execute()
    count = count_resp.count or 0
    if count > 0:
        client.table("schedules").delete().gte("id", 0).execute()
    return count


def _format_schedule_line(index: int, sched: list[Section]) -> str:
    """Build a single verbose-mode summary line."""
    summary = compute_schedule_summary(sched)
    courses = ", ".join(f"{s.subject}:{s.number}-{s.section_code}" for s in sched)
    rating = summary["total_instructor_score"] or "N/A"
    return (
        f"  [{index:>4}] {summary['total_credits']}cr | "
        f"rating={rating} | "
        f"{summary['campus_pattern']} | "
        f"{summary['earliest_start']}–{summary['latest_end']} | "
        f"{courses}"
    )


def _build_json_output(
    target_courses: list[tuple[str, int]],
    total_sections: int,
    schedules: list[list[Section]],
    dry_run: bool,
) -> dict:
    """Assemble the machine-readable JSON payload."""
    return {
        "target_courses": [f"{s}:{n}" for s, n in target_courses],
        "sections_loaded": total_sections,
        "schedules_generated": len(schedules),
        "dry_run": dry_run,
        "schedules": [
            {
                **compute_schedule_summary(sched),
                "courses": [
                    {
                        "subject": s.subject,
                        "number": s.number,
                        "section": s.section_code,
                        "instructor": s.instructor,
                        "rating": s.rating,
                    }
                    for s in sched
                ],
            }
            for sched in schedules
        ],
    }


# Orchestration


def run(args: Namespace) -> None:
    """Execute the generation pipeline.  Testable without argparse."""
    client = get_supabase()
    settings = Settings()
    quiet = args.json_output

    # Resolve target courses
    try:
        target_courses = _resolve_target_courses(args, settings)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)

    if not quiet:
        print(f"Target courses: {', '.join(f'{s}:{n}' for s, n in target_courses)}")

    # Load sections from Supabase
    t0 = time_mod.perf_counter()
    sections_by_course = load_sections(
        client,
        term=args.term,
        campuses=args.campus,
        modalities=args.modality,
        exclude_honors=args.exclude_honors,
        seats_available_only=args.seats_available,
    )
    load_time = time_mod.perf_counter() - t0

    missing = _check_missing_courses(target_courses, sections_by_course)
    if missing:
        print(f"error: no sections found for: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    # Apply Python-side filters
    if args.min_rating is not None:
        sections_by_course = _filter_by_min_rating(sections_by_course, args.min_rating)
        missing = _check_missing_courses(target_courses, sections_by_course)
        if missing:
            print(
                f"error: no sections remain after --min-rating for: "
                f"{', '.join(missing)}",
                file=sys.stderr,
            )
            sys.exit(1)

    total_sections = sum(
        len(v) for k, v in sections_by_course.items() if k in target_courses
    )
    if not quiet:
        print(f"Loaded {total_sections} sections in {load_time:.2f}s")

    # Generate schedules
    t0 = time_mod.perf_counter()
    schedules = generate_schedules(
        sections_by_course,
        target_courses,
        allow_campus_switch=args.allow_campus_switch,
    )
    gen_time = time_mod.perf_counter() - t0

    if not quiet:
        print(f"Generated {len(schedules)} valid schedules in {gen_time:.2f}s")

    # Apply limit
    if args.limit and len(schedules) > args.limit:
        schedules = schedules[: args.limit]
        if not quiet:
            print(f"Capped to {args.limit} schedules (--limit)")

    # Output
    if args.verbose and not quiet:
        for i, sched in enumerate(schedules, 1):
            print(_format_schedule_line(i, sched))

    if args.json_output:
        payload = _build_json_output(
            target_courses, total_sections, schedules, args.dry_run
        )
        print(json.dumps(payload, indent=2, default=str))
        if args.dry_run:
            return

    # Write to database
    if args.dry_run:
        if not quiet:
            print("Dry run — nothing written.")
        return

    if args.clear:
        cleared = _clear_existing_schedules(client)
        if not quiet:
            print(f"Cleared {cleared} existing schedules.")

    t0 = time_mod.perf_counter()
    count = write_schedules_to_db(client, schedules)
    write_time = time_mod.perf_counter() - t0

    if not quiet:
        print(f"Wrote {count} schedules in {write_time:.2f}s")


# Entry Point


def main(argv: Optional[list[str]] = None) -> None:
    """Parse CLI arguments and dispatch to :func:`run`."""
    parser = build_parser()
    args = parser.parse_args(argv)
    run(args)


if __name__ == "__main__":
    main()
