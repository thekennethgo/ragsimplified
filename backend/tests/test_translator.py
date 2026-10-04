import httpx
import pytest

from app.pipeline import translator
from app.pipeline.translator import DIMENSION, FakeEmbedder, VoyageEmbedder


def test_fake_embedder_is_deterministic_and_sized():
    fake = FakeEmbedder()
    a, b = fake.embed(["hello", "hello"])
    c = fake.embed(["goodbye"])[0]
    assert a == b
    assert a != c
    assert len(a) == DIMENSION


def make_embedder(handler):
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return VoyageEmbedder(api_key="pa-fake", client=client)


def ok(request: httpx.Request) -> httpx.Response:
    import json

    inputs = json.loads(request.content)["input"]
    # Return out of order to prove results are re-sorted by index.
    data = [{"index": i, "embedding": [float(i)]} for i in range(len(inputs))]
    return httpx.Response(200, json={"data": list(reversed(data))})


def test_voyage_sends_model_dimension_and_key():
    seen = {}

    def handler(request):
        import json

        seen["body"] = json.loads(request.content)
        seen["auth"] = request.headers["authorization"]
        return ok(request)

    make_embedder(handler).embed(["a"], input_type="query")
    assert seen["body"]["model"] == "voyage-4"
    assert seen["body"]["output_dimension"] == 1024
    assert seen["body"]["input_type"] == "query"
    assert seen["auth"] == "Bearer pa-fake"


def test_voyage_batches_and_keeps_order(monkeypatch):
    monkeypatch.setattr(translator, "BATCH_SIZE", 2)
    calls = []

    def handler(request):
        calls.append(request)
        return ok(request)

    vectors = make_embedder(handler).embed(["a", "b", "c", "d", "e"])
    assert len(calls) == 3
    assert vectors == [[0.0], [1.0], [0.0], [1.0], [0.0]]


def test_voyage_retries_then_succeeds(monkeypatch):
    monkeypatch.setattr(translator.time, "sleep", lambda s: None)
    attempts = []

    def handler(request):
        attempts.append(1)
        if len(attempts) < 3:
            return httpx.Response(429)
        return ok(request)

    assert make_embedder(handler).embed(["a"]) == [[0.0]]
    assert len(attempts) == 3


def test_voyage_gives_up_after_retries(monkeypatch):
    monkeypatch.setattr(translator.time, "sleep", lambda s: None)
    embedder = make_embedder(lambda request: httpx.Response(500))
    with pytest.raises(httpx.HTTPStatusError):
        embedder.embed(["a"])


def test_voyage_does_not_retry_client_errors():
    attempts = []

    def handler(request):
        attempts.append(1)
        return httpx.Response(401)

    with pytest.raises(httpx.HTTPStatusError):
        make_embedder(handler).embed(["a"])
    assert len(attempts) == 1
