import hashlib
import os
import time
from typing import Literal, Protocol

import httpx

VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
MODEL = "voyage-4"
DIMENSION = 1024
BATCH_SIZE = 64
MAX_RETRIES = 4

InputType = Literal["document", "query"]


class Embedder(Protocol):
    def embed(self, texts: list[str], input_type: InputType = "document") -> list[list[float]]: ...


class VoyageEmbedder:
    """Embeds text with Voyage AI in batches, retrying rate limits and server errors."""

    def __init__(self, api_key: str | None = None, client: httpx.Client | None = None) -> None:
        self.api_key = api_key or os.environ["VOYAGE_API_KEY"]
        self.client = client or httpx.Client(timeout=60)

    def embed(self, texts: list[str], input_type: InputType = "document") -> list[list[float]]:
        vectors: list[list[float]] = []
        for start in range(0, len(texts), BATCH_SIZE):
            vectors.extend(self._embed_batch(texts[start : start + BATCH_SIZE], input_type))
        return vectors

    def _embed_batch(self, batch: list[str], input_type: InputType) -> list[list[float]]:
        body = {
            "input": batch,
            "model": MODEL,
            "input_type": input_type,
            "output_dimension": DIMENSION,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        for attempt in range(MAX_RETRIES + 1):
            response = self.client.post(VOYAGE_URL, json=body, headers=headers)
            if response.status_code == 429 or response.status_code >= 500:
                if attempt == MAX_RETRIES:
                    response.raise_for_status()
                time.sleep(2**attempt)
                continue
            response.raise_for_status()
            data = sorted(response.json()["data"], key=lambda item: item["index"])
            return [item["embedding"] for item in data]
        raise RuntimeError("unreachable")


class FakeEmbedder:
    """Deterministic embeddings for tests: the same text always gives the same vector."""

    def embed(self, texts: list[str], input_type: InputType = "document") -> list[list[float]]:
        return [self._vector(text) for text in texts]

    @staticmethod
    def _vector(text: str) -> list[float]:
        digest = hashlib.sha256(text.encode()).digest()
        raw = [digest[i % len(digest)] / 255 - 0.5 for i in range(DIMENSION)]
        norm = sum(v * v for v in raw) ** 0.5
        return [v / norm for v in raw]
