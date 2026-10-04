from pathlib import Path

import pytest

from app.pipeline.collector import Page, collect

FIXTURES = Path(__file__).parent / "fixtures"


def test_collects_pdf_with_page_numbers():
    assert collect(FIXTURES / "sample.pdf") == [
        Page(1, "Hello from page one"),
        Page(2, "Hello from page two"),
    ]


def test_collects_markdown_keeping_headings():
    pages = collect(FIXTURES / "sample.md")
    assert len(pages) == 1
    assert pages[0].number is None
    assert "## Section" in pages[0].text
    assert "Second paragraph." in pages[0].text


def test_collects_plain_text():
    assert collect(FIXTURES / "sample.txt") == [Page(None, "Plain text line one.\nLine two.")]


def test_rejects_unsupported_type(tmp_path):
    bad = tmp_path / "file.docx"
    bad.write_text("x")
    with pytest.raises(ValueError):
        collect(bad)
