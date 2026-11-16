"""registrations_flow_wider: true registrations on the wider scope (D-106, D-113).

The same supplied store, import-status rule and code as registrations_flow; the only difference is which vehicle types it
counts (the types the vehicle scope file marks in its trade_scope column in place of those it marks in_scope). The fixture
history holds no type outside the default scope, so a copy of it with rows of the added types is supplied. No vehicle type,
status or group is named here: they are read from the scope files and config, so a reference edit is not a code edit.
"""

from __future__ import annotations

import copy
import csv
import json
import shutil
from collections import Counter

import duckdb
import pytest

from pipeline import build, guardrails, normalise, reference, schema, supplied
from pipeline.errors import GuardrailError

from .conftest import FIXTURES, NOW, load_rows, make_cfg, source_for, write_pages

SOURCE = "nzta_dashboard"
WIDER, FLOW, SURVIVING = "registrations_flow_wider", "registrations_flow", "registrations_surviving"
HISTORY = FIXTURES / "dashboard_history.csv"
ADDED_VEHICLES = 5


def expect_abort(fn, fragment):
    with pytest.raises(GuardrailError) as info:
        fn()
    assert fragment in str(info.value), str(info.value)


def scope_rows(cfg):
    return reference.read(cfg.reference(cfg.pipeline["scope"]["vehicle"]["file"]))


def wider_only_types(cfg) -> list[str]:
    """The types the wider scope counts and the default scope does not."""
    vehicle, true = cfg.pipeline["scope"]["vehicle"], cfg.pipeline["boolean_true"]
    column = vehicle["also"][next(iter(vehicle["also"]))]
    return [r[vehicle["key"]] for r in scope_rows(cfg) if r[column] == true and r[vehicle["in_scope"]] != true]


def counted_statuses(cfg) -> set[str]:
    p = cfg.pipeline
    status, true = p["scope"]["status"], p["boolean_true"]
    return {r[status["key"]] for r in reference.read(cfg.reference(status["file"]))
            if r[status["in_scope"]] == true and r[status["fleet_entry"]] == true}


def history_with_added_types(cfg, tmp_path):
    """The fixture history plus, in every month, `ADDED_VEHICLES` vehicles of each type only the wider scope counts. The
    template is the first row of a type in the default scope with a status both datasets count; its make and model are
    ones the reference files know, so the added rows are mapped like any other."""
    p, s = cfg.pipeline, cfg.supplied(SOURCE)
    vcol, scol, ccol = s["fields"]["vehicle_type"], s["fields"]["import_status"], s["count_column"]
    default = {r[p["scope"]["vehicle"]["key"]] for r in scope_rows(cfg) if r[p["scope"]["vehicle"]["in_scope"]] == p["boolean_true"]}
    with HISTORY.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        header, rows = reader.fieldnames, list(reader)
    statuses = counted_statuses(cfg)
    months = sorted({r[s["month"]["column"]] for r in rows})
    template = next(r for r in rows if r[vcol] in default and r[scol] in statuses)
    added = [dict(template, **{s["month"]["column"]: m, vcol: t, ccol: str(ADDED_VEHICLES)})
             for m in months for t in wider_only_types(cfg)]
    path = tmp_path / "history_wider.csv"
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows + added)
    return path, rows + added


def expected_months(cfg, rows, types: set[str]) -> dict[str, int]:
    """Vehicles per month the store holds for these types and the statuses the datasets count, read from the file."""
    s = cfg.supplied(SOURCE)
    statuses = counted_statuses(cfg)
    out: Counter = Counter()
    for r in rows:
        if r[s["fields"]["vehicle_type"]] in types and r[s["fields"]["import_status"]] in statuses:
            month = r[s["month"]["column"]]
            out[month] += int(r[s["count_column"]])
    return dict(out)


def month_key(cfg, label: str) -> str:
    from datetime import datetime
    return datetime.strptime(label, cfg.supplied(SOURCE)["month"]["format"]).strftime("%Y-%m")


def types_in(cfg, column: str) -> set[str]:
    p = cfg.pipeline
    vehicle, true = p["scope"]["vehicle"], p["boolean_true"]
    return {r[vehicle["key"]] for r in scope_rows(cfg) if r[column] == true}


