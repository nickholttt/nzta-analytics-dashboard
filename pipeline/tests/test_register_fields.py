"""Register fields bound as dimensions of registrations_surviving, each with its sentinels and its guard (package F).

A lookup dimension reads a small reference file (code to label), so a raw value the file does not know is `__UNMAPPED__`,
counts against the unmapped guard and, above its threshold, stops the build (invariant 4). A form that means "not recorded"
is in sentinels.csv under the field and reads `__UNDEFINED__`, like NULL; nothing else does. The expected counts are worked
out here from the fixture rows and the reference files, not from the pipeline's own derivation. No field value is written
in this file (invariant 1): every code, label and form is read from config and the reference files.
"""

from __future__ import annotations

import csv
import math
import shutil
from collections import Counter

import duckdb
import pytest

from pipeline import build, derive, reference
from pipeline.contract import OTHER, UNDEFINED, UNMAPPED
from pipeline.errors import GuardrailError

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages

SURVIVING = "registrations_surviving"
# The dimensions of this module that are a lookup on one register field.
LOOKUPS = ["nz_assembled"]


def spec_of(cfg, dim_id: str) -> dict:
    return next(d for d in cfg.dimensions["dimensions"] if d["id"] == dim_id)


def source_column(cfg, dim_id: str) -> str:
    """The NZTA field a lookup dimension reads, as the saved pages and sentinels.csv name it."""
    return cfg.pipeline["fields"][spec_of(cfg, dim_id)["derive"]["field"]]


def sentinel_forms(cfg, column: str) -> set[str]:
    """The raw forms sentinels.csv lists for this field alone (the any-field tokens are NULL and empty text)."""
    s = cfg.pipeline["sentinels"]
    return {r[s["value"]] for r in reference.read(cfg.reference(s["file"])) if r[s["field"]] == column}


def reference_labels(cfg, dim_id: str, directory=None) -> dict[str, str]:
    d = spec_of(cfg, dim_id)["derive"]
    path = (directory / d["reference"]) if directory else cfg.reference(d["reference"])
    return {r[d["key"]]: r[d["value"]] for r in reference.read(path)}


def build_fixture(tmp_path, workspace, extra_rows=(), tweak=None):
    rows = load_rows() + list(extra_rows)
    cfg = make_cfg(workspace)
    if tweak:
        tweak(cfg)
    manifest = build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    return cfg, rows, manifest


def counted(cfg, rows, latest_month: str) -> list[dict]:
    """The fixture rows registrations_surviving counts: a type in scope, a status that enters the fleet, and a first
    registration month that exists and is not after the snapshot month."""
    p = cfg.pipeline
    true, vehicle, status = p["boolean_true"], p["scope"]["vehicle"], p["scope"]["status"]
    types = {r[vehicle["key"]] for r in reference.read(cfg.reference(vehicle["file"])) if r[vehicle["in_scope"]] == true}
    statuses = {r[status["key"]] for r in reference.read(cfg.reference(status["file"]))
                if r[status["in_scope"]] == true and r[status["fleet_entry"]] == true}
    year, month = p["fields"]["registration_year"], p["fields"]["registration_month"]
    return [r for r in rows
            if r[p["fields"][vehicle["field"]]] in types and r[p["fields"][status["field"]]] in statuses
            and r[year] and r[month] and 1 <= r[month] <= 12 and f"{r[year]}-{r[month]:02d}" <= latest_month]


def expected_lookup_counts(cfg, dim_id: str, rows) -> Counter:
    labels, column = reference_labels(cfg, dim_id), source_column(cfg, dim_id)
    forms = sentinel_forms(cfg, column)
    out = Counter()
    for r in rows:
        raw = r.get(column)
        raw = raw.strip() if isinstance(raw, str) else raw
        if raw is None or raw == "" or str(raw) in forms:
            out[UNDEFINED] += 1
        else:
            out[labels.get(raw, UNMAPPED)] += 1
    return out


def slice_counts(public, dim_id: str) -> Counter:
    path = (public / "cube" / SURVIVING / f"{dim_id}.parquet").as_posix()
    return Counter(dict(duckdb.connect().execute(f"SELECT dim_value, sum(n) FROM read_parquet('{path}') GROUP BY 1").fetchall()))


