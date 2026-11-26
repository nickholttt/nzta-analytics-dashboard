"""The vehicles registered today (`fleet`): a stock of every vehicle in the register, counted by how the register records its
usage now and by vehicle type, never by when it was first registered (D-135).

The expected counts are worked out here from the fixture rows and the reference files, not from the pipeline's own
derivation. No value of the register is written in this file (invariant 1): every dimension id, code and label is read from
config and the reference files, and the dataset is the one config marks as a stock.
"""

from __future__ import annotations

import csv
import json
import math
import shutil
from collections import Counter

import duckdb
import pytest

from pipeline import build, config, derive, privacy, reference
from pipeline.contract import NOT_BROKEN_DOWN, UNDEFINED, UNMAPPED
from pipeline.errors import GuardrailError

from .conftest import NOW, body_for_type, load_rows, make_cfg, source_for, write_pages
from .test_golden import frozen_reference


def stock_dataset() -> str:
    found = [d for d, spec in config.load().pipeline["datasets"].items() if spec.get("stock")]
    assert len(found) == 1, found
    return found[0]


FLEET = stock_dataset()


def usage_dimension() -> str:
    """The one dimension only the stock is offered: it reads a field the data map marks as describing the vehicle now."""
    cfg = config.load()
    found = privacy.stock_only_dimensions(cfg)
    assert len(found) == 1, found
    return next(iter(found))


USAGE = usage_dimension()


def type_dimension() -> str:
    """The dimension the usage is paired with: the stock is offered others that stand in no pair (market type, D-161)."""
    cfg = config.load()
    pairs = cfg.pipeline["datasets"][FLEET]["pairs"]
    assert len(pairs) == 1 and USAGE in pairs[0], pairs
    return next(d for d in pairs[0] if d != USAGE)


TYPE = type_dimension()
PAIR = f"{USAGE}__{TYPE}"


def spec_of(cfg, dim_id):
    return next(d for d in cfg.dimensions["dimensions"] if d["id"] == dim_id)


def usage_column(cfg) -> str:
    return cfg.pipeline["fields"][spec_of(cfg, USAGE)["derive"]["field"]]


def usage_labels(cfg) -> dict[str, str]:
    d = spec_of(cfg, USAGE)["derive"]
    return {r[d["key"]]: r[d["value"]] for r in reference.read(cfg.reference(d["reference"]))}


def type_labels(cfg) -> dict[str, str]:
    d = spec_of(cfg, TYPE)["derive"]
    return {r[d["key"]]: r[d["value"]] for r in reference.read(cfg.reference(d["reference"]))}


def read(path):
    return duckdb.connect().execute(f"SELECT * FROM read_parquet('{path.as_posix()}') ORDER BY ALL").fetchall()


def built_fixture(tmp_path, workspace, rows=None, **extra):
    cfg = make_cfg(workspace, **extra)
    rows = rows if rows is not None else load_rows()
    manifest = build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    return cfg, rows, manifest


# --- what the dataset counts --------------------------------------------------------------------------------------------


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    root = tmp_path_factory.mktemp("fleet")
    workspace = {"staging": root / "staging", "public": root / "public", "state": root / "state" / "last_good.json",
                 "snapshots": root / "snapshots", "supplied": root / "supplied"}
    cfg, rows, manifest = built_fixture(root, workspace)
    return cfg, rows, manifest, workspace


def test_the_fleet_counts_every_row_of_the_register_in_the_one_period(built):
    cfg, rows, manifest, workspace = built
    entry = manifest["datasets"][FLEET]
    assert entry["rows"] == len(rows) == manifest["source"]["rows_pulled"]
    assert entry["months"] == 1 and entry["latest_month"] == manifest["latest_snapshot"][:7]
    assert entry["facts"] is None and not (workspace["public"] / "facts" / FLEET).exists()
    # Every dimension the stock is offered is live (a stock is offered the dimensions it can be broken down by and no others).
    assert sorted(entry["live_dimensions"]) == sorted(cfg.pipeline["datasets"][FLEET]["dimensions"])
    assert {USAGE, TYPE} <= set(entry["live_dimensions"])
    assert entry["live_pairs"] == [PAIR]


