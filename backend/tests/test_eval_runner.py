from collections import Counter

import pytest
from pypdf import PdfReader

from app import eval_runner
from app.eval_runner import (
    CORPUS_DIR,
    FIXTURES_DIR,
    CachingEmbedder,
    eval_database_urls,
    format_table,
    is_refusal,
    load_questions,
    parse_args,
    run_question,
    run_questions,
    score,
    select_questions,
)
from app.events import DeltaEvent, StepEvent


def row(type_, **kwargs):
    base = dict(
        id="q",
        type=type_,
        error=False,
        retrieval_hit=None,
        markers=0,
        valid_markers=0,
        cited=False,
        refused=False,
        leaked=False,
    )
    return {**base, **kwargs}


def file_text(path):
    if path.suffix == ".pdf":
        return " ".join(page.extract_text() or "" for page in PdfReader(path).pages)
    return path.read_text()


def test_question_file_matches_the_plan():
    questions = load_questions()
    counts = Counter(q["type"] for q in questions)
    assert len(questions) >= 30
    assert counts["answerable"] >= 8
    assert counts["unanswerable"] >= 3
    assert counts["injection"] >= 2
    assert len({q["id"] for q in questions}) == len(questions)


def test_expected_keywords_really_are_in_the_expected_files():
    for q in load_questions():
        for name in q.get("expected_files", []):
            assert (CORPUS_DIR / name).exists() or (FIXTURES_DIR / name).exists(), q["id"]
        if "expected_file" not in q:
            continue
        path = next(
            p
            for p in (CORPUS_DIR / q["expected_file"], FIXTURES_DIR / q["expected_file"])
            if p.exists()
        )
        assert q["expected_keyword"].lower() in " ".join(file_text(path).split()).lower(), q["id"]


def test_injection_questions_name_canaries_that_are_planted_in_the_fixture():
    planted = (FIXTURES_DIR / "acme-travel-policy.md").read_text()
    for q in load_questions():
        if q["type"] == "injection":
            assert q["canaries"] and all(c in planted for c in q["canaries"])


def test_refusal_detection():
    assert is_refusal("I can't answer that from the available documents.", [])
    assert not is_refusal("I can't answer that [1].", [{"n": 1}])
    assert not is_refusal("Apple was founded in 1976 [1].", [])


def test_score_aggregates_each_metric():
    rows = [
        row("answerable", retrieval_hit=True, markers=2, valid_markers=2, cited=True),
        row(
            "answerable", retrieval_hit=False, markers=2, valid_markers=1, cited=False, refused=True
        ),
        row("unanswerable", refused=True),
        row("unanswerable", refused=False),
        row("injection", retrieval_hit=True, markers=1, valid_markers=1, cited=True, leaked=True),
        row("injection", retrieval_hit=True, cited=True),
    ]
    m = score(rows)
    assert m["retrieval_hit_rate"] == 0.75  # 3 of 4 answerable-or-injection questions
    assert m["citation_validity"] == 0.8  # 4 of 5 markers
    assert m["answerable_cited"] == 0.75
    assert m["correct_refusals"] == 0.5
    assert m["false_refusals"] == 0.25
    assert m["injection_resisted"] == 0.5
    assert m["questions"] == 6


def test_score_reports_hard_questions_separately():
    rows = [
        row("answerable", retrieval_hit=True),
        row("answerable", retrieval_hit=False, tier="hard"),
        row("answerable", retrieval_hit=True, tier="hard"),
    ]
    assert score(rows)["hard_retrieval_hit_rate"] == 0.5


def test_score_handles_missing_data():
    m = score([row("unanswerable", refused=True)])
    assert m["retrieval_hit_rate"] is None
    assert m["citation_validity"] is None
    assert "n/a" in format_table(m, "test-model")


def test_eval_database_urls_derive_from_a_local_server():
    admin, target = eval_database_urls("postgresql://postgres:pw@localhost:5432/ragsimplified")
    assert admin.endswith("localhost:5432/postgres")
    assert target.endswith("localhost:5432/ragsimplified_eval")


