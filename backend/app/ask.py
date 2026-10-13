import os
from collections.abc import Callable, Iterator
from dataclasses import asdict

import psycopg
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.events import DeltaEvent, StepEvent
from app.llm import LLM, get_llm
from app.map import Projection, get_projection
from app.pipeline import second_look
from app.pipeline.citations import extract_citations
from app.pipeline.decider import Decider, get_decider
from app.pipeline.judge import Reranker, get_reranker, judge
from app.pipeline.scout import CANDIDATES, PrivateChunk, Result, scout
from app.pipeline.storyteller import build_prompt
from app.pipeline.translator import DIMENSION, Embedder, translate_question
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


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, 4)


def _found_by(result: Result) -> str:
    if result.vector_rank and result.keyword_rank:
        return "both"
    return "vector" if result.vector_rank else "keyword"


def describe_candidates(results: list[Result]) -> list[dict]:
    return [
        {
            "rank": rank,
            "source": r.source,
            "document_id": r.document_id,
            "title": r.title,
            "position": r.position,
            "page": r.page,
            "heading": r.heading,
            "score": round(r.score, 4),
            "vector_rank": r.vector_rank,
            "vector_score": _round(r.vector_score),
            "keyword_rank": r.keyword_rank,
            "keyword_score": _round(r.keyword_score),
            "matched_words": None if r.matched_words is None else list(r.matched_words),
            "found_by": _found_by(r),
        }
        for rank, r in enumerate(results, start=1)
    ]


def describe_judgement(candidates: list[Result], kept: list[Result]) -> list[dict]:
    """Every candidate with its old and new rank, in new order; `n` is the citation number."""
    numbers = {id(r): n for n, r in enumerate(kept, start=1)}
    return [
        {
            "n": numbers.get(id(r)),
            "kept": id(r) in numbers,
            "old_rank": r.old_rank,
            "new_rank": r.new_rank,
            "rerank_score": None if r.rerank_score is None else round(r.rerank_score, 4),
            "source": r.source,
            "document_id": r.document_id,
            "title": r.title,
            "position": r.position,
            "page": r.page,
            "heading": r.heading,
        }
        for r in candidates
    ]


def describe_final(first_round: list[Result], results: list[Result]) -> list[dict]:
    """The cards that go to the Storyteller, in citation order, and which round each came from."""
    from_first = {id(r) for r in first_round}
    return [
        {
            "n": n,
            "round": 1 if id(r) in from_first else 2,
            "source": r.source,
            "document_id": r.document_id,
            "title": r.title,
            "position": r.position,
            "page": r.page,
            "heading": r.heading,
        }
        for n, r in enumerate(results, start=1)
    ]


def _key(result: Result) -> tuple:
    return (result.source, result.document_id or result.title, result.position)


def _combine(first_round: list[Result], second_round: list[Result]) -> list[Result]:
    """All of the first round's cards, then the second round's cards that are new."""
    seen = {_key(r) for r in first_round}
    return first_round + [r for r in second_round if _key(r) not in seen]


