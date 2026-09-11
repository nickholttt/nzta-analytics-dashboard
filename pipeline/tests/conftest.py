"""Shared test harness. Fixture data lives in JSON files, never in .py files (design invariant #1)."""

from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from pipeline import config

HERE = Path(__file__).parent
FIXTURES = HERE / "fixtures"
GOLDEN = HERE / "golden"
NOW = datetime(2026, 9, 11, tzinfo=timezone.utc)


def load_rows() -> list[dict]:
    return json.loads((FIXTURES / "rows.json").read_text(encoding="utf-8"))


def write_pages(directory: Path, rows: list[dict]) -> str:
    """Two pages in the service's response shape, so ingestion is exercised exactly as in production."""
    directory.mkdir(parents=True, exist_ok=True)
    half = len(rows) // 2
    for index, chunk in enumerate((rows[:half], rows[half:])):
        page = {"objectIdFieldName": "fixture", "features": [{"attributes": r} for r in chunk], "exceededTransferLimit": False}
        (directory / f"page_{index}.json").write_text(json.dumps(page), encoding="utf-8")
    return (directory / "*.json").as_posix()


def source_for(rows: list[dict]) -> dict:
    source = json.loads((FIXTURES / "source.json").read_text(encoding="utf-8"))
    source["row_count"] = len(rows)
    source["change_key"]["row_count"] = len(rows)
    return source


@pytest.fixture
def workspace(tmp_path) -> dict:
    return {
        "staging": tmp_path / "staging",
        "public": tmp_path / "public",
        "state": tmp_path / "state" / "last_good.json",
        "snapshots": tmp_path / "snapshots",
    }


def make_cfg(workspace: dict, **extra) -> config.Config:
    overrides = {k: str(v) for k, v in {**workspace, **extra}.items()}
    return config.load(overrides=overrides)


def with_dimension_change(cfg: config.Config, dim_id: str, **changes) -> config.Config:
    dims = copy.deepcopy(cfg.dimensions)
    for dim in dims["dimensions"]:
        if dim["id"] == dim_id:
            for key, value in changes.items():
                dim["derive"][key] = value
    cfg.dimensions = dims
    return cfg