def test_the_usage_slice_has_the_labels_of_the_register_and_one_month(built):
    cfg, rows, manifest, workspace = built
    labels = usage_labels(cfg)
    column = usage_column(cfg)
    expected = Counter(labels.get(r.get(column), UNMAPPED) if r.get(column) else UNDEFINED for r in rows)
    got = read(workspace["public"] / "cube" / FLEET / f"{USAGE}.parquet")
    assert {r[0].isoformat() for r in got} == {manifest["latest_snapshot"][:8] + "01"}
    visible = {value: n for _, value, n, *_ in got if n is not None}
    for value, n in visible.items():
        assert expected[value] == n, value
    assert UNMAPPED not in expected
    assert sum(expected.values()) == len(rows)
    # Everything not visible is accounted for by the hidden cells: the month's total less the visible counts.
    hidden = [value for _, value, n, *_ in got if n is None]
    assert sum(expected[v] for v in hidden) == len(rows) - sum(visible.values())


def test_the_type_slice_lists_every_type_the_register_holds_not_only_the_two_in_scope(built):
    cfg, rows, manifest, workspace = built
    labels = type_labels(cfg)
    column = cfg.pipeline["fields"][spec_of(cfg, TYPE)["derive"]["field"]]
    got = {value: n for _, value, n, *_ in read(workspace["public"] / "cube" / FLEET / f"{TYPE}.parquet")}
    assert got == dict(Counter(labels[r[column]] for r in rows))
    scope = cfg.pipeline["scope"]["vehicle"]
    in_scope = {r[scope["key"]] for r in reference.read(cfg.reference(scope["file"])) if r[scope["in_scope"]] == cfg.pipeline["boolean_true"]}
    assert len(got) > len(in_scope), "the fixture holds only the types of the default scope, so the test proves little"


def test_the_fleet_holds_the_vehicles_the_other_datasets_leave_out(built):
    cfg, rows, manifest, workspace = built
    surviving = manifest["datasets"]["registrations_surviving"]["rows"]
    assert manifest["datasets"][FLEET]["rows"] > surviving
    unmonthed = [r for r in rows if not r[cfg.pipeline["fields"]["registration_month"]]]
    assert unmonthed, "the fixture holds no vehicle without a month of first registration"


def test_the_usage_slice_and_the_pair_are_held_to_their_rules_and_the_manifest_says_so(built):
    cfg, rows, manifest, workspace = built
    entry = manifest["datasets"][FLEET]
    assert list(entry["small_cells"]) == [USAGE]
    assert list(entry["small_cell_pairs"]) == [PAIR]
    pair = entry["small_cell_pairs"][PAIR]
    assert pair["months"] == 1
    assert pair["cells_hidden_first_rule"] + pair["cells_hidden_by_slice"] + pair["cells_hidden_second_rule"] + pair["months_not_broken_down"] > 0
    slice_ = read(workspace["public"] / "cube" / FLEET / f"{USAGE}.parquet")
    assert any(n is None for _, _, n, *_ in slice_) or any(value == NOT_BROKEN_DOWN for _, value, *_ in slice_)


def test_neither_slice_of_the_fleet_nor_its_pair_carries_a_fuel_figure(built):
    """The fuel-eligible counts of the slices would bound the pair's hidden cells, which the audit does not see (D-135)."""
    _, _, _, workspace = built
    for path in (workspace["public"] / "cube" / FLEET / f"{USAGE}.parquet", workspace["public"] / "cube" / FLEET / f"{TYPE}.parquet",
                 workspace["public"] / "pairs" / FLEET / f"{PAIR}.parquet"):
        rows = read(path)
        assert rows, path.name
        assert all(r[-3:] == (None, None, None) for r in rows), path.name


def test_no_file_of_the_fleet_has_a_month_other_than_the_snapshots(built):
    cfg, rows, manifest, workspace = built
    snapshot = manifest["latest_snapshot"][:8] + "01"
    for path in [*(workspace["public"] / "cube" / FLEET).glob("*.parquet"), *(workspace["public"] / "pairs" / FLEET).glob("*.parquet")]:
        assert {r[0].isoformat() for r in read(path)} == {snapshot}, path.name


# --- the usage dimension is the fleet's alone ---------------------------------------------------------------------------


def test_the_usage_dimension_is_live_in_no_other_dataset_and_in_no_other_dataset_s_files(built):
    cfg, rows, manifest, workspace = built
    for dataset, entry in manifest["datasets"].items():
        if dataset == FLEET:
            continue
        assert USAGE not in entry.get("live_dimensions", []), dataset
        assert USAGE in entry.get("not_live", {}) or "not_built" in entry or "undefined" in entry, dataset
        assert not (workspace["public"] / "cube" / dataset / f"{USAGE}.parquet").exists()
        for pair in entry.get("live_pairs", []):
            assert USAGE not in pair.split("__"), dataset
        assert USAGE not in ((entry.get("facts") or {}).get("dimensions") or []), dataset


