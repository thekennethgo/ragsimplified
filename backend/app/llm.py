"""The only code that calls an LLM (ADR 003).

`LLM_PROVIDER` picks the implementation:
- `openai_compatible`: an OpenAI-style /chat/completions API (Gemini, Groq, OpenRouter, Ollama),
  using LLM_BASE_URL, LLM_API_KEY and LLM_MODEL.
- `anthropic`: the Anthropic Messages API, using ANTHROPIC_API_KEY and LLM_MODEL.
"""

import json
import os
import time
from collections.abc import Iterator
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
    def stream(self, system: str, messages: list[Message]) -> Iterator[str]:
        """Yield the reply as it is generated, piece by piece."""
        ...


def _open_stream(client: httpx.Client, url: str, headers: dict, body: dict) -> Iterator[str]:
    """POST and yield the response's lines, retrying 429 and 5xx before any text arrives."""
    for attempt in range(MAX_RETRIES + 1):
        with client.stream("POST", url, headers=headers, json=body) as response:
            if response.status_code == 429 or response.status_code >= 500:
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
        self, base_url: str, api_key: str, model: str, client: httpx.Client | None = None
    ) -> None:
        self.url = base_url.rstrip("/") + "/chat/completions"
        self.api_key = api_key
        self.model = model
        self.client = client or httpx.Client(timeout=httpx.Timeout(60, read=120))

    def stream(self, system: str, messages: list[Message]) -> Iterator[str]:
        body = {
            "model": self.model,
            "stream": True,
            "messages": [{"role": "system", "content": system}, *messages],
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        for event in _data_lines(_open_stream(self.client, self.url, headers, body)):
            for choice in event.get("choices", []):
                text = (choice.get("delta") or {}).get("content")
                if text:
                    yield text


class AnthropicLLM:
    def __init__(self, api_key: str, model: str, client: httpx.Client | None = None) -> None:
        self.api_key = api_key
        self.model = model
        self.client = client or httpx.Client(timeout=httpx.Timeout(60, read=120))

    def stream(self, system: str, messages: list[Message]) -> Iterator[str]:
        body = {
            "model": self.model,
            "max_tokens": ANTHROPIC_MAX_TOKENS,
            "stream": True,
            "system": system,
            "messages": messages,
        }
        headers = {"x-api-key": self.api_key, "anthropic-version": ANTHROPIC_VERSION}
        for event in _data_lines(_open_stream(self.client, ANTHROPIC_URL, headers, body)):
            if event.get("type") == "content_block_delta":
                text = event["delta"].get("text")
                if text:
                    yield text


class FakeLLM:
    """For tests: streams a fixed reply and records the calls it received."""

    def __init__(self, reply: str = "This is a fake answer.") -> None:
        self.reply = reply
        self.calls: list[tuple[str, list[Message]]] = []

    def stream(self, system: str, messages: list[Message]) -> Iterator[str]:
        self.calls.append((system, messages))
        words = self.reply.split(" ")
        for i, word in enumerate(words):
            yield word if i == 0 else " " + word


def get_llm() -> LLM:
    """Build the LLM chosen by the environment."""
    provider = os.environ.get("LLM_PROVIDER", "openai_compatible")
    model = os.environ["LLM_MODEL"]
    if provider == "openai_compatible":
        return OpenAICompatibleLLM(os.environ["LLM_BASE_URL"], os.environ["LLM_API_KEY"], model)
    if provider == "anthropic":
        return AnthropicLLM(os.environ["ANTHROPIC_API_KEY"], model)
    raise ValueError(f"Unknown LLM_PROVIDER: {provider}")
