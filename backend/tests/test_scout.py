import os

import psycopg
import pytest

from app.pipeline.archivist import hash_pages, save_document
from app.pipeline.chopper import Chunk
from app.pipeline.collector import Page
from app.pipeline.scout import (
    PrivateChunk,
    Result,
    fuse,
    merge,
    scout,
    search_keywords,
    search_library,
    search_private,
)
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


def lib(text: str, score: float = 0.0, doc: int = 1, position: int = 0) -> Result:
    return Result("library", score, f"Doc {doc}", position, None, None, text, doc)


def test_fuse_ranks_a_chunk_found_by_both_lists_first():
    vector = [lib("only-vector", 0.9, 1), lib("both", 0.8, 2)]
    keyword = [lib("both", 5.0, 2), lib("only-keyword", 3.0, 3)]
    fused = fuse(vector, keyword, k=3)
    assert [r.text for r in fused] == ["both", "only-vector", "only-keyword"]
    both = fused[0]
    assert (both.vector_rank, both.keyword_rank) == (2, 1)
    assert both.vector_score == 0.8 and both.keyword_score == 5.0
    assert both.score == pytest.approx(1 / 62 + 1 / 61)
    assert (fused[1].vector_rank, fused[1].keyword_rank) == (1, None)
    assert (fused[2].vector_rank, fused[2].keyword_rank) == (None, 2)


def test_fuse_with_private_chunks_uses_ranks_not_raw_scores():
    # A private cosine of 0.95 must not beat a chunk that both lists agree on.
    mine = Result("private", 0.95, "Mine", 0, None, None, "mine")
    vector = [mine, lib("both", 0.5, 2)]
    keyword = [lib("both", 0.1, 2)]
    assert [r.text for r in fuse(vector, keyword, k=2)] == ["both", "mine"]
    assert fuse(vector, keyword, k=2)[1].keyword_rank is None


def test_fuse_keeps_only_k():
    assert len(fuse([lib(str(i), doc=i) for i in range(10)], [], k=3)) == 3


@pytest.fixture
def keyword_conn(library_conn):
    save_document(
        library_conn,
        title="Doc zebra",
        filename="zebra.md",
        content_hash=hash_pages([Page(None, "zebra")]),
        chunks=[Chunk(0, None, None, "The quokka code is Q-9931 and nothing else.")],
        vectors=[axis(7)],
    )
    return library_conn


def test_keyword_search_finds_exact_codes_and_ignores_stop_words(keyword_conn):
    results = search_keywords(keyword_conn, "What is the quokka code Q-9931?")
    assert [r.title for r in results] == ["Doc zebra"]
    assert results[0].score > 0 and results[0].source == "library"


def test_keyword_search_is_safe_and_empty_when_nothing_matches(keyword_conn):
    assert search_keywords(keyword_conn, "xylophone") == []
    assert search_keywords(keyword_conn, "the of and") == []
    assert search_keywords(keyword_conn, "' | & ! ( ) :* \\") == []


def test_scout_finds_a_chunk_only_by_keyword(keyword_conn):
    # The query vector points at "exact"; only the keyword list knows about the quokka chunk.
    results = scout(keyword_conn, axis(0), k=5, question="quokka Q-9931")
    zebra = next(r for r in results if r.title == "Doc zebra")
    assert zebra.keyword_rank == 1
    assert zebra.vector_rank is not None  # fourth by vector, but still within the 20 candidates
    assert results[0].title == "Doc zebra" or results[0].vector_rank == 1


def test_scout_by_both_beats_by_one(keyword_conn):
    results = scout(keyword_conn, axis(7), k=2, question="quokka")
    assert results[0].title == "Doc zebra"
    assert (results[0].vector_rank, results[0].keyword_rank) == (1, 1)


def test_matched_words_lists_the_question_words_found_in_each_library_result(keyword_conn):
    results = scout(
        keyword_conn, axis(7), k=5, question="What is the quokka code, and a xylophone?"
    )
    zebra = next(r for r in results if r.title == "Doc zebra")
    assert zebra.matched_words == ("code", "quokka")  # stems match; stop words and misses do not
    assert next(r for r in results if r.title == "Doc exact").matched_words == ()


def test_matched_words_is_none_for_private_results_and_without_a_question(keyword_conn):
    mine = [private("quokka code", axis(0))]
    results = scout(keyword_conn, axis(0), mine, k=5, question="quokka")
    assert next(r for r in results if r.source == "private").matched_words is None
    assert all(r.matched_words is None for r in scout(keyword_conn, axis(0), k=5))
