from datetime import time, datetime, timezone

from models import Directories as dirs


class Utilities:
    @staticmethod
    def read_sql(relative_path: str) -> str:
        """Read SQL file content from sql directory."""
        file_path = dirs.sql / f"{relative_path}.sql"
        return file_path.read_text()

    @staticmethod
    def parse_time_str(s: str) -> time:
        fmt = "%H:%M:%S" if len(s) > 5 else "%H:%M"
        return datetime.strptime(s, fmt).time()

    @staticmethod
    def now() -> datetime:
        """Get current UTC timestamp."""
        return datetime.now(timezone.utc)
