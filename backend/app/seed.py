import os
import shutil
from pathlib import Path

import psycopg

from app.pipeline.archivist import document_exists, hash_pages, save_document
from app.pipeline.chopper import chop
from app.pipeline.collector import collect
from app.pipeline.translator import Embedder, VoyageEmbedder

REPO_ROOT = Path(__file__).resolve().parents[2]
CORPUS_DIR = REPO_ROOT / "corpus"
PUBLIC_DIR = REPO_ROOT / "frontend" / "public" / "corpus"
SUPPORTED = {".pdf", ".md", ".markdown", ".txt"}


def title_for(path: Path) -> str:
    """The first top-level Markdown heading, else the filename made readable."""
    if path.suffix.lower() in {".md", ".markdown"}:
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("# "):
                return line[2:].strip()
    return path.stem.replace("-", " ").replace("_", " ").strip().title()


def seed(
    conn: psycopg.Connection,
    embedder: Embedder,
    corpus_dir: Path = CORPUS_DIR,
    public_dir: Path = PUBLIC_DIR,
) -> dict[str, str]:
    """Load every supported file in corpus_dir into the library and copy it to public_dir.

    Returns a status per file: "saved", "skipped" (already in the library) or "empty".
    Re-running is safe: documents are matched by content hash.
    """
    results: dict[str, str] = {}
    public_dir.mkdir(parents=True, exist_ok=True)
    for path in sorted(corpus_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED:
            continue
        if path.name.lower() == "readme.md":
            continue
        name = path.relative_to(corpus_dir).as_posix()
        pages = collect(path)
        chunks = chop(pages)
        if not chunks:
            results[name] = "empty"
            continue
        content_hash = hash_pages(pages)
        if document_exists(conn, content_hash):
            results[name] = "skipped"
        else:
            vectors = embedder.embed([chunk.text for chunk in chunks], input_type="document")
            save_document(
                conn,
                title=title_for(path),
                filename=name,
                content_hash=content_hash,
                chunks=chunks,
                vectors=vectors,
            )
            results[name] = "saved"
        destination = public_dir / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, destination)
    return results


def main() -> None:
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn:
        results = seed(conn, VoyageEmbedder())
    for name, status in results.items():
        print(f"{status:8} {name}")
    if not results:
        print(f"No documents found in {CORPUS_DIR}")


if __name__ == "__main__":
    main()
