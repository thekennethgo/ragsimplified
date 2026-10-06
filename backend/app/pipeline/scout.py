import math
from dataclasses import dataclass, replace
from typing import Literal

import psycopg

DEFAULT_K = 5
CANDIDATES = 20  # how many each search list contributes to the fusion
RRF_K = 60  # the standard reciprocal-rank-fusion constant


@dataclass(frozen=True)
class PrivateChunk:
    """A chunk of a visitor's own pasted text, sent by the browser with its vector."""

    title: str
    position: int
    heading: str | None
    text: str
    vector: list[float]


@dataclass(frozen=True)
class Result:
    source: Literal["library", "private"]
    score: float  # fused (RRF) score after `scout`; cosine similarity from the single searches
    title: str
    position: int
    heading: str | None
    page: int | None
    text: str
    document_id: int | None = None  # library results only
    vector_rank: int | None = None  # 1-based rank in the vector list, if it appears there
    vector_score: float | None = None  # cosine similarity
    keyword_rank: int | None = None  # 1-based rank in the keyword list, if it appears there
    keyword_score: float | None = None  # ts_rank_cd
    old_rank: int | None = None  # 1-based rank before the Judge (fused order)
    new_rank: int | None = None  # 1-based rank after the Judge
    rerank_score: float | None = None  # the reranker's relevance score


def _vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(str(v) for v in vector) + "]"


def search_library(
    conn: psycopg.Connection, query: list[float], k: int = DEFAULT_K
) -> list[Result]:
    """Top-k chunks of the shared library by cosine similarity (pgvector)."""
    literal = _vector_literal(query)
    rows = conn.execute(
        "SELECT d.id, d.title, c.position, c.heading, c.page, c.text, "
        "1 - (c.embedding <=> %s::vector) AS score "
        "FROM chunks c JOIN documents d ON d.id = c.document_id "
        "ORDER BY c.embedding <=> %s::vector LIMIT %s",
        (literal, literal, k),
    ).fetchall()
    return [
        Result(
            source="library",
            score=float(score),
            title=title,
            position=position,
            heading=heading,
            page=page,
            text=text,
            document_id=document_id,
        )
        for document_id, title, position, heading, page, text, score in rows
    ]


def search_keywords(conn: psycopg.Connection, question: str, k: int = CANDIDATES) -> list[Result]:
    """Top-k library chunks by full-text match, ranked with ts_rank_cd.

    Postgres stems the question and drops stop words; the AND between its words is swapped for OR
    so a natural-language question still matches. Words never reach the SQL text, so user input
    cannot break the query.
    """
    query = "replace(plainto_tsquery('english', %s)::text, ' & ', ' | ')::tsquery"
    rows = conn.execute(
        "SELECT d.id, d.title, c.position, c.heading, c.page, c.text, "
        f"ts_rank_cd(c.fts, {query}) AS score "
        "FROM chunks c JOIN documents d ON d.id = c.document_id "
        f"WHERE c.fts @@ {query} "
        "ORDER BY score DESC, d.id, c.position LIMIT %s",
        (question, question, k),
    ).fetchall()
    return [
        Result(
            source="library",
            score=float(score),
            title=title,
            position=position,
            heading=heading,
            page=page,
            text=text,
            document_id=document_id,
        )
        for document_id, title, position, heading, page, text, score in rows
    ]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def search_private(
    query: list[float], chunks: list[PrivateChunk], k: int = DEFAULT_K
) -> list[Result]:
    """Top-k of the visitor's own chunks by cosine similarity, computed in memory."""
    results = [
        Result(
            source="private",
            score=_cosine(query, chunk.vector),
            title=chunk.title,
            position=chunk.position,
            heading=chunk.heading,
            page=None,
            text=chunk.text,
        )
        for chunk in chunks
    ]
    return sorted(results, key=lambda r: r.score, reverse=True)[:k]


def merge(*result_lists: list[Result], k: int = DEFAULT_K) -> list[Result]:
    """Merge result lists by score, best first, and keep the top k."""
    combined = [result for results in result_lists for result in results]
    return sorted(combined, key=lambda r: r.score, reverse=True)[:k]


def _key(result: Result) -> tuple:
    return (result.source, result.document_id, result.title, result.position)


def fuse(
    vector_results: list[Result], keyword_results: list[Result], k: int = DEFAULT_K
) -> list[Result]:
    """Reciprocal rank fusion: each chunk scores the sum of 1 / (RRF_K + rank) over the lists.

    Fusing ranks, not scores, is what lets cosine similarity and full-text rank (different
    scales) be combined. Ties go to the better vector rank, then the better keyword rank.
    """
    fused: dict[tuple, Result] = {}
    for rank, result in enumerate(vector_results, start=1):
        fused[_key(result)] = replace(result, vector_rank=rank, vector_score=result.score)
    for rank, result in enumerate(keyword_results, start=1):
        existing = fused.get(_key(result), result)
        fused[_key(result)] = replace(existing, keyword_rank=rank, keyword_score=result.score)

    def rrf(result: Result) -> float:
        return sum(1 / (RRF_K + rank) for rank in (result.vector_rank, result.keyword_rank) if rank)

    ranked = sorted(
        fused.values(),
        key=lambda r: (-rrf(r), r.vector_rank or math.inf, r.keyword_rank or math.inf),
    )
    return [replace(r, score=rrf(r)) for r in ranked[:k]]


def scout(
    conn: psycopg.Connection,
    query: list[float],
    private_chunks: list[PrivateChunk] | None = None,
    k: int = DEFAULT_K,
    question: str | None = None,
) -> list[Result]:
    """Hybrid search: vector (library plus private chunks) and keyword (library), fused by RRF.

    Private chunks only have a vector, so they join the vector list and have no keyword rank.
    Without a question there is no keyword search and the result is the vector ranking alone.
    """
    vector_results = merge(
        search_library(conn, query, CANDIDATES),
        search_private(query, private_chunks or [], CANDIDATES),
        k=CANDIDATES,
    )
    keyword_results = search_keywords(conn, question) if question else []
    return fuse(vector_results, keyword_results, k)
