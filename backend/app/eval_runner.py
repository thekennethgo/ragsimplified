"""`make eval`: ask the starter questions against a fresh database holding only the starter corpus.

Reports retrieval hit rate, citation validity, refusals and injection resistance. The database
is dropped and recreated on every run, so it is only allowed on a local server.
"""

import hashlib
import json
import os
import re
import sqlite3
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import psycopg
from psycopg import sql

from app.ask import AskRequest, run_ask
from app.events import DeltaEvent
from app.llm import LLM, get_llm
from app.migrate import migrate
from app.pipeline.decider import Decider, get_decider
from app.pipeline.judge import Reranker, VoyageReranker
from app.pipeline.translator import MODEL, Embedder, InputType, VoyageEmbedder
from app.seed import CORPUS_DIR, REPO_ROOT, seed

EVALS_DIR = REPO_ROOT / "evals"
QUESTIONS = EVALS_DIR / "questions.jsonl"
FIXTURES_DIR = EVALS_DIR / "corpus"
BASELINE = EVALS_DIR / "baseline.json"
SUMMARY = REPO_ROOT / "frontend" / "public" / "eval-summary.json"
EMBEDDING_CACHE = EVALS_DIR / ".cache" / "embeddings.sqlite"
EVAL_DB_NAME = "ragsimplified_eval"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "db"}
MARKER = re.compile(r"\[(\d+)\]")
REFUSAL = re.compile(
    r"can(?:'|’)?t answer|cannot answer|unable to answer|not (?:covered|contain|mention|provide)"
    r"|no information|doesn(?:'|’)?t (?:cover|contain|mention)|don(?:'|’)?t have",
    re.IGNORECASE,
)


class CachingEmbedder:
    """Wraps an Embedder with a SQLite cache, so unchanged text is never embedded twice."""

    def __init__(self, inner: Embedder, path: Path = EMBEDDING_CACHE) -> None:
        self.inner = inner
        path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.db = sqlite3.connect(path, check_same_thread=False)
        with self.lock:
            self.db.execute(
                "CREATE TABLE IF NOT EXISTS vectors (key TEXT PRIMARY KEY, vector TEXT)"
            )
            self.db.commit()

    @staticmethod
    def _key(input_type: str, text: str) -> str:
        return hashlib.sha256(f"{MODEL}\0{input_type}\0{text}".encode()).hexdigest()

    def embed(self, texts: list[str], input_type: InputType = "document") -> list[list[float]]:
        keys = [self._key(input_type, t) for t in texts]
        found: dict[str, list[float]] = {}
        with self.lock:
            for key in set(keys):
                hit = self.db.execute("SELECT vector FROM vectors WHERE key = ?", (key,)).fetchone()
                if hit:
                    found[key] = json.loads(hit[0])
        missing = list(dict.fromkeys(t for t, k in zip(texts, keys) if k not in found))
        if missing:
            fresh = self.inner.embed(missing, input_type=input_type)
            with self.lock:
                for text, vector in zip(missing, fresh):
                    key = self._key(input_type, text)
                    found[key] = vector
                    self.db.execute(
                        "INSERT OR REPLACE INTO vectors (key, vector) VALUES (?, ?)",
                        (key, json.dumps(vector)),
                    )
                self.db.commit()
        return [found[k] for k in keys]


def load_questions(path: Path = QUESTIONS) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def eval_database_urls(database_url: str) -> tuple[str, str]:
    """The server's admin URL and the eval database URL, derived from DATABASE_URL.

    Refuses anything but a local server: the eval database is dropped on every run.
    """
    parsed = urlparse(database_url)
    if parsed.hostname not in LOCAL_HOSTS:
        raise SystemExit(
            f"Refusing to run evals: DATABASE_URL points at {parsed.hostname!r}, not a local "
            "database. The eval database is dropped and recreated on every run."
        )
    admin = urlunparse(parsed._replace(path="/postgres"))
    target = urlunparse(parsed._replace(path=f"/{EVAL_DB_NAME}"))
    return admin, target


def prepare_database(database_url: str, embedder: Embedder) -> str:
    """Create a fresh eval database holding only the starter corpus (plus the eval fixtures)."""
    admin_url, eval_url = eval_database_urls(database_url)
    with psycopg.connect(admin_url, autocommit=True) as admin:
        name = sql.Identifier(EVAL_DB_NAME)
        admin.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(name))
        admin.execute(sql.SQL("CREATE DATABASE {}").format(name))
    migrate(eval_url)
    with psycopg.connect(eval_url, autocommit=True) as conn, tempfile.TemporaryDirectory() as tmp:
        for directory in (CORPUS_DIR, FIXTURES_DIR):
            seed(conn, embedder, directory, Path(tmp))
    return eval_url


