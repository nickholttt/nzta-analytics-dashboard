"""The associations file: how strongly each pair of a dataset's dimensions moves together (pipeline/association.py).

The formula is held to tables worked by hand; a whole build is held to figures recomputed in this file from the fact
table's own files by a longer route (every cell, empty ones included); the guards (a V outside 0 to 1, a missing pair,
an owner dimension in a pair) are each shown to stop a build. No dimension, field or value is named here except as
config or the build names it (design invariant 1).
"""

from __future__ import annotations

import itertools
import json
import math
import random
from datetime import date
from types import SimpleNamespace

import duckdb
import pytest

from pipeline import association, config, privacy
from pipeline.contract import ASSOCIATIONS_DIR, FACT_COUNT, FACT_MONTH, FACTS_DIR, OTHER, UNDEFINED, UNMAPPED

from .conftest import load_rows, make_cfg, source_for
from .test_flow import HISTORY, supply
from .test_guardrails import expect_abort, run

DATASET = "registrations_surviving"
FLOW = "registrations_flow"


# --- the formula --------------------------------------------------------------------------------------------------


def table(rows: list[list[int]]):
    return [(f"r{i}", f"c{j}", n) for i, row in enumerate(rows) for j, n in enumerate(row) if n > 0]


def test_a_two_by_two_table_worked_by_hand():
    # [[30, 10], [10, 30]]: N = 80, every expected count 20, chi2 = 4 * 10^2 / 20 = 20, phi2 = 1/4.
    # phi2c = 1/4 - 1/79; r~ = c~ = 2 - 1/79, so min(r~, c~) - 1 = 78/79; V^2 = (1/4 - 1/79) / (78/79) = 18.75 / 78 = 25 / 104.
    found = association.cramers_v(table([[30, 10], [10, 30]]))
    assert found.v == pytest.approx(5 / math.sqrt(104), abs=1e-12)
    assert round(found.v, 4) == 0.4903
    assert (found.vehicles, found.values_a, found.values_b) == (80, 2, 2)


def test_a_two_by_three_table_worked_by_hand():
    # [[6, 2, 2], [2, 6, 2]]: N = 20, row totals 10, column totals 8, 8, 4; chi2 = 2 + 2 = 4, phi2 = 1/5.
    # phi2c = 1/5 - 2/19 = 1.8/19; r~ = 2 - 1/19, c~ = 3 - 4/19, so the smaller less one is 18/19; V^2 = 1.8 / 18 = 1/10.
    found = association.cramers_v(table([[6, 2, 2], [2, 6, 2]]))
    assert found.v == pytest.approx(math.sqrt(0.1), abs=1e-12)
    assert (found.vehicles, found.values_a, found.values_b) == (20, 2, 3)


def test_one_decides_the_other_is_one_and_no_association_is_zero():
    assert association.cramers_v(table([[10, 0], [0, 10]])).v == pytest.approx(1.0, abs=1e-12)
    assert association.cramers_v(table([[10, 10], [10, 10]])).v == 0.0


@pytest.mark.parametrize("cells", [[], [("r", "c", 1)], [("r", "c", 40)], [("r", "c", 20), ("r", "d", 20)],
                                   [("r", "c", 20), ("s", "c", 20)]])
def test_a_side_with_one_value_or_fewer_than_two_vehicles_has_no_v_but_keeps_its_counts(cells):
    found = association.cramers_v(cells)
    assert found.v is None
    assert found.vehicles == sum(n for *_, n in cells)


def test_v_stays_between_zero_and_one_on_random_tables():
    generator = random.Random(7)
    for _ in range(300):
        rows, columns = generator.randint(2, 7), generator.randint(2, 7)
        cells = table([[generator.choice([0, 0, 1, 2, 5, 40]) for _ in range(columns)] for _ in range(rows)])
        found = association.cramers_v(cells)
        assert found.v is None or 0.0 <= found.v <= 1.0 + 1e-12, (found, cells)


# --- the pairs that are not findings, read from config ---------------------------------------------------------------