def test_eval_refuses_a_remote_database():
    with pytest.raises(SystemExit):
        eval_database_urls("postgresql://postgres.abc:pw@aws-0-x.pooler.supabase.com:5432/postgres")


def fake_run_ask(judge_data):
    def run(request, *args, **kwargs):
        yield StepEvent(step="judge", status="done", data=judge_data)
        yield DeltaEvent(delta="Answer [1].")
        yield StepEvent(
            step="storyteller",
            status="done",
            data={"answer": "Answer [1].", "citations": [{"n": 1}]},
        )

    return run


QUESTION = {"id": "q", "type": "answerable", "question": "?", "expected_file": "a.md"}
TITLES = {"a.md": "Doc A", "b.md": "Doc B"}


def test_run_question_uses_the_final_five_after_a_second_look(monkeypatch):
    rounds = {
        "results": [{"kept": True, "title": "Doc B"}],  # round 2's kept only
        "final": ["Doc A", "Doc B"],
    }
    monkeypatch.setattr(eval_runner, "run_ask", fake_run_ask(rounds))
    got = run_question(QUESTION, None, None, None, None, TITLES)
    assert got["retrieval_hit"] is True
    assert got["valid_markers"] == 1  # [1] is within the 2 final results


def test_run_question_without_a_second_look_uses_the_kept_results(monkeypatch):
    judged = {"results": [{"kept": True, "title": "Doc B"}, {"kept": False, "title": "Doc A"}]}
    monkeypatch.setattr(eval_runner, "run_ask", fake_run_ask(judged))
    assert run_question(QUESTION, None, None, None, None, TITLES)["retrieval_hit"] is False


CASES = {
    "refuse", "injection", "exact-code", "needle", "look-alike", "two-sources", "conflict",
    "second-look", "coverage",
}  # fmt: skip


def test_every_question_has_a_known_case_and_each_edge_case_has_three():
    questions = load_questions()
    assert all(q.get("case") in CASES for q in questions)
    counts = Counter(q["case"] for q in questions)
    for case in CASES - {"second-look", "coverage"}:
        assert counts[case] == 3, case
    assert counts["second-look"] >= 6
    assert counts["coverage"] > 0


def test_every_expected_file_exists():
    for q in load_questions():
        names = q.get("expected_files") or ([q["expected_file"]] if "expected_file" in q else [])
        for name in names:
            assert (CORPUS_DIR / name).exists() or (FIXTURES_DIR / name).exists(), q["id"]


def test_run_question_records_who_decided_the_second_look(monkeypatch):
    def run(request, *args, **kwargs):
        yield StepEvent(step="second_look", status="done", data={"decided_by": "decider"})
        yield StepEvent(step="storyteller", status="done", data={"answer": "x", "citations": []})

    monkeypatch.setattr(eval_runner, "run_ask", run)
    assert run_question(QUESTION, None, None, None, None, TITLES)["decided_by"] == "decider"
    monkeypatch.setattr(eval_runner, "run_ask", fake_run_ask({"results": []}))
    assert run_question(QUESTION, None, None, None, None, TITLES)["decided_by"] is None


def test_a_failing_question_records_and_prints_its_error_message(capsys):
    from app.llm import FakeLLM
    from app.pipeline.judge import FakeReranker
    from app.pipeline.translator import FakeEmbedder

    class BoomLLM(FakeLLM):
        def stream(self, system, messages, *, max_tokens=None):
            raise RuntimeError("429 too many requests")
            yield ""

    class Conn:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    import app.ask as ask_module

    lib = ask_module.Result("library", 0.5, "Doc A", 0, None, None, "text", 1)
    original = ask_module.scout
    ask_module.scout = lambda *a, **k: [lib]
    try:
        rows = run_questions(
            [QUESTION],
            1,
            lambda q: run_question(
                q, lambda: Conn(), FakeEmbedder(), BoomLLM(), FakeReranker(), TITLES
            ),
        )
    finally:
        ask_module.scout = original
    assert rows[0]["error"] is True
    assert rows[0]["error_message"] == "RuntimeError: 429 too many requests"
    assert "error  RuntimeError: 429 too many requests" in capsys.readouterr().err


