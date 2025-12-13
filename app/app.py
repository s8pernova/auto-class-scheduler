from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from pandas import read_sql

from app.utilities import Utilities as utils
from app.models import (
    Directories,
    Engines,
    HealthResponse,
    ScheduleSummaryResponse,
    ScheduleDetailResponse,
    ScheduleSectionResponse,
    FavoriteScheduleRequest,
    FavoriteResponse,
)

app = FastAPI(
    title="Schedule Planner",
    description="Tools for querying possible class schedules.",
    version="0.1.0",
)
dirs = Directories()
engs = Engines()


# ~~~~ Helper Functions ~~~~


def get_schedule_by_id(schedule_id: int) -> ScheduleDetailResponse | None:
    """Fetch a schedule with all its sections from the database."""
    sql = utils.read_sql("queries/get_schedule_detail")
    df = read_sql(sql, con=engs.engine, params={"schedule_id": schedule_id})

    if df.empty:
        return None

    # First row has the schedule summary
    first = df.iloc[0]

    sections = [
        ScheduleSectionResponse(
            subject_code=row["subject_code"],
            course_number=row["course_number"],
            section_code=row["section_code"],
            course_title=row["course_title"],
            credits=row["credits"],
        )
        for _, row in df.iterrows()
    ]

    return ScheduleDetailResponse(
        schedule_id=first["schedule_id"],
        total_credits=first["total_credits"],
        total_instructor_score=first["total_instructor_score"],
        num_sections=first["num_sections"],
        meets_mon=first["meets_mon"],
        meets_tue=first["meets_tue"],
        meets_wed=first["meets_wed"],
        meets_thu=first["meets_thu"],
        meets_fri=first["meets_fri"],
        meets_sat=first["meets_sat"],
        earliest_start=first["earliest_start"],
        latest_end=first["latest_end"],
        campus_pattern=first["campus_pattern"],
        created_at=first["created_at"],
        sections=sections,
    )


# ~~~~ Endpoints ~~~~


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="ok")


@app.get("/api/schedules", response_model=list[ScheduleSummaryResponse])
async def get_schedules():
    """Get all schedules with summary information."""
    sql = utils.read_sql("queries/get_schedules")
    df = read_sql(sql, con=engs.engine)

    schedules = [
        ScheduleSummaryResponse(
            schedule_id=row["id"],
            total_credits=row["total_credits"],
            total_instructor_score=row["total_instructor_score"],
            num_sections=row["num_sections"],
            meets_mon=row["meets_mon"],
            meets_tue=row["meets_tue"],
            meets_wed=row["meets_wed"],
            meets_thu=row["meets_thu"],
            meets_fri=row["meets_fri"],
            meets_sat=row["meets_sat"],
            earliest_start=row["earliest_start"],
            latest_end=row["latest_end"],
            campus_pattern=row["campus_pattern"],
            created_at=row["created_at"],
        )
        for _, row in df.iterrows()
    ]

    return schedules


@app.get("/api/schedules/{schedule_id}", response_model=ScheduleDetailResponse)
async def get_schedule(schedule_id: int):
    """Get detailed information about a specific schedule including sections."""
    schedule = get_schedule_by_id(schedule_id)

    if schedule is None:
        raise HTTPException(status_code=404, detail=f"Schedule {schedule_id} not found")

    return schedule


@app.post("/api/favorite", response_model=FavoriteResponse)
async def favorite_schedule(request: FavoriteScheduleRequest):
    """Favorite a schedule."""
    # Check if schedule exists
    schedule = get_schedule_by_id(request.schedule_id)
    if schedule is None:
        raise HTTPException(
            status_code=404, detail=f"Schedule {request.schedule_id} not found"
        )

    # Insert favorite (or update if already exists)
    sql = utils.read_sql("mutations/upsert_favorite")
    now = utils.now()

    params = {
        "schedule_id": request.schedule_id,
        "favorited_at": now,
    }

    with engs.engine.begin() as conn:
        result = conn.execute(text(sql), params)
        row = result.fetchone()

    return FavoriteResponse(
        schedule_id=row[1],
        favorited_at=row[2],
    )