def fact_counts(public, dim_id: str) -> Counter:
    d = public / "facts" / SURVIVING
    con = duckdb.connect()
    return Counter(dict(con.execute(
        f"SELECT v.{dim_id}, sum(n.n) FROM (SELECT row_number() OVER () AS i, * FROM read_parquet('{(d / (dim_id + '.parquet')).as_posix()}')) v "
        f"JOIN (SELECT row_number() OVER () AS i, * FROM read_parquet('{(d / 'n.parquet').as_posix()}')) n USING (i) GROUP BY 1").fetchall()))


# --- the reference files and the sentinels ------------------------------------------------------------------------------


@pytest.mark.parametrize("dim_id", LOOKUPS)
def test_every_code_has_a_readable_label_that_names_one_code_only(dim_id):
    cfg = make_cfg({})
    labels = reference_labels(cfg, dim_id)
    assert len(labels) >= 2, "a lookup of one value proves nothing"
    values = list(labels.values())
    assert all(v and v.strip() == v for v in values), "a blank or padded label"
    assert len(set(values)) == len(values), "two codes share a label, so a slice would merge them"
    assert not set(values) & {UNDEFINED, UNMAPPED, OTHER}
    d = spec_of(cfg, dim_id)["derive"]
    assert d["kind"] == "lookup" and d["value"] != d["key"]


@pytest.mark.parametrize("dim_id", LOOKUPS)
def test_a_sentinel_form_is_listed_for_its_field_alone_and_is_not_a_code_of_the_reference_file(dim_id):
    cfg = make_cfg({})
    s, column = cfg.pipeline["sentinels"], source_column(cfg, dim_id)
    rows = reference.read(cfg.reference(s["file"]))
    forms = sentinel_forms(cfg, column)
    labels = reference_labels(cfg, dim_id)
    assert not forms & set(labels), "a form that means not recorded is also a code with a label"
    for form in forms:
        assert not [r for r in rows if r[s["field"]] == s["any_field"] and r[s["value"]] == form], f"{form!r} is listed for every field"


# --- what a build does with them ----------------------------------------------------------------------------------------


@pytest.mark.parametrize("dim_id", LOOKUPS)
def test_a_form_of_not_recorded_reads_not_recorded_and_every_other_value_keeps_its_label(tmp_path, workspace, dim_id):
    cfg, rows, manifest = build_fixture(tmp_path, workspace)
    entry = manifest["datasets"][SURVIVING]
    assert dim_id in entry["live_dimensions"] and dim_id in entry["facts"]["dimensions"] and dim_id not in entry["not_live"]
    expected = expected_lookup_counts(cfg, dim_id, counted(cfg, rows, entry["latest_month"]))
    assert expected[UNDEFINED] > 0, "the fixture holds no vehicle with the field not recorded"
    assert len(expected) > 2, "the fixture holds too few values to prove that only the forms of not recorded are lost"
    assert UNMAPPED not in expected
    assert slice_counts(workspace["public"], dim_id) == expected
    assert fact_counts(workspace["public"], dim_id) == expected
    assert sum(expected.values()) == entry["rows"]
    assert entry["unmapped_rates"][dim_id] == 0.0


@pytest.mark.parametrize("dim_id", LOOKUPS)
def test_the_field_is_read_from_the_register_and_is_not_live_where_the_source_carries_none(dim_id):
    cfg = make_cfg({})
    others = [d for d in cfg.pipeline["datasets"] if d != SURVIVING]
    assert len(others) >= 3
    field = spec_of(cfg, dim_id)["derive"]["field"]
    assert derive.needed_fields(cfg, spec_of(cfg, dim_id)["derive"]) == {field}
    assert "applies_to" not in spec_of(cfg, dim_id), "the carried-fields rule must decide this, not a list"
    assert dim_id in {d["id"] for d in derive.applicable(cfg, SURVIVING)[0]}
    for dataset in others:
        live, not_live = derive.applicable(cfg, dataset)
        assert dim_id not in {d["id"] for d in live}, dataset
        assert not_live[dim_id] == "the source does not carry " + cfg.source_field(field), dataset
        assert dim_id not in (cfg.pipeline["datasets"][dataset].get("facts") or []), dataset


@pytest.mark.parametrize("dim_id", LOOKUPS)
def test_the_unmapped_rate_of_the_dimension_is_guarded_on_the_trailing_window(dim_id):
    cfg = make_cfg({})
    g = cfg.pipeline["guardrails"]
    assert dim_id in g["abort_on_unmapped"]
    assert 0 < g["warn_unmapped_rate_trailing"] < g["max_unmapped_rate_trailing"] <= g["max_unmapped_rate"]


