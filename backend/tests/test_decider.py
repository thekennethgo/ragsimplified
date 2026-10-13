import json

import httpx
import pytest

from app.pipeline import decider as decider_module
from app.pipeline.decider import Decision, MercuryDecider, get_decider


def make(handler):
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return MercuryDecider("or-key", client)


def noul(p):
    return {"type": "noul", "noul": p}


def answer(enough, relevant):
    answers = {"enough": enough, "relevant": relevant}
    return httpx.Response(200, json={"answers": answers, "model": "m", "usage": {}})


def test_sends_the_decisions_request_and_reads_both_probabilities():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return answer(noul(0.83), noul(0.97))

    assert make(handler).decide("Question: q") == Decision(enough=0.83, relevant=0.97)
    assert seen["url"] == "https://openrouter.ai/api/alpha/decisions"
    assert seen["auth"] == "Bearer or-key"
    body = seen["body"]
    assert body["model"] == "inception/mercury-decide:free"
    assert body["state"] == "Question: q"
    assert set(body["questions"]) == {"enough", "relevant"}  # both in one call
    for question in body["questions"].values():
        assert question["type"] == "noul"
        assert set(question["criteria"]) == {"true", "false"}


def test_partly_asks_only_the_part_question():
    seen = {}

    def handler(request):
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"answers": {"part": noul(0.04)}})

    assert make(handler).partly("Question: q") == 0.04
    assert set(seen["body"]["questions"]) == {"part"}


def test_raises_on_a_rate_limit_without_retrying():
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(429, json={"error": {"code": 429, "message": "Rate limit"}})

    with pytest.raises(httpx.HTTPStatusError):
        make(handler).decide("s")
    assert len(calls) == 1


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, json={"nope": 1}),
        httpx.Response(200, json={"answers": {}}),
        httpx.Response(200, text="not json"),
        httpx.Response(200, json={"answers": {"enough": noul(0.5)}}),
        answer({"type": "score", "score": 1.0}, noul(0.5)),
        answer(noul(7), noul(0.5)),
        answer(noul(0.5), noul(-1)),
        answer({"type": "noul"}, noul(0.5)),
    ],
)
def test_raises_on_a_malformed_response(response):
    with pytest.raises(Exception):  # noqa: B017 (any failure makes the caller fall back)
        make(lambda request: response).decide("s")


def test_get_decider_needs_the_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    assert get_decider() is None
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    assert isinstance(get_decider(), MercuryDecider)
    assert decider_module.TIMEOUT_SECONDS == 5
