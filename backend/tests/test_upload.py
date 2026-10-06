import json
import os

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.pipeline.translator import DIMENSION, FakeEmbedder
from app.upload import MAX_TEXT_CHARS, get_embedder


@pytest.fixture
def client():
    app.dependency_overrides[get_embedder] = lambda: FakeEmbedder()
    yield TestClient(app)
    app.dependency_overrides.clear()


def events(response):
    return [json.loads(line) for line in response.text.splitlines()]


def test_streams_steps_then_chunks_and_vectors(client):
    response = client.post("/upload", json={"title": "Mine", "text": "# Hi\n\nSome private text."})
    assert response.status_code == 200
    got = events(response)
    assert [(e["step"], e["status"]) for e in got] == [
        ("chopper", "start"),
        ("chopper", "done"),
        ("translator", "start"),
        ("translator", "done"),
    ]
    final = got[-1]["data"]
    assert final["title"] == "Mine"
    assert len(final["chunks"]) == len(final["vectors"]) == got[1]["data"]["chunks"]
    assert len(final["vectors"][0]) == DIMENSION
    assert "Some private text." in final["chunks"][0]["text"]


def test_rejects_text_over_the_limit(client):
    response = client.post("/upload", json={"title": "T", "text": "x" * (MAX_TEXT_CHARS + 1)})
    assert response.status_code == 422


def test_accepts_text_at_the_limit(client):
    response = client.post("/upload", json={"title": "T", "text": "word " * 4000})
    assert response.status_code == 200
    assert events(response)[-1]["step"] == "translator"


def test_rejects_empty_title_or_text(client):
    assert client.post("/upload", json={"title": "", "text": "x"}).status_code == 422
    assert client.post("/upload", json={"title": "T", "text": ""}).status_code == 422


def test_embedder_failure_ends_with_an_error_event(client):
    class Broken:
        def embed(self, texts, input_type="document"):
            raise RuntimeError("boom")

    app.dependency_overrides[get_embedder] = lambda: Broken()
    got = events(client.post("/upload", json={"title": "T", "text": "hello"}))
    assert got[-1] == {"step": "error", "status": "done", "data": {"message": "Upload failed"}}


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="DATABASE_URL not set")
def test_upload_writes_nothing_to_the_database(client):
    def counts():
        with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
            return conn.execute(
                "SELECT (SELECT count(*) FROM documents), (SELECT count(*) FROM chunks)"
            ).fetchone()

    before = counts()
    client.post("/upload", json={"title": "T", "text": "Nothing should be stored."})
    assert counts() == before


def test_chopper_event_lists_each_chunks_position_heading_length_and_overlap(client):
    text = "# Guide\n\n" + "\n\n".join("Paragraph " + "word " * 150 for _ in range(8))
    got = events(client.post("/upload", json={"title": "Long", "text": text}))
    data = got[1]["data"]
    details = data["chunk_details"]
    assert data["chunks"] == len(details) > 1
    assert [d["position"] for d in details] == list(range(len(details)))
    assert details[0]["heading"] == "Guide" and details[0]["overlap"] == 0
    assert all(d["length"] > 0 for d in details)
    assert all(d["overlap"] > 0 for d in details[1:])
    translator = got[-1]["data"]
    assert [d["length"] for d in details] == [len(c["text"]) for c in translator["chunks"]]
