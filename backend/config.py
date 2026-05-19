"""
Application settings.

Single ``BaseSettings`` class - reads from ``.env`` automatically.
No directory classes, no secrets wrappers, no hardcoded paths.
"""

from __future__ import annotations

from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


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
    app_version: str = "2.0.0"

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
    ]

    # NOTE: LEGACY CODE
    # Default courses for the CLI generator (overridable via --courses)
    target_courses: list[tuple[str, int]] = [
        ("PHY", 241),
        ("MTH", 265),
        ("CSC", 223),
        ("MTH", 288),
    ]
