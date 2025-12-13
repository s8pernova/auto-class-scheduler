from typing import Optional
from pathlib import Path
from datetime import datetime, time
from pydantic import BaseModel, Field, ConfigDict
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


class Directories(BaseModel):
    root: Path = Path(__file__).parent.parent.resolve()
    app: Path = root / "app"
    sql: Path = app / "sql"


class Settings(BaseModel):
    target_courses: list[tuple[str, int]] = [
        ("PHY", 241),
        ("MTH", 265),
        ("CSC", 223),
        ("MTH", 288),
        # ("CSC", 208),
    ]


class Secrets(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

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


class ScheduleSectionResponse(BaseModel):
    """A section within a schedule."""

    subject_code: str
    course_number: int
    section_code: str
    course_title: str
    credits: int


class ScheduleSummaryResponse(BaseModel):
    """Summary information about a schedule."""

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


class ScheduleDetailResponse(ScheduleSummaryResponse):
    """Detailed schedule information including sections."""

    sections: list[ScheduleSectionResponse]


class FavoriteResponse(BaseModel):
    """Response when favoriting a schedule."""

    schedule_id: int
    favorited_at: datetime
    message: str = "Schedule favorited successfully"


class HealthResponse(BaseModel):
    """Health check response."""

    status: str


# ~~~~ Request Models ~~~~


class FavoriteScheduleRequest(BaseModel):
    """Request to favorite a schedule."""

    schedule_id: int = Field(..., gt=0, description="ID of the schedule to favorite")