def new_code_in_snapshot_month(rows, cfg, dim_id: str, count: int, first_id: int) -> list[dict]:
    """Vehicles like the fixture's last one, first registered in the snapshot month, recorded under a code the reference
    file does not hold."""
    column, template = source_column(cfg, dim_id), next(r for r in rows if r["OBJECTID"] == 62)
    snapshot = source_for(rows)["change_key"]["snapshot"]
    year, month = int(snapshot[:4]), int(snapshot[5:7])
    known = set(reference_labels(cfg, dim_id))
    values = [f"A NEW CODE {i}" for i in range(count)]
    assert not set(values) & known
    return [dict(template, OBJECTID=first_id + i, FIRST_NZ_REGISTRATION_YEAR=year, FIRST_NZ_REGISTRATION_MONTH=month,
                 **{column: v}) for i, v in enumerate(values)]


@pytest.mark.parametrize("dim_id", LOOKUPS)
def test_a_new_raw_value_is_unmapped_warns_with_headroom_and_stops_the_build_above_the_threshold(tmp_path, workspace, dim_id):
    rows, cfg0 = load_rows(), make_cfg(workspace)
    g = cfg0.pipeline["guardrails"]
    # Both bases of the guard are looser than the trailing one here only if the whole run holds more rows; the window is
    # most of the fixture, so the trailing figure decides. One vehicle fewer than the abort needs must still build.
    cfg, _, manifest = build_fixture(tmp_path / "base", workspace)
    base = manifest["datasets"][SURVIVING]["unmapped_guard"][dim_id]["trailing"]["rows"]
    rate = g["max_unmapped_rate_trailing"]
    over = math.floor(rate * base / (1 - rate)) + 1  # the fewest unmapped vehicles whose share of the window exceeds the rate
    assert over >= 2, "the fixture's window is too small to show a build that passes one under the threshold"

    just_under = new_code_in_snapshot_month(rows, cfg0, dim_id, over - 1, 5000)
    ok_cfg, _, ok = build_fixture(tmp_path / "under", {k: v.parent / "under" / v.name for k, v in workspace.items()}, just_under)
    figures = ok["datasets"][SURVIVING]["unmapped_guard"][dim_id]
    assert figures["trailing"]["unmapped"] == over - 1 and figures["trailing"]["headroom_rows"] >= 0
    assert any(w.startswith(f"{SURVIVING}.{dim_id}:") and "warning level" in w for w in ok["warnings"]), ok["warnings"]
    assert ok["datasets"][SURVIVING]["unmapped_rates"][dim_id] > 0
    assert slice_counts(workspace["public"].parent / "under" / workspace["public"].name, dim_id)[UNMAPPED] == over - 1

    beyond = new_code_in_snapshot_month(rows, cfg0, dim_id, over, 6000)
    other = {k: v.parent / "over" / v.name for k, v in workspace.items()}
    with pytest.raises(GuardrailError) as info:
        build_fixture(tmp_path / "over", other, beyond)
    assert f"{SURVIVING}.{dim_id}: unmapped rate" in str(info.value), str(info.value)


@pytest.mark.parametrize("dim_id", LOOKUPS)
def test_a_code_added_to_the_reference_file_maps_with_no_other_change(tmp_path, workspace, dim_id):
    cfg0 = make_cfg(workspace)
    d = spec_of(cfg0, dim_id)["derive"]
    extra = new_code_in_snapshot_month(load_rows(), cfg0, dim_id, 1, 7000)
    ref = tmp_path / "reference"
    shutil.copytree(cfg0.reference("x").parent, ref)
    with (ref / d["reference"]).open(encoding="utf-8", newline="") as fh:
        text = fh.read()
    header = text.splitlines()[0].split(",")
    row = {c: "" for c in header}
    row[d["key"]], row[d["value"]] = "A NEW CODE 0", "A new label"
    with (ref / d["reference"]).open("a", encoding="utf-8", newline="") as fh:
        csv.DictWriter(fh, fieldnames=header, lineterminator="\n").writerow(row)
    cfg = make_cfg(workspace, reference_dir=ref)
    rows = load_rows() + extra
    manifest = build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    assert manifest["datasets"][SURVIVING]["unmapped_rates"][dim_id] == 0.0
    counts = slice_counts(workspace["public"], dim_id)
    assert counts["A new label"] == 1 and UNMAPPED not in counts
