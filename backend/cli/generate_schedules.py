"""
Generate all valid class schedules and persist them to Supabase.

Usage::

    python -m backend.cli.generate_schedules --courses CSC:223 MTH:265 PHY:241
    python -m backend.cli.generate_schedules --term "Fall 2026" --dry-run
    python -m backend.cli.generate_schedules --campus Annandale --no-campus-switch --verbose
"""

from __future__ import annotations

import json
import time as time_mod
from argparse import ArgumentParser
from typing import Optional

from backend.config import Settings
from backend.core import generate_schedules, load_sections, write_schedules_to_db
from backend.dependencies import get_supabase


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


def _apply_min_rating_filter(
    sections_by_course: dict[tuple[str, int], list],
    min_rating: float,
) -> dict[tuple[str, int], list]:
    """Drop sections whose instructor rating is below *min_rating*."""
    filtered: dict[tuple[str, int], list] = {}
    for key, sections in sections_by_course.items():
        pool = [
            sec
            for sec in sections
            if sec.rating is not None and sec.rating >= min_rating
        ]
        if pool:
            filtered[key] = pool
    return filtered


def _clear_existing_schedules(client) -> int:
    """Delete all rows from schedules (cascades to schedule_sections). Returns count."""
    # Count first
    count_resp = client.table("schedules").select("id", count="exact").execute()
    count = count_resp.count or 0

    if count > 0:
        # Delete all — PostgREST requires a filter, so we use gte 0 on the PK
        client.table("schedules").delete().gte("id", 0).execute()

    return count


def main(argv: Optional[list[str]] = None) -> None:
    """Entry point for schedule generation CLI."""
    parser = build_parser()
    args = parser.parse_args(argv)

    client = get_supabase()
    settings = Settings()

    # Resolve target courses
    if args.courses:
        try:
            target_courses = [_parse_course(c) for c in args.courses]
        except ValueError as e:
            parser.error(str(e))
    else:
        target_courses = settings.target_courses

    if not args.json_output:
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

    # Check that all target courses exist in the data
    missing = [
        f"{s}:{n}" for s, n in target_courses if (s, n) not in sections_by_course
    ]
    if missing:
        parser.error(f"No sections found for: {', '.join(missing)}")

    # Apply Python-side filters
    if args.min_rating is not None:
        sections_by_course = _apply_min_rating_filter(
            sections_by_course, args.min_rating
        )
        missing_after = [
            f"{s}:{n}" for s, n in target_courses if (s, n) not in sections_by_course
        ]
        if missing_after:
            parser.error(
                f"No sections remain after --min-rating filter for: "
                f"{', '.join(missing_after)}"
            )

    total_sections = sum(
        len(v) for k, v in sections_by_course.items() if k in target_courses
    )
    if not args.json_output:
        print(f"Loaded {total_sections} sections in {load_time:.2f}s")

    # Generate schedules
    t0 = time_mod.perf_counter()
    valid = generate_schedules(
        sections_by_course,
        target_courses,
        allow_campus_switch=args.allow_campus_switch,
    )
    gen_time = time_mod.perf_counter() - t0

    if not args.json_output:
        print(f"Generated {len(valid)} valid schedules in {gen_time:.2f}s")

    # Apply limit
    if args.limit and len(valid) > args.limit:
        valid = valid[: args.limit]
        if not args.json_output:
            print(f"Capped to {args.limit} schedules (--limit)")

    # Verbose / JSON output
    if args.verbose and not args.json_output:
        from backend.core.generator import compute_schedule_summary

        for i, sched in enumerate(valid, 1):
            summary = compute_schedule_summary(sched)
            courses = ", ".join(
                f"{s.subject}:{s.number}-{s.section_code}" for s in sched
            )
            rating = summary["total_instructor_score"] or "N/A"
            print(
                f"  [{i:>4}] {summary['total_credits']}cr | "
                f"rating={rating} | "
                f"{summary['campus_pattern']} | "
                f"{summary['earliest_start']}–{summary['latest_end']} | "
                f"{courses}"
            )

    if args.json_output:
        from backend.core.generator import compute_schedule_summary

        output = {
            "target_courses": [f"{s}:{n}" for s, n in target_courses],
            "sections_loaded": total_sections,
            "schedules_generated": len(valid),
            "dry_run": args.dry_run,
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
                for sched in valid
            ],
        }
        print(json.dumps(output, indent=2, default=str))
        if args.dry_run:
            return

    # Write to database
    if args.dry_run:
        if not args.json_output:
            print("Dry run — nothing written.")
        return

    if args.clear:
        cleared = _clear_existing_schedules(client)
        if not args.json_output:
            print(f"Cleared {cleared} existing schedules.")

    t0 = time_mod.perf_counter()
    count = write_schedules_to_db(client, valid)
    write_time = time_mod.perf_counter() - t0

    if not args.json_output:
        print(f"Wrote {count} schedules in {write_time:.2f}s")


if __name__ == "__main__":
    main()
