import os

from fastapi import APIRouter

from app.ask import MAX_PRIVATE_CHUNKS
from app.llm import ANTHROPIC_MAX_TOKENS
from app.pipeline import chopper, judge, scout, storyteller, translator
from app.upload import MAX_TEXT_CHARS

router = APIRouter()


@router.get("/about")
def about() -> dict:
    """Non-secret facts about how the pipeline is set up, for the character tabs."""
    provider = os.environ.get("LLM_PROVIDER", "openai_compatible")
    return {
        "embedder": {
            "provider": "Voyage AI",
            "model": translator.MODEL,
            "dimensions": translator.DIMENSION,
        },
        "reranker": {"provider": "Voyage AI", "model": judge.MODEL},
        "llm": {
            "provider": provider,
            "model": os.environ.get("LLM_MODEL", ""),
            # Only the Anthropic request sets a limit; the other uses the model's default.
            "max_tokens": ANTHROPIC_MAX_TOKENS if provider == "anthropic" else None,
        },
        "chopper": {
            "chunk_tokens": chopper.CHUNK_TOKENS,
            "overlap_tokens": chopper.OVERLAP_TOKENS,
            "chars_per_token": chopper.CHARS_PER_TOKEN,
            "max_text_chars": MAX_TEXT_CHARS,
        },
        "translator": {"max_weighted_words": translator.MAX_WEIGHTED_WORDS},
        "scout": {
            "candidates": scout.CANDIDATES,
            "rrf_k": scout.RRF_K,
            "max_private_chunks": MAX_PRIVATE_CHUNKS,
        },
        "judge": {"keep": scout.DEFAULT_K},
        "storyteller_prompt": storyteller.SYSTEM_PROMPT,
    }
