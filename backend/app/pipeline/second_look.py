"""The second look (ADR 006): after the Judge, decide whether one more search is needed.

Stage 1 (decider.py, free): a decision model gives the probability that the sources answer the
question. Stage 2 (the configured LLM, only when needed): write one follow-up search query.
"""

import os
import re
from pathlib import Path

from app.llm import LLM, Message
from app.pipeline.decider import Decider
from app.pipeline.scout import Result
from app.pipeline.storyteller import _attribute, _escape

PROMPT = (Path(__file__).with_name("second_look_prompt.md")).read_text(encoding="utf-8")

MAX_QUERY_CHARS = 100
MAX_QUERY_TOKENS = 30
SECOND_LOOK_THRESHOLD = 0.5
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


def decide(
    question: str, results: list[Result], llm: LLM, decider: Decider | None
) -> tuple[str | None, float | None]:
    """The follow-up search query (or None) and the decider's probability (or None)."""
    probability: float | None = None
    # Pasted text is never sent to a new provider, so the decider only sees library results.
    if decider is not None and all(r.source == "library" for r in results):
        try:
            probability = decider.enough(build_state(question, results))
        except Exception:
            probability = None
    if probability is not None and probability >= SECOND_LOOK_THRESHOLD:
        return None, probability
    try:
        reply = "".join(
            llm.stream(PROMPT, build_message(question, results), max_tokens=MAX_QUERY_TOKENS)
        )
    except Exception:
        return None, probability
    return parse(reply, question), probability
