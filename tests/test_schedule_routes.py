from __future__ import annotations

import unittest
from unittest.mock import Mock, patch
from uuid import UUID

from fastapi import HTTPException

from backend.api.v1.routes.schedules import get_schedules

USER_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
CATALOG_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


class ScheduleRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_favorites_only_requires_authentication(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            await get_schedules(
                Mock(),
                None,
                favorites_only=True,
                catalog_id=CATALOG_ID,
            )

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(
            raised.exception.detail,
            "Authentication required to view favorites",
        )

    async def test_favorites_only_requires_catalog_id(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            await get_schedules(Mock(), USER_ID, favorites_only=True)

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(
            raised.exception.detail,
            "catalog_id is required to view favorites",
        )

    async def test_favorites_only_passes_current_user_to_service(self) -> None:
        with patch(
            "backend.api.v1.routes.schedules.schedule_service.list_schedules",
            return_value=[],
        ) as list_schedules:
            result = await get_schedules(
                Mock(),
                USER_ID,
                favorites_only=True,
                catalog_id=CATALOG_ID,
            )

        self.assertEqual(result, [])
        list_schedules.assert_called_once()
        self.assertEqual(list_schedules.call_args.kwargs["user_id"], USER_ID)
        self.assertEqual(list_schedules.call_args.kwargs["catalog_id"], CATALOG_ID)


if __name__ == "__main__":
    unittest.main()