def test_the_usage_dimension_names_the_stock_as_the_only_dataset_it_applies_to():
    cfg = config.load()
    assert spec_of(cfg, USAGE)["applies_to"] == [FLEET]
    for dataset, spec in cfg.pipeline["datasets"].items():
        if dataset != FLEET:
            named = set(spec.get("dimensions") or []) | set(spec.get("facts") or []) | {d for p in spec.get("pairs") or [] for d in p}
            assert USAGE not in named, dataset


def test_no_owner_dimension_is_in_the_fact_table_of_any_dataset_and_the_fleet_has_none():
    cfg = config.load()
    owners = set(privacy.owner_dimensions(cfg))
    assert USAGE in owners, "the data map groups the field as the owner's, so the dimension is held to the rules"
    for dataset, spec in cfg.pipeline["datasets"].items():
        assert not owners & set(spec.get("facts") or []), dataset
    assert "facts" not in cfg.pipeline["datasets"][FLEET]


def test_the_stock_is_never_broken_down_by_the_year_or_the_month_of_first_registration():
    cfg = config.load()
    dmap = privacy.load_map(cfg)
    never = {cfg.pipeline["fields"][f] for f in cfg.pipeline["datasets"][FLEET]["not_by"]}
    assert never == {cfg.pipeline["fields"]["registration_year"], cfg.pipeline["fields"]["registration_month"]}
    for dim_id in cfg.pipeline["datasets"][FLEET]["dimensions"]:
        assert not privacy.fields_read(spec_of(cfg, dim_id), cfg.pipeline, dmap["derive_reads"]) & never, dim_id


def test_the_field_the_dimension_reads_is_marked_as_describing_the_vehicle_now_and_as_the_owners():
    cfg = config.load()
    dmap = privacy.load_map(cfg)
    name = cfg.pipeline["fields"][spec_of(cfg, USAGE)["derive"]["field"]]
    assert name in privacy.stock_only_fields(dmap) and name in privacy.owner_fields(dmap)
    entry = next(e for e in dmap["fields"] if e["name"] == name and e["source"] == privacy.REGISTER)
    assert entry["bound"] == spec_of(cfg, USAGE)["derive"]["field"]


# --- the lookup and its guard ---------------------------------------------------------------------------------------------


def test_every_label_names_one_value_and_no_value_is_missing_from_the_fixture_build(built):
    cfg, rows, manifest, workspace = built
    labels = usage_labels(cfg)
    assert len(set(labels.values())) == len(labels) >= 2
    entry = manifest["datasets"][FLEET]
    assert entry["unmapped_rates"][USAGE] == 0.0
    assert USAGE in cfg.pipeline["guardrails"]["abort_on_unmapped"]


def new_code(rows, cfg, count, first_id):
    column, template = usage_column(cfg), next(r for r in rows if r["OBJECTID"] == 62)
    known = set(usage_labels(cfg))
    values = [f"A NEW CODE {i}" for i in range(count)]
    assert not set(values) & known
    return [dict(template, OBJECTID=first_id + i, **{column: v}) for i, v in enumerate(values)]


def test_a_new_raw_value_is_unmapped_warns_with_headroom_and_stops_the_build_above_the_threshold(tmp_path, workspace):
    rows = load_rows()
    cfg0 = make_cfg(workspace)
    g = cfg0.pipeline["guardrails"]
    base = len(rows)
    rate = g["max_unmapped_rate_trailing"]
    over = math.floor(rate * base / (1 - rate)) + 1
    assert over >= 2
    under_rows = rows + new_code(rows, cfg0, over - 1, 5000)
    other = {k: v.parent / "under" / v.name for k, v in workspace.items()}
    _, _, ok = built_fixture(tmp_path / "under", other, under_rows)
    figures = ok["datasets"][FLEET]["unmapped_guard"][USAGE]
    assert figures["trailing"]["unmapped"] == over - 1 and figures["trailing"]["headroom_rows"] >= 0
    assert any(w.startswith(f"{FLEET}.{USAGE}:") and "warning level" in w for w in ok["warnings"]), ok["warnings"]
    beyond = rows + new_code(rows, cfg0, over, 6000)
    other = {k: v.parent / "over" / v.name for k, v in workspace.items()}
    with pytest.raises(GuardrailError) as info:
        built_fixture(tmp_path / "over", other, beyond)
    assert f"{FLEET}.{USAGE}: unmapped rate" in str(info.value), str(info.value)


