from collections import Counter

import pytest

from app.eval_runner import (
    CORPUS_DIR,
    FIXTURES_DIR,
    eval_database_urls,
    format_table,
    is_refusal,
    load_questions,
    score,
)


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


def test_question_file_matches_the_plan():
    questions = load_questions()
    counts = Counter(q["type"] for q in questions)
    assert len(questions) == 30
    assert counts["answerable"] >= 8
    assert counts["unanswerable"] >= 5
    assert counts["injection"] >= 2
    assert len({q["id"] for q in questions}) == len(questions)


def test_expected_keywords_really_are_in_the_expected_files():
    for q in load_questions():
        if "expected_file" not in q:
            continue
        path = next(
            p
            for p in (CORPUS_DIR / q["expected_file"], FIXTURES_DIR / q["expected_file"])
            if p.exists()
        )
        assert q["expected_keyword"].lower() in path.read_text().lower(), q["id"]


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
