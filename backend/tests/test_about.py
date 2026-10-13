import json

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_about_returns_the_documented_facts():
    body = client.get("/about").json()
    assert set(body) == {
        "embedder",
        "reranker",
        "llm",
        "chopper",
        "translator",
        "scout",
        "judge",
        "second_look",
        "storyteller_prompt",
    }
    assert body["embedder"]["model"] == "voyage-4"
    assert body["embedder"]["dimensions"] == 1024
    assert body["chopper"]["chunk_tokens"] == 500
    assert body["scout"]["candidates"] == 20
    assert body["judge"]["keep"] == 5
    assert body["storyteller_prompt"].strip()


def test_about_reflects_the_llm_environment(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "claude-test-model")
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    llm = client.get("/about").json()["llm"]
    assert (llm["provider"], llm["model"]) == ("anthropic", "claude-test-model")


def test_about_leaks_no_secrets(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "sk-secret-llm")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-secret-anthropic")
    monkeypatch.setenv("LLM_BASE_URL", "https://secret.example.com/v1")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:secret-pass@host/db")
    text = json.dumps(client.get("/about").json())
    for secret in ("sk-secret", "secret.example.com", "secret-pass", "postgresql://"):
        assert secret not in text


def test_max_tokens_is_only_reported_for_the_anthropic_provider(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    assert client.get("/about").json()["llm"]["max_tokens"] == 1024
    monkeypatch.setenv("LLM_PROVIDER", "openai_compatible")
    assert client.get("/about").json()["llm"]["max_tokens"] is None


def test_second_look_facts_never_include_the_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("SECOND_LOOK", raising=False)
    look = client.get("/about").json()["second_look"]
    assert look["enabled"] is True and look["decider"] is None
    assert look["threshold"] == 0.5 and look["excerpt_chars"] == 400 and look["slots"] == 2
    assert "DONE" in look["prompt"]
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-secret")
    monkeypatch.setenv("SECOND_LOOK", "off")
    body = client.get("/about").json()
    assert body["second_look"]["decider"] == "inception/mercury-decide:free"
    assert body["second_look"]["enabled"] is False
    assert "sk-or-secret" not in json.dumps(body)