def synthetic(rolls: list, listed: list, dims: dict):
    """A config and a data map over invented names: `dims` maps a dimension id to the logical fields its derive block mentions
    (one field is a lookup of it, several are a range lookup); `rolls` is (field, target) and `listed` is (a, b, basis)."""
    logical = {f: f.upper() for fields in dims.values() for f in fields}

    def derive(fields):
        return {"kind": "lookup", "field": fields[0]} if len(fields) == 1 else {"kind": "range_lookup", "keys": {f: f for f in fields}}

    cfg = SimpleNamespace(pipeline={"fields": logical},
                          dimensions={"dimensions": [{"id": i, "derive": derive(fields)} for i, fields in dims.items()]})
    entries = [{"name": name, "source": "register", "bound": field,
                "relations": {"rolls_up_to": [{"to": t, "via": None, "holds_on": "by_construction"} for f, t in rolls if f == name]}}
               for field, name in logical.items()]
    dmap = {"fields": entries, "moves_together": {"true_by_definition": [{"a": a, "b": b, "basis": basis} for a, b, basis in listed]}}
    return cfg, dmap


def test_a_roll_up_a_listed_pair_and_a_shared_field_are_each_marked_and_a_finding_is_not():
    cfg, dmap = synthetic(
        rolls=[("A", "narrow")],
        listed=[("B", "Z", "by_construction")],
        dims={"src": ["a"], "narrow": ["n"], "wide": ["b"], "twin": ["b"], "other": ["z"]})
    found = association.relations(cfg, dmap, ["src", "narrow", "wide", "twin", "other"])
    # The dimension read from field A alone stands for it, and A rolls up to the dimension "narrow".
    assert found[frozenset(("src", "narrow"))] == [{"kind": "rolls_up", "basis": "by_construction"}]
    assert found[frozenset(("wide", "twin"))] == [{"kind": "same_field", "basis": None}]
    assert found[frozenset(("wide", "other"))] == [{"kind": "true_by_definition", "basis": "by_construction"}]
    assert found[frozenset(("twin", "other"))] == [{"kind": "true_by_definition", "basis": "by_construction"}]
    for finding in (("src", "other"), ("narrow", "wide"), ("src", "wide")):
        assert frozenset(finding) not in found, finding


def test_a_dimension_read_from_several_fields_does_not_carry_a_fields_roll_up():
    cfg, dmap = synthetic(rolls=[("A", "narrow"), ("N", "B")], listed=[], dims={"src": ["a"], "narrow": ["n"], "multi": ["a", "b"], "b_alone": ["b"]})
    found = association.relations(cfg, dmap, ["src", "narrow", "multi", "b_alone"])
    # "multi" is derived from A but is not A, so A's roll-up does not make it roll up to "narrow"; it does share a field with "src".
    assert found.get(frozenset(("multi", "narrow"))) is None
    assert found[frozenset(("src", "multi"))] == [{"kind": "same_field", "basis": None}]
    # Nor does anything roll up to "multi" by naming field B, which it is partly derived from: only a dimension read from B alone is B.
    assert found.get(frozenset(("narrow", "multi"))) is None
    assert found[frozenset(("narrow", "b_alone"))] == [{"kind": "rolls_up", "basis": "by_construction"}]
    assert found[frozenset(("src", "narrow"))] == [{"kind": "rolls_up", "basis": "by_construction"}]


def test_rolling_up_is_followed_through_other_dimensions_and_both_directions_of_a_pair_are_one_pair():
    cfg, dmap = synthetic(
        rolls=[("A", "mid"), ("M", "top")],
        listed=[],
        dims={"low": ["a"], "mid": ["m"], "top": ["t"], "side": ["s"]})
    found = association.relations(cfg, dmap, ["low", "mid", "top", "side"])
    assert found[frozenset(("low", "mid"))] == [{"kind": "rolls_up", "basis": "by_construction"}]
    assert found[frozenset(("mid", "top"))] == [{"kind": "rolls_up", "basis": "by_construction"}]
    assert found[frozenset(("low", "top"))] == [{"kind": "rolls_up", "basis": "by_construction"}]
    assert frozenset(("side", "top")) not in found and frozenset(("low", "side")) not in found


def test_a_listed_pair_is_matched_on_a_dimension_id_or_a_field_it_is_derived_from_in_either_order():
    cfg, dmap = synthetic(rolls=[], listed=[("B", "p", "by_definition_inferred")], dims={"p": ["x"], "q": ["b"], "r": ["y"]})
    found = association.relations(cfg, dmap, ["p", "q", "r"])
    assert found == {frozenset(("p", "q")): [{"kind": "true_by_definition", "basis": "by_definition_inferred"}]}


