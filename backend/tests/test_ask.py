import json
import os

import psycopg
import pytest
from fastapi.testclient import TestClient

from app import ask as ask_module
from app.ask import MAX_PRIVATE_CHUNKS, NOTHING_FOUND, get_connect
from app.llm import FakeLLM, get_llm
from app.main import app
from app.map import get_projection
from app.pipeline import second_look
from app.pipeline.archivist import hash_pages, save_document
from app.pipeline.chopper import Chunk
from app.pipeline.collector import Page
from app.pipeline.decider import FakeDecider, get_decider
from app.pipeline.judge import FakeReranker, get_reranker
from app.pipeline.scout import Result
from app.pipeline.translator import FakeEmbedder
from app.upload import get_embedder

DATABASE_URL = os.environ.get("DATABASE_URL")
needs_db = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

QUESTION = "ask-test unique question text 4417"
fake = FakeEmbedder()


class RoutingLLM(FakeLLM):
    """Answers the second look's call with `look_reply` and every other call with `reply`.

    `calls` holds only the Storyteller's calls; the second look's are in `look_calls`.
    """

    def __init__(self, reply: str, look_reply: str = "DONE") -> None:
        super().__init__(reply)
        self.look_reply = look_reply
        self.look_calls: list[tuple[str, list]] = []

    def stream(self, system, messages, *, max_tokens=None):
        if system == second_look.PROMPT:
            self.look_calls.append((system, messages))
            yield self.look_reply
            return
        yield from super().stream(system, messages, max_tokens=max_tokens)


@pytest.fixture
def llm():
    return RoutingLLM("The answer is here [1].")


@pytest.fixture
def client(llm):
    app.dependency_overrides[get_decider] = lambda: None
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
        ("second_look", "start"),
        ("second_look", "done"),
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
def test_storyteller_start_event_carries_the_prompt_sent(client, llm, library_chunk):
    got = events(client.post("/ask", json={"question": QUESTION}))
    start = next(e for e in got if e["step"] == "storyteller" and e["status"] == "start")
    prompt = start["data"]["prompt"]
    assert prompt == llm.calls[0][1][0]["content"]
    assert QUESTION in prompt
    assert 'n="1"' in prompt
    assert "Library text for the ask test." in prompt


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
def test_a_private_chunks_page_reaches_the_prompt_and_the_citation(client, llm):
    chunk = private_chunk(QUESTION, page=3)
    llm.reply = "[1] [2] [3] [4] [5]"  # cite every card, so the private one is cited
    got = events(client.post("/ask", json={"question": QUESTION, "private_chunks": [chunk]}))
    judge_done = next(e for e in got if e.get("step") == "judge" and e["status"] == "done")
    mine = [r for r in judge_done["data"]["results"] if r["source"] == "private"]
    assert [r["page"] for r in mine] == [3]
    assert 'page="3"' in llm.calls[0][1][0]["content"]
    final = next(e for e in got if e.get("step") == "storyteller" and e["status"] == "done")
    cited = [c for c in final["data"]["citations"] if c["source"] == "private"]
    assert [c["page"] for c in cited] == [3]


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
    start = next(e for e in got if e["step"] == "storyteller" and e["status"] == "start")
    assert "data" not in start


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
def test_scout_results_carry_document_id_and_position(client, library_chunk):
    chunk = private_chunk(QUESTION)
    got = events(client.post("/ask", json={"question": QUESTION, "private_chunks": [chunk]}))
    scout_done = next(e for e in got if e.get("step") == "scout" and e["status"] == "done")
    results = scout_done["data"]["results"]
    assert all(isinstance(r["position"], int) for r in results)
    assert all(isinstance(r["document_id"], int) for r in results if r["source"] == "library")
    assert all(r["document_id"] is None for r in results if r["source"] == "private")
    assert {r["source"] for r in results} == {"library", "private"}


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


# --- the second look (no database: the Scout is faked) ---------------------------------------


class _Conn:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class RecordingReranker(FakeReranker):
    def __init__(self):
        self.queries = []

    def rerank(self, query, documents):
        self.queries.append(query)
        return super().rerank(query, documents)


def lib(doc_id, title, text, position=0):
    return Result("library", 0.5, title, position, None, None, text, doc_id)


ROUND_1 = [lib(i, f"Doc {i}", f"profile text {i}") for i in range(1, 7)]
ROUND_2 = [
    lib(1, "Doc 1", "profile text 1"),  # already seen in round 1: dropped
    lib(20, "Batam", "Batam city overview of the island"),
    lib(21, "Other", "something else entirely"),
    lib(22, "Third", "more unrelated words"),
]
HOMETOWN = "What is Kenneth's hometown like?"


