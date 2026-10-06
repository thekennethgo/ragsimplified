import httpx
import pytest

from app.pipeline import translator
from app.pipeline.translator import (
    DIMENSION,
    MAX_WEIGHTED_WORDS,
    FakeEmbedder,
    VoyageEmbedder,
    translate_question,
)


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


class CountingEmbedder(FakeEmbedder):
    def __init__(self):
        self.batches = []

    def embed(self, texts, input_type="document"):
        self.batches.append((list(texts), input_type))
        return super().embed(texts, input_type)


def test_question_words_get_leave_one_out_influence_in_one_batch():
    embedder = CountingEmbedder()
    query, words = translate_question(embedder, "who directed the film")
    assert [w["text"] for w in words] == ["who", "directed", "the", "film"]
    influences = [w["influence"] for w in words]
    assert all(0 <= i <= 1 for i in influences)
    assert max(influences) == 1.0  # scaled so the most influential word is 1
    assert len(embedder.batches) == 1  # the question and every variant, in one call
    texts, input_type = embedder.batches[0]
    assert texts == [
        "who directed the film",
        "directed the film",
        "who the film",
        "who directed film",
        "who directed the",
    ]
    assert input_type == "query"
    assert query == FakeEmbedder().embed(["who directed the film"])[0]


def test_single_word_question_has_full_influence_and_one_embedding():
    embedder = CountingEmbedder()
    _, words = translate_question(embedder, "quokka")
    assert words == [{"text": "quokka", "influence": 1.0}]
    assert embedder.batches[0][0] == ["quokka"]


def test_long_questions_weight_only_the_first_words():
    embedder = CountingEmbedder()
    question = " ".join(f"w{i}" for i in range(MAX_WEIGHTED_WORDS + 5))
    _, words = translate_question(embedder, question)
    assert len(words) == MAX_WEIGHTED_WORDS + 5
    assert all(w["influence"] is not None for w in words[:MAX_WEIGHTED_WORDS])
    assert all(w["influence"] is None for w in words[MAX_WEIGHTED_WORDS:])
    assert len(embedder.batches[0][0]) == MAX_WEIGHTED_WORDS + 1


def test_markup_in_a_question_is_kept_as_plain_text():
    _, words = translate_question(FakeEmbedder(), "<b>hi</b> there")
    assert [w["text"] for w in words] == ["<b>hi</b>", "there"]
