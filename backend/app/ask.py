import os
from collections.abc import Callable, Iterator
from dataclasses import asdict

import psycopg
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.events import DeltaEvent, StepEvent
from app.llm import LLM, get_llm
from app.pipeline.citations import extract_citations
from app.pipeline.scout import PrivateChunk, Result, scout
from app.pipeline.storyteller import build_prompt
from app.pipeline.translator import DIMENSION, Embedder
from app.upload import get_embedder

MAX_QUESTION_CHARS = 1_000
MAX_PRIVATE_CHUNKS = 60
MAX_CHUNK_CHARS = 4_000
NOTHING_FOUND = "I can't answer that from the available documents."

router = APIRouter()


class PrivateChunkIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    position: int = Field(ge=0)
    heading: str | None = Field(default=None, max_length=500)
    text: str = Field(min_length=1, max_length=MAX_CHUNK_CHARS)
    vector: list[float] = Field(min_length=DIMENSION, max_length=DIMENSION)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=MAX_QUESTION_CHARS)
    private_chunks: list[PrivateChunkIn] = Field(
        default_factory=list, max_length=MAX_PRIVATE_CHUNKS
    )


Connect = Callable[[], psycopg.Connection]


def get_connect() -> Connect:
    return lambda: psycopg.connect(os.environ["DATABASE_URL"])


def describe(results: list[Result]) -> list[dict]:
    return [
        {
            "n": n,
            "source": r.source,
            "title": r.title,
            "page": r.page,
            "heading": r.heading,
            "score": round(r.score, 4),
        }
        for n, r in enumerate(results, start=1)
    ]


def run_ask(
    request: AskRequest, embedder: Embedder, llm: LLM, connect: Connect
) -> Iterator[StepEvent | DeltaEvent]:
    yield StepEvent(step="translator", status="start")
    [query] = embedder.embed([request.question], input_type="query")
    yield StepEvent(step="translator", status="done")

    yield StepEvent(step="scout", status="start")
    private = [PrivateChunk(**chunk.model_dump()) for chunk in request.private_chunks]
    with connect() as conn:
        results = scout(conn, query, private)
    yield StepEvent(step="scout", status="done", data={"results": describe(results)})

    yield StepEvent(step="storyteller", status="start")
    if not results:
        # Nothing to answer from: refuse without spending an LLM call.
        yield DeltaEvent(delta=NOTHING_FOUND)
        answer = NOTHING_FOUND
    else:
        system, messages = build_prompt(request.question, results)
        pieces: list[str] = []
        for piece in llm.stream(system, messages):
            pieces.append(piece)
            yield DeltaEvent(delta=piece)
        answer = "".join(pieces)
    # The streamed pieces may hold a made-up [n]; this final answer is the cleaned one.
    answer, citations = extract_citations(answer, results)
    yield StepEvent(
        step="storyteller",
        status="done",
        data={"answer": answer, "citations": [asdict(c) for c in citations]},
    )


def stream(request: AskRequest, embedder: Embedder, llm: LLM, connect: Connect) -> Iterator[str]:
    try:
        for event in run_ask(request, embedder, llm, connect):
            yield event.to_line()
    except Exception:
        yield StepEvent(step="error", status="done", data={"message": "Ask failed"}).to_line()


@router.post("/ask")
def ask(
    request: AskRequest,
    embedder: Embedder = Depends(get_embedder),
    llm: LLM = Depends(get_llm),
    connect: Connect = Depends(get_connect),
) -> StreamingResponse:
    return StreamingResponse(
        stream(request, embedder, llm, connect), media_type="application/x-ndjson"
    )
