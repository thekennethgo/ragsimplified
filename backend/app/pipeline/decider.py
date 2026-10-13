"""Stage 1 of the second look: a free yes/no decision model (ADR 006).

Inception's Mercury Decide, through OpenRouter's Decisions API (alpha), returns two probabilities in
one call: that the sources answer the question completely, and that they hold anything on it at
all. After a second look it is asked once more whether the final cards answer any part of the
question. It cannot write text, so it never writes the follow-up query.
"""

import os
from dataclasses import dataclass
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

# Asked about mentions, not answers: "What food is popular where Kenneth grew up?" must count as
# touched by a card that only says he grew up in Batam, so the second look can follow the link.
RELEVANT = {
    "type": "noul",
    "instructions": (
        "Does any source mention a person, place or thing that the question refers to, "
        "directly or by description (for example 'where he grew up')?"
    ),
    "criteria": {
        "true": "A source names someone or something the question refers to",
        "false": "Nothing the question refers to is mentioned in any source",
    },
}

# After the second look: is there anything for the Storyteller to write? "What is Kenneth's
# hometown like and what is its famous dish?" passes on the first half alone.
PART = {
    "type": "noul",
    "instructions": (
        "Do the sources answer at least one part of the question, even if other parts are missing?"
    ),
    "criteria": {
        "true": "A source states a fact that directly answers some part of what the question asks",
        "false": "No source states anything that answers any part of what the question asks",
    },
}


@dataclass(frozen=True)
class Decision:
    enough: float  # probability the sources answer the question completely
    relevant: float  # probability the sources mention anything the question refers to


class Decider(Protocol):
    def decide(self, state: str) -> Decision:
        """How likely (0 to 1) the sources in `state` are to answer, and to touch, the question."""
        ...

    def partly(self, state: str) -> float:
        """How likely (0 to 1) the sources in `state` are to answer part of the question."""
        ...


class MercuryDecider:
    """Asks Mercury Decide once. Raises on any failure (no retries) so the caller can fall back."""

    def __init__(self, api_key: str | None = None, client: httpx.Client | None = None) -> None:
        self.api_key = api_key or os.environ["OPENROUTER_API_KEY"]
        self.client = client or httpx.Client(timeout=TIMEOUT_SECONDS)

    def decide(self, state: str) -> Decision:
        questions = {"enough": QUESTION, "relevant": RELEVANT}
        body = {"model": MODEL, "state": state, "questions": questions}
        headers = {"Authorization": f"Bearer {self.api_key}"}
        response = self.client.post(DECISIONS_URL, json=body, headers=headers)
        response.raise_for_status()
        answers = response.json()["answers"]
        return Decision(_probability(answers["enough"]), _probability(answers["relevant"]))

    def partly(self, state: str) -> float:
        body = {"model": MODEL, "state": state, "questions": {"part": PART}}
        headers = {"Authorization": f"Bearer {self.api_key}"}
        response = self.client.post(DECISIONS_URL, json=body, headers=headers)
        response.raise_for_status()
        return _probability(response.json()["answers"]["part"])


def _probability(answer: dict) -> float:
    if answer.get("type") != "noul":
        raise ValueError("Unexpected Decisions answer type")
    probability = float(answer["noul"])
    if not 0.0 <= probability <= 1.0:
        raise ValueError("Decisions probability out of range")
    return probability


class FakeDecider:
    """For tests: always answers the same probabilities and records the states it received."""

    def __init__(self, probability: float, relevant: float = 1.0, part: float = 1.0) -> None:
        self.probability = probability
        self.relevant = relevant
        self.part = part
        self.states: list[str] = []

    def decide(self, state: str) -> Decision:
        self.states.append(state)
        return Decision(self.probability, self.relevant)

    def partly(self, state: str) -> float:
        self.states.append(state)
        return self.part


def get_decider() -> Decider | None:
    """The Mercury decider when OPENROUTER_API_KEY is set, else None (the LLM decides alone)."""
    if os.environ.get("OPENROUTER_API_KEY"):
        return MercuryDecider()
    return None
