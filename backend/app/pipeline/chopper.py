import re
from dataclasses import dataclass

from app.pipeline.collector import Page

# No tokenizer dependency: estimate 1 token as 4 characters.
CHARS_PER_TOKEN = 4
CHUNK_TOKENS = 500
OVERLAP_TOKENS = 50
MAX_CHARS = CHUNK_TOKENS * CHARS_PER_TOKEN
OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN

HEADING = re.compile(r"^#{1,6}\s+(.*\S)\s*$")


@dataclass(frozen=True)
class Chunk:
    position: int
    page: int | None
    heading: str | None
    text: str


def _segments(text: str) -> list[tuple[str, str | None]]:
    """Split text into paragraphs and whole fenced code blocks, with the current heading."""
    segments: list[tuple[str, str | None]] = []
    heading: str | None = None
    current: list[str] = []
    in_code = False

    def flush() -> None:
        body = "\n".join(current).strip()
        if body:
            segments.append((body, heading))
        current.clear()

    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            if not in_code:
                flush()
            current.append(line)
            in_code = not in_code
            if not in_code:
                flush()
            continue
        if in_code:
            current.append(line)
            continue
        match = HEADING.match(line)
        if match:
            flush()
            heading = match.group(1)
            current.append(line)
            flush()
        elif not line.strip():
            flush()
        else:
            current.append(line)
    flush()
    return segments


def _split_oversized(text: str, limit: int) -> list[str]:
    """Break text longer than `limit` characters into word-boundary pieces."""
    pieces: list[str] = []
    current = ""
    for word in text.split(" "):
        while len(word) > limit:
            if current:
                pieces.append(current)
                current = ""
            pieces.append(word[:limit])
            word = word[limit:]
        if current and len(current) + 1 + len(word) > limit:
            pieces.append(current)
            current = word
        else:
            current = f"{current} {word}" if current else word
    if current:
        pieces.append(current)
    return pieces


def _tail(text: str) -> str:
    """The last ~OVERLAP_CHARS characters of text, starting at a word boundary."""
    if len(text) <= OVERLAP_CHARS:
        return text
    tail = text[-OVERLAP_CHARS:]
    space = tail.find(" ")
    return tail[space + 1 :] if space != -1 else tail


def chop(pages: list[Page]) -> list[Chunk]:
    """Split pages into ~500-token chunks with a 50-token overlap, keeping page and heading."""
    chunks: list[Chunk] = []
    limit = MAX_CHARS - OVERLAP_CHARS

    for page in pages:
        buffer = ""  # text of the chunk being built, including any overlap
        fresh = False  # whether the buffer holds anything beyond the overlap
        buffer_heading: str | None = None

        def flush(page_number: int | None = page.number) -> None:
            nonlocal buffer, fresh
            if fresh:
                chunks.append(Chunk(len(chunks), page_number, buffer_heading, buffer.strip()))
                buffer = _tail(buffer)
                fresh = False

        for segment, heading in _segments(page.text):
            pieces = [segment] if len(segment) <= limit else _split_oversized(segment, limit)
            for piece in pieces:
                if buffer and len(buffer) + 2 + len(piece) > MAX_CHARS:
                    flush()
                if not fresh:
                    buffer_heading = heading
                buffer = f"{buffer}\n\n{piece}" if buffer else piece
                fresh = True
        flush()
    return chunks
