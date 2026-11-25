"""new_registrations: one dataset of first registrations, new and used, of the five vehicle types of the trade scope (D-158).

It replaces registrations_flow (the default scope's two types, D-084) and registrations_flow_wider (five types, D-106, D-113): vehicle type is
a condition of a question, not a dataset, so a question for the narrower scope is this dataset narrowed to the vehicle types the vehicle scope
file marks in its in_scope column. The same supplied store, import-status rule and code as before. The fixture history holds no type outside
the default scope, so a copy of it with rows of the added types is supplied. No vehicle type, status or group is named here: they are read from
the scope files and config, so a reference edit is not a code edit.
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
NEW, SURVIVING = "new_registrations", "registrations_surviving"
HISTORY = FIXTURES / "dashboard_history.csv"
ADDED_VEHICLES = 5


def expect_abort(fn, fragment):
    with pytest.raises(GuardrailError) as info:
        fn()
    assert fragment in str(info.value), str(info.value)


def scope_rows(cfg):
    return reference.read(cfg.reference(cfg.pipeline["scope"]["vehicle"]["file"]))


def added_types(cfg) -> list[str]:
    """The types the dataset counts and the default scope does not."""
    vehicle, true = cfg.pipeline["scope"]["vehicle"], cfg.pipeline["boolean_true"]
    column = vehicle["also"][next(iter(vehicle["also"]))]
    return [r[vehicle["key"]] for r in scope_rows(cfg) if r[column] == true and r[vehicle["in_scope"]] != true]


def counted_statuses(cfg) -> set[str]:
    p = cfg.pipeline
    status, true = p["scope"]["status"], p["boolean_true"]
    return {r[status["key"]] for r in reference.read(cfg.reference(status["file"]))
            if r[status["in_scope"]] == true and r[status["fleet_entry"]] == true}


def history_with_added_types(cfg, tmp_path):
    """The fixture history plus, in every month, `ADDED_VEHICLES` vehicles of each type only the trade scope counts. The
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
             for m in months for t in added_types(cfg)]
    path = tmp_path / "history_with_added_types.csv"
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
    tmp = tmp_path_factory.mktemp("new_registrations")
    workspace = workspace_for(tmp)
    cfg = make_cfg(workspace)
    path, rows = history_with_added_types(cfg, tmp)
    supplied.supply(cfg, SOURCE, path, taken="2026-09-05", echo=lambda *_: None)
    manifest = run(tmp, cfg)
    return {"cfg": cfg, "rows": rows, "manifest": manifest, "public": workspace["public"], "state": workspace["state"], "tmp": tmp,
            "workspace": workspace, "history": path}


def labels_of(cfg, column: str) -> set[str]:
    """The labels a fact table's vehicle type column holds for the types a scope column marks: the dimension's own derive rule names the label column."""
    derive = next(d for d in cfg.dimensions["dimensions"] if d["id"] == "vehicle_type")["derive"]
    true = cfg.pipeline["boolean_true"]
    return {r[derive["value"]] for r in scope_rows(cfg) if r[column] == true}


def fact_rows(public, dataset: str, columns: list[str]):
    """The dataset's fact table as rows of (month, *columns, n): the files hold the same rows in the same order."""
    con = duckdb.connect()
    names = ["month", *columns, "n"]
    selects = ", ".join(f"{c}.v AS {c}" for c in names)
    joins = " ".join(f"JOIN (SELECT row_number() OVER () AS i, {c} AS v FROM read_parquet('{(public / 'facts' / dataset / f'{c}.parquet').as_posix()}')) {c} USING (i)"
                     for c in names[1:])
    sql = (f"SELECT {selects} FROM (SELECT row_number() OVER () AS i, month AS v FROM read_parquet('{(public / 'facts' / dataset / 'month.parquet').as_posix()}')) month {joins}")
    return con.execute(sql).fetchall()


