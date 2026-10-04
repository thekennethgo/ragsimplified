import re
from dataclasses import dataclass
from typing import Literal

from app.pipeline.scout import Result

MARKER = re.compile(r"\[(\d+)\]")
SNIPPET_CHARS = 240


@dataclass(frozen=True)
class Citation:
    n: int  # the [n] in the answer; the chunk is results[n - 1]
    source: Literal["library", "private"]
    title: str
    page: int | None
    heading: str | None
    snippet: str
    document_id: int | None  # library only
    position: int  # the chunk's position inside its document or pasted text


def _snippet(text: str) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= SNIPPET_CHARS else flat[: SNIPPET_CHARS - 1].rstrip() + "…"


def extract_citations(answer: str, results: list[Result]) -> tuple[str, list[Citation]]:
    """Map the [n] markers in an answer to their chunks.

    Returns the answer with markers that match no chunk removed, and one Citation per valid
    number, in order of first appearance (a number used several times is listed once).
    """
    citations: dict[int, Citation] = {}

    def keep_or_drop(match: re.Match[str]) -> str:
        n = int(match.group(1))
        if not 1 <= n <= len(results):
            return ""
        if n not in citations:
            r = results[n - 1]
            citations[n] = Citation(
                n=n,
                source=r.source,
                title=r.title,
                page=r.page,
                heading=r.heading,
                snippet=_snippet(r.text),
                document_id=r.document_id,
                position=r.position,
            )
        return match.group(0)

    cleaned = MARKER.sub(keep_or_drop, answer)
    # Tidy the space a dropped marker leaves behind.
    cleaned = re.sub(r"[ \t]+([.,;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    return cleaned, list(citations.values())
