import os
import re
import time
from dataclasses import dataclass, replace
from typing import Protocol

import httpx

from app.pipeline.scout import DEFAULT_K, Result

VOYAGE_RERANK_URL = "https://api.voyageai.com/v1/rerank"
MODEL = "rerank-3-lite"
MAX_RETRIES = 4


class Reranker(Protocol):
    def rerank(self, query: str, documents: list[str]) -> list[tuple[int, float]]:
        """Every document as (index, relevance score), best first."""
        ...


class VoyageReranker:
    """Reranks with Voyage AI, retrying rate limits and server errors."""

    def __init__(self, api_key: str | None = None, client: httpx.Client | None = None) -> None:
        self.api_key = api_key or os.environ["VOYAGE_API_KEY"]
        self.client = client or httpx.Client(timeout=60)

    def rerank(self, query: str, documents: list[str]) -> list[tuple[int, float]]:
        body = {
            "query": query,
            "documents": documents,
            "model": MODEL,
            "top_k": len(documents),
            "truncation": True,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        for attempt in range(MAX_RETRIES + 1):
            response = self.client.post(VOYAGE_RERANK_URL, json=body, headers=headers)
            if response.status_code == 429 or response.status_code >= 500:
                if attempt == MAX_RETRIES:
                    response.raise_for_status()
                time.sleep(2**attempt)
                continue
            response.raise_for_status()
            payload = response.json()
            items = payload.get("data") or payload.get("results") or []
            ranked = sorted(items, key=lambda item: item["relevance_score"], reverse=True)
            return [(item["index"], float(item["relevance_score"])) for item in ranked]
        raise RuntimeError("unreachable")


class FakeReranker:
    """Deterministic reranker for tests: scores a document by how many query words it contains."""

    def rerank(self, query: str, documents: list[str]) -> list[tuple[int, float]]:
        words = set(re.findall(r"\w+", query.lower()))
        scored = [
            (index, len(words & set(re.findall(r"\w+", doc.lower()))) / (len(words) or 1))
            for index, doc in enumerate(documents)
        ]
        return sorted(scored, key=lambda pair: (-pair[1], pair[0]))


def get_reranker() -> Reranker:
    return VoyageReranker()


@dataclass(frozen=True)
class Judgement:
    candidates: list[Result]  # every candidate with old_rank, new_rank and rerank_score
    kept: list[Result]  # the best `keep`, in their new order
    fallback: bool  # True when the reranker failed and the fused order was kept


def judge(
    question: str, candidates: list[Result], reranker: Reranker, keep: int = DEFAULT_K
) -> Judgement:
    """Rerank the Scout's candidates and keep the best `keep`.

    If the reranker fails, the first `keep` candidates in fused order are kept, so a reranker
    outage degrades the answer instead of breaking it.
    """
    numbered = [replace(r, old_rank=rank) for rank, r in enumerate(candidates, start=1)]
    if not numbered:
        return Judgement([], [], False)
    try:
        ranked = reranker.rerank(question, [r.text for r in numbered])
    except Exception:
        shown = [replace(r, new_rank=r.old_rank) for r in numbered]
        return Judgement(shown, shown[:keep], True)
    reordered = [
        replace(numbered[index], new_rank=new_rank, rerank_score=score)
        for new_rank, (index, score) in enumerate(ranked, start=1)
    ]
    return Judgement(reordered, reordered[:keep], False)
