import json

import httpx
import pytest

from app.pipeline import judge as judge_module
from app.pipeline.judge import FakeReranker, VoyageReranker, judge
from app.pipeline.scout import Result


def candidate(text: str, rank: int, source: str = "library") -> Result:
    return Result(source, 0.03 - rank / 1000, f"Doc {rank}", 0, None, None, text, rank)


QUESTION = "quokka code"
CANDIDATES = [
    candidate("nothing relevant here", 1),
    candidate("the quokka", 2),
    candidate("the quokka code is Q-9931", 3),
    candidate("unrelated words", 4, "private"),
]


def test_judge_reorders_and_keeps_the_best():
    outcome = judge(QUESTION, CANDIDATES, FakeReranker(), keep=2)
    assert [r.text for r in outcome.kept] == ["the quokka code is Q-9931", "the quokka"]
    assert not outcome.fallback
    by_text = {r.text: r for r in outcome.candidates}
    top = by_text["the quokka code is Q-9931"]
    assert (top.old_rank, top.new_rank) == (3, 1)
    assert top.rerank_score == pytest.approx(1.0)
    assert (
        by_text["nothing relevant here"].old_rank,
        by_text["nothing relevant here"].new_rank,
    ) == (1, 3)
    # Every candidate gets a new rank, so rejected cards can be shown sliding down.
    assert sorted(r.new_rank for r in outcome.candidates) == [1, 2, 3, 4]


def test_private_chunks_are_reranked_in_the_same_pool():
    pool = [candidate("unrelated", 1), candidate("my own note about the quokka code", 2, "private")]
    outcome = judge(QUESTION, pool, FakeReranker(), keep=1)
    assert [(r.source, r.old_rank, r.new_rank) for r in outcome.kept] == [("private", 2, 1)]


def test_reranker_failure_falls_back_to_the_fused_order():
    class Broken:
        def rerank(self, query, documents):
            raise RuntimeError("down")

    outcome = judge(QUESTION, CANDIDATES, Broken(), keep=2)
    assert outcome.fallback
    assert [r.old_rank for r in outcome.kept] == [1, 2]
    assert all(r.new_rank == r.old_rank and r.rerank_score is None for r in outcome.candidates)


def test_no_candidates_skips_the_reranker():
    class Boom:
        def rerank(self, query, documents):
            raise AssertionError("should not be called")

    outcome = judge(QUESTION, [], Boom())
    assert (outcome.candidates, outcome.kept, outcome.fallback) == ([], [], False)


def make_reranker(handler):
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return VoyageReranker(api_key="pa-fake", client=client)


def test_voyage_reranker_sends_the_request_and_sorts_by_score():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(json.loads(request.content), auth=request.headers["Authorization"])
        data = [{"index": 0, "relevance_score": 0.2}, {"index": 1, "relevance_score": 0.9}]
        return httpx.Response(200, json={"data": data})

    assert make_reranker(handler).rerank("q", ["a", "b"]) == [(1, 0.9), (0, 0.2)]
    assert seen["model"] == "rerank-3-lite"
    assert seen["top_k"] == 2 and seen["query"] == "q" and seen["documents"] == ["a", "b"]
    assert seen["auth"] == "Bearer pa-fake"


def test_voyage_reranker_retries_rate_limits(monkeypatch):
    monkeypatch.setattr(judge_module.time, "sleep", lambda seconds: None)
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        if len(calls) < 3:
            return httpx.Response(429)
        return httpx.Response(200, json={"data": [{"index": 0, "relevance_score": 0.5}]})

    assert make_reranker(handler).rerank("q", ["a"]) == [(0, 0.5)]
    assert len(calls) == 3


def test_voyage_reranker_raises_after_too_many_failures(monkeypatch):
    monkeypatch.setattr(judge_module.time, "sleep", lambda seconds: None)
    with pytest.raises(httpx.HTTPStatusError):
        make_reranker(lambda request: httpx.Response(503)).rerank("q", ["a"])


def chunk(title: str, position: int, text: str, document_id=None, source="library") -> Result:
    return Result(source, 0.01, title, position, None, None, text, document_id)


def test_cap_keeps_two_per_document_and_fills_from_the_next_documents():
    pool = [
        chunk("A", 0, "quokka quokka code one", 1),
        chunk("A", 1, "quokka code two", 1),
        chunk("A", 2, "quokka third", 1),
        chunk("B", 0, "quokka b", 2),
        chunk("C", 0, "quokka c", 3),
    ]
    # Ranks A0 > A1 > A2 > B > C by number of matching query words.
    ranker = FakeReranker()
    outcome = judge("quokka code one", pool, ranker, keep=4)
    assert [(r.title, r.position) for r in outcome.kept] == [("A", 0), ("A", 1), ("B", 0), ("C", 0)]
    ids = {id(r) for r in outcome.candidates}
    assert all(id(r) in ids for r in outcome.kept)


def test_cap_applies_in_the_reranker_fallback():
    class Broken:
        def rerank(self, query, documents):
            raise RuntimeError("down")

    pool = [chunk("A", i, f"t{i}", 1) for i in range(3)] + [chunk("B", 0, "b", 2)]
    outcome = judge("q", pool, Broken(), keep=3)
    assert outcome.fallback
    assert [(r.title, r.position) for r in outcome.kept] == [("A", 0), ("A", 1), ("B", 0)]


def test_private_results_are_capped_by_title():
    pool = [
        chunk("Note", 0, "quokka quokka", None, "private"),
        chunk("Note", 1, "quokka code", None, "private"),
        chunk("Note", 2, "quokka", None, "private"),
        chunk("Other", 0, "unrelated", None, "private"),
    ]
    outcome = judge("quokka code", pool, FakeReranker(), keep=3)
    assert [(r.title, r.position) for r in outcome.kept] == [("Note", 1), ("Note", 0), ("Other", 0)]