# --- a whole build ----------------------------------------------------------------------------------------------------


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    root = tmp_path_factory.mktemp("associations")
    workspace = {"staging": root / "staging", "public": root / "public", "state": root / "state" / "last_good.json",
                 "snapshots": root / "snapshots", "supplied": root / "supplied"}
    cfg = make_cfg(workspace)
    manifest = run(root, cfg, load_rows())
    public = workspace["public"]
    return SimpleNamespace(cfg=cfg, manifest=manifest, public=public,
                           doc=json.loads((public / ASSOCIATIONS_DIR / f"{DATASET}.json").read_text(encoding="utf-8")))


def pairs_of(doc: dict) -> dict:
    return {(p["a"], p["b"]): p for p in doc["pairs"]}


def test_every_pair_of_the_fact_tables_dimensions_is_in_the_file_once_in_order(built):
    facts = built.manifest["datasets"][DATASET]["facts"]["dimensions"]
    entry = built.manifest["datasets"][DATASET]["associations"]
    expected = list(itertools.combinations(sorted(facts), 2))
    assert [(p["a"], p["b"]) for p in built.doc["pairs"]] == expected
    assert built.doc["dimensions"] == sorted(facts)
    assert entry["file"] == f"{ASSOCIATIONS_DIR}/{DATASET}.json"
    assert (entry["dimensions"], entry["pairs"]) == (len(facts), len(expected))
    assert entry["not_findings"] == sum(1 for p in built.doc["pairs"] if p["relation"]) > 0


def test_a_dataset_without_a_fact_table_has_no_file_and_says_null(built):
    for name, entry in built.manifest["datasets"].items():
        if "not_built" in entry or entry.get("facts") is not None:
            continue
        assert entry["associations"] is None
        assert not (built.public / ASSOCIATIONS_DIR / f"{name}.json").exists()


def test_the_file_is_deterministic_and_written_with_lf(built, tmp_path):
    workspace = {"staging": tmp_path / "staging", "public": tmp_path / "public", "state": tmp_path / "state" / "last_good.json",
                 "snapshots": tmp_path / "snapshots", "supplied": tmp_path / "supplied"}
    run(tmp_path, make_cfg(workspace), load_rows())
    one = (built.public / ASSOCIATIONS_DIR / f"{DATASET}.json").read_bytes()
    two = (workspace["public"] / ASSOCIATIONS_DIR / f"{DATASET}.json").read_bytes()
    assert one == two and b"\r" not in one and one.endswith(b"\n")


def read_fact_table(public, dataset: str, facts: list[str]) -> list[dict]:
    """The fact table's rows from its published files, one dict a row."""
    con = duckdb.connect()
    names = [FACT_MONTH[0], *facts, FACT_COUNT[0]]
    columns = [[r[0] for r in con.execute(f"SELECT {n} FROM read_parquet('{(public / FACTS_DIR / dataset / f'{n}.parquet').as_posix()}')").fetchall()]
               for n in names]
    return [dict(zip(names, values)) for values in zip(*columns)]


def v_the_long_way(cells: dict) -> float | None:
    """Bias-corrected V from a full table, every cell and its expected count, in the order the textbooks give."""
    rows = sorted({a for a, _ in cells})
    columns = sorted({b for _, b in cells})
    total = sum(cells.values())
    if total < 2 or len(rows) < 2 or len(columns) < 2:
        return None
    row_total = {a: sum(n for (x, _), n in cells.items() if x == a) for a in rows}
    column_total = {b: sum(n for (_, y), n in cells.items() if y == b) for b in columns}
    chi2 = 0.0
    for a in rows:
        for b in columns:
            expected = row_total[a] * column_total[b] / total
            chi2 += (cells.get((a, b), 0) - expected) ** 2 / expected
    r, c = len(rows), len(columns)
    phi2 = max(0.0, chi2 / total - (r - 1) * (c - 1) / (total - 1))
    r_tilde, c_tilde = r - (r - 1) ** 2 / (total - 1), c - (c - 1) ** 2 / (total - 1)
    if min(r_tilde, c_tilde) <= 1:
        return None
    return math.sqrt(phi2 / (min(r_tilde, c_tilde) - 1))


def unknown_bands(cfg) -> dict[str, str]:
    return {d["id"]: b["label"] for d in cfg.dimensions["dimensions"] for b in d.get("bands", []) if b.get("unknown")}


