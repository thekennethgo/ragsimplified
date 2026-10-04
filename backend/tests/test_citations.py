from app.pipeline.citations import SNIPPET_CHARS, extract_citations
from app.pipeline.scout import Result


def result(text: str, **kwargs) -> Result:
    defaults = dict(
        source="library",
        score=0.9,
        title="Doc",
        position=0,
        heading=None,
        page=None,
        text=text,
        document_id=1,
    )
    return Result(**{**defaults, **kwargs})


RESULTS = [
    result("Apple was founded in 1976.", title="Apple Inc.", page=2, position=4),
    result("The M1 was announced in 2020.", source="private", title="My note", document_id=None),
]


def test_valid_citations_are_mapped_to_their_chunks():
    answer, citations = extract_citations("Founded in 1976 [1]. M1 came in 2020 [2].", RESULTS)
    assert answer == "Founded in 1976 [1]. M1 came in 2020 [2]."
    assert [c.n for c in citations] == [1, 2]
    first, second = citations
    assert (first.source, first.title, first.page, first.document_id) == (
        "library",
        "Apple Inc.",
        2,
        1,
    )
    assert first.position == 4
    assert first.snippet == "Apple was founded in 1976."
    assert (second.source, second.title, second.document_id) == ("private", "My note", None)


def test_repeated_citations_are_listed_once_in_order_of_first_use():
    answer, citations = extract_citations("B [2]. A [1]. B again [2][1].", RESULTS)
    assert answer == "B [2]. A [1]. B again [2][1]."
    assert [c.n for c in citations] == [2, 1]


def test_made_up_numbers_are_dropped_from_the_answer():
    answer, citations = extract_citations("True [1]. Invented [7]. Zero [0].", RESULTS)
    assert answer == "True [1]. Invented. Zero."
    assert [c.n for c in citations] == [1]


def test_only_made_up_numbers_leave_no_citations():
    answer, citations = extract_citations("Nothing real [3][4].", RESULTS)
    assert answer == "Nothing real."
    assert citations == []


def test_no_markers_and_no_results():
    assert extract_citations("No sources here.", RESULTS) == ("No sources here.", [])
    assert extract_citations("Claim [1].", []) == ("Claim.", [])


def test_long_chunks_get_a_short_one_line_snippet():
    long_text = "word " * 200
    _, citations = extract_citations("x [1]", [result(long_text)])
    assert len(citations[0].snippet) <= SNIPPET_CHARS
    assert citations[0].snippet.endswith("…")
    assert "\n" not in citations[0].snippet
