import math
from dataclasses import dataclass
from typing import Literal

import psycopg

DEFAULT_K = 5


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
    score: float  # cosine similarity, higher is better
    title: str
    position: int
    heading: str | None
    page: int | None
    text: str
    document_id: int | None = None  # library results only


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


def scout(
    conn: psycopg.Connection,
    query: list[float],
    private_chunks: list[PrivateChunk] | None = None,
    k: int = DEFAULT_K,
) -> list[Result]:
    """Search the library and any private chunks, merged by score."""
    return merge(
        search_library(conn, query, k),
        search_private(query, private_chunks or [], k),
        k=k,
    )