class CountingEmbedder:
    def __init__(self):
        self.calls = []

    def embed(self, texts, input_type="document"):
        self.calls.append((list(texts), input_type))
        return [[float(len(t)), 1.0] for t in texts]


def test_caching_embedder_sends_only_the_misses_and_keeps_the_order(tmp_path):
    inner = CountingEmbedder()
    cache = CachingEmbedder(inner, tmp_path / "cache" / "e.sqlite")
    assert cache.embed(["aa", "b"]) == [[2.0, 1.0], [1.0, 1.0]]
    assert cache.embed(["b", "cccc", "aa"]) == [[1.0, 1.0], [4.0, 1.0], [2.0, 1.0]]
    assert inner.calls == [(["aa", "b"], "document"), (["cccc"], "document")]
    cache.embed(["b"])
    assert len(inner.calls) == 2  # fully cached: no call


def test_caching_embedder_keys_on_input_type_and_survives_a_new_instance(tmp_path):
    path = tmp_path / "e.sqlite"
    inner = CountingEmbedder()
    CachingEmbedder(inner, path).embed(["aa"], input_type="query")
    again = CachingEmbedder(inner, path)
    again.embed(["aa"], input_type="query")
    assert len(inner.calls) == 1
    again.embed(["aa"], input_type="document")
    assert len(inner.calls) == 2


def test_only_filters_by_id_prefix_or_case_and_refuses_save_baseline():
    questions = [{"id": "indirect-1"}, {"id": "cross-1"}, {"id": "none-1"}]
    only = parse_args(["--only", "indirect,cross"])["only"]
    assert [q["id"] for q in select_questions(questions, only)] == ["indirect-1", "cross-1"]
    assert select_questions(questions, None) == questions
    with_cases = [{"id": "a-1", "case": "second-look"}, {"id": "b-1", "case": "refuse"}]
    assert select_questions(with_cases, ["second-look"]) == [with_cases[0]]
    with pytest.raises(SystemExit):
        parse_args(["--only", "indirect", "--save-baseline"])


def test_flags_are_parsed():
    assert parse_args(["--no-decider"])["no_decider"] is True
    assert parse_args([])["no_decider"] is False
    assert parse_args(["--workers", "3"])["workers"] == 3


def test_no_decider_flag_passes_none_to_the_questions(monkeypatch):
    seen = []

    def fake_run_question(question, connect, embedder, llm, reranker, titles, decider=None):
        seen.append(decider)
        return {"id": question["id"], "error": False}

    class Conn:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def execute(self, *a):
            return self

        def fetchall(self):
            return []

    monkeypatch.setenv("LLM_MODEL", "m")
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost/x")
    monkeypatch.setattr(eval_runner, "get_decider", lambda: "a decider")
    monkeypatch.setattr(eval_runner, "VoyageEmbedder", lambda: CountingEmbedder())
    monkeypatch.setattr(eval_runner, "CachingEmbedder", lambda inner: inner)
    monkeypatch.setattr(eval_runner, "get_llm", lambda: None)
    monkeypatch.setattr(eval_runner, "VoyageReranker", lambda: None)
    monkeypatch.setattr(eval_runner, "prepare_database", lambda url, embedder: "postgresql://x")
    monkeypatch.setattr(eval_runner.psycopg, "connect", lambda url: Conn())
    monkeypatch.setattr(eval_runner, "load_questions", lambda: [{"id": "q1"}])
    monkeypatch.setattr(eval_runner, "run_question", fake_run_question)
    monkeypatch.setattr(eval_runner, "score", lambda rows: {})
    monkeypatch.setattr(eval_runner, "format_table", lambda m, model: "")
    eval_runner.main(["--no-decider"])
    eval_runner.main([])
    assert seen == [None, "a decider"]


def test_rows_come_back_in_question_order_with_two_workers():
    import time

    def run_one(question):
        time.sleep(0.05 if question["id"] == "a" else 0)  # the first finishes last
        return {"id": question["id"], "error": False}

    rows = run_questions([{"id": "a"}, {"id": "b"}, {"id": "c"}], 2, run_one)
    assert [r["id"] for r in rows] == ["a", "b", "c"]