def run(tmp_path, cfg, state=None, name="pages", publish=True):
    rows = load_rows()
    return build.build(cfg, source_for(rows), write_pages(tmp_path / name, rows), state, NOW, publish=publish)


def workspace_for(tmp):
    return {"staging": tmp / "staging", "public": tmp / "public", "state": tmp / "state" / "last_good.json",
            "snapshots": tmp / "snapshots", "supplied": tmp / "supplied"}


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("wider")
    workspace = workspace_for(tmp)
    cfg = make_cfg(workspace)
    path, rows = history_with_added_types(cfg, tmp)
    supplied.supply(cfg, SOURCE, path, taken="2026-09-05", echo=lambda *_: None)
    manifest = run(tmp, cfg)
    return {"cfg": cfg, "rows": rows, "manifest": manifest, "public": workspace["public"], "state": workspace["state"], "tmp": tmp,
            "workspace": workspace, "history": path}


def test_its_month_totals_are_the_stores_vehicles_of_the_types_the_wider_scope_counts(built):
    cfg, rows, manifest = built["cfg"], built["rows"], built["manifest"]
    wider, flow = types_in(cfg, "trade_scope"), types_in(cfg, "in_scope")
    expected = {month_key(cfg, m): n for m, n in expected_months(cfg, rows, wider).items()}
    state = json.loads(built["state"].read_text(encoding="utf-8"))
    assert state["month_counts"][WIDER] == expected
    assert manifest["datasets"][WIDER]["rows"] == sum(expected.values())
    flow_expected = {month_key(cfg, m): n for m, n in expected_months(cfg, rows, flow).items()}
    assert state["month_counts"][FLOW] == flow_expected
    # The difference is exactly the added types, every month.
    added = {month_key(cfg, m): n for m, n in expected_months(cfg, rows, set(wider_only_types(cfg))).items()}
    assert {m: expected[m] - flow_expected[m] for m in expected} == added
    assert all(n == ADDED_VEHICLES * len(wider_only_types(cfg)) for n in added.values())


def test_every_slice_and_the_fact_table_sum_to_those_totals(built):
    cfg, manifest, public = built["cfg"], built["manifest"], built["public"]
    entry = manifest["datasets"][WIDER]
    con = duckdb.connect()
    for dim in entry["live_dimensions"]:
        path = (public / "cube" / WIDER / f"{dim}.parquet").as_posix()
        assert con.execute(f"SELECT sum(n) FROM read_parquet('{path}')").fetchone()[0] == entry["rows"], dim
    total = con.execute(f"SELECT sum(n) FROM read_parquet('{(public / 'facts' / WIDER / 'n.parquet').as_posix()}')").fetchone()[0]
    assert total == entry["rows"]
    assert entry["facts"]["dimensions"] and not entry["facts"]["not_live"]
    assert set(entry["facts"]["dimensions"]) <= set(entry["live_dimensions"])


def test_the_group_dimension_counts_each_group_as_the_scope_file_says(built):
    cfg, rows, public = built["cfg"], built["rows"], built["public"]
    vehicle, true = cfg.pipeline["scope"]["vehicle"], cfg.pipeline["boolean_true"]
    group_of = {r[vehicle["key"]]: r["trade_group"] for r in scope_rows(cfg) if r[vehicle["also"][next(iter(vehicle["also"]))]] == true}
    s, statuses = cfg.supplied(SOURCE), counted_statuses(cfg)
    expected: Counter = Counter()
    for r in rows:
        if r[s["fields"]["vehicle_type"]] in group_of and r[s["fields"]["import_status"]] in statuses:
            expected[group_of[r[s["fields"]["vehicle_type"]]]] += int(r[s["count_column"]])
    assert len(expected) == 2
    con = duckdb.connect()
    sliced = dict(con.execute(f"SELECT dim_value, sum(n) FROM read_parquet('{(public / 'cube' / WIDER / 'trade_group.parquet').as_posix()}') GROUP BY 1").fetchall())
    assert sliced == dict(expected)
    assert built["manifest"]["datasets"][WIDER]["unmapped_rates"]["trade_group"] == 0.0


