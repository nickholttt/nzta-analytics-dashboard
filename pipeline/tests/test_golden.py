"""Locks the cube contract (docs/CUBE_SCHEMA.md): slice schemas, slice contents, the manifest and events.json.

Regenerate deliberately with UPDATE_GOLDEN=1 and review the diff: a golden change is a contract change.

The build reads a frozen events file (fixtures/events.csv), not data/reference/events.csv. Adding an event is a one-row
data edit (design invariant 3), but events.json counts towards payload_bytes, so building from the live file would make
every new event a contract change. The live file is still validated by every guardrail test's build.
"""

from __future__ import annotations

import csv
import json
import os
import shutil

import duckdb

from pipeline import build, config
from pipeline.contract import (FACT_COUNT, FACT_DIMENSION_TYPE, FACT_MONTH, FACTS_DIR, PAIR_COLUMNS, PAIR_SEPARATOR,
                               SLICE_COLUMNS)

from .conftest import FIXTURES, GOLDEN, NOW, load_rows, make_cfg, source_for, write_pages

GOLDEN_FILE = GOLDEN / "contract.json"


def frozen_reference(tmp_path):
    """The reference files with events.csv replaced by the frozen fixture."""
    live = config.load()
    reference = tmp_path / "reference"
    shutil.copytree(live.reference("x").parent, reference)
    shutil.copyfile(FIXTURES / "events.csv", reference / live.pipeline["events"]["file"])
    return reference


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
    cfg = make_cfg(workspace, reference_dir=frozen_reference(tmp_path))
    build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    public = workspace["public"]
    # payload_bytes is compared too: it changes with DuckDB's Parquet layout, so a DuckDB upgrade needs a deliberate golden
    # update, and a change in what the site downloads never passes unnoticed.
    manifest = json.loads((public / "manifest.json").read_text(encoding="utf-8"))
    events = json.loads((public / "events.json").read_text(encoding="utf-8"))
    contract = {"manifest": manifest, "slices": {}, "pairs": {}, "facts": {}, "events": events}
    for kind, folder in (("slices", "cube"), ("pairs", "pairs"), ("facts", FACTS_DIR)):
        for path in sorted((public / folder).rglob("*.parquet")):
            contract[kind][path.relative_to(public / folder).as_posix()] = read_slice(path)
    return contract, {"events": events, "cfg": cfg}


