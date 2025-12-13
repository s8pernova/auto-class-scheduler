from pathlib import Path
from sqlalchemy import text


def get_sql_text(sql_dir: Path, relative_path: str) -> str:
    """Read SQL file content from sql directory."""
    file_path = sql_dir / f"{relative_path}.sql"
    query = (file_path).read_text()
    return text(query)
