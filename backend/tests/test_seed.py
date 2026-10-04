import os

import psycopg
import pytest

from app.pipeline.translator import FakeEmbedder
from app.seed import seed

DATABASE_URL = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")


@pytest.fixture
def conn():
    with psycopg.connect(DATABASE_URL, autocommit=True) as connection:
        yield connection


def test_seed_saves_copies_and_is_repeatable(conn, tmp_path):
    corpus = tmp_path / "corpus"
    public = tmp_path / "public"
    corpus.mkdir()
    (corpus / "seed-test-note.md").write_text("# Seed test\n\nUnique seed test content 7731.")
    (corpus / "blank.txt").write_text("   ")
    (corpus / "image.png").write_bytes(b"not text")
    (corpus / "README.md").write_text("ignored")
    try:
        first = seed(conn, FakeEmbedder(), corpus, public)
        assert first == {"blank.txt": "empty", "seed-test-note.md": "saved"}
        assert (public / "seed-test-note.md").read_text().startswith("# Seed test")

        assert seed(conn, FakeEmbedder(), corpus, public)["seed-test-note.md"] == "skipped"
        count = conn.execute(
            "SELECT count(*) FROM documents WHERE filename = 'seed-test-note.md'"
        ).fetchone()[0]
        assert count == 1
        title = conn.execute(
            "SELECT title FROM documents WHERE filename = 'seed-test-note.md'"
        ).fetchone()[0]
        assert title == "Seed test"
    finally:
        conn.execute("DELETE FROM documents WHERE filename = 'seed-test-note.md'")