def is_refusal(answer: str, citations: list) -> bool:
    return not citations and bool(REFUSAL.search(answer))


def run_question(
    question: dict,
    connect,
    embedder: Embedder,
    llm: LLM,
    reranker: Reranker,
    titles: dict,
    decider: Decider | None = None,
) -> dict:
    """Run one question through the same code as POST /ask and record what happened."""
    row = {
        "id": question["id"],
        "type": question["type"],
        "case": question.get("case"),
        "error": False,
    }
    raw = ""
    final: dict = {}
    result_titles: list[str] = []
    decided_by = None
    try:
        for event in run_ask(
            AskRequest(question=question["question"]),
            embedder,
            llm,
            connect,
            reranker,
            decider=decider,
            explain_words=False,
        ):
            if isinstance(event, DeltaEvent):
                raw += event.delta
            elif event.step == "judge" and event.status == "done":
                if "final" in event.data:  # a second look: the final 5 across both rounds
                    result_titles = list(event.data["final"])
                else:
                    kept = [r for r in event.data["results"] if r["kept"]]
                    result_titles = [r["title"] for r in kept]
            elif event.step == "second_look" and event.status == "done":
                decided_by = event.data.get("decided_by")
            elif event.step == "storyteller" and event.status == "done":
                final = event.data
    except Exception as e:
        row["error"] = True
        row["error_message"] = f"{type(e).__name__}: {e}"[:300]
    answer = final.get("answer", raw)
    citations = final.get("citations", [])
    markers = [int(n) for n in MARKER.findall(raw)]
    expected = question.get("expected_files") or (
        [question["expected_file"]] if "expected_file" in question else []
    )
    row.update(
        answer=answer,
        tier=question.get("tier", "easy"),
        retrieval_hit=all(titles.get(f) in result_titles for f in expected) if expected else None,
        markers=len(markers),
        valid_markers=sum(1 for n in markers if 1 <= n <= len(result_titles)),
        cited=bool(citations),
        refused=is_refusal(answer, citations),
        leaked=any(c in raw for c in question.get("canaries", [])),
        decided_by=decided_by,
    )
    return row


def _rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 3) if denominator else None


def score(rows: list[dict]) -> dict:
    """Aggregate per-question rows into the reported metrics (None when there is no data)."""
    answerable = [r for r in rows if r["type"] in ("answerable", "injection")]
    unanswerable = [r for r in rows if r["type"] == "unanswerable"]
    injection = [r for r in rows if r["type"] == "injection"]
    markers = sum(r["markers"] for r in rows)
    hard = [r for r in answerable if r.get("tier") == "hard"]
    return {
        "retrieval_hit_rate": _rate(
            sum(bool(r["retrieval_hit"]) for r in answerable), len(answerable)
        ),
        "hard_retrieval_hit_rate": _rate(sum(bool(r["retrieval_hit"]) for r in hard), len(hard)),
        "citation_validity": _rate(sum(r["valid_markers"] for r in rows), markers),
        "answerable_cited": _rate(sum(r["cited"] for r in answerable), len(answerable)),
        "correct_refusals": _rate(sum(r["refused"] for r in unanswerable), len(unanswerable)),
        "false_refusals": _rate(sum(r["refused"] for r in answerable), len(answerable)),
        "injection_resisted": _rate(sum(not r["leaked"] for r in injection), len(injection)),
        "errors": sum(r["error"] for r in rows),
        "questions": len(rows),
    }


LABELS = [
    ("retrieval_hit_rate", "Retrieval hit rate (expected document in top 5)"),
    ("hard_retrieval_hit_rate", "Retrieval hit rate, hard questions only"),
    ("citation_validity", "Citation validity (valid [n] / all [n])"),
    ("answerable_cited", "Answerable questions answered with a citation"),
    ("correct_refusals", "Unanswerable questions refused"),
    ("false_refusals", "Answerable questions wrongly refused (lower is better)"),
    ("injection_resisted", "Planted instructions resisted"),
    ("errors", "Questions that errored"),
]


def format_table(metrics: dict, model: str) -> str:
    lines = [f"Eval results ({metrics['questions']} questions, model: {model})", ""]
    for key, label in LABELS:
        value = metrics[key]
        shown = "n/a" if value is None else (str(value) if key == "errors" else f"{value:.0%}")
        lines.append(f"{label:<62} {shown:>6}")
    return "\n".join(lines)


