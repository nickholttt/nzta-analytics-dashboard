"""Register fields bound as dimensions of registrations_surviving, each with its sentinels and its guard (package F).

A lookup dimension reads a small reference file (code to label), so a raw value the file does not know is `__UNMAPPED__`,
counts against the unmapped guard and, above its threshold, stops the build (invariant 4). A form that means "not recorded"
is in sentinels.csv under the field and reads `__UNDEFINED__`, like NULL; nothing else does. The expected counts are worked
out here from the fixture rows and the reference files, not from the pipeline's own derivation. No field value is written
in this file (invariant 1): every code, label and form is read from config and the reference files.
"""

from __future__ import annotations

import csv
import json
import math
import shutil
from collections import Counter
from pathlib import Path

import duckdb
import pytest

from pipeline import build, derive, reference
from pipeline.contract import OTHER, UNDEFINED, UNMAPPED
from pipeline.errors import GuardrailError

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages

SURVIVING = "registrations_surviving"
ROOT = Path(__file__).resolve().parents[2]
# The dimensions of this module that are a lookup on one register field.
LOOKUPS = ["nz_assembled", "nzta_class"]


def spec_of(cfg, dim_id: str) -> dict:
    return next(d for d in cfg.dimensions["dimensions"] if d["id"] == dim_id)


def source_column(cfg, dim_id: str) -> str:
    """The NZTA field a lookup dimension reads, as the saved pages and sentinels.csv name it."""
    return cfg.pipeline["fields"][spec_of(cfg, dim_id)["derive"]["field"]]


def sentinel_forms(cfg, column: str) -> set[str]:
    """The raw forms sentinels.csv lists for this field alone (the any-field tokens are NULL and empty text)."""
    s = cfg.pipeline["sentinels"]
    return {r[s["value"]] for r in reference.read(cfg.reference(s["file"])) if r[s["field"]] == column}


def reference_labels(cfg, dim_id: str) -> dict[str, str]:
    d = spec_of(cfg, dim_id)["derive"]
    return {r[d["key"]]: r[d["value"]] for r in reference.read(cfg.reference(d["reference"]))}


def build_fixture(tmp_path, workspace, extra_rows=()):
    rows = load_rows() + list(extra_rows)
    cfg = make_cfg(workspace)
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
    # The window holds most of the fixture, so the trailing figure decides. One vehicle fewer than the abort needs builds.
    _, _, manifest = build_fixture(tmp_path / "base", workspace)
    base = manifest["datasets"][SURVIVING]["unmapped_guard"][dim_id]["trailing"]["rows"]
    rate = g["max_unmapped_rate_trailing"]
    over = math.floor(rate * base / (1 - rate)) + 1  # the fewest unmapped vehicles whose share of the window exceeds the rate
    assert over >= 2, "the fixture's window is too small to show a build that passes one under the threshold"

    just_under = new_code_in_snapshot_month(rows, cfg0, dim_id, over - 1, 5000)
    _, _, ok = build_fixture(tmp_path / "under", {k: v.parent / "under" / v.name for k, v in workspace.items()}, just_under)
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


# --- the class code -----------------------------------------------------------------------------------------------------

CLASS_DIM = "nzta_class"
# One of NZTA's class codes reads like "not applicable" and is a real class of light goods vehicle. It is the one code
# written out here: the test exists to hold it (docs/DATA_MAP.md, CLASS).
LOOKS_LIKE_MISSING = "NA"


def test_na_is_a_class_and_is_never_a_form_of_not_recorded():
    cfg = make_cfg({})
    s = cfg.pipeline["sentinels"]
    rows = reference.read(cfg.reference(s["file"]))
    column = source_column(cfg, CLASS_DIM)
    assert not [r for r in rows if r[s["field"]] == column], "sentinels.csv lists a form of not recorded for the class"
    assert not [r for r in rows if r[s["field"]] == s["any_field"] and r[s["value"]] == LOOKS_LIKE_MISSING]
    assert LOOKS_LIKE_MISSING in reference_labels(cfg, CLASS_DIM), "the code is not in the class file, so it would read as unmapped"