def test_its_month_totals_are_the_stores_vehicles_of_the_five_types_and_the_narrower_scope_is_a_condition(built):
    """A question for the types of the default scope is this dataset narrowed to them: through the fact table it gives the months the store
    holds for those types, which is what the dataset it replaced counted."""
    cfg, rows, manifest = built["cfg"], built["rows"], built["manifest"]
    five, two = types_in(cfg, "trade_scope"), types_in(cfg, "in_scope")
    state = json.loads(built["state"].read_text(encoding="utf-8"))
    expected = {month_key(cfg, m): n for m, n in expected_months(cfg, rows, five).items()}
    assert state["month_counts"][NEW] == expected
    assert manifest["datasets"][NEW]["rows"] == sum(expected.values())
    narrowed = {month_key(cfg, m): n for m, n in expected_months(cfg, rows, two).items()}
    two_labels = labels_of(cfg, "in_scope")
    through_facts: dict[str, int] = {}
    for month, vehicle_type, n in fact_rows(built["public"], NEW, ["vehicle_type"]):
        if vehicle_type in two_labels:
            through_facts[month.strftime("%Y-%m")] = through_facts.get(month.strftime("%Y-%m"), 0) + n
    assert through_facts == narrowed
    # The difference is exactly the added types, every month.
    added = {month_key(cfg, m): n for m, n in expected_months(cfg, rows, set(added_types(cfg))).items()}
    assert {m: expected[m] - narrowed[m] for m in expected} == added
    assert all(n == ADDED_VEHICLES * len(added_types(cfg)) for n in added.values())


def test_narrowed_to_each_vehicle_type_and_status_the_fact_table_is_the_stores_count(built):
    """Every vehicle type the dataset counts, and each of those narrowed by import status, through the fact table: the counts the store holds."""
    cfg, rows, public = built["cfg"], built["rows"], built["public"]
    s, p = cfg.supplied(SOURCE), cfg.pipeline
    derive = next(d for d in cfg.dimensions["dimensions"] if d["id"] == "vehicle_type")["derive"]
    label_of = {r[derive["key"]]: r[derive["value"]] for r in scope_rows(cfg)}
    status_map = next(d for d in cfg.dimensions["dimensions"] if d["id"] == "import_status")["derive"]
    status_label = {r[status_map["key"]]: r[status_map["value"]] for r in reference.read(cfg.reference(status_map["reference"]))}
    counted = counted_statuses(cfg)
    five = types_in(cfg, "trade_scope")
    expected: Counter = Counter()
    for r in rows:
        t, st = r[s["fields"]["vehicle_type"]], r[s["fields"]["import_status"]]
        if t in five and st in counted:
            expected[(label_of[t], status_label[st])] += int(r[s["count_column"]])
    got: Counter = Counter()
    for _, vt, st, n in fact_rows(public, NEW, ["vehicle_type", "import_status"]):
        got[(vt, st)] += n
    assert got == expected
    assert len({vt for vt, _ in expected}) == len(five) and len({st for _, st in expected}) > 1, "the fixture holds every type and more than one status"


def test_every_slice_and_the_fact_table_sum_to_those_totals(built):
    cfg, manifest, public = built["cfg"], built["manifest"], built["public"]
    entry = manifest["datasets"][NEW]
    con = duckdb.connect()
    for dim in entry["live_dimensions"]:
        path = (public / "cube" / NEW / f"{dim}.parquet").as_posix()
        assert con.execute(f"SELECT sum(n) FROM read_parquet('{path}')").fetchone()[0] == entry["rows"], dim
    total = con.execute(f"SELECT sum(n) FROM read_parquet('{(public / 'facts' / NEW / 'n.parquet').as_posix()}')").fetchone()[0]
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
    sliced = dict(con.execute(f"SELECT dim_value, sum(n) FROM read_parquet('{(public / 'cube' / NEW / 'trade_group.parquet').as_posix()}') GROUP BY 1").fetchall())
    assert sliced == dict(expected)
    assert built["manifest"]["datasets"][NEW]["unmapped_rates"]["trade_group"] == 0.0