@pytest.fixture
def looking(client, llm, monkeypatch):
    """A client whose Scout returns ROUND_1 and then ROUND_2; returns (reranker, scout calls)."""
    reranker = RecordingReranker()
    calls = []

    def fake_scout(conn, query, private_chunks=None, k=5, question=None):
        calls.append(question)
        return list(ROUND_1 if len(calls) == 1 else ROUND_2)

    monkeypatch.setattr(ask_module, "scout", fake_scout)
    app.dependency_overrides[get_connect] = lambda: lambda: _Conn()
    app.dependency_overrides[get_reranker] = lambda: reranker
    return reranker, calls


def done_events(got, step):
    return [e for e in got if e.get("step") == step and e["status"] == "done"]


def test_second_look_done_ends_after_one_round(client, llm, looking):
    got = events(client.post("/ask", json={"question": HOMETOWN}))
    assert steps(got) == [
        ("translator", "start"),
        ("translator", "done"),
        ("scout", "start"),
        ("scout", "done"),
        ("judge", "start"),
        ("judge", "done"),
        ("second_look", "start"),
        ("second_look", "done"),
        ("storyteller", "start"),
        ("storyteller", "done"),
    ]
    assert done_events(got, "second_look")[0]["data"] == {
        "query": None,
        "enough": None,
        "decided_by": "llm",
    }
    assert done_events(got, "scout")[0]["data"]["round"] == 1
    assert done_events(got, "judge")[0]["data"]["round"] == 1
    assert done_events(got, "judge")[0]["data"]["second_look"] is True
    assert len(llm.look_calls) == 1 and len(llm.calls) == 1


def test_second_look_follow_up_runs_a_second_round(client, llm, looking):
    reranker, scout_questions = looking
    llm.look_reply = "Batam city overview"
    got = events(client.post("/ask", json={"question": HOMETOWN}))
    assert steps(got)[6:] == [
        ("second_look", "start"),
        ("second_look", "done"),
        ("translator", "start"),
        ("translator", "done"),
        ("scout", "start"),
        ("scout", "done"),
        ("judge", "start"),
        ("judge", "done"),
        ("storyteller", "start"),
        ("storyteller", "done"),
    ]
    assert done_events(got, "second_look")[0]["data"]["query"] == "Batam city overview"
    assert done_events(got, "judge")[0]["data"]["second_look"] is True
    rewrite = done_events(got, "translator")[1]["data"]
    assert (rewrite["round"], rewrite["query"]) == (2, "Batam city overview")
    assert "words" not in rewrite
    assert scout_questions == [HOMETOWN, "Batam city overview"]
    scout_two = done_events(got, "scout")[1]["data"]
    assert scout_two["round"] == 2
    assert scout_two["query"] == "Batam city overview"
    assert scout_two["skipped"] == 1  # "Doc 1" was already found in round 1
    assert [r["title"] for r in scout_two["results"]] == ["Batam", "Other", "Third"]  # no repeat
    # Round 2 is reranked against the follow-up query, not the question.
    assert reranker.queries == [HOMETOWN, "Batam city overview"]
    judge_two = done_events(got, "judge")[1]["data"]
    assert judge_two["round"] == 2
    assert [r["title"] for r in judge_two["results"] if r["kept"]] == ["Batam", "Other"]
    # All 5 of round 1, then round 2's 2 new cards: 7, none removed.
    expected = ["Doc 1", "Doc 2", "Doc 3", "Doc 4", "Doc 5", "Batam", "Other"]
    assert judge_two["final"] == expected
    assert judge_two["query"] == "Batam city overview"
    cards = judge_two["final_cards"]
    assert [(c["n"], c["round"], c["title"]) for c in cards] == [
        (1, 1, "Doc 1"),
        (2, 1, "Doc 2"),
        (3, 1, "Doc 3"),
        (4, 1, "Doc 4"),
        (5, 1, "Doc 5"),
        (6, 2, "Batam"),
        (7, 2, "Other"),
    ]
    assert cards[5]["document_id"] == 20 and cards[5]["position"] == 0
    assert {"source", "page", "heading"} <= set(cards[0])
    assert all("document_id" in r and "position" in r for r in judge_two["results"])
    prompt = next(e for e in got if e["step"] == "storyteller" and e["status"] == "start")
    titles = [t for t in expected if f'title="{t}"' in prompt["data"]["prompt"]]
    assert titles == expected


