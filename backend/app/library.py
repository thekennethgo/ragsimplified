import os
from collections.abc import Iterator
from datetime import datetime

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()


class DocumentSummary(BaseModel):
    id: int
    title: str
    filename: str
    uploaded_at: datetime
    chunk_count: int


class ChunkOut(BaseModel):
    id: int
    position: int
    page: int | None
    heading: str | None
    text: str


class DocumentDetail(DocumentSummary):
    chunks: list[ChunkOut]


def get_conn() -> Iterator[psycopg.Connection]:
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        yield conn


@router.get("/library")
def list_documents(conn: psycopg.Connection = Depends(get_conn)) -> list[DocumentSummary]:
    rows = conn.execute(
        "SELECT d.id, d.title, d.filename, d.uploaded_at, count(c.id) "
        "FROM documents d LEFT JOIN chunks c ON c.document_id = d.id "
        "GROUP BY d.id ORDER BY d.title, d.id"
    ).fetchall()
    return [
        DocumentSummary(id=r[0], title=r[1], filename=r[2], uploaded_at=r[3], chunk_count=r[4])
        for r in rows
    ]


@router.get("/library/{document_id}")
def get_document(document_id: int, conn: psycopg.Connection = Depends(get_conn)) -> DocumentDetail:
    doc = conn.execute(
        "SELECT id, title, filename, uploaded_at FROM documents WHERE id = %s", (document_id,)
    ).fetchone()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    chunks = conn.execute(
        "SELECT id, position, page, heading, text FROM chunks "
        "WHERE document_id = %s ORDER BY position",
        (document_id,),
    ).fetchall()
    return DocumentDetail(
        id=doc[0],
        title=doc[1],
        filename=doc[2],
        uploaded_at=doc[3],
        chunk_count=len(chunks),
        chunks=[
            ChunkOut(id=c[0], position=c[1], page=c[2], heading=c[3], text=c[4]) for c in chunks
        ],
    )