def test_the_group_dimension_is_offered_to_no_other_dataset(built):
    manifest = built["manifest"]
    for dataset in (SURVIVING,):
        assert "trade_group" not in manifest["datasets"][dataset]["live_dimensions"]
        assert not (built["public"] / "cube" / dataset / "trade_group.parquet").exists()


def test_its_dimensions_hold_the_group_beside_the_vehicle_type_and_say_why_the_others_are_not_live(built):
    entry = built["manifest"]["datasets"][NEW]
    live = entry["live_dimensions"]
    assert live[live.index("vehicle_type") + 1] == "trade_group"
    assert entry["facts"]["dimensions"] == [d for d in built["cfg"].pipeline["datasets"][NEW]["facts"] if d in live]
    # A dimension the source cannot carry is not live, and says so in the source's words.
    assert entry["not_live"], "the dashboard carries no gross vehicle mass or engine size: some dimensions are not live"
    assert all(why.startswith(("the source does not carry", "does not apply")) for why in entry["not_live"].values()), entry["not_live"]
    assert entry["supplied"]["months"]["count"] > 0


def test_adding_the_dataset_changes_no_byte_of_the_others(built, tmp_path):
    """Built again with no store for this dataset to read, so it is not built, every file of registrations_surviving is the same, and
    so is its manifest entry: a dataset read from the dashboard's store moves no other dataset's rows or guards."""
    cfg = built["cfg"]
    workspace = workspace_for(tmp_path)
    # A reference folder whose published figures are header-only: the live rows name this dataset, and a build that does not
    # have the dataset must stop on them (test_reconcile.py), which is not what this test is about.
    reference = tmp_path / "reference_without_figures"
    shutil.copytree(cfg.reference("x").parent, reference)
    live = cfg.reference(cfg.pipeline["reconciliation"]["figures_file"])
    (reference / live.name).write_text(live.read_text(encoding="utf-8").splitlines()[0] + "\n", encoding="utf-8", newline="\n")
    narrow = make_cfg(workspace, reference_dir=reference)
    manifest = run(tmp_path, narrow, name="narrow")
    assert "not_built" in manifest["datasets"][NEW]
    for dataset in (SURVIVING,):
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
    block = built["manifest"]["datasets"][NEW]["mild_hybrid_identification_coverage"]
    assert block["mild_split_published"] in (True, False) and block["all_time"]["source_hybrids"] > 0
    assert built["manifest"]["datasets"][NEW]["model_cap"]["model"]["cap"] > 0
    state = json.loads(built["state"].read_text(encoding="utf-8"))
    assert state["mild_split"][NEW]["published"] == block["mild_split_published"]


