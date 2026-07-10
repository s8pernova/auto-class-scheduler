from __future__ import annotations

import unittest

from backend.cache.cursors import (
    InvalidGenerationCursorError,
    decode_generation_cursor,
    encode_generation_cursor,
)


class GenerationCursorTests(unittest.TestCase):
    def test_cursor_round_trip(self) -> None:
        fingerprint = "a" * 64
        cursor = encode_generation_cursor(
            offset=50,
            query_fingerprint=fingerprint,
        )

        self.assertNotIn("50", cursor)
        self.assertEqual(
            decode_generation_cursor(
                cursor,
                expected_query_fingerprint=fingerprint,
            ),
            50,
        )

    def test_cursor_rejects_different_view_controls(self) -> None:
        cursor = encode_generation_cursor(
            offset=50,
            query_fingerprint="a" * 64,
        )

        with self.assertRaisesRegex(
            InvalidGenerationCursorError,
            "does not match",
        ):
            decode_generation_cursor(
                cursor,
                expected_query_fingerprint="b" * 64,
            )

    def test_cursor_rejects_malformed_input(self) -> None:
        with self.assertRaisesRegex(InvalidGenerationCursorError, "Invalid"):
            decode_generation_cursor(
                "not-a-valid-cursor",
                expected_query_fingerprint="a" * 64,
            )


if __name__ == "__main__":
    unittest.main()
