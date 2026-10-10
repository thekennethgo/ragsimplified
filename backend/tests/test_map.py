import json
import os

import numpy as np
import psycopg
import pytest
from fastapi.testclient import TestClient

from app.ask import get_connect
from app.llm import FakeLLM, get_llm
from app.main import app
from app.map import Projection, _conn, build_map, fit_projection, get_projection, load_projection
from app.pipeline.archivist import hash_pages, save_document
from app.pipeline.chopper import Chunk
from app.pipeline.collector import Page
from app.pipeline.judge import FakeReranker, get_reranker
from app.pipeline.translator import DIMENSION, FakeEmbedder
from app.upload import get_embedder

DATABASE_URL = os.environ.get("DATABASE_URL")
needs_db = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")


def test_fit_recovers_known_directions_and_projects_new_vectors():
    # Spread of 2 along x, 1 along y, none along z: the components must be x then y.
    vectors = np.array([[2.0, 0, 0], [-2.0, 0, 0], [0, 1.0, 0], [0, -1.0, 0]]) + [5, 5, 5]
    projection = fit_projection(vectors)
    assert projection.mean.tolist() == [5, 5, 5]
    assert np.allclose(projection.components, [[1, 0, 0], [0, 1, 0]])
    points = projection.project([[7, 5, 5], [5, 4, 5], [5, 5, 9]])
    assert points == [{"x": 2.0, "y": 0.0}, {"x": 0.0, "y": -1.0}, {"x": 0.0, "y": 0.0}]


def test_fit_is_repeatable_and_survives_a_single_vector():
    rng = np.random.default_rng(1)
    vectors = rng.normal(size=(10, 6))
    a, b = fit_projection(vectors), fit_projection(vectors)
    assert np.array_equal(a.components, b.components)
    only = fit_projection(np.array([[1.0, 2.0, 3.0]]))
    assert only.project([[1.0, 2.0, 3.0]]) == [{"x": 0.0, "y": 0.0}]


def test_projecting_nothing_gives_nothing():
    assert fit_projection(np.eye(3)).project([]) == []


def clustered_vector(center: np.ndarray, rng: np.random.Generator) -> list[float]:
    vector = center + 0.1 * rng.normal(size=DIMENSION) / np.sqrt(DIMENSION)
    return (vector / np.linalg.norm(vector)).tolist()


@pytest.fixture
def conn():
    """A transaction holding an otherwise empty library; everything is rolled back."""
    if not DATABASE_URL:
        pytest.skip("DATABASE_URL not set")
    with psycopg.connect(DATABASE_URL) as connection:
        connection.execute("DELETE FROM documents")
        yield connection
        connection.rollback()


@pytest.fixture
def seeded(conn):
    """Three documents of four chunks each, whose vectors cluster by document."""
    rng = np.random.default_rng(0)
    centers = [rng.normal(size=DIMENSION) for _ in range(3)]
    centers = [c / np.linalg.norm(c) for c in centers]
    for index, center in enumerate(centers):
        save_document(
            conn,
            title=f"Doc {index}",
            filename=f"doc{index}.md",
            content_hash=hash_pages([Page(None, f"map doc {index}")]),
            chunks=[Chunk(i, None, None, f"doc {index} chunk {i}") for i in range(4)],
            vectors=[clustered_vector(center, rng) for _ in range(4)],
        )
    return conn


def test_chunks_of_the_same_document_land_closer_together(seeded):
    assert build_map(seeded) == 12
    rows = seeded.execute(
        "SELECT c.document_id, p.x, p.y FROM map_points p JOIN chunks c ON c.id = p.chunk_id"
    ).fetchall()
    by_doc: dict[int, list[np.ndarray]] = {}
    for document_id, x, y in rows:
        by_doc.setdefault(document_id, []).append(np.array([x, y]))
    within, between = [], []
    docs = list(by_doc)
    for a in docs:
        pts = by_doc[a]
        within += [np.linalg.norm(p - q) for i, p in enumerate(pts) for q in pts[i + 1 :]]
        for b in docs:
            if a < b:
                between += [np.linalg.norm(p - q) for p in pts for q in by_doc[b]]
    assert np.mean(within) < np.mean(between) / 3