def test_the_first_build_that_has_the_dataset_is_accepted_and_the_later_ones_guard_it(built, tmp_path):
    cfg, state_path = built["cfg"], built["state"]
    full = json.loads(state_path.read_text(encoding="utf-8"))
    # A state as the last good build was before this dataset existed: nothing about it, anywhere.
    before = copy.deepcopy(full)
    for key in ("live_dimensions", "month_counts", "mild_split", "supplied_totals", "supplied_files"):
        before[key].pop(NEW, None)
    assert all(NEW not in before[k] for k in ("live_dimensions", "month_counts", "mild_split", "supplied_totals", "supplied_files"))
    manifest = run(tmp_path, cfg, state=copy.deepcopy(before), name="first", publish=False)
    assert manifest["datasets"][NEW]["rows"] > 0
    assert not any(NEW in w and "flip" in w.lower() for w in manifest["warnings"])

    # Once recorded, a month of the store whose total moved is refused, and so is a month that has emptied.
    moved = copy.deepcopy(full)
    month = next(iter(moved["supplied_totals"][NEW]))
    moved["supplied_totals"][NEW][month] *= 2
    expect_abort(lambda: run(tmp_path, cfg, state=moved, name="moved", publish=False), f"{NEW}: 1 month(s) differ from the last good build")
    floor = cfg.pipeline["guardrails"]["zero_row_min_previous_rows"]
    previous = {**full, "month_counts": {**full["month_counts"], NEW: {**full["month_counts"][NEW], month: floor}}}
    current = {**full, "month_counts": {**full["month_counts"], NEW: {m: n for m, n in full["month_counts"][NEW].items() if m != month}}}
    aborts, _ = guardrails.compare(cfg, current, previous)
    assert any(a.startswith(f"{NEW}: 1 month(s)") and month in a for a in aborts), aborts
    aborts, _ = guardrails.compare(cfg, current, before)
    assert not any(NEW in a for a in aborts), "a dataset with no earlier record has nothing to be emptied from"
    # A split recorded as the other answer is announced, as for any dataset.
    flipped = copy.deepcopy(full)
    flipped["mild_split"][NEW]["published"] = not flipped["mild_split"][NEW]["published"]
    manifest = run(tmp_path, cfg, state=flipped, name="flipped", publish=False)
    assert any(w.startswith(f"{NEW}: the mild hybrid split was") for w in manifest["warnings"])
    # A dataset recorded as built cannot quietly vanish.
    bare = make_cfg({**built["workspace"], "supplied": tmp_path / "nowhere"})
    expect_abort(lambda: run(tmp_path, bare, state=copy.deepcopy(full), name="gone", publish=False), f"{NEW}: it was built in the last good run")


CARRIED = ("live_dimensions", "month_counts", "mild_split", "supplied_totals", "supplied_files")


def left_by(full: dict, old: str) -> dict:
    """The last good state as it was when the dataset's predecessor was built under another id: its records are under that id, none under this one's."""
    state = copy.deepcopy(full)
    for key in CARRIED:
        state[key][old] = state[key].pop(NEW)
    return state


def test_the_dataset_is_compared_with_the_records_of_the_one_it_took_the_place_of(built, tmp_path):
    cfg, full = make_cfg(built["workspace"]), json.loads(built["state"].read_text(encoding="utf-8"))
    (old,) = cfg.pipeline["datasets"][NEW]["continues"]
    assert old not in cfg.pipeline["datasets"], "the id it continues is retired"
    left = left_by(full, old)
    assert all(NEW not in left[key] and old in left[key] for key in CARRIED)

    # A month of the store whose total moved since then is refused although no record is under this dataset's own id.
    moved = copy.deepcopy(left)
    month = next(iter(moved["supplied_totals"][old]))
    moved["supplied_totals"][old][month] *= 2
    expect_abort(lambda: run(tmp_path, cfg, state=moved, name="moved", publish=False), f"{NEW}: 1 month(s) differ from the last good build")
    # With nothing continued the same state compares nothing: the lapse the list closes.
    alone = make_cfg(built["workspace"])
    alone.pipeline["datasets"][NEW].pop("continues")
    run(tmp_path, alone, state=copy.deepcopy(moved), name="alone", publish=False)

    # A month that has emptied and a split that flipped are read the same way.
    floor = cfg.pipeline["guardrails"]["zero_row_min_previous_rows"]
    inherited = guardrails.inherit_history(cfg, left)
    assert inherited["month_counts"][NEW] == left["month_counts"][old] and inherited["mild_split"][NEW] == left["mild_split"][old]
    previous = {**inherited, "month_counts": {**inherited["month_counts"], NEW: {**inherited["month_counts"][NEW], month: floor}}}
    current = {**full, "month_counts": {**full["month_counts"], NEW: {m: n for m, n in full["month_counts"][NEW].items() if m != month}}}
    aborts, _ = guardrails.compare(cfg, current, previous)
    assert any(a.startswith(f"{NEW}: 1 month(s)") and month in a for a in aborts), aborts
    flipped = copy.deepcopy(left)
    flipped["mild_split"][old]["published"] = not flipped["mild_split"][old]["published"]
    manifest = run(tmp_path, cfg, state=flipped, name="flipped", publish=False)
    assert any(w.startswith(f"{NEW}: the mild hybrid split was") for w in manifest["warnings"])
    # A dataset recorded as built cannot quietly vanish, and the record it inherits says it was built.
    bare = make_cfg({**built["workspace"], "supplied": tmp_path / "nowhere"})
    expect_abort(lambda: run(tmp_path, bare, state=copy.deepcopy(left), name="gone", publish=False), f"{NEW}: it was built in the last good run")
    # What the run writes back is its own build, under its own id, and the old id's record is not carried on.
    manifest = run(tmp_path, cfg, state=copy.deepcopy(left), name="written", publish=True)
    written = json.loads(built["state"].read_text(encoding="utf-8"))
    assert NEW in written["month_counts"] and old not in written["month_counts"] and old not in written["supplied_totals"]


