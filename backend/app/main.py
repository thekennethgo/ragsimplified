from fastapi import FastAPI

app = FastAPI(title="ragsimplified")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
