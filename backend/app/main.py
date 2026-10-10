import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.about import router as about_router
from app.ask import router as ask_router
from app.library import router as library_router
from app.map import router as map_router
from app.upload import router as upload_router

app = FastAPI(title="ragsimplified")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(about_router)
app.include_router(upload_router)
app.include_router(ask_router)
app.include_router(library_router)
app.include_router(map_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