def test_a_record_of_the_datasets_own_is_not_replaced_and_a_bad_state_is_left_alone(built):
    cfg, full = make_cfg(built["workspace"]), json.loads(built["state"].read_text(encoding="utf-8"))
    (old,) = cfg.pipeline["datasets"][NEW]["continues"]
    both = copy.deepcopy(full)
    for key in CARRIED:
        both[key][old] = {"a": 1}
    assert guardrails.inherit_history(cfg, both) == both, "a dataset with a record of its own keeps it"
    assert guardrails.inherit_history(cfg, None) is None
    odd = copy.deepcopy(full)
    odd["mild_split"] = ["not", "a", "mapping"]
    odd["supplied_files"] = None
    assert guardrails.inherit_history(cfg, odd) == odd
    # The input is not changed.
    left = left_by(full, old)
    before = copy.deepcopy(left)
    guardrails.inherit_history(cfg, left)
    assert left == before


def test_a_continued_id_that_is_still_a_dataset_or_is_not_an_id_is_refused(built, tmp_path):
    for bad, fragment in ((SURVIVING, f"{NEW}: continues names {SURVIVING}, which is still a dataset of this build"), ("", "continues must be a list of dataset ids"),
                          (["a", 3], "continues must be a list of dataset ids")):
        cfg = make_cfg(built["workspace"])
        cfg.pipeline["datasets"][NEW]["continues"] = [bad] if isinstance(bad, str) and bad else bad
        assert any(fragment in problem for problem in guardrails.continuation_problems(cfg)), bad
        expect_abort(lambda: run(tmp_path, cfg, name="refused", publish=False), fragment)


def test_a_ledger_that_lacks_a_counted_pair_is_refused_and_the_committed_trim_is_the_datasets_pairs(built):
    """The older refusal: a ledger whose trim differs from today's rule by a pair that is counted now. (The case of a
    second dataset counting beyond a trim that matches the rule is the next test; this one does not reach it.)"""
    cfg = built["cfg"]
    source = cfg.supplied(SOURCE)
    ledger = json.loads(supplied.store_paths(cfg, SOURCE)[1].read_text(encoding="utf-8"))
    assert supplied.scope_problems(cfg, source, ledger).refusals == []
    cut = copy.deepcopy(ledger)
    dropped = next(pair for pair in cut["outside_scope"]["counted"] if pair[0] in added_types(cfg))
    cut["outside_scope"]["counted"].remove(dropped)
    # The ledger's own rule is judged on the dataset it names, which counts these pairs through the same column; a rule
    # config does not have is judged too. The pair is refused for the dataset that counts it beyond the trim.
    refusals = supplied.scope_problems(cfg, source, cut).refusals
    assert refusals and any(dropped[0] in r or NEW in r for r in refusals), refusals
    assert {tuple(p) for p in ledger["outside_scope"]["counted"]} == supplied.counted_pairs(cfg, NEW)


