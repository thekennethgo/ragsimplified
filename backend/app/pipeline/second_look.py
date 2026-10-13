"""The second look (ADR 006): after the Judge, decide whether one more search is needed.

Stage 1 (decider.py, free): a decision model gives the probability that the sources answer the
question, and that they hold anything on it at all; when it is sure they hold nothing, there is no
answer to write and the run ends without the Storyteller. Stage 2 (the configured LLM, only when
needed): write one follow-up search query. After the second round the decision model checks the
final cards once more (`final_check`): if they answer no part of the question, the run ends the
same way.
"""

import os
import re
from dataclasses import dataclass
from pathlib import Path

from app.llm import LLM, Message
from app.pipeline.decider import Decider
from app.pipeline.scout import Result
from app.pipeline.storyteller import _attribute, _escape

PROMPT = (Path(__file__).with_name("second_look_prompt.md")).read_text(encoding="utf-8")

MAX_QUERY_CHARS = 100
MAX_QUERY_TOKENS = 30
SECOND_LOOK_THRESHOLD = 0.5
NOTHING_THRESHOLD = 0.1  # below this chance that the sources touch the question, nothing is on file
SECOND_LOOK_SLOTS = 2  # cards the second round can add to the Judge's 5


def enabled() -> bool:
    return os.environ.get("SECOND_LOOK", "on").lower() != "off"


def _sources(results: list[Result]) -> str:
    parts = []
    for i, r in enumerate(results, start=1):
        attributes = f'n="{i}" title="{_attribute(r.title)}"'
        if r.heading:
            attributes += f' heading="{_attribute(r.heading)}"'
        parts.append(f"<source {attributes}>\n{_escape(r.text)}\n</source>")
    return "\n\n".join(parts)


def build_message(question: str, results: list[Result]) -> list[Message]:
    content = f"<question>\n{_escape(question)}\n</question>\n\n{_sources(results)}"
    return [{"role": "user", "content": content}]


def build_state(question: str, results: list[Result]) -> str:
    """The same question and cards as `build_message`, as plain text for the decider."""
    return f"Question: {question}\n\nSources:\n\n{_sources(results)}"


def parse(reply: str, question: str) -> str | None:
    """The follow-up query from the LLM's reply, or None for DONE, an empty reply or a repeat."""
    first = next((ln.strip() for ln in reply.splitlines() if ln.strip()), "")
    line = first.strip("\"'`“”‘’ ").rstrip(".!?,;: ").strip("\"'`“”‘’ ")
    repeat = {question.strip().lower(), question.strip().lower().rstrip(".!?,;: ")}
    if not line or re.match(r"done\b", line, re.IGNORECASE) or line.lower() in repeat:
        return None
    return line[:MAX_QUERY_CHARS]


@dataclass(frozen=True)
class Look:
    query: str | None  # the follow-up search query, or None
    enough: float | None = None  # the decider's probabilities, or None without a decider
    relevant: float | None = None
    nothing: bool = False  # the decider is sure the sources hold nothing on the question

    @property
    def decided_by(self) -> str:
        return "decider" if self.nothing or (self.enough or 0) >= SECOND_LOOK_THRESHOLD else "llm"


def can_check(results: list[Result], decider: Decider | None) -> bool:
    """Whether the decider may see these cards: pasted text is never sent to a new provider."""
    return decider is not None and all(r.source == "library" for r in results)


def final_check(question: str, results: list[Result], decider: Decider) -> float | None:
    """After the second round: how likely the final cards answer any part of the question."""
    try:
        return decider.partly(build_state(question, results))
    except Exception:
        return None


def decide(question: str, results: list[Result], llm: LLM, decider: Decider | None) -> Look:
    """Whether to search again (and for what), or whether there is nothing to answer from."""
    look = Look(None)
    if decider is not None and can_check(results, decider):
        try:
            decision = decider.decide(build_state(question, results))
            look = Look(None, decision.enough, decision.relevant)
        except Exception:
            pass
    if look.relevant is not None and look.relevant < NOTHING_THRESHOLD:
        return Look(None, look.enough, look.relevant, nothing=True)
    if look.enough is not None and look.enough >= SECOND_LOOK_THRESHOLD:
        return look
    try:
        reply = "".join(
            llm.stream(PROMPT, build_message(question, results), max_tokens=MAX_QUERY_TOKENS)
        )
    except Exception:
        return look
    return Look(parse(reply, question), look.enough, look.relevant)
