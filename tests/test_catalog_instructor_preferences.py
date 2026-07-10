from __future__ import annotations

import unittest
from types import SimpleNamespace
from uuid import UUID

from backend.api.v1.schemas.catalogs import CatalogInstructorPreferencesReplaceRequest
from backend.api.v1.services.catalogs import (
    list_catalog_instructor_preferences,
    replace_catalog_instructor_preferences,
)

CATALOG_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
INSTRUCTOR_ID = UUID("11111111-1111-1111-1111-111111111111")
CLEARED_INSTRUCTOR_ID = UUID("22222222-2222-2222-2222-222222222222")


class CatalogInstructorPreferenceTests(unittest.TestCase):
    def test_replace_normalizes_names_and_drops_blank_scores(self) -> None:
        client = FakeSupabase()

        result = replace_catalog_instructor_preferences(
            client,
            CATALOG_ID,
            user_id=USER_ID,
            payload=CatalogInstructorPreferencesReplaceRequest(
                instructor_ratings={
                    " Professor   Example ": 4.5,
                    "Cleared Instructor": None,
                }
            ),
        )

        self.assertEqual(result.instructor_ratings, {"Professor Example": 4.5})
        self.assertEqual(
            client.preferences,
            [
                {
                    "instructor_id": str(INSTRUCTOR_ID),
                    "user_id": str(USER_ID),
                    "preference_score": 4.5,
                }
            ],
        )

    def test_replace_rejects_unknown_rated_instructors(self) -> None:
        client = FakeSupabase()

        with self.assertRaisesRegex(ValueError, "Unknown Professor"):
            replace_catalog_instructor_preferences(
                client,
                CATALOG_ID,
                user_id=USER_ID,
                payload=CatalogInstructorPreferencesReplaceRequest(
                    instructor_ratings={"Unknown Professor": 3}
                ),
            )

        self.assertEqual(client.preferences, [])

    def test_list_without_user_returns_empty_preferences(self) -> None:
        result = list_catalog_instructor_preferences(
            FakeSupabase(),
            CATALOG_ID,
            user_id=None,
        )

        self.assertEqual(result.instructor_ratings, {})


class FakeSupabase:
    def __init__(self) -> None:
        self.instructors: list[dict[str, str]] = [
            {
                "id": str(INSTRUCTOR_ID),
                "catalog_id": str(CATALOG_ID),
                "name": "Professor Example",
                "normalized_name": "professor example",
            },
            {
                "id": str(CLEARED_INSTRUCTOR_ID),
                "catalog_id": str(CATALOG_ID),
                "name": "Cleared Instructor",
                "normalized_name": "cleared instructor",
            },
        ]
        self.preferences: list[dict[str, str | float | None]] = []

    def table(self, table_name: str) -> "FakeTable":
        return FakeTable(self, table_name)


class FakeTable:
    def __init__(self, client: FakeSupabase, table_name: str) -> None:
        self.client = client
        self.table_name = table_name
        self.filters: list[tuple[str, str]] = []
        self.in_filters: list[tuple[str, set[str]]] = []
        self.is_delete = False
        self.insert_rows: list[dict[str, str | float | None]] | None = None

    def select(self, _columns: str) -> "FakeTable":
        return self

    def eq(self, column: str, value: str) -> "FakeTable":
        self.filters.append((column, value))
        return self

    def in_(self, column: str, values: list[str]) -> "FakeTable":
        self.in_filters.append((column, set(values)))
        return self

    def order(self, _column: str) -> "FakeTable":
        return self

    def delete(self) -> "FakeTable":
        self.is_delete = True
        return self

    def insert(self, rows: list[dict[str, str | float | None]]) -> "FakeTable":
        self.insert_rows = rows
        return self

    def execute(self) -> SimpleNamespace:
        rows = self._table_rows()
        if self.insert_rows is not None:
            self.client.preferences.extend(self.insert_rows)
            return SimpleNamespace(data=self.insert_rows)

        if self.is_delete:
            self.client.preferences = [
                row for row in self.client.preferences if not self._matches(row)
            ]
            return SimpleNamespace(data=[])

        return SimpleNamespace(data=[row for row in rows if self._matches(row)])

    def _table_rows(self) -> list[dict[str, str | float | None]]:
        if self.table_name == "catalog_instructors":
            return self.client.instructors
        if self.table_name == "catalog_instructor_preferences":
            return self.client.preferences
        raise AssertionError(f"Unexpected table: {self.table_name}")

    def _matches(self, row: dict[str, str | float | None]) -> bool:
        return all(row.get(column) == value for column, value in self.filters) and all(
            row.get(column) in values for column, values in self.in_filters
        )


if __name__ == "__main__":
    unittest.main()
