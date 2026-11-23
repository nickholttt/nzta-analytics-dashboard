"""Shared test harness. Fixture data lives in JSON files, never in .py files (design invariant #1)."""

from __future__ import annotations

import atexit
import copy
import json
import shutil
import tempfile
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
        # No test reads a store a maintainer has supplied on this computer.
        "supplied": tmp_path / "supplied",
    }


_FROZEN_REFERENCE: list[Path] = []


def frozen_published_reference() -> Path:
    """The live reference folder with the two published-figures files header-only. A test builds a cube of a few fixture
    vehicles, and the live rows (data/reference/published_figures.csv) are real figures for real months: set beside a fixture
    cube they would be hundreds of times its size, and the hard limit (D-149) would stop every build that has a dataset those
    rows name. test_reconcile.py holds the step's own behaviour, and the live files are validated by its own test."""
    if not _FROZEN_REFERENCE:
        live = config.load()
        folder = Path(tempfile.mkdtemp(prefix="reference-"))
        atexit.register(shutil.rmtree, folder, ignore_errors=True)
        shutil.copytree(live.reference("x").parent, folder, dirs_exist_ok=True)
        for key in ("figures_file", "sources_file"):
            name = live.pipeline["reconciliation"][key]
            header = live.reference(name).read_text(encoding="utf-8").splitlines()[0]
            (folder / name).write_text(header + "\n", encoding="utf-8", newline="\n")
        _FROZEN_REFERENCE.append(folder)
    return _FROZEN_REFERENCE[0]


def make_cfg(workspace: dict, **extra) -> config.Config:
    if "reference_dir" not in extra and "reference_dir" not in workspace:
        extra["reference_dir"] = frozen_published_reference()
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
