"""`run` tried every day: what it builds, what it leaves alone, and what it says when it builds nothing.

The network is replaced by a client whose grouped counts the test sets, so the decision is exercised through `run`
itself. A run that decides not to build must never pull.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from pipeline import fetch
from pipeline.arcgis import Service

from .conftest import make_cfg


class Pulled(Exception):
    """Raised in place of the pull: the run decided to build."""


class FakeClient:
    def __init__(self, cfg, counts: dict[tuple[int, int], int]):
        f = cfg.pipeline["fields"]
        expected = json.loads(cfg.path("expected_schema").read_text(encoding="utf-8"))
        self.layer = {"fields": expected["fields"]}
        self.stats = [{f["registration_year"]: year, f["registration_month"]: month, f["import_status"]: "a",
                       f["vehicle_type"]: "b", "n": n} for (year, month), n in counts.items()]

    def discover(self) -> Service:
        return Service("fixture-item", "search", "FIXTURE", "https://example.invalid/FeatureServer/0", self.layer, [])

    def count(self, layer_url: str) -> int:
        return sum(row["n"] for row in self.stats)

    def grouped_counts(self, layer_url: str, fields: list[str], count_field: str) -> list[dict]:
        return self.stats

    def pull_rows(self, *args) -> int:
        raise Pulled


def at(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day, 13, 20, tzinfo=timezone.utc)


def attempt(monkeypatch, tmp_path, cfg, counts, now, force=False):
    """One run. Returns (exit code or None when it went on to pull, step outputs, summary lines)."""
    output, summary = tmp_path / "output", tmp_path / "summary"
    for path in (output, summary):
        path.write_text("", encoding="utf-8")
    monkeypatch.setattr(fetch, "Client", lambda source_cfg: FakeClient(cfg, counts))
    try:
        code = fetch.run(cfg, force=force, github_output=str(output), now=now, github_summary=str(summary))
    except Pulled:
        code = None
    outputs = dict(line.split("=", 1) for line in output.read_text(encoding="utf-8").splitlines())
    return code, outputs, summary.read_text(encoding="utf-8")


def built_state(cfg, counts, now) -> dict:
    """The state a good build of this source on this day leaves behind, as far as `run` reads it."""
    client = FakeClient(cfg, counts)
    key, _ = fetch.snapshot_and_key(cfg, client.stats, client.count(""), now.date())
    state = {"latest_snapshot": key["snapshot"], "change_key": key}
    cfg.path("state").parent.mkdir(parents=True, exist_ok=True)
    cfg.path("state").write_text(json.dumps(state), encoding="utf-8")
    return state


@pytest.fixture
def cfg(tmp_path, workspace):
    return make_cfg(workspace, raw=tmp_path / "raw")


AUGUST = {(2026, 7): 40, (2026, 8): 50}


def test_first_run_and_a_new_month_build(monkeypatch, tmp_path, cfg):
    code, outputs, _ = attempt(monkeypatch, tmp_path, cfg, AUGUST, at(2026, 9, 4))
    assert code is None and outputs == {"snapshot": "2026-08"}
    built_state(cfg, AUGUST, at(2026, 9, 4))
    september = {**AUGUST, (2026, 8): 49, (2026, 9): 60}
    code, outputs, _ = attempt(monkeypatch, tmp_path, cfg, september, at(2026, 10, 7))
    assert code is None and outputs == {"snapshot": "2026-09"}


def test_an_unchanged_source_is_skipped_every_day_it_is_tried(monkeypatch, tmp_path, cfg):
    built_state(cfg, AUGUST, at(2026, 9, 4))
    for day in (5, 6, 30):
        code, outputs, summary = attempt(monkeypatch, tmp_path, cfg, AUGUST, at(2026, 9, day))
        assert code == 0 and outputs["built"] == "false"
        assert summary == "Source unchanged since the last good build (snapshot 2026-08-31); nothing to do.\n"


def test_a_source_that_changes_after_its_month_was_built_is_reported_and_not_rebuilt(monkeypatch, tmp_path, cfg):
    built_state(cfg, AUGUST, at(2026, 9, 4))
    edited = {**AUGUST, (2026, 8): 53}
    code, outputs, summary = attempt(monkeypatch, tmp_path, cfg, edited, at(2026, 9, 20))
    assert code == 0 and outputs["built"] == "false"
    assert "changed after snapshot 2026-08 was built: 90 rows then, 93 now" in summary and "force" in summary
    code, outputs, summary = attempt(monkeypatch, tmp_path, cfg, edited, at(2026, 9, 20), force=True)
    assert code is None and "built" not in outputs and summary == ""


def test_a_forced_run_rebuilds_an_unchanged_source(monkeypatch, tmp_path, cfg):
    built_state(cfg, AUGUST, at(2026, 9, 4))
    code, _, _ = attempt(monkeypatch, tmp_path, cfg, AUGUST, at(2026, 9, 5), force=True)
    assert code is None


def test_the_cap_moving_on_the_first_of_a_month_is_not_a_changed_source(monkeypatch, tmp_path, cfg):
    # Rows dated after the snapshot month: on the first of the next month the cap passes them and the snapshot the
    # key names moves forward, though the register is the one already built.
    with_later_rows = {**AUGUST, (2026, 9): 2}
    state = built_state(cfg, with_later_rows, at(2026, 9, 4))
    assert state["latest_snapshot"] == "2026-08-31"
    code, outputs, summary = attempt(monkeypatch, tmp_path, cfg, with_later_rows, at(2026, 10, 1))
    assert code == 0 and outputs == {"snapshot": "2026-09", "built": "false"}
    assert "Source unchanged since the last good build (snapshot 2026-08-31)" in summary
