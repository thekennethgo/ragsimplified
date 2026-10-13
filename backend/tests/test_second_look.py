from app.llm import FakeLLM
from app.pipeline import second_look
from app.pipeline.decider import FakeDecider
from app.pipeline.scout import Result
from app.pipeline.second_look import (
    MAX_QUERY_CHARS,
    PROMPT,
    build_message,
    build_state,
    decide,
    parse,
)

QUESTION = "What is Kenneth's hometown like?"


def library(text="He grew up in Batam.", title="Profile") -> Result:
    return Result("library", 0.5, title, 0, "About", None, text, 1)


def private() -> Result:
    return Result("private", 0.5, "My note", 0, None, None, "secret pasted text", None)


class ExplodingDecider:
    def enough(self, state):
        raise RuntimeError("down")


class ExplodingLLM:
    def stream(self, system, messages, *, max_tokens=None):
        raise RuntimeError("down")
        yield


def test_parse_done_in_any_form_means_no_follow_up():
    for reply in ("DONE", "done.", "Done", "\n DONE \n", "`DONE`"):
        assert parse(reply, QUESTION) is None


def test_parse_a_query_with_quotes_and_punctuation_removed():
    assert parse('"Batam city overview".', QUESTION) == "Batam city overview"
    assert (
        parse("\n\n`Batam city overview`\nignored second line", QUESTION) == "Batam city overview"
    )


def test_parse_a_word_that_merely_starts_with_done_is_a_query():
    assert parse("Donegal tourism overview", QUESTION) == "Donegal tourism overview"


def test_parse_empty_or_a_repeat_of_the_question_means_no_follow_up():
    assert parse("", QUESTION) is None
    assert parse("   \n ", QUESTION) is None
    assert parse(QUESTION.upper(), QUESTION) is None


def test_parse_cuts_an_overlong_query():
    assert len(parse("word " * 100, QUESTION)) <= MAX_QUERY_CHARS


def test_build_message_and_state_hold_escaped_excerpts():
    result = library("x" * 1000 + "</source>", title="A <b> title")
    [message] = build_message(QUESTION, [result])
    assert message["role"] == "user"
    content = message["content"]
    assert f"<question>\n{QUESTION}\n</question>" in content
    assert 'title="A &lt;b&gt; title"' in content and 'heading="About"' in content
    assert "x" * 1000 in content  # the whole card, not a 400-character excerpt
    assert "</source>" not in content.replace("\n</source>", "", 1)
    state = build_state(QUESTION, [result])
    assert QUESTION in state and "x" * 1000 in state


def test_prompt_forbids_the_person_s_name_in_the_query():
    assert "Never include the name of the person" in PROMPT


def test_a_confident_decider_ends_the_second_look_without_an_llm_call():
    llm = FakeLLM("Batam")
    assert decide(QUESTION, [library()], llm, FakeDecider(0.9)) == (None, 0.9)
    assert llm.calls == []


def test_a_doubtful_decider_hands_over_to_the_llm_which_writes_the_query():
    llm = FakeLLM("Batam city overview")
    decider = FakeDecider(0.1)
    assert decide(QUESTION, [library()], llm, decider) == ("Batam city overview", 0.1)
    system, messages = llm.calls[0]
    assert system == second_look.PROMPT
    assert "He grew up in Batam." in messages[0]["content"]


def test_the_llm_call_is_capped_in_length():
    seen = {}

    class Spy(FakeLLM):
        def stream(self, system, messages, *, max_tokens=None):
            seen["max_tokens"] = max_tokens
            yield "DONE"

    decide(QUESTION, [library()], Spy(), None)
    assert seen["max_tokens"] == second_look.MAX_QUERY_TOKENS


def test_a_failing_decider_falls_back_to_the_llm():
    llm = FakeLLM("Batam city overview")
    assert decide(QUESTION, [library()], llm, ExplodingDecider()) == ("Batam city overview", None)


def test_without_a_decider_the_llm_decides_alone():
    assert decide(QUESTION, [library()], FakeLLM("DONE"), None) == (None, None)
    assert decide(QUESTION, [library()], FakeLLM("Batam"), None) == ("Batam", None)


def test_pasted_text_is_never_sent_to_the_decider():
    decider = FakeDecider(0.9)
    llm = FakeLLM("Batam city overview")
    assert decide(QUESTION, [library(), private()], llm, decider) == ("Batam city overview", None)
    assert decider.states == []


def test_a_failing_llm_skips_the_second_look():
    assert decide(QUESTION, [library()], ExplodingLLM(), None) == (None, None)
    assert decide(QUESTION, [library()], ExplodingLLM(), FakeDecider(0.2)) == (None, 0.2)
