from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


@dataclass(frozen=True)
class Page:
    """Text from one page. `number` is None for formats without pages."""

    number: int | None
    text: str


def collect(path: Path) -> list[Page]:
    """Parse a PDF, Markdown or text file into pages of text."""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        reader = PdfReader(path)
        return [
            Page(number=i, text=(page.extract_text() or "").strip())
            for i, page in enumerate(reader.pages, start=1)
        ]
    if suffix in {".md", ".markdown", ".txt"}:
        return [Page(number=None, text=path.read_text(encoding="utf-8").strip())]
    raise ValueError(f"Unsupported file type: {path.suffix}")
