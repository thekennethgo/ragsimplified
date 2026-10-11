import json

from app.seed import CORPUS_DIR, SUPPORTED


def test_sources_json_matches_the_corpus_files():
    entries = json.loads((CORPUS_DIR / "sources.json").read_text(encoding="utf-8"))
    files = {
        path.relative_to(CORPUS_DIR).as_posix()
        for path in CORPUS_DIR.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED and path.name.lower() != "readme.md"
    }
    assert files - set(entries) == set(), "files without an entry in corpus/sources.json"
    assert set(entries) - files == set(), "entries in corpus/sources.json without a file"
    for name, entry in entries.items():
        assert entry.get("source") and entry.get("licence"), name
