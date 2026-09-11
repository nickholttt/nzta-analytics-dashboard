"""Locks the cube contract (docs/CUBE_SCHEMA.md): slice schemas, slice contents and the manifest.

Regenerate deliberately with UPDATE_GOLDEN=1 and review the diff: a golden change is a contract change.
"""

from __future__ import annotations

import csv
import json
import os

import duckdb

from pipeline import build, config
from pipeline.contract import SLICE_COLUMNS

from .conftest import GOLDEN, NOW, load_rows, make_cfg, source_for, write_pages

GOLDEN_FILE = GOLDEN / "contract.json"


def read_slice(path) -> dict:
    con = duckdb.connect()
    target = f"read_parquet('{path.as_posix()}')"
    schema = [[name, typ] for name, typ, *_ in con.execute(f"DESCRIBE SELECT * FROM {target}").fetchall()]
    rows = [[v.isoformat() if hasattr(v, "isoformat") else v for v in row]
            for row in con.execute(f"SELECT * FROM {target}").fetchall()]
    con.close()
    return {"schema": schema, "rows": rows}


def built_contract(tmp_path, workspace) -> tuple[dict, dict]:
    rows = load_rows()
    cfg = make_cfg(workspace)
    build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    public = workspace["public"]
    manifest = json.loads((public / "manifest.json").read_text(encoding="utf-8"))
    manifest.pop("payload_bytes")  # depends on the parquet writer's byte layout, not on the contract
    contract = {"manifest": manifest, "slices": {}}
    for path in sorted((public / "cube").rglob("*.parquet")):
        contract["slices"][path.relative_to(public / "cube").as_posix()] = read_slice(path)
    events = json.loads((public / "events.json").read_text(encoding="utf-8"))
    return contract, {"events": events, "cfg": cfg}


def test_cube_matches_golden(tmp_path, workspace):
    contract, _ = built_contract(tmp_path, workspace)
    if os.environ.get("UPDATE_GOLDEN") == "1":
        GOLDEN.mkdir(exist_ok=True)
        GOLDEN_FILE.write_text(json.dumps(contract, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    expected = json.loads(GOLDEN_FILE.read_text(encoding="utf-8"))
    assert contract["manifest"] == expected["manifest"]
    assert sorted(contract["slices"]) == sorted(expected["slices"])
    for name, doc in expected["slices"].items():
        assert contract["slices"][name] == doc, name


def test_every_slice_has_the_contract_schema_and_order(tmp_path, workspace):
    contract, _ = built_contract(tmp_path, workspace)
    assert contract["slices"], "no slices were written"
    for name, doc in contract["slices"].items():
        assert doc["schema"] == [list(c) for c in SLICE_COLUMNS], name
        keys = [(r[0], r[1]) for r in doc["rows"]]
        assert keys == sorted(keys), f"{name} is not sorted by month, dim_value"
        totals = {}
        for month, _, n, denominator, fc_sum, fc_n, fc_eligible_n in doc["rows"]:
            totals.setdefault(month, [0, denominator])[0] += n
            assert fc_n <= fc_eligible_n <= n
            assert (fc_sum is None) == (fc_n == 0)
        assert all(total == denominator for total, denominator in totals.values()), f"{name}: n does not sum to denominator"


def test_live_dimensions_match_files_and_events_are_verified_only(tmp_path, workspace):
    contract, extra = built_contract(tmp_path, workspace)
    for dataset, info in contract["manifest"]["datasets"].items():
        files = sorted(k.split("/")[1][: -len(".parquet")] for k in contract["slices"] if k.startswith(f"{dataset}/"))
        assert files == sorted(info["live_dimensions"])
    cfg = extra["cfg"]
    e = cfg.pipeline["events"]
    with cfg.reference(e["file"]).open(encoding="utf-8", newline="") as fh:
        verified = {r["id"] for r in csv.DictReader(fh) if r[e["verified_column"]] == cfg.pipeline["boolean_true"]}
    assert {x["id"] for x in extra["events"]} == verified
    assert all(e["verified_column"] not in x for x in extra["events"])
