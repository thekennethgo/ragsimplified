"""The only code that calls an LLM (ADR 003).

`LLM_PROVIDER` picks the implementation:
- `openai_compatible`: an OpenAI-style /chat/completions API (Gemini, Groq, OpenRouter, Ollama),
  using LLM_BASE_URL, LLM_API_KEY and LLM_MODEL.
- `anthropic`: the Anthropic Messages API, using ANTHROPIC_API_KEY and LLM_MODEL.
Set `LLM_FALLBACK_MODEL` to send a request to that OpenRouter model when the primary answers 429.
"""

import json
import os
import time
from collections.abc import Callable, Iterator
from typing import Protocol, TypedDict

import httpx

MAX_RETRIES = 4
MAX_RETRY_WAIT = 30.0
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
ANTHROPIC_MAX_TOKENS = 1024


class Message(TypedDict):
    role: str  # "user" or "assistant"
    content: str


class LLM(Protocol):
    def stream(
        self, system: str, messages: list[Message], *, max_tokens: int | None = None
    ) -> Iterator[str]:
        """Yield the reply as it is generated, piece by piece.

        `max_tokens` caps the reply's length when set; otherwise the provider's default applies.
        """
        ...


def _open_stream(
    client: httpx.Client, url: str, headers: dict, body: dict, retry_429: bool = True
) -> Iterator[str]:
    """POST and yield the response's lines, retrying 5xx (and 429 if asked) before any text."""
    for attempt in range(MAX_RETRIES + 1):
        with client.stream("POST", url, headers=headers, json=body) as response:
            if (response.status_code == 429 and retry_429) or response.status_code >= 500:
                if attempt == MAX_RETRIES:
                    response.read()
                    response.raise_for_status()
                time.sleep(_wait(response, attempt))
                continue
            if response.is_error:
                response.read()
                response.raise_for_status()
            yield from response.iter_lines()
            return


def _wait(response: httpx.Response, attempt: int) -> float:
    try:
        return min(float(response.headers["retry-after"]), MAX_RETRY_WAIT)
    except (KeyError, ValueError):
        return min(2.0**attempt, MAX_RETRY_WAIT)


def _data_lines(lines: Iterator[str]) -> Iterator[dict]:
    """Parse server-sent-event `data:` lines as JSON, stopping at [DONE]."""
    for line in lines:
        if not line.startswith("data:"):
            continue
        payload = line[len("data:") :].strip()
        if payload == "[DONE]":
            return
        if payload:
            yield json.loads(payload)


class OpenAICompatibleLLM:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        client: httpx.Client | None = None,
        retry_429: bool = True,
    ) -> None:
        self.url = base_url.rstrip("/") + "/chat/completions"
        self.api_key = api_key
        self.model = model
        self.client = client or httpx.Client(timeout=httpx.Timeout(60, read=120))
        self.retry_429 = retry_429

    def stream(
        self, system: str, messages: list[Message], *, max_tokens: int | None = None
    ) -> Iterator[str]:
        body = {
            "model": self.model,
            "stream": True,
            "messages": [{"role": "system", "content": system}, *messages],
        }
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        headers = {"Authorization": f"Bearer {self.api_key}"}
        for event in _data_lines(
            _open_stream(self.client, self.url, headers, body, self.retry_429)
        ):
            for choice in event.get("choices", []):
                text = (choice.get("delta") or {}).get("content")
                if text:
                    yield text


class AnthropicLLM:
    def __init__(
        self,
        api_key: str,
        model: str,
        client: httpx.Client | None = None,
        retry_429: bool = True,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.client = client or httpx.Client(timeout=httpx.Timeout(60, read=120))
        self.retry_429 = retry_429

    def stream(
        self, system: str, messages: list[Message], *, max_tokens: int | None = None
    ) -> Iterator[str]:
        body = {
            "model": self.model,
            "max_tokens": max_tokens if max_tokens is not None else ANTHROPIC_MAX_TOKENS,
            "stream": True,
            "system": system,
            "messages": messages,
        }
        headers = {"x-api-key": self.api_key, "anthropic-version": ANTHROPIC_VERSION}
        for event in _data_lines(
            _open_stream(self.client, ANTHROPIC_URL, headers, body, self.retry_429)
        ):
            if event.get("type") == "content_block_delta":
                text = event["delta"].get("text")
                if text:
                    yield text


OPENROUTER_URL = "https://openrouter.ai/api/v1"
FALLBACK_COOLDOWN = 60.0  # seconds the primary is skipped after a 429


class FallbackLLM:
    """The primary LLM, or `fallback` when the primary answers 429 (its quota is used up).

    `model` is the model that served the latest call, so the answer can name it.
    """

    # shortcut: shared by every request in this process, lost on restart;
    # fine for one Render instance.
    skip_until = 0.0

    def __init__(
        self, primary: LLM, fallback: LLM, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self.primary, self.fallback, self.clock = primary, fallback, clock
        self.model = primary.model

    def stream(
        self, system: str, messages: list[Message], *, max_tokens: int | None = None
    ) -> Iterator[str]:
        if self.clock() >= FallbackLLM.skip_until:
            self.model = self.primary.model
            started = False
            try:
                for piece in self.primary.stream(system, messages, max_tokens=max_tokens):
                    started = True
                    yield piece
                return
            except httpx.HTTPStatusError as error:
                if started or error.response.status_code != 429:
                    raise
                FallbackLLM.skip_until = self.clock() + FALLBACK_COOLDOWN
        self.model = self.fallback.model
        yield from self.fallback.stream(system, messages, max_tokens=max_tokens)


class FakeLLM:
    """For tests: streams a fixed reply and records the calls it received."""

    def __init__(self, reply: str = "This is a fake answer.") -> None:
        self.reply = reply
        self.calls: list[tuple[str, list[Message]]] = []

    def stream(
        self, system: str, messages: list[Message], *, max_tokens: int | None = None
    ) -> Iterator[str]:
        self.calls.append((system, messages))
        words = self.reply.split(" ")
        for i, word in enumerate(words):
            yield word if i == 0 else " " + word


def get_llm() -> LLM:
    """Build the LLM chosen by the environment."""
    provider = os.environ.get("LLM_PROVIDER", "openai_compatible")
    model = os.environ["LLM_MODEL"]
    fallback = os.environ.get("LLM_FALLBACK_MODEL")
    if provider == "openai_compatible":
        primary = OpenAICompatibleLLM(
            os.environ["LLM_BASE_URL"], os.environ["LLM_API_KEY"], model, retry_429=not fallback
        )
    elif provider == "anthropic":
        primary = AnthropicLLM(os.environ["ANTHROPIC_API_KEY"], model, retry_429=not fallback)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}")
    if fallback:
        return FallbackLLM(
            primary, OpenAICompatibleLLM(OPENROUTER_URL, os.environ["OPENROUTER_API_KEY"], fallback)
        )
    return primary
