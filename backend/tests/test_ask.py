import json
import os

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.ask import MAX_PRIVATE_CHUNKS, NOTHING_FOUND, get_connect
from app.llm import FakeLLM, get_llm
from app.main import app
from app.pipeline.archivist import hash_pages, save_document
from app.pipeline.chopper import Chunk
from app.pipeline.collector import Page
from app.pipeline.judge import FakeReranker, get_reranker
from app.pipeline.translator import FakeEmbedder
from app.upload import get_embedder

DATABASE_URL = os.environ.get("DATABASE_URL")
needs_db = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

QUESTION = "ask-test unique question text 4417"
fake = FakeEmbedder()


@pytest.fixture
def llm():
    return FakeLLM("The answer is here [1].")


@pytest.fixture
def client(llm):
    app.dependency_overrides[get_embedder] = lambda: fake
    app.dependency_overrides[get_llm] = lambda: llm
    app.dependency_overrides[get_reranker] = lambda: FakeReranker()
    yield TestClient(app)
    app.dependency_overrides.clear()


def events(response):
    return [json.loads(line) for line in response.text.splitlines()]


def steps(got):
    return [(e["step"], e["status"]) for e in got if "status" in e]


def private_chunk(text: str, **kwargs):
    return {
        "title": "My note",
        "position": 0,
        "heading": None,
        "text": text,
        "vector": fake.embed([text])[0],
        **kwargs,
    }


@pytest.fixture
def library_chunk():
    """A committed library chunk whose vector equals the test question's."""
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        document_id = save_document(
            conn,
            title="Ask test doc",
            filename="ask-test.md",
            content_hash=hash_pages([Page(None, QUESTION)]),
            chunks=[Chunk(0, 1, None, "Library text for the ask test.")],
            vectors=[fake.embed([QUESTION])[0]],
        )
        yield document_id
        conn.execute("DELETE FROM documents WHERE id = %s", (document_id,))


@needs_db
def test_streams_steps_then_answer_from_the_library(client, llm, library_chunk):
    got = events(client.post("/ask", json={"question": QUESTION}))
    assert steps(got) == [
        ("translator", "start"),
        ("translator", "done"),
        ("scout", "start"),
        ("scout", "done"),
        ("judge", "start"),
        ("judge", "done"),
        ("storyteller", "start"),
        ("storyteller", "done"),
    ]
    judge_done = next(e for e in got if e.get("step") == "judge" and e["status"] == "done")
    top = judge_done["data"]["results"][0]
    assert (top["n"], top["source"], top["title"]) == (1, "library", "Ask test doc")
    assert (top["old_rank"], top["new_rank"], top["kept"]) == (1, 1, True)
    assert judge_done["data"]["fallback"] is False
    deltas = "".join(e["delta"] for e in got if "delta" in e)
    assert deltas == "The answer is here [1]."
    assert got[-1]["data"]["answer"] == deltas
    system, messages = llm.calls[0]
    assert "Library text for the ask test." in messages[0]["content"]
    assert QUESTION in messages[0]["content"]


@needs_db
def test_private_chunks_are_searched_and_sent_to_the_storyteller(client, llm):
    chunk = private_chunk(QUESTION)  # identical text, so cosine similarity 1.0
    got = events(client.post("/ask", json={"question": QUESTION, "private_chunks": [chunk]}))
    judge_done = next(e for e in got if e.get("step") == "judge" and e["status"] == "done")
    # The Judge orders by relevance, so where the private chunk lands depends on the data.
    mine = [r for r in judge_done["data"]["results"] if r["source"] == "private"]
    assert [r["title"] for r in mine] == ["My note"]
    assert 'from="your pasted text"' in llm.calls[0][1][0]["content"]


@needs_db
def test_both_library_and_private_results_can_appear(client, library_chunk):
    chunk = private_chunk(QUESTION)
    got = events(client.post("/ask", json={"question": QUESTION, "private_chunks": [chunk]}))
    judge_done = next(e for e in got if e.get("step") == "judge" and e["status"] == "done")
    sources = {r["source"] for r in judge_done["data"]["results"] if r["kept"]}
    assert sources == {"library", "private"}


