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