def run_ask(
    request: AskRequest,
    embedder: Embedder,
    llm: LLM,
    connect: Connect,
    reranker: Reranker,
    projection: Projection | None = None,
    decider: Decider | None = None,
    explain_words: bool = True,
) -> Iterator[StepEvent | DeltaEvent]:
    yield StepEvent(step="translator", status="start")
    if explain_words:
        query, words = translate_question(embedder, request.question)
    else:  # the eval never looks at the word weights, so skip the extra embeddings
        [query] = embedder.embed([request.question], input_type="query")
        words = []
    translated: dict = {"words": words}
    if projection is not None:
        [translated["point"]] = projection.project([query])
    yield StepEvent(step="translator", status="done", data=translated)

    yield StepEvent(step="scout", status="start")
    private = [PrivateChunk(**chunk.model_dump()) for chunk in request.private_chunks]
    with connect() as conn:
        candidates = scout(conn, query, private, k=CANDIDATES, question=request.question)
    yield StepEvent(
        step="scout",
        status="done",
        data={"results": describe_candidates(candidates), "round": 1},
    )

    yield StepEvent(step="judge", status="start")
    judgement = judge(request.question, candidates, reranker)
    results = judgement.kept
    yield StepEvent(
        step="judge",
        status="done",
        data={
            "results": describe_judgement(judgement.candidates, results),
            "fallback": judgement.fallback,
            "round": 1,
            "second_look": bool(results) and second_look.enabled(),
        },
    )

    if results and second_look.enabled():
        yield StepEvent(step="second_look", status="start")
        follow_up, probability = second_look.decide(request.question, results, llm, decider)
        yield StepEvent(
            step="second_look",
            status="done",
            data={
                "query": follow_up,
                "enough": None if probability is None else round(probability, 3),
                "decided_by": (
                    "decider"
                    if probability is not None and probability >= second_look.SECOND_LOOK_THRESHOLD
                    else "llm"
                ),
            },
        )
        if follow_up:
            first_round = results
            seen = {_key(r) for r in candidates}
            yield StepEvent(step="translator", status="start")
            [follow_up_vector] = embedder.embed([follow_up], input_type="query")
            rewritten: dict = {"round": 2, "query": follow_up}
            if projection is not None:
                [rewritten["point"]] = projection.project([follow_up_vector])
            yield StepEvent(step="translator", status="done", data=rewritten)
            yield StepEvent(step="scout", status="start")
            with connect() as conn:
                found = scout(conn, follow_up_vector, private, k=CANDIDATES, question=follow_up)
            new = [r for r in found if _key(r) not in seen]
            yield StepEvent(
                step="scout",
                status="done",
                data={
                    "results": describe_candidates(new),
                    "round": 2,
                    "query": follow_up,
                    "skipped": len(found) - len(new),
                },
            )

            yield StepEvent(step="judge", status="start")
            # Reranked against the follow-up: the linked text rarely repeats the question's words.
            second = judge(follow_up, new, reranker, keep=second_look.SECOND_LOOK_SLOTS)
            results = _combine(first_round, second.kept)
            yield StepEvent(
                step="judge",
                status="done",
                data={
                    "results": describe_judgement(second.candidates, second.kept),
                    "fallback": second.fallback,
                    "round": 2,
                    "query": follow_up,
                    "final": [r.title for r in results],
                    "final_cards": describe_final(first_round, results),
                },
            )

    if not results:
        yield StepEvent(step="storyteller", status="start")
        # Nothing to answer from: refuse without spending an LLM call.
        yield DeltaEvent(delta=NOTHING_FOUND)
        answer = NOTHING_FOUND
    else:
        system, messages = build_prompt(request.question, results)
        # The visitor can read the exact message the model is about to get.
        yield StepEvent(step="storyteller", status="start", data={"prompt": messages[0]["content"]})
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


def stream(
    request: AskRequest,
    embedder: Embedder,
    llm: LLM,
    connect: Connect,
    reranker: Reranker,
    projection: Projection | None,
    decider: Decider | None,
) -> Iterator[str]:
    try:
        for event in run_ask(request, embedder, llm, connect, reranker, projection, decider):
            yield event.to_line()
    except Exception:
        yield StepEvent(step="error", status="done", data={"message": "Ask failed"}).to_line()


@router.post("/ask")
def ask(
    request: AskRequest,
    embedder: Embedder = Depends(get_embedder),
    llm: LLM = Depends(get_llm),
    connect: Connect = Depends(get_connect),
    reranker: Reranker = Depends(get_reranker),
    projection: Projection | None = Depends(get_projection),
    decider: Decider | None = Depends(get_decider),
) -> StreamingResponse:
    return StreamingResponse(
        stream(request, embedder, llm, connect, reranker, projection, decider),
        media_type="application/x-ndjson",
    )
