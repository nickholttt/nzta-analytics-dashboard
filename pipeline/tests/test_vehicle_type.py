"""The vehicle_type dimension: NZTA's own vehicle type, under the label vehicle_scope.csv gives it.

It is read from the same reference file, key and field that decide which vehicles are in scope, so it cannot name a type
that scope does not know. The register's datasets carry it, a series source does not (test_statsnz_build.py, test_flow.py).
"""

from __future__ import annotations

import csv
import shutil
from collections import Counter

import duckdb

from pipeline import build, derive, reference
from pipeline.contract import OTHER, UNDEFINED, UNMAPPED

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages

DIM = "vehicle_type"
SURVIVING = "registrations_surviving"


def dimension(cfg) -> dict:
    return next(d for d in cfg.dimensions["dimensions"] if d["id"] == DIM)


def scope_rows(cfg, directory=None) -> list[dict]:
    vehicle = cfg.pipeline["scope"]["vehicle"]
    path = (directory / vehicle["file"]) if directory else cfg.reference(vehicle["file"])
    return reference.read(path)


def labels(cfg, rows=None) -> dict[str, str]:
    """{NZTA vehicle type: label}, read the way the dimension reads it."""
    spec = dimension(cfg)["derive"]
    return {r[spec["key"]]: r[spec["value"]] for r in (rows if rows is not None else scope_rows(cfg))}


def build_fixture(tmp_path, workspace, reference_dir=None, extra_rows=()):
    rows = load_rows() + list(extra_rows)
    extra = {"reference_dir": reference_dir} if reference_dir else {}
    cfg = make_cfg(workspace, **extra)
    manifest = build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    return cfg, rows, manifest


def slice_counts(public, dataset=SURVIVING) -> dict[str, int]:
    con = duckdb.connect()
    path = (public / "cube" / dataset / f"{DIM}.parquet").as_posix()
    return dict(con.execute(f"SELECT dim_value, sum(n) FROM read_parquet('{path}') GROUP BY 1").fetchall())


def fleet_entry_counts(cfg, rows, latest_month) -> Counter:
    """Fixture vehicles per vehicle type that scope counts and that enter the fleet, decided from the reference files.

    A vehicle with no first-registration month, or one after the snapshot month, is in no month's count."""
    p = cfg.pipeline
    true, vehicle, status = p["boolean_true"], p["scope"]["vehicle"], p["scope"]["status"]
    types = {r[vehicle["key"]] for r in scope_rows(cfg) if r[vehicle["in_scope"]] == true}
    statuses = {r[status["key"]] for r in reference.read(cfg.reference(status["file"]))
                if r[status["in_scope"]] == true and r[status["fleet_entry"]] == true}
    year, month = p["fields"]["registration_year"], p["fields"]["registration_month"]

    def counted(r) -> bool:
        return bool(r[year] and r[month] and 1 <= r[month] <= 12 and f"{r[year]}-{r[month]:02d}" <= latest_month)

    return Counter(r[p["fields"][vehicle["field"]]] for r in rows
                   if counted(r) and r[p["fields"][vehicle["field"]]] in types and r[p["fields"][status["field"]]] in statuses)


def test_every_type_has_a_label_that_is_readable_and_names_one_type_only(workspace):
    cfg = make_cfg(workspace)
    by_type = labels(cfg)
    assert len(by_type) == len(scope_rows(cfg)) > 2
    values = list(by_type.values())
    assert all(v.strip() == v and v for v in values), "a blank or padded label"
    assert len(set(values)) == len(values), "two types share a label, so a slice would merge them"
    assert not set(values) & {UNDEFINED, UNMAPPED, OTHER}
    assert not set(values) & set(by_type), "a label left as the register's own capitals"


def test_the_dimension_reads_the_file_key_and_field_that_decide_scope(workspace):
    cfg = make_cfg(workspace)
    spec, vehicle = dimension(cfg)["derive"], cfg.pipeline["scope"]["vehicle"]
    assert spec["kind"] == "lookup"
    assert (spec["reference"], spec["key"], spec["field"]) == (vehicle["file"], vehicle["key"], vehicle["field"])
    assert spec["value"] not in (vehicle["key"], vehicle["in_scope"])


def test_it_is_live_for_the_register_and_its_values_are_the_labels_of_the_types_in_scope(tmp_path, workspace):
    cfg, rows, manifest = build_fixture(tmp_path, workspace)
    entry = manifest["datasets"][SURVIVING]
    assert DIM in entry["live_dimensions"] and DIM not in entry["not_live"]
    by_type = labels(cfg)
    expected = {by_type[t]: n for t, n in fleet_entry_counts(cfg, rows, entry["latest_month"]).items()}
    assert len(expected) > 1, "the fixture holds only one type in scope; the test would prove little"
    assert slice_counts(workspace["public"]) == expected
    assert sum(expected.values()) == entry["rows"]
    assert entry["unmapped_rates"][DIM] == 0.0


def test_a_type_brought_into_scope_appears_under_its_label_with_no_other_change(tmp_path, workspace):
    cfg = make_cfg(workspace)
    vehicle, true = cfg.pipeline["scope"]["vehicle"], cfg.pipeline["boolean_true"]
    column = cfg.pipeline["fields"][vehicle["field"]]
    # A vehicle like the first one in the fixture, recorded under a type that scope leaves out and no fixture vehicle has.
    present = {r[column] for r in load_rows()}
    out = next(r for r in scope_rows(cfg) if r[vehicle["in_scope"]] != true and r[vehicle["key"]] not in present)
    extra = dict(load_rows()[0], OBJECTID=9001, **{column: out[vehicle["key"]]})
    _, _, before = build_fixture(tmp_path / "before", workspace, extra_rows=[extra])
    assert out[dimension(cfg)["derive"]["value"]] not in slice_counts(workspace["public"])
    ref = tmp_path / "reference"
    shutil.copytree(cfg.reference("x").parent, ref)
    changed = [dict(r, **{vehicle["in_scope"]: true}) if r[vehicle["key"]] == out[vehicle["key"]] else r for r in scope_rows(cfg)]
    with (ref / vehicle["file"]).open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(changed[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(changed)
    cfg2, _, after = build_fixture(tmp_path / "after", workspace, reference_dir=ref, extra_rows=[extra])
    counts = slice_counts(workspace["public"])
    assert counts[out[dimension(cfg2)["derive"]["value"]]] == 1
    assert after["datasets"][SURVIVING]["unmapped_rates"][DIM] == 0.0
    assert UNMAPPED not in counts and UNDEFINED not in counts
    assert after["datasets"][SURVIVING]["rows"] == before["datasets"][SURVIVING]["rows"] + 1


def test_a_dimension_cannot_be_live_where_the_source_carries_no_vehicle_type(workspace):
    cfg = make_cfg(workspace)
    field = dimension(cfg)["derive"]["field"]
    assert derive.needed_fields(cfg, dimension(cfg)["derive"]) == {field}
    assert "applies_to" not in dimension(cfg), "the series rule must decide this, not a list"
