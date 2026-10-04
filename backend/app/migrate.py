import os
from pathlib import Path

import psycopg

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def migrate(database_url: str, migrations_dir: Path = MIGRATIONS_DIR) -> list[str]:
    """Apply unapplied .sql files in name order and return the names applied."""
    applied_now: list[str] = []
    with psycopg.connect(database_url) as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            "name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        done = {row[0] for row in conn.execute("SELECT name FROM schema_migrations")}
        for path in sorted(migrations_dir.glob("*.sql")):
            if path.name in done:
                continue
            conn.execute(path.read_text())
            conn.execute("INSERT INTO schema_migrations (name) VALUES (%s)", (path.name,))
            applied_now.append(path.name)
    return applied_now


def main() -> None:
    applied = migrate(os.environ["DATABASE_URL"])
    for name in applied:
        print(f"applied {name}")
    if not applied:
        print("nothing to apply")


if __name__ == "__main__":
    main()