def test_the_group_dimension_is_offered_to_no_other_dataset(built):
    manifest = built["manifest"]
    for dataset in (SURVIVING, FLOW):
        assert "trade_group" not in manifest["datasets"][dataset]["live_dimensions"]
        assert not (built["public"] / "cube" / dataset / "trade_group.parquet").exists()


def test_its_dimensions_are_the_flow_datasets_where_the_field_exists_plus_the_group(built):
    entry, flow = built["manifest"]["datasets"][WIDER], built["manifest"]["datasets"][FLOW]
    assert entry["live_dimensions"] == [*flow["live_dimensions"][:flow["live_dimensions"].index("vehicle_type") + 1], "trade_group",
                                        *flow["live_dimensions"][flow["live_dimensions"].index("vehicle_type") + 1:]]
    # A dimension the source cannot carry is not live there either, and says so in the same words.
    assert {d: why for d, why in entry["not_live"].items() if d != "trade_group"} == {d: why for d, why in flow["not_live"].items() if d != "trade_group"}
    assert set(entry["supplied"]) == set(flow["supplied"])
    assert entry["supplied"] == flow["supplied"]


def test_adding_the_dataset_changes_no_byte_of_the_others(built, tmp_path):
    """Built again without the wider dataset in config, every file of registrations_flow and registrations_surviving is
    the same, and so is each one's manifest entry: widening the scope of one dataset moves no other's rows or guards."""
    cfg = built["cfg"]
    workspace = workspace_for(tmp_path)
    narrow = make_cfg(workspace)
    del narrow.pipeline["datasets"][WIDER]
    shutil.copytree(cfg.supplied_store(SOURCE), narrow.supplied_store(SOURCE))
    manifest = run(tmp_path, narrow, name="narrow")
    assert WIDER not in manifest["datasets"]
    for dataset in (SURVIVING, FLOW):
        assert manifest["datasets"][dataset] == built["manifest"]["datasets"][dataset], dataset
        for folder in ("cube", "facts", "pairs"):
            left, right = built["public"] / folder / dataset, workspace["public"] / folder / dataset
            assert left.exists() == right.exists(), (folder, dataset)
            if not left.exists():
                continue
            files = sorted(p.relative_to(left) for p in left.rglob("*") if p.is_file())
            assert files == sorted(p.relative_to(right) for p in right.rglob("*") if p.is_file())
            assert all((left / f).read_bytes() == (right / f).read_bytes() for f in files), (folder, dataset)


def test_its_hybrids_are_judged_on_its_own_vehicles(built):
    block = built["manifest"]["datasets"][WIDER]["mild_hybrid_identification_coverage"]
    flow = built["manifest"]["datasets"][FLOW]["mild_hybrid_identification_coverage"]
    assert block["mild_split_published"] in (True, False) and block["all_time"]["source_hybrids"] >= flow["all_time"]["source_hybrids"]
    assert built["manifest"]["datasets"][WIDER]["model_cap"]["model"]["cap"] == built["manifest"]["datasets"][FLOW]["model_cap"]["model"]["cap"]
    state = json.loads(built["state"].read_text(encoding="utf-8"))
    assert state["mild_split"][WIDER]["published"] == block["mild_split_published"]


