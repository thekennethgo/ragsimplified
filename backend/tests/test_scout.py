import os

import psycopg
import pytest

from app.pipeline.archivist import hash_pages, save_document
from app.pipeline.chopper import Chunk
from app.pipeline.collector import Page
from app.pipeline.scout import PrivateChunk, Result, merge, scout, search_library, search_private
from app.pipeline.translator import DIMENSION

DATABASE_URL = os.environ.get("DATABASE_URL")


def axis(index: int, weight: float = 1.0, other: int | None = None, rest: float = 0.0):
    """A fixed fake embedding: `weight` on one axis and optionally `rest` on another."""
    vector = [0.0] * DIMENSION
    vector[index] = weight
    if other is not None:
        vector[other] = rest
    return vector


def private(text: str, vector: list[float], position: int = 0) -> PrivateChunk:
    return PrivateChunk(title="My note", position=position, heading=None, text=text, vector=vector)


def test_private_search_ranks_by_cosine_and_limits_k():
    chunks = [
        private("far", axis(2), 0),
        private("exact", axis(0), 1),
        private("close", axis(0, 1.0, 1, 1.0), 2),  # cosine 0.707 with axis 0
    ]
    results = search_private(axis(0), chunks, k=2)
    assert [r.text for r in results] == ["exact", "close"]
    assert results[0].score == pytest.approx(1.0)
    assert results[1].score == pytest.approx(0.7071, abs=1e-3)
    assert all(r.source == "private" and r.page is None for r in results)


def test_private_search_with_no_chunks_is_empty():
    assert search_private(axis(0), []) == []


def test_merge_orders_by_score_across_sources():
    library = [Result("library", 0.9, "Doc", 0, None, 1, "lib-a", 1)]
    mine = [Result("private", 0.95, "Mine", 0, None, None, "mine-a")]
    mine_low = [Result("private", 0.1, "Mine", 1, None, None, "mine-b")]
    merged = merge(library, mine + mine_low, k=2)
    assert [r.text for r in merged] == ["mine-a", "lib-a"]


@pytest.fixture
def library_conn():
    """A transaction holding an otherwise empty library; everything is rolled back."""
    if not DATABASE_URL:
        pytest.skip("DATABASE_URL not set")
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute("DELETE FROM documents")
        for name, vector in [("exact", axis(0)), ("near", axis(0, 1.0, 1, 1.0)), ("far", axis(3))]:
            save_document(
                conn,
                title=f"Doc {name}",
                filename=f"{name}.md",
                content_hash=hash_pages([Page(None, name)]),
                chunks=[Chunk(0, 4, "Heading", f"library {name}")],
                vectors=[vector],
            )
        yield conn
        conn.rollback()


def test_library_search_returns_the_expected_chunks(library_conn):
    results = search_library(library_conn, axis(0), k=2)
    assert [r.text for r in results] == ["library exact", "library near"]
    assert results[0].score == pytest.approx(1.0)
    assert results[0].source == "library"
    assert results[0].title == "Doc exact"
    assert results[0].page == 4
    assert results[0].heading == "Heading"
    assert results[0].document_id is not None


def test_scout_merges_library_and_private(library_conn):
    mine = [private("mine near", axis(0, 1.0, 1, 0.5))]  # cosine 0.894: between exact and near
    results = scout(library_conn, axis(0), mine, k=3)
    assert [r.text for r in results] == ["library exact", "mine near", "library near"]
    assert [r.source for r in results] == ["library", "private", "library"]


def test_scout_with_only_library_or_only_private(library_conn):
    assert [r.source for r in scout(library_conn, axis(0), k=1)] == ["library"]
    library_conn.execute("DELETE FROM documents")
    results = scout(library_conn, axis(0), [private("only mine", axis(0))], k=5)
    assert [r.source for r in results] == ["private"]
