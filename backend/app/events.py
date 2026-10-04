import json
from typing import Any, Literal

from pydantic import BaseModel


class StepEvent(BaseModel):
    """One event in a streamed response. Shared by /upload and /ask."""

    step: str
    status: Literal["start", "done"]
    data: dict[str, Any] | None = None

    def to_line(self) -> str:
        """Serialize as one line of newline-delimited JSON."""
        return json.dumps(self.model_dump(exclude_none=True), separators=(",", ":")) + "\n"


class DeltaEvent(BaseModel):
    """A piece of the answer text as it is written. Only /ask sends these."""

    step: Literal["answer"] = "answer"
    delta: str

    def to_line(self) -> str:
        return json.dumps(self.model_dump(), separators=(",", ":")) + "\n"