def test_the_first_build_that_has_the_dataset_is_accepted_and_the_later_ones_guard_it(built, tmp_path):
    cfg, state_path = built["cfg"], built["state"]
    full = json.loads(state_path.read_text(encoding="utf-8"))
    # A state as the last good build was before this dataset existed: nothing about it, anywhere.
    before = copy.deepcopy(full)
    for key in ("live_dimensions", "month_counts", "mild_split", "supplied_totals", "supplied_files"):
        before[key].pop(WIDER, None)
    assert all(WIDER not in before[k] for k in ("live_dimensions", "month_counts", "mild_split", "supplied_totals", "supplied_files"))
    manifest = run(tmp_path, cfg, state=copy.deepcopy(before), name="first", publish=False)
    assert manifest["datasets"][WIDER]["rows"] > 0
    assert not any(WIDER in w and "flip" in w.lower() for w in manifest["warnings"])

    # Once recorded, a month of the store whose total moved is refused, and so is a month that has emptied.
    moved = copy.deepcopy(full)
    month = next(iter(moved["supplied_totals"][WIDER]))
    moved["supplied_totals"][WIDER][month] *= 2
    expect_abort(lambda: run(tmp_path, cfg, state=moved, name="moved", publish=False), f"{WIDER}: 1 month(s) differ from the last good build")
    floor = cfg.pipeline["guardrails"]["zero_row_min_previous_rows"]
    previous = {**full, "month_counts": {**full["month_counts"], WIDER: {**full["month_counts"][WIDER], month: floor}}}
    current = {**full, "month_counts": {**full["month_counts"], WIDER: {m: n for m, n in full["month_counts"][WIDER].items() if m != month}}}
    aborts, _ = guardrails.compare(cfg, current, previous)
    assert any(a.startswith(f"{WIDER}: 1 month(s)") and month in a for a in aborts), aborts
    aborts, _ = guardrails.compare(cfg, current, before)
    assert not any(WIDER in a for a in aborts), "a dataset with no earlier record has nothing to be emptied from"
    # A split recorded as the other answer is announced, as for any dataset.
    flipped = copy.deepcopy(full)
    flipped["mild_split"][WIDER]["published"] = not flipped["mild_split"][WIDER]["published"]
    manifest = run(tmp_path, cfg, state=flipped, name="flipped", publish=False)
    assert any(w.startswith(f"{WIDER}: the mild hybrid split was") for w in manifest["warnings"])
    # A dataset recorded as built cannot quietly vanish.
    bare = make_cfg({**built["workspace"], "supplied": tmp_path / "nowhere"})
    expect_abort(lambda: run(tmp_path, bare, state=copy.deepcopy(full), name="gone", publish=False), f"{WIDER}: it was built in the last good run")


def test_a_store_trimmed_narrower_than_the_wider_scope_is_refused(built):
    """The model of a (type, status) pair the dataset counts must be in the store. A ledger whose trim leaves one out would
    otherwise give the dataset a model dimension that is silently not recorded for those vehicles."""
    cfg = built["cfg"]
    source = cfg.supplied(SOURCE)
    ledger = json.loads(supplied.store_paths(cfg, SOURCE)[1].read_text(encoding="utf-8"))
    assert supplied.scope_problems(cfg, source, ledger).refusals == []
    cut = copy.deepcopy(ledger)
    dropped = next(pair for pair in cut["outside_scope"]["counted"] if pair[0] in wider_only_types(cfg))
    cut["outside_scope"]["counted"].remove(dropped)
    # The ledger's own rule is judged on the dataset it names, which counts these pairs through the same column; a rule
    # config does not have is judged too. The pair is refused for the dataset that counts it beyond the trim.
    refusals = supplied.scope_problems(cfg, source, cut).refusals
    assert refusals and any(dropped[0] in r or WIDER in r for r in refusals), refusals
    assert supplied.counted_pairs(cfg, WIDER) >= supplied.counted_pairs(cfg, FLOW)
    assert {tuple(p) for p in ledger["outside_scope"]["counted"]} == supplied.counted_pairs(cfg, WIDER)


def test_a_dataset_must_name_exactly_one_scope_flag(workspace):
    cfg = make_cfg(workspace)
    flags = list(normalise.scope_columns(cfg))
    assert len(flags) >= 2
    for require in ([], ["fleet_entry"], flags[:2] + ["fleet_entry"]):
        with pytest.raises(GuardrailError) as info:
            normalise.scope_flag(cfg, "x", require)
        assert "require must name exactly one of the scope flags" in str(info.value)
    assert normalise.scope_flag(cfg, "x", [flags[1], "fleet_entry"]) == flags[1]


