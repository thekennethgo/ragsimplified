from app.pipeline.chopper import MAX_CHARS, OVERLAP_CHARS, chop
from app.pipeline.collector import Page


def test_empty_input():
    assert chop([]) == []
    assert chop([Page(1, "")]) == []
    assert chop([Page(None, "   \n\n  ")]) == []


def test_short_text_is_one_chunk_with_page_and_heading():
    chunks = chop([Page(3, "# Intro\n\nHello world.")])
    assert len(chunks) == 1
    assert chunks[0].position == 0
    assert chunks[0].page == 3
    assert chunks[0].heading == "Intro"
    assert "Hello world." in chunks[0].text


def test_one_huge_section_is_split_with_overlap():
    words = [f"w{i}" for i in range(3000)]
    chunks = chop([Page(None, " ".join(words))])
    assert len(chunks) > 1
    assert [c.position for c in chunks] == list(range(len(chunks)))
    assert all(len(c.text) <= MAX_CHARS for c in chunks)
    for earlier, later in zip(chunks, chunks[1:]):
        assert later.text.split()[0] in earlier.text.split()[-(OVERLAP_CHARS // 2) :]
    # No words lost.
    assert set(" ".join(c.text for c in chunks).split()) == set(words)


def test_code_block_stays_whole():
    code = "```python\n" + "\n".join(f"x{i} = {i}" for i in range(20)) + "\n```"
    chunks = chop([Page(None, f"Before.\n\n{code}\n\nAfter.")])
    assert len(chunks) == 1
    assert code in chunks[0].text


def test_code_block_with_blank_lines_is_not_split_at_them():
    code = "```\na = 1\n\nb = 2\n```"
    chunks = chop([Page(None, f"Intro.\n\n{code}")])
    assert code in chunks[0].text


def test_heading_follows_sections_across_chunks():
    filler = " ".join(["word"] * 600)
    text = f"# One\n\n{filler}\n\n# Two\n\n{filler}"
    headings = [c.heading for c in chop([Page(None, text)])]
    assert headings[0] == "One"
    assert headings[-1] == "Two"


def test_pages_are_chunked_separately():
    chunks = chop([Page(1, "First page."), Page(2, "Second page.")])
    assert [(c.page, c.position) for c in chunks] == [(1, 0), (2, 1)]
