"""Locks the cube contract (docs/CUBE_SCHEMA.md): slice schemas, slice contents, the manifest, events.json and reconciliation.json.

Regenerate deliberately with UPDATE_GOLDEN=1 and review the diff: a golden change is a contract change.

The build reads a frozen events file (fixtures/events.csv), not data/reference/events.csv. Adding an event is a one-row
data edit (design invariant 3), but events.json counts towards payload_bytes, so building from the live file would make
every new event a contract change. The live file is still validated by every guardrail test's build.

The same holds for the two published-figures files (D-149): the build reads frozen copies (fixtures/published_sources.csv and
fixtures/published_figures.csv, made-up rows the fixture cube can answer), not data/reference/. reconciliation.json holds a
row for every published figure, so building from the live files would make each month's new rows a contract change, and the
live rows name months, models and datasets this small cube does not have. The live files are still read and validated by every
other test's build, and test_reconcile.py holds the step's own behaviour.
"""

from __future__ import annotations

import csv
import json
import os
import shutil

import duckdb

from pipeline import build, config
from pipeline.contract import (ASSOCIATIONS_DIR, FACT_COUNT, FACT_DIMENSION_TYPE, FACT_MONTH, FACTS_DIR, NARROW_DIR, NOT_BROKEN_DOWN, PAIR_COLUMNS,
                               PAIR_SEPARATOR, SLICE_COLUMNS)

from .conftest import FIXTURES, GOLDEN, NOW, load_rows, make_cfg, source_for, write_pages

GOLDEN_FILE = GOLDEN / "contract.json"


def frozen_reference(tmp_path):
    """The reference files with events.csv and the two published-figures files replaced by the frozen fixtures."""
    live = config.load()
    reference = tmp_path / "reference"
    shutil.copytree(live.reference("x").parent, reference)
    shutil.copyfile(FIXTURES / "events.csv", reference / live.pipeline["events"]["file"])
    for key in ("figures_file", "sources_file"):
        shutil.copyfile(FIXTURES / live.pipeline["reconciliation"][key], reference / live.pipeline["reconciliation"][key])
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
    reconciliation = json.loads((public / manifest["reconciliation"]["file"]).read_text(encoding="utf-8"))
    contract = {"manifest": manifest, "slices": {}, "pairs": {}, "facts": {}, "associations": {}, "events": events,
                "reconciliation": reconciliation}
    for kind, folder in (("slices", "cube"), ("pairs", "pairs"), ("facts", FACTS_DIR)):
        for path in sorted((public / folder).rglob("*.parquet")):
            contract[kind][path.relative_to(public / folder).as_posix()] = read_slice(path)
    for path in sorted((public / ASSOCIATIONS_DIR).glob("*.json")):
        contract["associations"][path.name] = json.loads(path.read_text(encoding="utf-8"))
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
    assert contract["associations"] == expected["associations"]
    assert contract["reconciliation"] == expected["reconciliation"]
    # The fixture rows are there so the golden locks the shape of a row of each status this cube can produce.
    rows = contract["reconciliation"]["rows"]
    assert {r["status"] for r in rows} >= {"pass", "warn", "not_compared"}
    assert {r["reason_kind"] for r in rows if r["status"] == "not_compared"} >= {"month_not_held", "dataset_not_built", "value_not_held"}


def test_every_slice_has_the_contract_schema_and_order(tmp_path, workspace):
    contract, _ = built_contract(tmp_path, workspace)
    assert contract["slices"], "no slices were written"
    protected = {f"{dataset}/{dim}.parquet" for dataset, info in contract["manifest"]["datasets"].items()
                 for dim in info.get("small_cells", {})}
    # The slices a protected pair stands on carry no fuel figure on any row (D-135), read from the manifest's pair names.
    no_fuel = {f"{dataset}/{dim}.parquet" for dataset, info in contract["manifest"]["datasets"].items()
               for pair in info.get("small_cell_pairs", {}) for dim in pair.split(PAIR_SEPARATOR)}
    assert no_fuel, "no protected pair was built"
    for name, doc in contract["slices"].items():
        assert doc["schema"] == [list(c) for c in SLICE_COLUMNS], name
        keys = [(r[0], r[1]) for r in doc["rows"]]
        assert keys == sorted(keys), f"{name} is not sorted by month, dim_value"
        totals = {}
        for month, value, n, denominator, fc_sum, fc_n, fc_eligible_n in doc["rows"]:
            if name in protected and n is None:
                # A cell hidden by the small-cell rule (D-127): its counts and the fuel counts that bound them are null.
                assert fc_sum is None and fc_n is None and fc_eligible_n is None, (name, month, value)
                continue
            totals.setdefault(month, [0, denominator])[0] += n
            if name in no_fuel:
                assert fc_sum is None and fc_n is None and fc_eligible_n is None, (name, month, value)
                continue
            if name in protected and value == NOT_BROKEN_DOWN:
                assert fc_sum is None and fc_n is None and fc_eligible_n is None, (name, month)
                continue
            assert fc_n <= fc_eligible_n <= n
            assert (fc_sum is None) == (fc_n == 0)
        if name in protected:
            # Hidden cells are missing from the sum, so it cannot exceed the month's total; the rule itself is held by
            # test_small_cells_build.py and by the build's own read-back.
            assert all(total <= denominator for total, denominator in totals.values()), f"{name}: n adds up to more than the denominator"
        else:
            assert all(total == denominator for total, denominator in totals.values()), f"{name}: n does not sum to denominator"


