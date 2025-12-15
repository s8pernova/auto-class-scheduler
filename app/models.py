from typing import Optional
from pathlib import Path
from datetime import datetime, time

from pydantic import BaseModel, ConfigDict
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


class Directories:
    root: Path = Path(__file__).parent.parent.resolve()
    app: Path = root / "app"
    sql: Path = app / "sql"


class Settings:
    target_courses: list[tuple[str, int]] = [
        ("PHY", 241),
        ("MTH", 265),
        ("CSC", 223),
        # ("MTH", 288),
        ("CSC", 208),
    ]


class Secrets(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Directories.root / ".env",
        case_sensitive=False,
    )

    database_url: str


class Engines(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    env: Secrets = Secrets()
    _engine: Optional[Engine] = None

    @property
    def engine(self) -> Engine:
        if self._engine is None:
            self._engine = create_engine(self.env.database_url)
        return self._engine


# ~~~~ Response Models ~~~~


class MeetingResponse(BaseModel):
    """A meeting time for a section."""

    day_of_week: str
    start_time: time
    end_time: time
    campus: str


class ScheduleSectionDetailResponse(BaseModel):
    """Section information including instructor and meetings."""

    subject_code: str
    course_number: int
    section_code: str
    course_title: str
    credits: int
    instructor_name: str | None
    instructor_rating: float | None
    meetings: list[MeetingResponse]


class ScheduleSectionResponse(BaseModel):
    """Section information without meeting details (legacy)."""

    subject_code: str
    course_number: int
    section_code: str
    course_title: str
    credits: int


class ScheduleDetailResponse(BaseModel):
    """Full schedule including its sections (legacy)."""

    schedule_id: int
    total_credits: int
    total_instructor_score: float | None
    num_sections: int
    meets_mon: bool
    meets_tue: bool
    meets_wed: bool
    meets_thu: bool
    meets_fri: bool
    meets_sat: bool
    earliest_start: time
    latest_end: time
    campus_pattern: str
    created_at: datetime
    sections: list[ScheduleSectionResponse]


class ScheduleSummaryResponse(BaseModel):
    """Schedule summary with full section details."""

    schedule_id: int
    total_credits: int
    total_instructor_score: float | None
    num_sections: int
    meets_mon: bool
    meets_tue: bool
    meets_wed: bool
    meets_thu: bool
    meets_fri: bool
    meets_sat: bool
    earliest_start: time
    latest_end: time
    campus_pattern: str
    created_at: datetime
    sections: list[ScheduleSectionDetailResponse]


class FavoriteResponse(BaseModel):
    """Response when favoriting a schedule."""

    schedule_id: int
    favorited_at: datetime
    message: str = "Schedule favorited successfully"


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
