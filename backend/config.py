"""
Application settings.

Single ``BaseSettings`` class - reads from ``.env`` automatically.
No directory classes, no secrets wrappers, no hardcoded paths.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: Optional[str] = None

    # App
    app_title: str = "Schedule Planner API"
    app_description: str = "Tools for querying and managing possible class schedules."
    app_version: str = "1.0.0"

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
    ]

    # Solver limits
    max_candidate_combinations: int = 250_000
    max_results: int = 500

    # Catalog input limits
    max_catalog_courses: int = 8
    max_catalog_sections: int = 150
    max_sections_per_course: int = 20
    max_source_metadata_bytes_per_section: int = 2048

    # User input limits
    max_blocked_times: int = 20
    max_instructor_ratings: int = 200


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Get cached settings instance."""
    env_file = os.getenv("ENV_FILE")

    if env_file:
        return Settings(_env_file=env_file)
    return Settings()
