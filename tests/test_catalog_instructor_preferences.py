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
            client.rows,
            [
                {
                    "catalog_id": str(CATALOG_ID),
                    "user_id": str(USER_ID),
                    "instructor_name": "Professor Example",
                    "normalized_instructor_name": "professor example",
                    "preference_score": 4.5,
                }
            ],
        )

    def test_list_without_user_returns_empty_preferences(self) -> None:
        result = list_catalog_instructor_preferences(
            FakeSupabase(),
            CATALOG_ID,
            user_id=None,
        )

        self.assertEqual(result.instructor_ratings, {})


class FakeSupabase:
    def __init__(self) -> None:
        self.rows: list[dict[str, str | float | None]] = []

    def table(self, table_name: str) -> "FakeTable":
        self.table_name = table_name
        return FakeTable(self)


class FakeTable:
    def __init__(self, client: FakeSupabase) -> None:
        self.client = client
        self.filters: list[tuple[str, str]] = []
        self.is_delete = False
        self.insert_rows: list[dict[str, str | float | None]] | None = None

    def select(self, _columns: str) -> "FakeTable":
        return self

    def eq(self, column: str, value: str) -> "FakeTable":
        self.filters.append((column, value))
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
        if self.insert_rows is not None:
            self.client.rows.extend(self.insert_rows)
            return SimpleNamespace(data=self.insert_rows)

        if self.is_delete:
            self.client.rows = [
                row for row in self.client.rows if not self._matches(row)
            ]
            return SimpleNamespace(data=[])

        return SimpleNamespace(
            data=[row for row in self.client.rows if self._matches(row)]
        )

    def _matches(self, row: dict[str, str | float | None]) -> bool:
        return all(row.get(column) == value for column, value in self.filters)


if __name__ == "__main__":
    unittest.main()