def test_build_map_replaces_the_old_map_and_stores_every_point(seeded):
    build_map(seeded)
    build_map(seeded)
    assert seeded.execute("SELECT count(*) FROM map_points").fetchone()[0] == 12
    assert seeded.execute("SELECT count(*) FROM map_projection").fetchone()[0] == 1
    projection = load_projection(seeded)
    assert projection.components.shape == (2, DIMENSION)
    # Projecting a stored chunk's own vector reproduces its stored point.
    chunk_id, vector, x, y = seeded.execute(
        "SELECT c.id, c.embedding::real[], p.x, p.y "
        "FROM chunks c JOIN map_points p ON p.chunk_id = c.id LIMIT 1"
    ).fetchone()
    point = projection.project([vector])[0]
    assert (point["x"], point["y"]) == (pytest.approx(x, abs=1e-4), pytest.approx(y, abs=1e-4))


def test_an_empty_library_leaves_no_map(conn):
    assert build_map(conn) == 0
    assert load_projection(conn) is None
    assert conn.execute("SELECT count(*) FROM map_points").fetchone()[0] == 0


def test_get_map_returns_each_chunks_document_and_point(seeded):
    build_map(seeded)
    app.dependency_overrides[_conn] = lambda: seeded
    try:
        response = TestClient(app).get("/map")
    finally:
        app.dependency_overrides.clear()
    points = response.json()
    assert response.status_code == 200 and len(points) == 12
    assert set(points[0]) == {"chunk_id", "document_id", "title", "position", "heading", "x", "y"}
    assert {p["title"] for p in points} == {"Doc 0", "Doc 1", "Doc 2"}


# A projection onto the first two axes, so a vector's point is easy to predict.
AXES = Projection(np.zeros(DIMENSION), np.eye(DIMENSION)[:2])


class NoRows:
    """A database with nothing in it: every query returns no rows."""

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, *args, **kwargs):
        class Rows:
            def fetchall(self):
                return []

        return Rows()


def events(response):
    return [json.loads(line) for line in response.text.splitlines()]


@pytest.fixture
def client():
    app.dependency_overrides[get_embedder] = lambda: FakeEmbedder()
    app.dependency_overrides[get_llm] = lambda: FakeLLM("ok")
    app.dependency_overrides[get_reranker] = lambda: FakeReranker()
    app.dependency_overrides[get_connect] = lambda: lambda: NoRows()
    app.dependency_overrides[get_projection] = lambda: AXES
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_ask_adds_the_questions_point_to_the_translator_event(client):
    got = events(client.post("/ask", json={"question": "where am I on the map"}))
    translator = next(e for e in got if e["step"] == "translator" and e["status"] == "done")
    vector = FakeEmbedder().embed(["where am I on the map"])[0]
    assert translator["data"]["point"] == {"x": round(vector[0], 5), "y": round(vector[1], 5)}


def test_ask_has_no_point_without_a_map(client):
    app.dependency_overrides[get_projection] = lambda: None
    got = events(client.post("/ask", json={"question": "no map yet"}))
    translator = next(e for e in got if e["step"] == "translator" and e["status"] == "done")
    assert "point" not in translator["data"]


def test_upload_adds_a_point_for_each_new_chunk(client):
    got = events(client.post("/upload", json={"title": "Mine", "text": "# Hi\n\nSome text."}))
    data = got[-1]["data"]
    assert len(data["points"]) == len(data["chunks"]) == 1
    vector = data["vectors"][0]
    assert data["points"][0] == {"x": round(vector[0], 5), "y": round(vector[1], 5)}


def test_upload_has_no_points_without_a_map(client):
    app.dependency_overrides[get_projection] = lambda: None
    got = events(client.post("/upload", json={"title": "Mine", "text": "Some text."}))
    assert "points" not in got[-1]["data"]


def test_get_projection_reads_the_stored_map(seeded, monkeypatch):
    build_map(seeded)

    class Borrowed:  # hands out the test's transaction without closing it
        def __enter__(self):
            return seeded

        def __exit__(self, *args):
            return False

    monkeypatch.setattr("app.map.psycopg.connect", lambda url: Borrowed())
    assert get_projection().components.shape == (2, DIMENSION)


def test_get_projection_is_none_without_a_database(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert get_projection() is None
