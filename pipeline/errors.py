"""Failure types. A GuardrailError aborts the run and leaves the last good build in place."""


class GuardrailError(Exception):
    """A check from docs/CUBE_SCHEMA.md failed. The run must not publish."""

    def __init__(self, check: str, detail: str):
        super().__init__(f"[{check}] {detail}")
        self.check = check
        self.detail = detail


class SourceError(Exception):
    """The source service could not be reached or returned an error after retries."""
