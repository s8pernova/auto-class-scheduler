from __future__ import annotations

from dataclasses import dataclass
from datetime import time
from typing import Optional
import itertools
import math

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

from models import (
    Directories as dirs,
    Settings as sets,
    Engines
)
from utilities import Utilities as utils

engs = Engines()


@dataclass
class Meeting:
    day: str
    start: time
    end: time
    campus: str


@dataclass
class Section:
    subject: str
    number: int
    section_code: str
    title: str
    credits: int
    instructor: str
    meetings: list[Meeting]
    rating: Optional[float] = None


def load_sections(engine: Engine, sql_query: str) -> dict[tuple[str, int], list[Section]]:
    df = pd.read_sql(sql_query, con=engine)

    df["start_time"] = df["start_time"].astype(str)
    df["end_time"] = df["end_time"].astype(str)

    sections_by_course: dict[tuple[str, int], list[Section]] = {}

    for (sub, num, sec), group in df.groupby(
        ["subject_code", "course_number", "section_code"]
    ):
        first = group.iloc[0]

        meetings = [
            Meeting(
                day=row["day_of_week"],
                start=utils.parse_time_str(row["start_time"]),
                end=utils.parse_time_str(row["end_time"]),
                campus=row["campus"],
            )
            for _, row in group.iterrows()
        ]

        rating = first["instructor_rating"]
        # Convert rating: pandas returns NaN for NULL, we want None
        if rating is None or (isinstance(rating, float) and math.isnan(rating)):
            rating_value = None
        else:
            rating_value = float(rating)

        sec_obj = Section(
            subject=sub,
            number=int(num),
            section_code=sec,
            title=first["course_title"] or "",
            credits=int(first["credits"]),
            instructor=first["instructor_name"] or "",
            rating=rating_value,
            meetings=meetings,
        )

        sections_by_course.setdefault((sub, int(num)), []).append(sec_obj)

    return sections_by_course


def meetings_conflict(m1: Meeting, m2: Meeting) -> bool:
    if m1.day != m2.day:
        return False
    return max(m1.start, m2.start) < min(m1.end, m2.end)


def campus_switch_same_day(m1: Meeting, m2: Meeting) -> bool:
    if m1.day != m2.day:
        return False
    if m1.campus == "Zoom" or m2.campus == "Zoom":
        return False
    return m1.campus != m2.campus


def schedule_is_valid(sections: list[Section]) -> bool:
    all_meetings = [m for sec in sections for m in sec.meetings]
    for i in range(len(all_meetings)):
        for j in range(i + 1, len(all_meetings)):
            if campus_switch_same_day(all_meetings[i], all_meetings[j]):
                return False
            if meetings_conflict(all_meetings[i], all_meetings[j]):
                return False
    return True


def generate_schedules(sections_by_course, target_courses):
    pools = [sections_by_course[key] for key in target_courses]
    results = []
    for combo in itertools.product(*pools):
        combo = list(combo)
        if schedule_is_valid(combo):
            results.append(combo)
    return results


def compute_schedule_summary(sections: list[Section]) -> dict:
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    meetings = [m for s in sections for m in s.meetings]

    credits = sum(s.credits for s in sections)

    # Calculate average rating, or None if no ratings available
    sections_with_ratings = [s.rating for s in sections if s.rating is not None]
    if sections_with_ratings:
        avg_rating = round(sum(sections_with_ratings) / len(sections_with_ratings), 2)
    else:
        avg_rating = None

    num_sections = len(sections)

    days_hit = {day: False for day in days}
    for m in meetings:
        if m.day in days_hit:
            days_hit[m.day] = True

    in_person_campuses = {m.campus for m in meetings if m.campus != "Zoom"}

    if len(in_person_campuses) == 0:
        campus_pattern = "Online-only"
    elif len(in_person_campuses) == 1:
        campus_pattern = list(in_person_campuses)[0] + "-only"
    else:
        campus_pattern = "Mixed"

    earliest_start = min(m.start for m in meetings)
    latest_end = max(m.end for m in meetings)

    return {
        "total_credits": credits,
        "total_instructor_score": avg_rating,
        "num_sections": num_sections,
        "meets_mon": days_hit["Mon"],
        "meets_tue": days_hit["Tue"],
        "meets_wed": days_hit["Wed"],
        "meets_thu": days_hit["Thu"],
        "meets_fri": days_hit["Fri"],
        "meets_sat": days_hit["Sat"],
        "earliest_start": earliest_start,
        "latest_end": latest_end,
        "campus_pattern": campus_pattern,
    }


def write_schedules_to_db(engine: Engine, schedules: list[list[Section]], dirs: Directories):
    now = utils.now()

    insert_schedule_sql = utils.read_sql("mutations/insert_schedules")
    insert_section_sql = utils.read_sql("mutations/insert_schedule_sections")

    for sched in schedules:
        summary = compute_schedule_summary(sched)

        schedule_row = {
            "created_at": now,
            **summary,
        }

        # Insert the schedule and get the generated ID
        with engine.begin() as conn:
            result = conn.execute(
                text(insert_schedule_sql),
                schedule_row
            )
            schedule_id = result.fetchone()[0]

            # Insert the sections for this schedule
            for sec in sched:
                conn.execute(
                    text(insert_section_sql),
                    {
                        "schedule_id": schedule_id,
                        "subject_code": sec.subject,
                        "course_number": sec.number,
                        "section_code": sec.section_code,
                        "course_title": sec.title,
                        "credits": sec.credits,
                    }
                )

    print(f"Generated {len(schedules)} valid schedules")


def main():
    get_courses_sql = utils.read_sql("queries/get_courses")
    sections_by_course = load_sections(engs.engine, get_courses_sql)
    valid = generate_schedules(sections_by_course, sets.target_courses)
    write_schedules_to_db(engs.engine, valid, dirs)


if __name__ == "__main__":
    main()