def test_vehicles_of_the_na_class_are_counted_under_their_label_and_only_a_blank_reads_not_recorded(tmp_path, workspace):
    cfg, rows, manifest = build_fixture(tmp_path, workspace)
    entry = manifest["datasets"][SURVIVING]
    column = source_column(cfg, CLASS_DIM)
    here = counted(cfg, rows, entry["latest_month"])
    na_vehicles = sum(1 for r in here if r.get(column) == LOOKS_LIKE_MISSING)
    blank = sum(1 for r in here if r.get(column) in (None, ""))
    assert na_vehicles > 0 and blank > 0, "the fixture holds no vehicle of that class, or none with a blank class"
    counts = slice_counts(workspace["public"], CLASS_DIM)
    assert counts[reference_labels(cfg, CLASS_DIM)[LOOKS_LIKE_MISSING]] == na_vehicles
    assert counts[UNDEFINED] == blank
    assert counts[UNMAPPED] == 0


# --- seats, in bands ----------------------------------------------------------------------------------------------------

SEATS_DIM = "seats_band"
SEATS_FIELD = "seats"
# A month no fixture vehicle was first registered in, so that month's slice holds the vehicles a test adds and no others.
EMPTY_YEAR, EMPTY_MONTH = 2024, 3
# The edges of the bands, and the counts either side of the guard. Numbers, not domain values.
SEAT_COUNTS = [None, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 59, 60, 61, 62, 999]
ZERO_FORM = "0"


def seat_bands(cfg) -> tuple[list[dict], str]:
    bands = spec_of(cfg, SEATS_DIM)["bands"]
    return bands, next(b["label"] for b in bands if b.get("unknown"))


def seat_vehicles(counts, first_id: int) -> list[dict]:
    template = next(r for r in load_rows() if r["OBJECTID"] == 62)
    return [dict(template, OBJECTID=first_id + i, FIRST_NZ_REGISTRATION_YEAR=EMPTY_YEAR, FIRST_NZ_REGISTRATION_MONTH=EMPTY_MONTH,
                 NUMBER_OF_SEATS=n) for i, n in enumerate(counts)]


def band_of(cfg, n) -> str:
    """Where a count of seats lands, worked out from the bands in config and the forms of not recorded, not from the build."""
    bands, unknown = seat_bands(cfg)
    if n is None or str(n) in sentinel_forms(cfg, cfg.pipeline["fields"][SEATS_FIELD]):
        return unknown
    return next((b["label"] for b in bands if "min" in b and b["min"] <= n <= b["max"]), unknown)


def test_the_seat_bands_do_not_overlap_start_above_zero_and_stop_at_the_guard():
    cfg = make_cfg({})
    bands, unknown = seat_bands(cfg)
    ranged = [b for b in bands if "min" in b]
    assert [b for b in bands if b.get("unknown")] == [{"label": unknown, "unknown": True}]
    for a, b in zip(ranged, ranged[1:]):
        assert a["max"] + 1 == b["min"], f"{a['label']} and {b['label']} leave a gap or overlap"
    assert ranged[0]["min"] == 1, "zero seats is not a number of seats: it is the form of not recorded"
    top = ranged[-1]["max"]
    assert top == 60
    guard = next(e for e in json.loads((ROOT / "config" / "data_map.json").read_text(encoding="utf-8"))["fields"]
                 if e["name"] == cfg.pipeline["fields"][SEATS_FIELD])["guard"]
    assert (guard["valid_min_inclusive"], guard["valid_max_inclusive"]) == (ranged[0]["min"], top)
    assert guard["status"] == "bound", "the guard is applied by the bands, so the map must not call it proposed"


