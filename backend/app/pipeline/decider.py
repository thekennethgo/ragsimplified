"""Stage 1 of the second look: a free yes/no decision model (ADR 006).

Inception's Mercury Decide, through OpenRouter's Decisions API (alpha), returns the probability
that the sources answer the question. It cannot write text, so it never writes the follow-up query.
"""

import os
from typing import Protocol

import httpx

DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"
MODEL = "inception/mercury-decide:free"
TIMEOUT_SECONDS = 5

QUESTION = {
    "type": "noul",
    "instructions": "Do the sources answer the question completely?",
    "criteria": {
        "true": "Every part of the question is answered by the sources",
        "false": "A part of the question needs facts the sources only name or do not cover",
    },
}


class Decider(Protocol):
    def enough(self, state: str) -> float:
        """The probability (0 to 1) that the sources in `state` answer the question."""
        ...


class MercuryDecider:
    """Asks Mercury Decide once. Raises on any failure (no retries) so the caller can fall back."""

    def __init__(self, api_key: str | None = None, client: httpx.Client | None = None) -> None:
        self.api_key = api_key or os.environ["OPENROUTER_API_KEY"]
        self.client = client or httpx.Client(timeout=TIMEOUT_SECONDS)

    def enough(self, state: str) -> float:
        body = {"model": MODEL, "state": state, "questions": {"enough": QUESTION}}
        headers = {"Authorization": f"Bearer {self.api_key}"}
        response = self.client.post(DECISIONS_URL, json=body, headers=headers)
        response.raise_for_status()
        answer = response.json()["answers"]["enough"]
        if answer.get("type") != "noul":
            raise ValueError("Unexpected Decisions answer type")
        probability = float(answer["noul"])
        if not 0.0 <= probability <= 1.0:
            raise ValueError("Decisions probability out of range")
        return probability


class FakeDecider:
    """For tests: always answers the same probability and records the states it received."""

    def __init__(self, probability: float) -> None:
        self.probability = probability
        self.states: list[str] = []

    def enough(self, state: str) -> float:
        self.states.append(state)
        return self.probability


def get_decider() -> Decider | None:
    """The Mercury decider when OPENROUTER_API_KEY is set, else None (the LLM decides alone)."""
    if os.environ.get("OPENROUTER_API_KEY"):
        return MercuryDecider()
    return None