def test_a_value_added_to_the_reference_file_maps_with_no_other_change(tmp_path, workspace):
    cfg0 = make_cfg(workspace)
    d = spec_of(cfg0, USAGE)["derive"]
    rows = load_rows()
    rows = rows + new_code(rows, cfg0, 1, 7000)
    ref = tmp_path / "reference"
    shutil.copytree(cfg0.reference("x").parent, ref)
    header = (ref / d["reference"]).read_text(encoding="utf-8").splitlines()[0].split(",")
    row = {c: "" for c in header}
    row[d["key"]], row[d["value"]] = "A NEW CODE 0", "A new label"
    with (ref / d["reference"]).open("a", encoding="utf-8", newline="") as fh:
        csv.DictWriter(fh, fieldnames=header, lineterminator="\n").writerow(row)
    cfg = make_cfg(workspace, reference_dir=ref)
    manifest = build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    assert manifest["datasets"][FLEET]["unmapped_rates"][USAGE] == 0.0


# --- the first table of the owner field -------------------------------------------------------------------------------------


def table_rows(template, counts, first_id):
    """Vehicles for a table of usage values by vehicle types: counts maps (usage index, type index) to a count."""
    cfg = config.load()
    usages = list(usage_labels(cfg))
    types = list(type_labels(cfg))
    column = usage_column(cfg)
    type_column = cfg.pipeline["fields"][spec_of(cfg, TYPE)["derive"]["field"]]
    body_column = cfg.pipeline["fields"]["body_type"]
    rows, next_id = [], first_id
    for (i, j), n in sorted(counts.items()):
        for _ in range(n):
            rows.append(dict(template, OBJECTID=next_id, **{column: usages[i], type_column: types[j], body_column: body_for_type(cfg, types[j], template[body_column])}))
            next_id += 1
    return rows



# Four usages by three types; (0, 0) is the one cell under 10.
RECTANGLE = {(0, 0): 9, (0, 1): 30, (0, 2): 20, (1, 0): 40, (1, 1): 12, (1, 2): 35, (2, 0): 25, (2, 1): 50, (2, 2): 15, (3, 0): 60, (3, 1): 11, (3, 2): 45}


def test_a_small_cell_of_the_fleet_is_hidden_with_the_rectangle_that_closes_it_and_the_totals_stay_public(tmp_path, workspace):
    template = next(r for r in load_rows() if r["OBJECTID"] == 62)
    rows = table_rows(template, RECTANGLE, 100)
    # Only the table's vehicles are in the register, so the events file that names countries the fixture lacks is replaced
    # by the frozen one the golden test builds from.
    cfg, _, manifest = built_fixture(tmp_path, workspace, rows, reference_dir=frozen_reference(tmp_path))
    cfg0 = config.load()
    usages = list(usage_labels(cfg0).values())
    types = list(type_labels(cfg0).values())
    pair = {(a, b): n for _, a, b, n, *_ in read(workspace["public"] / "pairs" / FLEET / f"{PAIR}.parquet")}
    hidden = {(i, j) for (i, j) in RECTANGLE if pair[(usages[i], types[j])] is None}
    assert hidden == {(0, 0), (0, 2), (2, 0), (2, 2)}
    slice_ = {v: n for _, v, n, *_ in read(workspace["public"] / "cube" / FLEET / f"{USAGE}.parquet")}
    assert slice_ == {usages[i]: sum(n for (a, _), n in RECTANGLE.items() if a == i) for i in range(4)}, "no usage is small, so none is hidden"
    assert manifest["datasets"][FLEET]["small_cell_pairs"][PAIR]["cells_hidden_first_rule"] == 1


def test_no_form_of_not_recorded_is_listed_for_the_field_and_the_map_lists_none():
    cfg = config.load()
    s = cfg.pipeline["sentinels"]
    column = usage_column(cfg)
    assert not [r for r in reference.read(cfg.reference(s["file"])) if r[s["field"]] == column]
    entry = next(e for e in privacy.load_map(cfg)["fields"] if e["name"] == column and e["source"] == privacy.REGISTER)
    assert entry["not_recorded"] == [] and entry["sentinels_pending"] == []
