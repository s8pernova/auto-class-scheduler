from __future__ import annotations

import unittest
from uuid import UUID

from backend.api.v1.services.schedules import list_schedules

USER_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
CATALOG_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


class FakeQuery:
    def __init__(self) -> None:
        self.eq_filters: list[tuple[str, str]] = []

    def select(self, _selection: str) -> "FakeQuery":
        return self

    def eq(self, column: str, value: str) -> "FakeQuery":
        self.eq_filters.append((column, value))
        return self

    def order(self, *_args: object, **_kwargs: object) -> "FakeQuery":
        return self

    def limit(self, _limit: int) -> "FakeQuery":
        return self

    def offset(self, _offset: int) -> "FakeQuery":
        return self

    def execute(self) -> object:
        return type("Response", (), {"data": []})()


class FakeClient:
    def __init__(self) -> None:
        self.query = FakeQuery()

    def table(self, _name: str) -> FakeQuery:
        return self.query


class ScheduleFavoriteServiceTests(unittest.TestCase):
    def test_favorites_only_requires_user_id(self) -> None:
        with self.assertRaisesRegex(
            ValueError,
            "user_id is required when favorites_only is true",
        ):
            list_schedules(FakeClient(), favorites_only=True)

    def test_favorites_only_requires_catalog_id(self) -> None:
        with self.assertRaisesRegex(
            ValueError,
            "catalog_id is required when favorites_only is true",
        ):
            list_schedules(FakeClient(), favorites_only=True, user_id=USER_ID)

    def test_favorites_only_filters_saved_schedule_and_favorite_user(self) -> None:
        client = FakeClient()

        result = list_schedules(
            client,
            favorites_only=True,
            user_id=USER_ID,
            catalog_id=CATALOG_ID,
        )

        self.assertEqual(result, [])
        self.assertIn(("user_id", str(USER_ID)), client.query.eq_filters)
        self.assertIn(("catalog_id", str(CATALOG_ID)), client.query.eq_filters)
        self.assertIn(
            ("user_favorites.user_id", str(USER_ID)),
            client.query.eq_filters,
        )


if __name__ == "__main__":
    unittest.main()