def test_a_store_whose_trim_matches_its_rule_but_not_a_second_dataset_is_refused_by_name(tmp_path, workspace):
    """The case the guard exists for. The rule names a dataset that counts the default scope's types only, and the history is supplied
    again under it, so the ledger equals what that config wants and nothing is stale. New registrations still counts types whose model that
    store blanked, and would publish 'not recorded' for every one of them. The store must be refused, naming the dataset and its pairs, by
    scope_problems and by the build. (A second dataset of a narrower scope is made here, in the test's own config.)"""
    cfg = make_cfg(workspace)
    rule = cfg.pipeline["supplied"][SOURCE]["outside_scope"]
    assert rule.pop("also_kept_column")
    narrower = "a_narrower_dataset_made_for_this_test"
    cfg.pipeline["datasets"][narrower] = {**cfg.pipeline["datasets"][NEW], "require": ["in_scope", "fleet_entry"]}
    rule["dataset"] = narrower
    path, _ = history_with_added_types(cfg, tmp_path)
    supplied.supply(cfg, SOURCE, path, taken="2026-09-05", echo=lambda *_: None)
    source = cfg.supplied(SOURCE)
    ledger = json.loads(supplied.store_paths(cfg, SOURCE)[1].read_text(encoding="utf-8"))
    assert ledger["outside_scope"] == supplied.outside_scope(cfg, source), "the ledger must match the rule, or the older check would refuse"
    only_wider = supplied.counted_pairs(cfg, NEW) - supplied.counted_pairs(cfg, narrower)
    assert only_wider and not only_wider & {tuple(p) for p in ledger["outside_scope"]["counted"]}
    refusals = supplied.scope_problems(cfg, source, ledger).refusals
    assert len(refusals) == 1 and NEW in refusals[0] and f"{len(only_wider)} (vehicle type, import status) pairs" in refusals[0], refusals
    assert all(vehicle in refusals[0] for vehicle, _ in list(sorted(only_wider))[:6])
    expect_abort(lambda: run(tmp_path, cfg), f"{NEW} counts")


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
    # The trade scope never counts fewer types than the default one.
    assert all(wide for default, wide, *_ in built.values() if default)


def test_the_committed_stores_months_are_what_the_dataset_counts(tmp_path):
    """The dataset can never drift from its source silently: built from the committed store, each month's total is the
    store's own vehicles of the types the dataset counts and the statuses it counts, summed here from the Parquet file with the scope
    files read in Python. The same sum over the types of the default scope is what a question narrowed to them counts, and it is lower."""
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

    def months(require):
        expected: Counter = Counter()
        for month, v, s, n in stored:
            if v in vehicles and s in statuses and all(flags[f](vehicles[v], statuses[s]) for f in require):
                expected[month] += int(n)
        return dict(expected)

    assert counts[NEW] == months(p["datasets"][NEW]["require"])
    narrower = months(["in_scope", "fleet_entry"])
    assert sum(counts[NEW].values()) > sum(narrower.values())
    assert all(counts[NEW][m] >= narrower[m] for m in narrower)


def test_the_committed_ledger_still_names_the_dataset_it_was_trimmed_for_by_its_old_name_and_the_store_is_accepted():
    """The store was written when the dashboard's dataset was registrations_flow, and the ledger records that name. Config now names
    new_registrations, so the ledger and the rule differ in that name alone: what the store kept (the pairs counted, the fields, the values
    the scope files knew) is what the rule wants, so the store is neither refused nor warned about, until a full supply writes the new name."""
    cfg = make_cfg({})
    registrations, ledger_path = supplied.store_paths(cfg, SOURCE)
    if not registrations.exists():
        pytest.skip("the dashboard's store is not committed")
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    wanted = supplied.outside_scope(cfg, cfg.supplied(SOURCE))
    recorded = ledger["outside_scope"]
    assert wanted["dataset"] == NEW and recorded["dataset"] != NEW, "the ledger names the dataset it was written for: the test is for the rename"
    assert {k: v for k, v in wanted.items() if k != "dataset"} == {k: v for k, v in recorded.items() if k != "dataset"}
    check = supplied.scope_problems(cfg, cfg.supplied(SOURCE), ledger)
    assert check.refusals == [] and check.warnings == [], (check.refusals, check.warnings)