def test_every_pair_has_the_contract_schema_and_adds_up_to_both_of_its_slices(tmp_path, workspace):
    contract, extra = built_contract(tmp_path, workspace)
    assert contract["pairs"], "no pair slices were written"
    protected = {f"{dataset}/{key}.parquet" for dataset, info in contract["manifest"]["datasets"].items()
                 for key in info.get("small_cell_pairs", {})}
    for name, doc in contract["pairs"].items():
        assert doc["schema"] == [list(c) for c in PAIR_COLUMNS], name
        keys = [(r[0], r[1], r[2]) for r in doc["rows"]]
        assert keys == sorted(keys), f"{name} is not sorted by month, a_value, b_value"
        dataset, file = name.split("/")
        dims = file[: -len(".parquet")].split(PAIR_SEPARATOR)
        if name in protected:
            # A pair held to the rule for a table of two fields (D-135): a hidden cell has no counts, and a period that is not
            # broken down is one row with the reserved value in both columns. What is visible never exceeds either slice's
            # count for its value; the rule itself is held by test_pair_cells.py and by the build's own read-back.
            for month, a_value, b_value, n, denominator, fc_sum, fc_n, fc_eligible_n in doc["rows"]:
                assert fc_sum is None and fc_n is None and fc_eligible_n is None, (name, month, a_value, b_value)
                if a_value == NOT_BROKEN_DOWN:
                    assert b_value == NOT_BROKEN_DOWN and n == denominator, (name, month)
                    assert sum(1 for r in doc["rows"] if r[0] == month) == 1, (name, month)
            for side, dim in enumerate(dims):
                single = {(r[0], r[1]): r for r in contract["slices"][f"{dataset}/{dim}.parquet"]["rows"]}
                summed = {}
                for month, a_value, b_value, n, denominator, *_rest in doc["rows"]:
                    if (a_value, b_value)[side] != NOT_BROKEN_DOWN:
                        summed[(month, (a_value, b_value)[side])] = summed.get((month, (a_value, b_value)[side]), 0) + (n or 0)
                for key, visible in summed.items():
                    assert single[key][2] is None or visible <= single[key][2], (name, key)
            continue
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
        if "not_built" in info:
            assert not any(k.startswith(f"{dataset}/") for kind in ("slices", "pairs", "facts") for k in contract[kind]), dataset
            continue
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


def check_fact_table(contract, dataset, info, prefix, table) -> None:
    """One fact table's files (`prefix` is the folder in the contract's file names) against its manifest entry `table`: one
    column per file, the same rows in the same order, the dataset's totals, and every slice when summed over the others."""
    files = {k[len(prefix):-len(".parquet")]: doc for k, doc in contract["facts"].items()
             if k.startswith(prefix) and "/" not in k[len(prefix):]}
    names = [FACT_MONTH[0], *table["dimensions"], FACT_COUNT[0]]
    assert sorted(files) == sorted(names), prefix
    types = {FACT_MONTH[0]: FACT_MONTH[1], FACT_COUNT[0]: FACT_COUNT[1]}
    for name, doc in files.items():
        assert doc["schema"] == [[name, types.get(name, FACT_DIMENSION_TYPE)]], name
        assert len(doc["rows"]) == table["rows"], name
    rows = list(zip(*([r[0] for r in files[name]["rows"]] for name in names)))
    keys = [row[:-1] for row in rows]
    assert keys == sorted(keys) and len(set(keys)) == len(keys), f"{prefix}: rows are not unique and in order"
    assert sum(row[-1] for row in rows) == info["rows"]
    for position, dim in enumerate(table["dimensions"], start=1):
        summed = {}
        for row in rows:
            summed[(row[0], row[position])] = summed.get((row[0], row[position]), 0) + row[-1]
        single = {(r[0], r[1]): r[2] for r in contract["slices"][f"{dataset}/{dim}.parquet"]["rows"]}
        assert summed == single, f"{prefix}: the fact table summed over {dim} differs from its slice"


def test_the_fact_table_is_one_column_per_file_and_adds_up_to_every_slice(tmp_path, workspace):
    contract, _ = built_contract(tmp_path, workspace)
    assert contract["facts"], "no fact table was written"
    narrow_seen = 0
    for dataset, info in contract["manifest"]["datasets"].items():
        if "not_built" in info:
            continue
        facts = info["facts"]
        if facts is None:
            assert not [k for k in contract["facts"] if k.startswith(f"{dataset}/")], f"{dataset} has fact table files but no facts in its manifest entry"
            continue
        check_fact_table(contract, dataset, info, f"{dataset}/", facts)
        # A narrow table (D-144) is held to the same rules, and only the tables the manifest lists exist.
        listed = facts.get("narrow", {})
        on_disk = {k.split("/")[2] for k in contract["facts"] if k.startswith(f"{dataset}/{NARROW_DIR}/")}
        assert on_disk == set(listed), dataset
        for table_id, table in listed.items():
            check_fact_table(contract, dataset, info, f"{dataset}/{NARROW_DIR}/{table_id}/", table)
            narrow_seen += 1
    assert narrow_seen, "no narrow table was written, so the check proved nothing"
