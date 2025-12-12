from __future__ import annotations

from dataclasses import dataclass
from datetime import time, datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple
import itertools

from pandas import DataFrame, read_sql
from pydantic import BaseModel, ConfigDict
from pydantic_settings import BaseSettings
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


TARGET_COURSES: List[Tuple[str, int]] = [
    ("PHY", 241),
    ("MTH", 265),
    ("CSC", 223),
    ("CSC", 208),
]


class Directories(BaseModel):
    # Dirs
    root: Path = Path(__file__).parent.parent.resolve()
    app: Path = root / "app"
    sql: Path = app / "sql"

    # Files
    get_courses: Path = sql / "queries/get_courses.sql"


class Secrets(BaseSettings):
    model_config = ConfigDict(env_file=".env", case_sensitive=False)

    database_url: str


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
    rating: float | None
    meetings: List[Meeting]


def parse_time_str(s: str) -> time:
    fmt = "%H:%M:%S" if len(s) > 5 else "%H:%M"
    return datetime.strptime(s, fmt).time()


def load_sections(engine: Engine, sql_file: Path) -> Dict[Tuple[str, int], List[Section]]:
    df = read_sql(sql_file.read_text(), con=engine)

    df["start_time"] = df["start_time"].astype(str)
    df["end_time"] = df["end_time"].astype(str)

    sections_by_course: Dict[Tuple[str, int], List[Section]] = {}

    for (sub, num, sec), group in df.groupby(
        ["subject_code", "course_number", "section_code"]
    ):
        first = group.iloc[0]

        meetings = [
            Meeting(
                day=row["day_of_week"],
                start=parse_time_str(row["start_time"]),
                end=parse_time_str(row["end_time"]),
                campus=row["campus"],
            )
            for _, row in group.iterrows()
        ]

        rating = first["instructor_rating"]
        sec_obj = Section(
            subject=sub,
            number=int(num),
            section_code=sec,
            title=first["course_title"] or "",
            credits=int(first["credits"]),
            instructor=first["instructor_name"] or "",
            rating=float(rating) if rating is not None else None,
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


def schedule_is_valid(sections: List[Section]) -> bool:
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


def compute_schedule_summary(sections: List[Section]) -> dict:
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    meetings = [m for s in sections for m in s.meetings]

    credits = sum(s.credits for s in sections)
    avg_rating = sum(s.rating for s in sections if s.rating is not None) / max(
        1, len([s for s in sections if s.rating is not None])
    )
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


def write_schedules_to_db(engine: Engine, schedules: List[List[Section]]):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM schedule_sections;"))
        conn.execute(text("DELETE FROM schedules;"))

    schedule_rows = []
    schedule_sec_rows = []
    now = datetime.now(timezone.utc)

    for idx, sched in enumerate(schedules, start=1):
        summary = compute_schedule_summary(sched)

        schedule_rows.append(
            {
                "id": idx,
                "created_at": now,
                **summary,
            }
        )

        for sec in sched:
            schedule_sec_rows.append(
                {
                    "schedule_id": idx,
                    "subject_code": sec.subject,
                    "course_number": sec.number,
                    "section_code": sec.section_code,
                    "course_title": sec.title,
                    "credits": sec.credits,
                }
            )

    DataFrame(schedule_rows).to_sql("schedules", engine, if_exists="append", index=False)
    DataFrame(schedule_sec_rows).to_sql("schedule_sections", engine, if_exists="append", index=False)


def main():
    dirs = Directories()
    sets = Secrets()
    engine = create_engine(sets.database_url)

    sections_by_course = load_sections(engine, dirs.get_courses)
    valid = generate_schedules(sections_by_course, TARGET_COURSES)
    write_schedules_to_db(engine, valid)

    print(f"Generated {len(valid)} valid schedules")


if __name__ == "__main__":
    main()
