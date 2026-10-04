import os

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.pipeline.archivist import hash_pages, save_document
from app.pipeline.chopper import chop
from app.pipeline.collector import Page
from app.pipeline.translator import FakeEmbedder

DATABASE_URL = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")


@pytest.fixture
def saved_document():
    pages = [Page(2, "# Library test\n\nA saved paragraph for the library endpoints.")]
    chunks = chop(pages)
    content_hash = hash_pages(pages)
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        document_id = save_document(
            conn,
            title="Library test doc",
            filename="library-test.md",
            content_hash=content_hash,
            chunks=chunks,
            vectors=FakeEmbedder().embed([c.text for c in chunks]),
        )
        yield document_id
        conn.execute("DELETE FROM documents WHERE id = %s", (document_id,))


def test_library_lists_documents_with_chunk_counts(saved_document):
    response = TestClient(app).get("/library")
    assert response.status_code == 200
    match = [d for d in response.json() if d["id"] == saved_document]
    assert len(match) == 1
    assert match[0]["title"] == "Library test doc"
    assert match[0]["chunk_count"] == 1


def test_library_returns_a_document_with_its_chunks(saved_document):
    response = TestClient(app).get(f"/library/{saved_document}")
    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "library-test.md"
    assert body["chunk_count"] == 1
    assert body["chunks"][0]["page"] == 2
    assert body["chunks"][0]["heading"] == "Library test"
    assert "A saved paragraph" in body["chunks"][0]["text"]
    assert "embedding" not in body["chunks"][0]


def test_unknown_document_is_404():
    assert TestClient(app).get("/library/999999999").status_code == 404
