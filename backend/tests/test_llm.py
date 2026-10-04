import json

import httpx
import pytest

from app import llm
from app.llm import AnthropicLLM, FakeLLM, OpenAICompatibleLLM, get_llm

MESSAGES = [{"role": "user", "content": "Hi"}]


def sse(*events: dict | str) -> bytes:
    lines = [e if isinstance(e, str) else json.dumps(e) for e in events]
    return "".join(f"data: {line}\n\n" for line in lines).encode()


def openai_body() -> bytes:
    chunks = [{"choices": [{"delta": {"content": text}}]} for text in ["Hel", "lo", "!"]]
    return sse({"choices": [{"delta": {"role": "assistant"}}]}, *chunks, "[DONE]")


def make(handler, cls=OpenAICompatibleLLM):
    client = httpx.Client(transport=httpx.MockTransport(handler))
    if cls is OpenAICompatibleLLM:
        return OpenAICompatibleLLM("https://example.test/v1/", "key", "model-x", client)
    return AnthropicLLM("anth-key", "claude-x", client)


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    waits = []
    monkeypatch.setattr(llm.time, "sleep", waits.append)
    return waits


def test_openai_compatible_streams_text_and_sends_the_request():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, content=openai_body())

    assert "".join(make(handler).stream("Be brief.", MESSAGES)) == "Hello!"
    assert seen["url"] == "https://example.test/v1/chat/completions"
    assert seen["auth"] == "Bearer key"
    assert seen["body"]["model"] == "model-x"
    assert seen["body"]["stream"] is True
    assert seen["body"]["messages"] == [{"role": "system", "content": "Be brief."}, *MESSAGES]


def test_anthropic_streams_text_and_sends_the_request():
    seen = {}

    def handler(request):
        seen["headers"] = request.headers
        seen["body"] = json.loads(request.content)
        body = sse(
            {"type": "message_start", "message": {}},
            {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hi"}},
            {"type": "content_block_delta", "delta": {"type": "text_delta", "text": " there"}},
            {"type": "message_stop"},
        )
        return httpx.Response(200, content=body)

    assert "".join(make(handler, AnthropicLLM).stream("Be brief.", MESSAGES)) == "Hi there"
    assert seen["headers"]["x-api-key"] == "anth-key"
    assert seen["headers"]["anthropic-version"] == "2023-06-01"
    assert seen["body"]["system"] == "Be brief."
    assert seen["body"]["messages"] == MESSAGES
    assert seen["body"]["max_tokens"] > 0


def test_retries_503_then_succeeds(no_sleep):
    attempts = []

    def handler(request):
        attempts.append(1)
        if len(attempts) < 3:
            return httpx.Response(503, json={"error": {"status": "UNAVAILABLE"}})
        return httpx.Response(200, content=openai_body())

    assert "".join(make(handler).stream("s", MESSAGES)) == "Hello!"
    assert len(attempts) == 3
    assert no_sleep == [1.0, 2.0]


def test_429_waits_for_retry_after(no_sleep):
    attempts = []

    def handler(request):
        attempts.append(1)
        if len(attempts) == 1:
            return httpx.Response(429, headers={"retry-after": "7"})
        return httpx.Response(200, content=openai_body())

    list(make(handler).stream("s", MESSAGES))
    assert no_sleep == [7.0]


def test_gives_up_after_the_retries():
    attempts = []

    def handler(request):
        attempts.append(1)
        return httpx.Response(503)

    with pytest.raises(httpx.HTTPStatusError):
        list(make(handler).stream("s", MESSAGES))
    assert len(attempts) == llm.MAX_RETRIES + 1


def test_does_not_retry_other_client_errors():
    attempts = []

    def handler(request):
        attempts.append(1)
        return httpx.Response(401, json={"error": "bad key"})

    with pytest.raises(httpx.HTTPStatusError):
        list(make(handler).stream("s", MESSAGES))
    assert len(attempts) == 1


def test_fake_llm_streams_its_reply_and_records_calls():
    fake = FakeLLM("one two three")
    assert list(fake.stream("sys", MESSAGES)) == ["one", " two", " three"]
    assert fake.calls == [("sys", MESSAGES)]


def test_get_llm_picks_the_provider_from_the_environment(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "m")
    monkeypatch.setenv("LLM_PROVIDER", "openai_compatible")
    monkeypatch.setenv("LLM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("LLM_API_KEY", "k")
    assert isinstance(get_llm(), OpenAICompatibleLLM)
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a")
    assert isinstance(get_llm(), AnthropicLLM)
    monkeypatch.setenv("LLM_PROVIDER", "nope")
    with pytest.raises(ValueError):
        get_llm()
