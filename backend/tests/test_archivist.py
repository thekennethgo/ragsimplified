import os

import psycopg
import pytest

from app.pipeline.archivist import document_exists, hash_pages, save_document
from app.pipeline.chopper import chop
from app.pipeline.collector import Page
from app.pipeline.translator import FakeEmbedder

DATABASE_URL = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")


@pytest.fixture
def conn():
    with psycopg.connect(DATABASE_URL, autocommit=True) as connection:
        yield connection


def prepare(text: str):
    pages = [Page(1, text)]
    chunks = chop(pages)
    return hash_pages(pages), chunks, FakeEmbedder().embed([c.text for c in chunks])


def test_saving_the_same_file_twice_stores_it_once(conn):
    content_hash, chunks, vectors = prepare("# Archivist test\n\nSaved exactly once, please.")
    try:
        first = save_document(
            conn,
            title="T",
            filename="t.md",
            content_hash=content_hash,
            chunks=chunks,
            vectors=vectors,
        )
        assert first is not None
        assert document_exists(conn, content_hash)
        second = save_document(
            conn,
            title="T",
            filename="t.md",
            content_hash=content_hash,
            chunks=chunks,
            vectors=vectors,
        )
        assert second is None
        docs = conn.execute(
            "SELECT count(*) FROM documents WHERE content_hash = %s", (content_hash,)
        ).fetchone()[0]
        stored = conn.execute(
            "SELECT count(*) FROM chunks WHERE document_id = %s", (first,)
        ).fetchone()[0]
        assert docs == 1
        assert stored == len(chunks)
    finally:
        conn.execute("DELETE FROM documents WHERE content_hash = %s", (content_hash,))


def test_failed_save_leaves_nothing_behind(conn):
    content_hash, chunks, vectors = prepare("Rollback test text.")
    bad_vectors = [[0.0] * 3 for _ in vectors]  # wrong dimension
    with pytest.raises(psycopg.Error):
        save_document(
            conn,
            title="T",
            filename="t.md",
            content_hash=content_hash,
            chunks=chunks,
            vectors=bad_vectors,
        )
    assert not document_exists(conn, content_hash)


def test_mismatched_lengths_are_rejected(conn):
    content_hash, chunks, vectors = prepare("Length mismatch.")
    with pytest.raises(ValueError):
        save_document(
            conn,
            title="T",
            filename="t.md",
            content_hash=content_hash,
            chunks=chunks,
            vectors=[],
        )