def test_cube_matches_golden(tmp_path, workspace):
    contract, _ = built_contract(tmp_path, workspace)
    if os.environ.get("UPDATE_GOLDEN") == "1":
        GOLDEN.mkdir(exist_ok=True)
        GOLDEN_FILE.write_text(json.dumps(contract, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    expected = json.loads(GOLDEN_FILE.read_text(encoding="utf-8"))
    assert contract["manifest"] == expected["manifest"]
    assert contract["events"] == expected["events"]
    for kind in ("slices", "pairs", "facts"):
        assert sorted(contract[kind]) == sorted(expected[kind]), kind
        for name, doc in expected[kind].items():
            assert contract[kind][name] == doc, name


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


def test_every_pair_has_the_contract_schema_and_adds_up_to_both_of_its_slices(tmp_path, workspace):
    contract, extra = built_contract(tmp_path, workspace)
    assert contract["pairs"], "no pair slices were written"
    for name, doc in contract["pairs"].items():
        assert doc["schema"] == [list(c) for c in PAIR_COLUMNS], name
        keys = [(r[0], r[1], r[2]) for r in doc["rows"]]
        assert keys == sorted(keys), f"{name} is not sorted by month, a_value, b_value"
        dataset, file = name.split("/")
        dims = file[: -len(".parquet")].split(PAIR_SEPARATOR)
        step = 10 ** -int(extra["cfg"].pipeline["fuel_consumption"]["sum_decimals"])
        for side, dim in enumerate(dims):
            summed = {}
            for month, a_value, b_value, n, denominator, fc_sum, fc_n, fc_eligible_n in doc["rows"]:
                assert fc_n <= fc_eligible_n <= n
                assert (fc_sum is None) == (fc_n == 0)
                total = summed.setdefault((month, (a_value, b_value)[side]), [0, denominator, 0.0, 0, 0, 0])
                total[0] += n
                total[2] += fc_sum or 0.0
                total[3] += fc_n
                total[4] += fc_eligible_n
                total[5] += 1
            single = {(r[0], r[1]): r for r in contract["slices"][f"{dataset}/{dim}.parquet"]["rows"]}
            assert sorted(summed) == sorted(single), f"{name} over {dim}: different months or values from its slice"
            for key, (n, denominator, fc_sum, fc_n, fc_eligible_n, parts) in summed.items():
                _, _, one_n, one_denominator, one_fc_sum, one_fc_n, one_fc_eligible_n = single[key]
                assert (n, denominator, fc_n, fc_eligible_n) == (one_n, one_denominator, one_fc_n, one_fc_eligible_n), (name, key)
                # Each part's fuel sum is rounded on its own, so the parts may differ from the rounded whole by half a
                # step each, and the whole by half a step more.
                assert abs(fc_sum - (one_fc_sum or 0.0)) <= step * (parts + 1) / 2 + 1e-9, (name, key)


def test_live_dimensions_match_files_and_events_are_verified_only(tmp_path, workspace):
    contract, extra = built_contract(tmp_path, workspace)
    for dataset, info in contract["manifest"]["datasets"].items():
        files = sorted(k.split("/")[1][: -len(".parquet")] for k in contract["slices"] if k.startswith(f"{dataset}/"))
        assert files == sorted(info["live_dimensions"])
        pairs = sorted(k.split("/")[1][: -len(".parquet")] for k in contract["pairs"] if k.startswith(f"{dataset}/"))
        assert pairs == sorted(info["live_pairs"])
        if info["facts"]:
            assert set(info["facts"]["dimensions"]) <= set(info["live_dimensions"])
    cfg = extra["cfg"]
    e = cfg.pipeline["events"]
    with cfg.reference(e["file"]).open(encoding="utf-8", newline="") as fh:
        verified = {r["id"] for r in csv.DictReader(fh) if r[e["verified_column"]] == cfg.pipeline["boolean_true"]}
    assert {x["id"] for x in extra["events"]} == verified
    assert all(e["verified_column"] not in x for x in extra["events"])
    assert all(column not in x for x in extra["events"] for column in e["unpublished_columns"])


def test_the_fact_table_is_one_column_per_file_and_adds_up_to_every_slice(tmp_path, workspace):
    contract, _ = built_contract(tmp_path, workspace)
    assert contract["facts"], "no fact table was written"
    for dataset, info in contract["manifest"]["datasets"].items():
        facts = info["facts"]
        names = [FACT_MONTH[0], *facts["dimensions"], FACT_COUNT[0]]
        files = {k.split("/")[1][: -len(".parquet")]: doc for k, doc in contract["facts"].items() if k.startswith(f"{dataset}/")}
        assert sorted(files) == sorted(names), dataset
        types = {FACT_MONTH[0]: FACT_MONTH[1], FACT_COUNT[0]: FACT_COUNT[1]}
        for name, doc in files.items():
            assert doc["schema"] == [[name, types.get(name, FACT_DIMENSION_TYPE)]], name
            assert len(doc["rows"]) == facts["rows"], name
        rows = list(zip(*([r[0] for r in files[name]["rows"]] for name in names)))
        keys = [row[:-1] for row in rows]
        assert keys == sorted(keys) and len(set(keys)) == len(keys), f"{dataset}: rows are not unique and in order"
        assert sum(row[-1] for row in rows) == info["rows"]
        for position, dim in enumerate(facts["dimensions"], start=1):
            summed = {}
            for row in rows:
                summed[(row[0], row[position])] = summed.get((row[0], row[position]), 0) + row[-1]
            single = {(r[0], r[1]): r[2] for r in contract["slices"][f"{dataset}/{dim}.parquet"]["rows"]}
            assert summed == single, f"{dataset}: the fact table summed over {dim} differs from its slice"
