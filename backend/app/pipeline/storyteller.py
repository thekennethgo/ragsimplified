from pathlib import Path

from app.llm import Message
from app.pipeline.scout import Result

SYSTEM_PROMPT = (Path(__file__).with_name("storyteller_prompt.md")).read_text(encoding="utf-8")


def _escape(text: str) -> str:
    """Stop chunk text from closing its own tag or opening a new one."""
    return text.replace("<", "&lt;").replace(">", "&gt;")


def _attribute(value: object) -> str:
    return _escape(str(value)).replace('"', "&quot;")


def format_chunk(number: int, result: Result) -> str:
    where = "your pasted text" if result.source == "private" else "library"
    attributes = f'n="{number}" from="{where}" title="{_attribute(result.title)}"'
    if result.page is not None:
        attributes += f' page="{result.page}"'
    if result.heading:
        attributes += f' heading="{_attribute(result.heading)}"'
    return f"<chunk {attributes}>\n{_escape(result.text)}\n</chunk>"


def build_prompt(question: str, results: list[Result]) -> tuple[str, list[Message]]:
    """The system prompt and the user message for the Storyteller.

    Chunks are numbered from 1 in the order given, so [n] in the answer is results[n - 1].
    """
    if results:
        chunks = "\n\n".join(format_chunk(i, r) for i, r in enumerate(results, start=1))
    else:
        chunks = "(No chunks were found for this question.)"
    content = f"<chunks>\n{chunks}\n</chunks>\n\n<question>\n{_escape(question)}\n</question>"
    return SYSTEM_PROMPT, [{"role": "user", "content": content}]
