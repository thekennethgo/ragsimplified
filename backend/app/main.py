import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.upload import router as upload_router

app = FastAPI(title="ragsimplified")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ],
    allow_methods=["GET"],
)

app.include_router(upload_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
