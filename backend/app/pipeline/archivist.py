import hashlib

import psycopg

from app.pipeline.chopper import Chunk
from app.pipeline.collector import Page


def hash_pages(pages: list[Page]) -> str:
    """Content hash of the parsed text, used to skip documents that are already saved."""
    digest = hashlib.sha256()
    for page in pages:
        digest.update(f"{page.number}\n{page.text}\n".encode())
    return digest.hexdigest()


def document_exists(conn: psycopg.Connection, content_hash: str) -> bool:
    row = conn.execute("SELECT 1 FROM documents WHERE content_hash = %s", (content_hash,))
    return row.fetchone() is not None


def save_document(
    conn: psycopg.Connection,
    *,
    title: str,
    filename: str,
    content_hash: str,
    chunks: list[Chunk],
    vectors: list[list[float]],
) -> int | None:
    """Save a document and its chunks in one transaction.

    Returns the new document ID, or None if a document with the same content hash exists.
    The original file is not stored.
    """
    if len(chunks) != len(vectors):
        raise ValueError("chunks and vectors must have the same length")
    with conn.transaction():
        row = conn.execute(
            "INSERT INTO documents (title, filename, content_hash) VALUES (%s, %s, %s) "
            "ON CONFLICT (content_hash) DO NOTHING RETURNING id",
            (title, filename, content_hash),
        ).fetchone()
        if row is None:
            return None
        document_id = row[0]
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO chunks (document_id, position, page, heading, text, embedding) "
                "VALUES (%s, %s, %s, %s, %s, %s::vector)",
                [
                    (
                        document_id,
                        chunk.position,
                        chunk.page,
                        chunk.heading,
                        chunk.text,
                        "[" + ",".join(str(v) for v in vector) + "]",
                    )
                    for chunk, vector in zip(chunks, vectors)
                ],
            )
    return document_id
