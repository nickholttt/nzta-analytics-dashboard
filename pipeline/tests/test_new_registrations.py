"""new_registrations: one dataset of first registrations, new and used, of the five vehicle types of the trade scope (D-158).

It replaces registrations_flow (the default scope's two types) and registrations_flow_wider (five types). Vehicle type is a condition of a
question, not a dataset, so a question for the narrower scope is this dataset narrowed to the vehicle types the vehicle scope file marks in its
in_scope column. These tests hold that claim to the fixture history with added types, through the fact table, for every dimension and every
month, against the datasets it replaces while they are still built; no vehicle type, status, group or dimension is named here.
"""

from __future__ import annotations

import json

import duckdb
import pytest

from pipeline import supplied

from .conftest import make_cfg
from .test_flow_wider import (HISTORY, SOURCE, WIDER, FLOW, ADDED_VEHICLES, expected_months, history_with_added_types, month_key, run, scope_rows,
                              types_in, wider_only_types, workspace_for)

NEW = "new_registrations"


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("new_registrations")
    workspace = workspace_for(tmp)
    cfg = make_cfg(workspace)
    path, rows = history_with_added_types(cfg, tmp)
    supplied.supply(cfg, SOURCE, path, taken="2026-09-05", echo=lambda *_: None)
    manifest = run(tmp, cfg)
    return {"cfg": cfg, "rows": rows, "manifest": manifest, "public": workspace["public"], "state": workspace["state"]}


def labels_of(cfg, column: str) -> set[str]:
    """The labels a fact table's vehicle type column holds for the types a scope column marks: the dimension's own derive rule names the label column."""
    derive = next(d for d in cfg.dimensions["dimensions"] if d["id"] == "vehicle_type")["derive"]
    vehicle, true = cfg.pipeline["scope"]["vehicle"], cfg.pipeline["boolean_true"]
    return {r[derive["value"]] for r in scope_rows(cfg) if r[column] == true}


def fact_rows(public, dataset: str, columns: list[str]):
    """The dataset's fact table as rows of (month, *columns, n): the files hold the same rows in the same order."""
    con = duckdb.connect()
    names = ["month", *columns, "n"]
    selects = ", ".join(f"{c}.v AS {c}" for c in names)
    joins = " ".join(f"JOIN (SELECT row_number() OVER () AS i, {c} AS v FROM read_parquet('{(public / 'facts' / dataset / f'{c}.parquet').as_posix()}')) {c} USING (i)"
                     for c in names[1:])
    first = names[0]
    sql = (f"SELECT {selects} FROM (SELECT row_number() OVER () AS i, month AS v FROM read_parquet('{(public / 'facts' / dataset / 'month.parquet').as_posix()}')) {first} {joins}")
    return con.execute(sql).fetchall()


def test_its_month_totals_are_the_stores_vehicles_of_the_five_types_and_the_narrower_scope_is_a_condition(built):
    cfg, rows, manifest = built["cfg"], built["rows"], built["manifest"]
    five, two = types_in(cfg, "trade_scope"), types_in(cfg, "in_scope")
    two_labels = labels_of(cfg, "in_scope")
    state = json.loads(built["state"].read_text(encoding="utf-8"))
    expected = {month_key(cfg, m): n for m, n in expected_months(cfg, rows, five).items()}
    assert state["month_counts"][NEW] == expected
    assert manifest["datasets"][NEW]["rows"] == sum(expected.values())
    # Narrowed to the types of the default scope, the same months as the dataset that counted only those.
    narrowed = {month_key(cfg, m): n for m, n in expected_months(cfg, rows, two).items()}
    through_facts: dict[str, int] = {}
    for month, vehicle_type, n in fact_rows(built["public"], NEW, ["vehicle_type"]):
        if vehicle_type in two_labels:
            through_facts[month.strftime("%Y-%m")] = through_facts.get(month.strftime("%Y-%m"), 0) + n
    assert through_facts == narrowed == state["month_counts"][FLOW]
    added = set(wider_only_types(cfg))
    assert added and all(n == ADDED_VEHICLES * len(added) for n in (expected[m] - narrowed[m] for m in expected))


def test_narrowed_to_the_default_scopes_types_it_equals_the_dataset_that_counted_only_those_for_every_dimension_and_month(built):
    """registrations_flow's whole fact table, dimension by dimension, set beside this one's rows of the same types."""
    cfg, public = built["cfg"], built["public"]
    two = labels_of(cfg, "in_scope")
    entry = built["manifest"]["datasets"][FLOW]
    shared = [d for d in entry["facts"]["dimensions"] if d != "vehicle_type"]
    assert shared, "the dataset carries no fact dimension: this test would pass without checking anything"
    for dimension in shared:
        old: dict = {}
        for m, v, n in fact_rows(public, FLOW, [dimension]):
            old[(m, v)] = old.get((m, v), 0) + n
        new: dict = {}
        for m, vt, v, n in fact_rows(public, NEW, ["vehicle_type", dimension]):
            if vt in two:
                new[(m, v)] = new.get((m, v), 0) + n
        assert new == old, dimension
    # The default scope's own vehicle types are the same two and nothing else.
    old_types = {vt for _, vt, _ in fact_rows(public, FLOW, ["vehicle_type"])}
    assert old_types == two


def test_it_is_the_wider_scope_dataset_row_for_row_while_both_are_built(built):
    """The wider dataset counted these five types already: the new one's cube, facts and manifest entry hold the same rows."""
    public, manifest = built["public"], built["manifest"]
    for folder in ("cube", "facts"):
        left, right = public / folder / NEW, public / folder / WIDER
        files = sorted(p.relative_to(left) for p in left.rglob("*") if p.is_file())
        assert files == sorted(p.relative_to(right) for p in right.rglob("*") if p.is_file()), folder
        assert files, folder
        assert all((left / f).read_bytes() == (right / f).read_bytes() for f in files), folder
    new, wider = manifest["datasets"][NEW], manifest["datasets"][WIDER]
    for key in ("rows", "live_dimensions", "not_live", "facts", "unmapped_rates", "model_cap", "months", "supplied"):
        assert new[key] == wider[key], key


def test_it_is_offered_the_dimensions_the_wider_dataset_was(built):
    manifest = built["manifest"]
    assert "trade_group" in manifest["datasets"][NEW]["live_dimensions"]
    assert "trade_group" in manifest["datasets"][NEW]["facts"]["dimensions"]
    assert manifest["datasets"][NEW]["facts"]["dimensions"]
    assert HISTORY.exists()