def test_round_two_translator_carries_the_projected_point(client, llm, looking):
    class FakeProjection:
        def project(self, vectors):
            return [{"x": float(len(vectors)), "y": 2.0} for _ in vectors]

    app.dependency_overrides[get_projection] = lambda: FakeProjection()
    llm.look_reply = "Batam city overview"
    got = events(client.post("/ask", json={"question": HOMETOWN}))
    first, second = done_events(got, "translator")
    assert first["data"]["point"] == {"x": 1.0, "y": 2.0}
    assert second["data"]["point"] == {"x": 1.0, "y": 2.0}
    assert second["data"]["round"] == 2


def test_combine_keeps_every_first_round_card_and_adds_only_new_ones():
    first = ROUND_1[:5]
    second = [first[1], lib(20, "Batam", "Batam text"), lib(21, "Other", "other text"), first[0]]
    combined = ask_module._combine(first, second)
    assert [r.title for r in combined] == [
        "Doc 1",
        "Doc 2",
        "Doc 3",
        "Doc 4",
        "Doc 5",
        "Batam",
        "Other",
    ]
    assert len(combined) == 7
    assert [r.title for r in ask_module._combine(first, [first[2]])] == [r.title for r in first]


def test_second_look_keeps_the_first_round_when_round_two_finds_less(
    client, llm, looking, monkeypatch
):
    llm.look_reply = "Batam city overview"
    calls = []

    def fake_scout(conn, query, private_chunks=None, k=5, question=None):
        calls.append(question)
        return list(ROUND_1 if len(calls) == 1 else [ROUND_2[1]])

    monkeypatch.setattr(ask_module, "scout", fake_scout)
    got = events(client.post("/ask", json={"question": HOMETOWN}))
    final = done_events(got, "judge")[1]["data"]["final"]
    assert final == ["Doc 1", "Doc 2", "Doc 3", "Doc 4", "Doc 5", "Batam"]


def test_second_look_off_emits_no_second_look_events(client, llm, looking, monkeypatch):
    monkeypatch.setenv("SECOND_LOOK", "off")
    got = events(client.post("/ask", json={"question": HOMETOWN}))
    assert "second_look" not in {e.get("step") for e in got}
    assert done_events(got, "judge")[0]["data"]["second_look"] is False
    assert llm.look_calls == []


def test_a_confident_decider_skips_the_llm_call(client, llm, looking):
    decider = FakeDecider(0.9)
    app.dependency_overrides[get_decider] = lambda: decider
    got = events(client.post("/ask", json={"question": HOMETOWN}))
    assert done_events(got, "second_look")[0]["data"] == {
        "query": None,
        "enough": 0.9,
        "decided_by": "decider",
    }
    assert llm.look_calls == []
    assert len(decider.states) == 1


@pytest.mark.parametrize(
    ("decider", "decided_by"),
    [(FakeDecider(0.9), "decider"), (FakeDecider(0.1), "llm"), (None, "llm")],
)
def test_second_look_done_says_who_decided(client, llm, looking, decider, decided_by):
    app.dependency_overrides[get_decider] = lambda: decider
    got = events(client.post("/ask", json={"question": HOMETOWN}))
    assert done_events(got, "second_look")[0]["data"]["decided_by"] == decided_by


def test_nothing_found_emits_no_second_look_events(client, llm):
    class EmptyConn(_Conn):
        def execute(self, *args, **kwargs):
            class Rows:
                def fetchall(self):
                    return []

            return Rows()

    app.dependency_overrides[get_connect] = lambda: lambda: EmptyConn()
    got = events(client.post("/ask", json={"question": "anything"}))
    assert "second_look" not in {e.get("step") for e in got}
    assert llm.look_calls == []
    assert done_events(got, "judge")[0]["data"]["second_look"] is False


def test_explain_words_false_embeds_only_the_question(monkeypatch):
    monkeypatch.setenv("SECOND_LOOK", "off")
    monkeypatch.setattr(ask_module, "scout", lambda *a, **k: list(ROUND_1))

    class CountingEmbedder(FakeEmbedder):
        def __init__(self):
            self.calls = []

        def embed(self, texts, input_type="document"):
            self.calls.append((list(texts), input_type))
            return super().embed(texts, input_type)

    def translator_data(**kwargs):
        embedder = CountingEmbedder()
        events = ask_module.run_ask(
            ask_module.AskRequest(question="What is Kenneth's hometown like?"),
            embedder,
            FakeLLM("Answer [1]."),
            lambda: _Conn(),
            FakeReranker(),
            **kwargs,
        )
        done = next(
            e for e in events if getattr(e, "step", "") == "translator" and e.status == "done"
        )
        return embedder.calls, done.data

    calls, data = translator_data(explain_words=False)
    assert calls == [(["What is Kenneth's hometown like?"], "query")]
    assert data["words"] == []

    calls, data = translator_data()
    assert len(calls[0][0]) > 1 and data["words"]
