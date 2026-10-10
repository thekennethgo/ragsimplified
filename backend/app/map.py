"""The vector map: chunk vectors flattened to 2-D with PCA so similar chunks sit near each other.

The projection is fitted once, by `make seed`, over every library chunk. Questions and pasted
texts are projected with the stored projection, so they land on the same map without refitting.
"""

import os
from collections.abc import Iterator
from dataclasses import dataclass

import numpy as np
import psycopg
from fastapi import APIRouter, Depends
from pydantic import BaseModel

router = APIRouter()


@dataclass(frozen=True)
class Projection:
    mean: np.ndarray  # shape (dimension,)
    components: np.ndarray  # shape (2, dimension): the first two principal components

    def project(self, vectors: list[list[float]]) -> list[dict[str, float]]:
        """Map vectors to {x, y} points, rounded to keep responses small."""
        if not len(vectors):
            return []
        flat = (np.asarray(vectors, dtype=float) - self.mean) @ self.components.T
        return [{"x": round(float(x), 5), "y": round(float(y), 5)} for x, y in flat]


def fit_projection(vectors: np.ndarray) -> Projection:
    """Fit a 2-D PCA: centre the vectors, then keep the two directions of greatest spread.

    Each component's sign is fixed (its largest entry is positive) so refitting the same data
    always gives the same map. With fewer than two directions of spread the missing ones are zero.
    """
    mean = vectors.mean(axis=0)
    _, _, directions = np.linalg.svd(vectors - mean, full_matrices=False)
    components = np.zeros((2, vectors.shape[1]))
    for i, direction in enumerate(directions[:2]):
        sign = 1.0 if direction[np.argmax(np.abs(direction))] >= 0 else -1.0
        components[i] = sign * direction
    return Projection(mean, components)


def build_map(conn: psycopg.Connection) -> int:
    """Fit the projection over every library chunk and store it with each chunk's point.

    Replaces the previous map. Returns the number of chunks mapped (0 leaves no map).
    """
    rows = conn.execute("SELECT id, embedding::real[] FROM chunks ORDER BY id").fetchall()
    conn.execute("DELETE FROM map_points")
    conn.execute("DELETE FROM map_projection")
    if not rows:
        return 0
    ids = [row[0] for row in rows]
    vectors = np.array([row[1] for row in rows], dtype=float)
    projection = fit_projection(vectors)
    conn.execute(
        "INSERT INTO map_projection (id, mean, pc1, pc2) VALUES (1, %s, %s, %s)",
        (
            projection.mean.tolist(),
            projection.components[0].tolist(),
            projection.components[1].tolist(),
        ),
    )
    points = projection.project(vectors.tolist())
    with conn.cursor() as cursor:
        cursor.executemany(
            "INSERT INTO map_points (chunk_id, x, y) VALUES (%s, %s, %s)",
            [(cid, p["x"], p["y"]) for cid, p in zip(ids, points)],
        )
    return len(ids)


def load_projection(conn: psycopg.Connection) -> Projection | None:
    row = conn.execute("SELECT mean, pc1, pc2 FROM map_projection WHERE id = 1").fetchone()
    if row is None:
        return None
    mean, pc1, pc2 = row
    return Projection(np.array(mean, dtype=float), np.array([pc1, pc2], dtype=float))


def get_projection() -> Projection | None:
    """The stored projection, or None when there is no map yet or the database is unreachable.

    The map is an extra: /ask and /upload still work without it.
    """
    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    try:
        with psycopg.connect(url) as conn:
            return load_projection(conn)
    except psycopg.Error:
        return None


class MapPoint(BaseModel):
    chunk_id: int
    document_id: int
    title: str
    position: int
    heading: str | None
    x: float
    y: float


def _conn() -> Iterator[psycopg.Connection]:
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        yield conn


@router.get("/map")
def get_map(conn: psycopg.Connection = Depends(_conn)) -> list[MapPoint]:
    rows = conn.execute(
        "SELECT p.chunk_id, d.id, d.title, c.position, c.heading, p.x, p.y "
        "FROM map_points p JOIN chunks c ON c.id = p.chunk_id "
        "JOIN documents d ON d.id = c.document_id ORDER BY p.chunk_id"
    ).fetchall()
    return [
        MapPoint(
            chunk_id=cid, document_id=did, title=title, position=position, heading=heading, x=x, y=y
        )
        for cid, did, title, position, heading, x, y in rows
    ]
