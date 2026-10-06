from collections.abc import Iterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.events import StepEvent
from app.map import Projection, get_projection
from app.pipeline.chopper import chop
from app.pipeline.collector import Page
from app.pipeline.translator import Embedder, VoyageEmbedder

MAX_TEXT_CHARS = 20_000

router = APIRouter()


class UploadRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)


def get_embedder() -> Embedder:
    return VoyageEmbedder()


def run_upload(
    request: UploadRequest, embedder: Embedder, projection: Projection | None = None
) -> Iterator[StepEvent]:
    yield StepEvent(step="chopper", status="start")
    chunks = chop([Page(number=None, text=request.text)])
    yield StepEvent(
        step="chopper",
        status="done",
        data={
            "chunks": len(chunks),
            "chunk_details": [
                {
                    "position": c.position,
                    "heading": c.heading,
                    "length": len(c.text),
                    "overlap": c.overlap,
                }
                for c in chunks
            ],
        },
    )

    yield StepEvent(step="translator", status="start")
    vectors = embedder.embed([chunk.text for chunk in chunks], input_type="document")
    translated: dict = {
        "title": request.title,
        "chunks": [{"position": c.position, "heading": c.heading, "text": c.text} for c in chunks],
        # Rounded to keep the response small; the browser keeps these in memory.
        "vectors": [[round(v, 5) for v in vector] for vector in vectors],
    }
    if projection is not None:
        # Each chunk's place on the vector map, from the library's stored projection.
        translated["points"] = projection.project(vectors)
    yield StepEvent(step="translator", status="done", data=translated)


def stream(
    request: UploadRequest, embedder: Embedder, projection: Projection | None
) -> Iterator[str]:
    try:
        for event in run_upload(request, embedder, projection):
            yield event.to_line()
    except Exception:
        yield StepEvent(step="error", status="done", data={"message": "Upload failed"}).to_line()


@router.post("/upload")
def upload(
    request: UploadRequest,
    embedder: Embedder = Depends(get_embedder),
    projection: Projection | None = Depends(get_projection),
) -> StreamingResponse:
    return StreamingResponse(
        stream(request, embedder, projection), media_type="application/x-ndjson"
    )
