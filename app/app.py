from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from pandas import read_sql, isna

from utilities import Utilities as utils
from models import (
    Engines,
    HealthResponse,
    ScheduleDetailResponse,
    ScheduleSummaryResponse,
    ScheduleSectionResponse,
    ScheduleSectionDetailResponse,
    MeetingResponse,
    FavoriteResponse,
)

app = FastAPI(
    title="Schedule Planner",
    description="Tools for querying possible class schedules.",
    version="0.1.0",
)

# Configure CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engs = Engines()


# ~~~~ Helper Functions ~~~~


def get_schedule_by_id(schedule_id: int) -> ScheduleDetailResponse | None:
    """Fetch a schedule with all its sections from the database."""
    sql = utils.read_sql("queries/get_schedule_detail")
    df = read_sql(text(sql), con=engs.engine, params={"schedule_id": schedule_id})

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
async def get_schedules(
    favorites_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    campuses: Optional[list[str]] = Query(None),
    times: Optional[list[str]] = Query(None)
):
    """Get all schedules with full details including instructor ratings and meeting times.

    Args:
        favorites_only: If True, only return favorited schedules
        limit: Maximum number of schedules to return (default 50)
        offset: Number of schedules to skip (default 0)
        campuses: List of campus filters ('Annandale', 'Alexandria', 'Online')
        times: List of time filters ('Morning', 'Afternoon', 'Evening')
    """
    # Convert campus selections to campus_patterns
    campus_patterns = None
    if campuses:
        patterns = set()
        if 'Annandale' in campuses:
            patterns.add('Annandale-only')
        if 'Alexandria' in campuses:
            patterns.add('Alexandria-only')
        if 'Online' in campuses:
            patterns.add('Online-only')
        # Only include Mixed if both Annandale AND Alexandria are selected
        if 'Annandale' in campuses and 'Alexandria' in campuses:
            patterns.add('Mixed')
        campus_patterns = list(patterns) if patterns else None

    # Convert time selections to boolean flags
    include_morning = times and 'Morning' in times
    include_afternoon = times and 'Afternoon' in times
    include_evening = times and 'Evening' in times

    query_file = (
        "queries/get_favorited_schedules_with_details"
        if favorites_only
        else "queries/get_schedules_with_details"
    )
    sql = utils.read_sql(query_file)

    params = {
        'limit': limit,
        'offset': offset,
        'campus_patterns': campus_patterns,
        'include_morning': include_morning,
        'include_afternoon': include_afternoon,
        'include_evening': include_evening
    }

    df = read_sql(text(sql), con=engs.engine, params=params)

    if df.empty:
        return []

    # Group by schedule_id to aggregate sections and meetings
    schedules_dict = {}
    for _, row in df.iterrows():
        schedule_id = row["id"]

        # Initialize schedule if not seen yet
        if schedule_id not in schedules_dict:
            schedules_dict[schedule_id] = {
                "schedule_id": schedule_id,
                "total_credits": row["total_credits"],
                "total_instructor_score": row["total_instructor_score"],
                "num_sections": row["num_sections"],
                "meets_mon": row["meets_mon"],
                "meets_tue": row["meets_tue"],
                "meets_wed": row["meets_wed"],
                "meets_thu": row["meets_thu"],
                "meets_fri": row["meets_fri"],
                "meets_sat": row["meets_sat"],
                "earliest_start": row["earliest_start"],
                "latest_end": row["latest_end"],
                "campus_pattern": row["campus_pattern"],
                "created_at": row["created_at"],
                "sections_dict": {}
            }

        # Add section data
        if row["subject_code"] is not None:
            section_key = (row["subject_code"], row["course_number"], row["section_code"])

            if section_key not in schedules_dict[schedule_id]["sections_dict"]:
                # Handle NaN values for instructor_rating - convert to None for JSON serialization
                instructor_rating = None if isna(row["instructor_rating"]) else row["instructor_rating"]

                schedules_dict[schedule_id]["sections_dict"][section_key] = {
                    "subject_code": row["subject_code"],
                    "course_number": row["course_number"],
                    "section_code": row["section_code"],
                    "course_title": row["course_title"],
                    "credits": row["credits"],
                    "modality": row["modality"],
                    "instructor_name": row["instructor_name"],
                    "instructor_rating": instructor_rating,
                    "meetings": []
                }

            # Add meeting if it exists
            if row["day_of_week"] is not None:
                schedules_dict[schedule_id]["sections_dict"][section_key]["meetings"].append(
                    MeetingResponse(
                        day_of_week=row["day_of_week"],
                        start_time=row["start_time"],
                        end_time=row["end_time"],
                        campus=row["campus"]
                    )
                )

    # Convert to response format
    schedules = []
    for schedule_data in schedules_dict.values():
        sections = [
            ScheduleSectionDetailResponse(**section_data)
            for section_data in schedule_data["sections_dict"].values()
        ]

        schedules.append(ScheduleSummaryResponse(
            schedule_id=schedule_data["schedule_id"],
            total_credits=schedule_data["total_credits"],
            total_instructor_score=schedule_data["total_instructor_score"],
            num_sections=schedule_data["num_sections"],
            meets_mon=schedule_data["meets_mon"],
            meets_tue=schedule_data["meets_tue"],
            meets_wed=schedule_data["meets_wed"],
            meets_thu=schedule_data["meets_thu"],
            meets_fri=schedule_data["meets_fri"],
            meets_sat=schedule_data["meets_sat"],
            earliest_start=schedule_data["earliest_start"],
            latest_end=schedule_data["latest_end"],
            campus_pattern=schedule_data["campus_pattern"],
            created_at=schedule_data["created_at"],
            sections=sections
        ))

    return schedules


@app.get("/api/favorites")
async def get_favorites():
    """Get all favorited schedule IDs."""
    sql = utils.read_sql("queries/get_favorites")
    df = read_sql(text(sql), con=engs.engine)

    # Return list of schedule IDs
    return [int(row["schedule_id"]) for _, row in df.iterrows()]


@app.post("/api/favorite/{schedule_id}", response_model=FavoriteResponse)
async def favorite_schedule(schedule_id: int):
    """Favorite a schedule."""
    # Check if schedule exists
    schedule = get_schedule_by_id(schedule_id)
    if schedule is None:
        raise HTTPException(
            status_code=404, detail=f"Schedule {schedule_id} not found"
        )

    # Insert favorite (or update if already exists)
    sql = utils.read_sql("mutations/upsert_favorite")
    params = {"schedule_id": schedule_id}

    with engs.engine.begin() as conn:
        result = conn.execute(text(sql), params)
        row = result.fetchone()

    return FavoriteResponse(
        schedule_id=row[1],
        favorited_at=row[2],
    )


@app.delete("/api/favorite/{schedule_id}")
async def unfavorite_schedule(schedule_id: int):
    """Remove a schedule from favorites."""
    sql = utils.read_sql("mutations/delete_favorite")

    with engs.engine.begin() as conn:
        result = conn.execute(
            text(sql),
            {"schedule_id": schedule_id}
        )
        row = result.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Schedule {schedule_id} is not favorited"
            )

    return {"schedule_id": schedule_id, "message": "Unfavorited successfully"}