def test_every_figure_equals_one_recomputed_from_the_published_fact_table(built):
    cfg, doc = built.cfg, built.doc
    facts = built.manifest["datasets"][DATASET]["facts"]["dimensions"]
    rows = read_fact_table(built.public, DATASET, facts)
    latest = date.fromisoformat(built.manifest["datasets"][DATASET]["latest_month"] + "-01")
    months_back = cfg.pipeline["trailing_window_months"] - 1
    start = date(latest.year + (latest.month - 1 - months_back) // 12, (latest.month - 1 - months_back) % 12 + 1, 1)
    unknown = unknown_bands(cfg)
    drops = {d: {UNDEFINED, UNMAPPED, OTHER, unknown.get(d)} for d in facts}
    trimmed = []
    for pair in doc["pairs"]:
        for window, since in (("all", date.min), ("trailing", start)):
            cells: dict = {}
            for row in rows:
                if row[FACT_MONTH[0]] < since or row[pair["a"]] in drops[pair["a"]] or row[pair["b"]] in drops[pair["b"]]:
                    continue
                key = (row[pair["a"]], row[pair["b"]])
                cells[key] = cells.get(key, 0) + row[FACT_COUNT[0]]
            expected = v_the_long_way(cells)
            got = pair[window]
            assert got["vehicles"] == sum(cells.values()), (pair["a"], pair["b"], window)
            assert (got["values_a"], got["values_b"]) == (len({a for a, _ in cells}), len({b for _, b in cells}))
            if expected is None:
                assert got["v"] is None, (pair["a"], pair["b"], window)
            else:
                assert got["v"] == pytest.approx(expected, abs=0.5e-4 + 1e-9), (pair["a"], pair["b"], window)
        total = sum(r[FACT_COUNT[0]] for r in rows)
        if pair["all"]["vehicles"] < total:
            trimmed.append((pair["a"], pair["b"]))
    assert trimmed, "no pair had a vehicle left out for a value not recorded: the exclusion was not exercised"


def test_a_pair_on_few_vehicles_is_written_with_its_count_and_does_not_stop_the_build(tmp_path, workspace):
    rows = load_rows()
    latest = source_for(rows)["change_key"]["snapshot"]
    year, month = int(latest[:4]), int(latest[5:7])
    # The events file must still resolve its values, so the first rows stay: the test cares about how few vehicles are left.
    few = [r for r in rows if (r["FIRST_NZ_REGISTRATION_YEAR"], r["FIRST_NZ_REGISTRATION_MONTH"]) == (year, month)] + rows[:3]
    manifest = run(tmp_path, make_cfg(workspace), few)
    doc = json.loads((workspace["public"] / ASSOCIATIONS_DIR / f"{DATASET}.json").read_text(encoding="utf-8"))
    figures = [p[w] for p in doc["pairs"] for w in ("all", "trailing")]
    assert manifest["datasets"][DATASET]["rows"] < 20
    assert min(f["vehicles"] for f in figures) < 10
    assert any(f["v"] is None and f["vehicles"] > 0 for f in figures), "no pair rests on too few vehicles for a V"


def test_the_windows_are_the_whole_dataset_and_the_configured_trailing_months(built):
    entry = built.manifest["datasets"][DATASET]
    windows = built.doc["windows"]
    assert windows["all"]["to"] == windows["trailing"]["to"] == entry["latest_month"]
    first, last = windows["trailing"]["from"], windows["trailing"]["to"]
    months = (int(last[:4]) - int(first[:4])) * 12 + int(last[5:]) - int(first[5:]) + 1
    assert months == built.cfg.pipeline["trailing_window_months"]


def test_the_pairs_the_data_map_says_roll_up_or_lists_are_marked_and_the_marks_come_from_config(built):
    dmap = privacy.load_map(built.cfg)
    marked = pairs_of(built.doc)
    dims = set(built.doc["dimensions"])
    expected = set()
    for entry in dmap["fields"]:
        bound = entry.get("bound")
        for roll in entry["relations"]["rolls_up_to"]:
            if entry["source"] == privacy.REGISTER and bound in dims and roll["to"] in dims:
                expected.add(tuple(sorted((bound, roll["to"]))))
    assert expected, "the data map has no roll-up between two fact-table dimensions: the test proves nothing"
    for pair in expected:
        assert any(r["kind"] == association.ROLLS_UP for r in marked[pair]["relation"]), pair
    for item in dmap["moves_together"]["true_by_definition"]:
        if {item["a"], item["b"]} <= dims:
            assert any(r["kind"] == association.LISTED for r in marked[tuple(sorted((item["a"], item["b"])))]["relation"]), item


# --- the guards ---------------------------------------------------------------------------------------------------------


def test_a_v_outside_zero_to_one_aborts_the_build(tmp_path, workspace, monkeypatch):
    real = association.cramers_v
    monkeypatch.setattr(association, "cramers_v", lambda cells: real(cells)._replace(v=1.5))
    expect_abort(lambda: run(tmp_path, make_cfg(workspace), load_rows()), "outside 0 to 1")


def test_a_pair_missing_from_the_file_aborts_the_build(tmp_path, workspace, monkeypatch):
    real = association.measure_pairs
    monkeypatch.setattr(association, "measure_pairs", lambda *args: real(*args)[:-1])
    expect_abort(lambda: run(tmp_path, make_cfg(workspace), load_rows()), "is missing")


def test_check_names_a_missing_a_repeated_and_a_foreign_pair_and_passes_a_small_one():
    good = {"pairs": [{"a": "x", "b": "y", "all": {"v": None}, "trailing": {"v": 0.0}}]}
    assert association.check(good, ["x", "y"]) == []
    assert any("missing" in p for p in association.check({"pairs": []}, ["x", "y"]))
    assert any("more than once" in p for p in association.check({"pairs": good["pairs"] * 2}, ["x", "y"]))
    assert any("not of the dataset" in p for p in association.check(good, ["x", "z"]))


def test_a_dimension_that_reads_an_owner_field_is_in_no_pair_even_when_the_fact_table_lists_it(tmp_path, workspace):
    cfg = make_cfg(workspace)
    owners = sorted(privacy.owner_dimensions(cfg))
    assert owners, "the data map has no owner dimension: the test proves nothing"
    facts = cfg.pipeline["datasets"][DATASET]["facts"]
    cfg.pipeline["datasets"][DATASET]["facts"] = facts + [o for o in owners if o not in facts]
    manifest = run(tmp_path, cfg, load_rows())
    text = (workspace["public"] / ASSOCIATIONS_DIR / f"{DATASET}.json").read_text(encoding="utf-8")
    doc = json.loads(text)
    entry = manifest["datasets"][DATASET]["associations"]
    for owner in owners:
        assert owner in manifest["datasets"][DATASET]["facts"]["dimensions"], "the owner dimension did not reach the fact table"
        assert owner not in doc["dimensions"]
        assert all(owner not in (p["a"], p["b"]) for p in doc["pairs"])
        assert entry["left_out"][owner]
    assert len(doc["pairs"]) == math.comb(len(doc["dimensions"]), 2)


def test_a_fact_table_with_one_dimension_has_a_file_with_no_pairs(tmp_path, workspace):
    # No dimension at all is the case test_guardrails builds (every listed dimension waiting); it passes through the same guard.
    cfg = make_cfg(workspace)
    only = cfg.pipeline["datasets"][DATASET]["facts"][0]
    cfg.pipeline["datasets"][DATASET]["facts"] = [only]
    manifest = run(tmp_path, cfg, load_rows())
    doc = json.loads((workspace["public"] / ASSOCIATIONS_DIR / f"{DATASET}.json").read_text(encoding="utf-8"))
    assert doc["dimensions"] == [only] and doc["pairs"] == []
    assert manifest["datasets"][DATASET]["associations"]["pairs"] == 0


def test_a_flow_dataset_built_from_a_store_has_its_own_file(tmp_path, workspace):
    cfg = make_cfg(workspace)
    supply(cfg, HISTORY)
    manifest = run(tmp_path, cfg, load_rows())
    entry = manifest["datasets"][FLOW]["associations"]
    doc = json.loads((workspace["public"] / entry["file"]).read_text(encoding="utf-8"))
    assert doc["dataset"] == FLOW
    assert [(p["a"], p["b"]) for p in doc["pairs"]] == list(itertools.combinations(doc["dimensions"], 2))
    assert doc["windows"]["trailing"]["to"] == manifest["datasets"][FLOW]["latest_month"]


def test_the_data_maps_note_on_moves_together_says_where_the_figures_are():
    note = json.loads(config.load().path("data_map").read_text(encoding="utf-8"))["moves_together"]["$comment"]
    assert ASSOCIATIONS_DIR in note