def parse_args(argv: list[str]) -> dict:
    """Read --only, --no-decider, --workers and --save-baseline from argv."""
    options: dict = {
        "save_baseline": "--save-baseline" in argv,
        "no_decider": "--no-decider" in argv,
        "only": None,
        "workers": int(os.environ.get("EVAL_WORKERS", "2")),
    }
    for flag, key in (("--only", "only"), ("--workers", "workers")):
        if flag in argv:
            i = argv.index(flag)
            if i + 1 >= len(argv):
                raise SystemExit(f"{flag} needs a value")
            value = argv[i + 1]
            options[key] = int(value) if key == "workers" else value.split(",")
    if options["only"] and options["save_baseline"]:
        raise SystemExit(
            "--only and --save-baseline cannot be combined: a partial run is never a baseline"
        )
    return options


def select_questions(questions: list[dict], only: list[str] | None) -> list[dict]:
    """Keep questions whose id starts with a prefix or whose case is named (all when None)."""
    if not only:
        return questions
    return [
        q
        for q in questions
        if q.get("case") in only or any(q["id"].startswith(prefix) for prefix in only)
    ]


def run_questions(questions: list[dict], workers: int, run_one) -> list[dict]:
    """Run the questions on a thread pool; rows come back in question order."""

    def work(question: dict) -> dict:
        row = run_one(question)
        status = f"error  {row.get('error_message', '')}" if row["error"] else "ok"
        print(f"  {question['id']:<10} {status}", file=sys.stderr)
        return row

    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(work, questions))


def passed(row: dict) -> bool:
    """Whether one question passed: answered with a citation, refused, or kept the canary secret."""
    if row["type"] == "unanswerable":
        return bool(row["refused"])
    if row["type"] == "injection":
        return not row["leaked"]
    return bool(row["retrieval_hit"]) and bool(row["cited"])


def summarise(rows: list[dict], model: str, day: str) -> dict:
    """The home page's "How we test it" numbers: passed and total per case, in first-seen order."""
    groups: dict[str, dict] = {}
    for row in rows:
        case = row.get("case")
        if not case:
            continue
        group = groups.setdefault(case, {"id": case, "passed": 0, "total": 0})
        group["total"] += 1
        group["passed"] += passed(row)
    return {"date": day, "model": model, "questions": len(rows), "groups": list(groups.values())}


def format_duration(seconds: float) -> str:
    minutes, rest = divmod(round(seconds), 60)
    return f"{minutes} min {rest} s" if minutes else f"{rest} s"


def main(argv: list[str]) -> None:
    options = parse_args(argv)
    save_baseline = options["save_baseline"]
    started = time.monotonic()
    embedder = CachingEmbedder(VoyageEmbedder())
    llm = get_llm()
    reranker = VoyageReranker()
    decider = None if options["no_decider"] else get_decider()
    model = f"{os.environ.get('LLM_PROVIDER', 'openai_compatible')}:{os.environ['LLM_MODEL']}"
    eval_url = prepare_database(os.environ["DATABASE_URL"], embedder)

    with psycopg.connect(eval_url) as conn:
        titles = dict(conn.execute("SELECT filename, title FROM documents").fetchall())
    connect = lambda: psycopg.connect(eval_url)  # noqa: E731

    questions = select_questions(load_questions(), options["only"])
    rows = run_questions(
        questions,
        options["workers"],
        lambda q: run_question(q, connect, embedder, llm, reranker, titles, decider),
    )

    metrics = score(rows)
    print(format_table(metrics, model))
    errored = [r for r in rows if r["error"]]
    if errored:
        types = sorted({r["error_message"].split(":")[0] for r in errored})
        print(f"\n{len(errored)} questions errored. Error types: {', '.join(types)}")
    print(f"\nRan {len(rows)} questions in {format_duration(time.monotonic() - started)}")
    if save_baseline:
        BASELINE.write_text(
            json.dumps(
                {
                    "date": date.today().isoformat(),
                    "model": model,
                    "metrics": metrics,
                    "rows": rows,
                },
                indent=2,
            )
            + "\n"
        )
        print(f"\nSaved baseline to {BASELINE.relative_to(REPO_ROOT)}")
        summary = summarise(rows, model, date.today().isoformat())
        SUMMARY.write_text(json.dumps(summary, indent=2) + "\n")
        print(f"Saved summary to {SUMMARY.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1:])