def test_zero_seats_is_a_form_of_not_recorded_for_this_field_alone():
    cfg = make_cfg({})
    s = cfg.pipeline["sentinels"]
    rows = reference.read(cfg.reference(s["file"]))
    assert ZERO_FORM in sentinel_forms(cfg, cfg.pipeline["fields"][SEATS_FIELD])
    assert not [r for r in rows if r[s["field"]] == s["any_field"] and r[s["value"]] == ZERO_FORM]


def test_each_seat_count_lands_in_its_band_and_a_zero_and_a_count_over_the_guard_land_in_unknown(tmp_path, workspace):
    rows = load_rows() + seat_vehicles(SEAT_COUNTS, 8000)
    cfg = make_cfg(workspace)
    manifest = build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    entry = manifest["datasets"][SURVIVING]
    assert SEATS_DIM in entry["live_dimensions"] and SEATS_DIM in entry["facts"]["dimensions"]
    path = (workspace["public"] / "cube" / SURVIVING / f"{SEATS_DIM}.parquet").as_posix()
    got = dict(duckdb.connect().execute(
        f"SELECT dim_value, sum(n) FROM read_parquet('{path}') WHERE month = DATE '{EMPTY_YEAR}-{EMPTY_MONTH:02d}-01' GROUP BY 1").fetchall())
    assert got == dict(Counter(band_of(cfg, n) for n in SEAT_COUNTS))
    # The edges, stated outright so that a change to the bands cannot move them and the test with them.
    label = {n: band_of(cfg, n) for n in SEAT_COUNTS}
    unknown = seat_bands(cfg)[1]
    assert label[None] == label[0] == label[61] == label[62] == label[999] == unknown
    assert label[1] == label[2] != label[3] == label[4] != label[5] != label[6] == label[7] != label[8]
    assert label[8] == label[9] == label[59] == label[60] != unknown
    assert len({label[n] for n in (1, 3, 5, 6, 8)}) == 5


def test_a_blank_a_zero_and_a_count_over_the_guard_are_counted_apart_in_the_manifest(tmp_path, workspace):
    rows = load_rows() + seat_vehicles(SEAT_COUNTS, 8000)
    cfg = make_cfg(workspace)
    manifest = build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    entry = manifest["datasets"][SURVIVING]
    counted_rows = counted(cfg, rows, entry["latest_month"])
    seats = [r.get("NUMBER_OF_SEATS") for r in counted_rows]
    top = max(b["max"] for b in seat_bands(cfg)[0] if "min" in b)
    assert entry["counts"]["bands"][SEATS_DIM] == {
        "source_missing": sum(1 for n in seats if n is None),
        "source_sentinel": sum(1 for n in seats if n is not None and str(n) == ZERO_FORM),
        "negative": 0,
        "out_of_bands": sum(1 for n in seats if n is not None and n > top),
    }
    bands = entry["counts"]["bands"][SEATS_DIM]
    assert bands["source_sentinel"] >= 3 and bands["out_of_bands"] >= 3 and bands["source_missing"] >= 2, (
        "the fixture does not hold each reason more than once, so the test would prove little")
    slice_unknown = slice_counts(workspace["public"], SEATS_DIM)[seat_bands(cfg)[1]]
    assert slice_unknown == bands["source_missing"] + bands["source_sentinel"] + bands["out_of_bands"]


def test_the_bands_are_live_where_the_register_is_the_source_and_not_where_the_source_carries_no_seats():
    cfg = make_cfg({})
    field = spec_of(cfg, SEATS_DIM)["derive"]["field"]
    assert derive.needed_fields(cfg, spec_of(cfg, SEATS_DIM)["derive"]) == {field}
    assert "applies_to" not in spec_of(cfg, SEATS_DIM)
    for dataset in (d for d in cfg.pipeline["datasets"] if d != SURVIVING):
        live, not_live = derive.applicable(cfg, dataset)
        assert SEATS_DIM not in {d["id"] for d in live}, dataset
        assert not_live[SEATS_DIM] == "the source does not carry " + cfg.source_field(field), dataset
        assert SEATS_DIM not in (cfg.pipeline["datasets"][dataset].get("facts") or []), dataset