def test_the_scope_flags_of_the_build_agree_with_the_functions_that_read_the_scope_files(tmp_path):
    """build_rows sets each flag in SQL, scope_flags computes it in Python: one answer for every (type, status) pair."""
    cfg = make_cfg({})
    p = cfg.pipeline
    vehicle, status = p["scope"]["vehicle"], p["scope"]["status"]
    vehicles = {r[vehicle["key"]]: r for r in scope_rows(cfg)}
    statuses = {r[status["key"]]: r for r in reference.read(cfg.reference(status["file"]))}
    expected = json.loads(cfg.path("expected_schema").read_text(encoding="utf-8"))
    types = schema.pull_types(expected, list(p["fields"].values()))
    con = duckdb.connect()
    con.execute(f"CREATE TABLE raw ({', '.join(f'{reference.quote(n)} {t}' for n, t in types.items())})")
    for v in vehicles:
        for s in statuses:
            con.execute(f"INSERT INTO raw ({reference.quote(cfg.source_field(vehicle['field']))}, "
                        f"{reference.quote(cfg.source_field(status['field']))}) VALUES (?, ?)", [v, s])
    normalise.build_src(con, cfg, types, {f["name"] for f in expected["fields"]})
    normalise.build_rows(con, cfg)
    flags = normalise.scope_flags(cfg)
    names = list(normalise.scope_columns(cfg))
    assert len(names) >= 2
    built = {(v, s): tuple(row) for v, s, *row in con.execute(
        f"SELECT {reference.quote(vehicle['field'])}, {reference.quote(status['field'])}, "
        f"{', '.join(reference.quote(n) for n in names)} FROM rows").fetchall()}
    assert len(built) == len(vehicles) * len(statuses)
    for (v, s), got in built.items():
        assert got == tuple(flags[n](vehicles[v], statuses[s]) for n in names), (v, s)
    # The wider scope never counts fewer types than the default one.
    assert all(wide for default, wide, *_ in built.values() if default)


def test_the_committed_stores_months_are_what_the_wider_dataset_counts(tmp_path):
    """The dataset can never drift from its source silently: built from the committed store, each month's total is the
    store's own vehicles of the types the wider scope counts and the statuses the datasets count, summed here from the
    Parquet file with the scope files read in Python, and the default-scope dataset's is the same sum over its types."""
    from datetime import date
    cfg = make_cfg({"staging": tmp_path / "staging", "public": tmp_path / "public", "state": tmp_path / "state" / "last_good.json",
                    "snapshots": tmp_path / "snapshots"})
    registrations, _ = supplied.store_paths(cfg, SOURCE)
    if not registrations.exists():
        pytest.skip("the dashboard's store is not committed")
    p = cfg.pipeline
    expected_schema = json.loads(cfg.path("expected_schema").read_text(encoding="utf-8"))
    types = schema.pull_types(expected_schema, list(p["fields"].values()))
    con = duckdb.connect()
    staging = tmp_path / "build"
    staging.mkdir()
    aborts, warnings = [], []
    latest = duckdb.connect().execute(f"SELECT max(month) FROM read_parquet('{registrations.as_posix()}')").fetchone()[0]
    _, counts, _, _, _ = build.build_supplied(con, cfg, SOURCE, types, {f["name"] for f in expected_schema["fields"]},
                                              date(latest.year, latest.month, 1), None, staging, aborts, warnings)
    assert not aborts, aborts
    vehicle, status = p["scope"]["vehicle"], p["scope"]["status"]
    vehicles = {r[vehicle["key"]]: r for r in scope_rows(cfg)}
    statuses = {r[status["key"]]: r for r in reference.read(cfg.reference(status["file"]))}
    flags = normalise.scope_flags(cfg)
    stored = con.execute(
        f"SELECT strftime(month, '%Y-%m'), vehicle_type, import_status, sum(vehicles) FROM read_parquet('{registrations.as_posix()}') GROUP BY ALL"
    ).fetchall()
    for dataset in (FLOW, WIDER):
        require = p["datasets"][dataset]["require"]
        expected: Counter = Counter()
        for month, v, s, n in stored:
            if v in vehicles and s in statuses and all(flags[f](vehicles[v], statuses[s]) for f in require):
                expected[month] += int(n)
        assert counts[dataset] == dict(expected), dataset
    assert sum(counts[WIDER].values()) > sum(counts[FLOW].values())
    assert all(counts[WIDER][m] >= counts[FLOW][m] for m in counts[FLOW])