@needs_db
def test_empty_library_and_no_private_chunks_refuses_without_calling_the_llm(client, llm):
    class EmptyConn:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def execute(self, *args, **kwargs):
            class Rows:
                def fetchall(self):
                    return []

            return Rows()

    app.dependency_overrides[get_connect] = lambda: lambda: EmptyConn()
    got = events(client.post("/ask", json={"question": "anything"}))
    assert got[-1]["data"]["answer"] == NOTHING_FOUND
    assert llm.calls == []


def test_llm_failure_ends_with_an_error_event(client):
    class Broken:
        def stream(self, system, messages):
            raise RuntimeError("boom")
            yield

    app.dependency_overrides[get_llm] = lambda: Broken()
    app.dependency_overrides[get_connect] = lambda: lambda: _OneChunkConn()
    got = events(client.post("/ask", json={"question": "q"}))
    assert got[-1] == {"step": "error", "status": "done", "data": {"message": "Ask failed"}}


class _OneChunkConn:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, *args, **kwargs):
        class Rows:
            def fetchall(self):
                return [(1, "Doc", 0, None, None, "some text", 0.9)]

        return Rows()


def test_rejects_bad_requests(client):
    assert client.post("/ask", json={"question": ""}).status_code == 422
    assert client.post("/ask", json={"question": "x" * 1001}).status_code == 422
    too_many = [private_chunk("t") for _ in range(MAX_PRIVATE_CHUNKS + 1)]
    assert (
        client.post("/ask", json={"question": "q", "private_chunks": too_many}).status_code == 422
    )
    bad_vector = private_chunk("t", vector=[0.0] * 3)
    assert (
        client.post("/ask", json={"question": "q", "private_chunks": [bad_vector]}).status_code
        == 422
    )
    huge_text = {**private_chunk("t"), "text": "x" * 4001}
    assert (
        client.post("/ask", json={"question": "q", "private_chunks": [huge_text]}).status_code
        == 422
    )


@needs_db
def test_final_event_has_a_cleaned_answer_and_the_citations(client, llm, library_chunk):
    llm.reply = "Real claim [1]. Invented claim [8]."
    final = events(client.post("/ask", json={"question": QUESTION}))[-1]["data"]
    assert final["answer"] == "Real claim [1]. Invented claim."
    assert [c["n"] for c in final["citations"]] == [1]
    citation = final["citations"][0]
    assert (citation["source"], citation["title"], citation["page"]) == (
        "library",
        "Ask test doc",
        1,
    )
    assert citation["snippet"] == "Library text for the ask test."
    assert citation["document_id"] == library_chunk


@needs_db
def test_scout_event_lists_the_candidates_before_the_judge(client, library_chunk):
    got = events(client.post("/ask", json={"question": QUESTION}))
    scout_done = next(e for e in got if e.get("step") == "scout" and e["status"] == "done")
    assert scout_done["data"]["results"][0]["rank"] == 1
    assert "n" not in scout_done["data"]["results"][0]


@needs_db
def test_a_reranker_failure_still_answers(client, llm, library_chunk):
    class Broken:
        def rerank(self, query, documents):
            raise RuntimeError("down")

    app.dependency_overrides[get_reranker] = lambda: Broken()
    got = events(client.post("/ask", json={"question": QUESTION}))
    judge_done = next(e for e in got if e.get("step") == "judge" and e["status"] == "done")
    assert judge_done["data"]["fallback"] is True
    assert got[-1]["data"]["answer"] == "The answer is here [1]."


@needs_db
def test_translator_event_carries_word_weights_and_scout_event_carries_both_ranks(
    client, library_chunk
):
    got = events(client.post("/ask", json={"question": QUESTION}))
    translator = next(e for e in got if e.get("step") == "translator" and e["status"] == "done")
    words = translator["data"]["words"]
    assert [w["text"] for w in words] == QUESTION.split()
    assert max(w["influence"] for w in words) == 1.0
    scout_done = next(e for e in got if e.get("step") == "scout" and e["status"] == "done")
    mine = next(r for r in scout_done["data"]["results"] if r["title"] == "Ask test doc")
    # The vector matches exactly; the keyword list matches on the question's words.
    assert mine["vector_rank"] is not None and mine["vector_score"] == 1.0
    assert mine["found_by"] in {"vector", "both"}
    assert set(mine) >= {"keyword_rank", "keyword_score", "matched_words", "found_by"}
