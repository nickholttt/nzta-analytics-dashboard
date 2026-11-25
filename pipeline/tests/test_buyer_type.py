"""The buyer_type dimension of new_registrations (D-159): what is published, that it adds up, and the floor on the published files.

A history is supplied with extra rows whose owner type and usage pairs are each in data/reference/buyer_type_map.csv, and the cube
is built from it. What a pair should read is taken from the map file itself (never written here), so a reference edit is not a code
edit (design invariant 1). The floor (a field that says what kind of owner is never in one table with a field that says where the
owner lives) is held on the published files; pipeline/tests/test_kind_of_owner_floor.py holds the configuration that makes them.
"""

from __future__ import annotations

import csv
import json
from collections import Counter

import duckdb
import pytest

from pipeline import build, privacy, reference, supplied
from pipeline.contract import FACT_COUNT, FACT_MONTH, FACTS_DIR, NARROW_DIR, PAIR_SEPARATOR
from pipeline.errors import GuardrailError

from .conftest import FIXTURES, NOW, load_rows, make_cfg, source_for, write_pages
from .test_new_registrations import counted_statuses, month_key, types_in, workspace_for

SOURCE, DATASET = "nzta_dashboard", "new_registrations"
DIMENSION = "buyer_type"
HISTORY = FIXTURES / "dashboard_history.csv"
ADDED = 3
HUGE = 100000


def map_rows(cfg) -> list[dict]:
    return reference.read(cfg.reference(next(d for d in cfg.dimensions["dimensions"] if d["id"] == DIMENSION)["derive"]["reference"]))


def key_columns(cfg) -> dict[str, str]:
    """The logical field of each key of the dimension's lookup and the column of the map file it is matched to."""
    return next(d for d in cfg.dimensions["dimensions"] if d["id"] == DIMENSION)["derive"]["keys"]


def pairs_of_the_map(cfg) -> dict[tuple[str, str], str]:
    owner, usage = key_columns(cfg).values()
    return {(r[owner], r[usage]): r[DIMENSION] for r in map_rows(cfg)}


def history_with(cfg, tmp_path, name: str, extra_pairs: list[tuple[str, str]], count: int = ADDED):
    """The fixture history plus, in every month, `count` vehicles for each owner type and usage pair, copied from a row whose type and
    status the dataset counts. Returns the file and every row it holds."""
    s = cfg.supplied(SOURCE)
    logical = key_columns(cfg)
    owner_col, usage_col = (s["extra_fields"][f] for f in logical)
    with HISTORY.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        header, rows = reader.fieldnames, list(reader)
    counted = counted_statuses(cfg)
    template = next(r for r in rows if r[s["fields"]["vehicle_type"]] in types_in(cfg, "trade_scope") and r[s["fields"]["import_status"]] in counted)
    months = sorted({r[s["month"]["column"]] for r in rows})
    # Another value in the column the store drops keeps an added row apart from a row of the file that holds the same pair.
    apart = {column: "ADDED" for column in s["private_columns"]}
    added = [dict(template, **apart, **{s["month"]["column"]: m, owner_col: owner, usage_col: usage, s["count_column"]: str(count)})
             for m in months for owner, usage in extra_pairs]
    path = tmp_path / name
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows + added)
    return path, rows + added


def spread_of_the_map(cfg) -> list[tuple[str, str]]:
    """The pairs to add: the first pair of each owner type and buyer type the map holds together, and every pair of a usage the map
    reads as more than one buyer type, so a pair's reading cannot be guessed from its owner type or its usage alone."""
    mapped = pairs_of_the_map(cfg)
    chosen = list({(owner, value): pair for pair, value in reversed(list(mapped.items())) for owner in [pair[0]]}.values())
    values_of_usage: dict[str, set[str]] = {}
    for (owner, usage), value in mapped.items():
        values_of_usage.setdefault(usage, set()).add(value)
    chosen += [pair for pair in mapped if len(values_of_usage[pair[1]]) > 1]
    return list(dict.fromkeys(chosen))


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("buyer_type")
    workspace = workspace_for(tmp)
    cfg = make_cfg(workspace)
    path, rows = history_with(cfg, tmp, "history.csv", spread_of_the_map(cfg))
    supplied.supply(cfg, SOURCE, path, taken="2026-09-05", echo=lambda *_: None)
    rows_json = load_rows()
    manifest = build.build(cfg, source_for(rows_json), write_pages(tmp / "pages", rows_json), None, NOW, publish=True)
    return {"cfg": cfg, "rows": rows, "manifest": manifest, "public": workspace["public"], "state": workspace["state"], "tmp": tmp}


def expected_by_month(cfg, rows) -> Counter:
    """(month, buyer type) -> vehicles the history holds, read through the map file, for the types and statuses the dataset counts."""
    s = cfg.supplied(SOURCE)
    logical = key_columns(cfg)
    owner_col, usage_col = (s["extra_fields"][f] for f in logical)
    mapped, counted, types = pairs_of_the_map(cfg), counted_statuses(cfg), types_in(cfg, "trade_scope")
    out: Counter = Counter()
    for r in rows:
        if r[s["fields"]["vehicle_type"]] in types and r[s["fields"]["import_status"]] in counted:
            out[(month_key(cfg, r[s["month"]["column"]]), mapped[(r[owner_col], r[usage_col])])] += int(r[s["count_column"]])
    return out


def test_the_slice_gives_each_months_vehicles_to_the_buyer_type_the_map_says_and_adds_up_to_the_months_total(built):
    cfg, rows, public = built["cfg"], built["rows"], built["public"]
    expected = expected_by_month(cfg, rows)
    path = (public / "cube" / DATASET / f"{DIMENSION}.parquet").as_posix()
    got = {(m.strftime("%Y-%m"), v): n for m, v, n in duckdb.connect().execute(
        f"SELECT month, dim_value, n FROM read_parquet('{path}')").fetchall()}
    assert got == dict(expected)
    assert len({v for _, v in expected}) >= 3, "the history holds several buyer types, so the test does not pass by one value being everything"
    totals = json.loads(built["state"].read_text(encoding="utf-8"))["month_counts"][DATASET]
    by_month: Counter = Counter()
    for (month, _), n in got.items():
        by_month[month] += n
    assert dict(by_month) == totals, "a month's buyer types add up to the dataset's total for the month"


def test_the_pair_with_new_or_used_and_the_narrow_table_give_the_same_counts_as_the_slice(built):
    cfg, public, manifest = built["cfg"], built["public"], built["manifest"]
    con = duckdb.connect()
    slice_ = dict(con.execute(f"SELECT dim_value, sum(n) FROM read_parquet('{(public / 'cube' / DATASET / f'{DIMENSION}.parquet').as_posix()}') GROUP BY 1").fetchall())
    entry = manifest["datasets"][DATASET]
    assert entry["live_pairs"] == [f"{DIMENSION}{PAIR_SEPARATOR}import_status"]
    pair = (public / "pairs" / DATASET / f"{DIMENSION}{PAIR_SEPARATOR}import_status.parquet").as_posix()
    assert dict(con.execute(f"SELECT a_value, sum(n) FROM read_parquet('{pair}') GROUP BY 1").fetchall()) == slice_
    narrow = entry["facts"]["narrow"]
    assert list(narrow) and all(DIMENSION in t["dimensions"] for t in narrow.values()), "one narrow table carries it"
    folder = public / FACTS_DIR / DATASET / NARROW_DIR / next(iter(narrow))
    n, v = (folder / f"{FACT_COUNT[0]}.parquet").as_posix(), (folder / f"{DIMENSION}.parquet").as_posix()
    got = dict(con.execute(
        f"SELECT v, sum(n) FROM (SELECT row_number() OVER () AS i, {DIMENSION} AS v FROM read_parquet('{v}')) JOIN "
        f"(SELECT row_number() OVER () AS i, n FROM read_parquet('{n}')) USING (i) GROUP BY 1").fetchall())
    assert got == slice_
    assert DIMENSION not in entry["facts"]["dimensions"], "it is not a column of the wide table, which it would make heavier for every question"


def test_a_pair_the_map_has_no_row_for_stops_the_build(tmp_path, workspace):
    """A value NZTA sends that the map file does not hold reads unmapped, and a build whose unmapped share is above the guard aborts."""
    cfg = make_cfg(workspace)
    owner, usage = next(iter(pairs_of_the_map(cfg)))
    new_usage = "A USAGE NO ROW OF THE MAP NAMES"
    assert (owner, new_usage) not in pairs_of_the_map(cfg)
    path, _ = history_with(cfg, tmp_path, "history_unmapped.csv", [(owner, new_usage)], count=HUGE)
    supplied.supply(cfg, SOURCE, path, taken="2026-09-05", echo=lambda *_: None)
    rows = load_rows()
    with pytest.raises(GuardrailError) as info:
        build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW, publish=False)
    assert DIMENSION in str(info.value), str(info.value)


def test_the_dimension_is_in_the_unmapped_guard_and_reads_only_the_dataset_that_carries_the_two_columns(built):
    cfg, manifest, public = built["cfg"], built["manifest"], built["public"]
    assert DIMENSION in cfg.pipeline["guardrails"]["abort_on_unmapped"]
    for dataset, entry in manifest["datasets"].items():
        live = DIMENSION in entry.get("live_dimensions", [])
        assert live == (dataset == DATASET), dataset
        assert (public / "cube" / dataset / f"{DIMENSION}.parquet").exists() == live
        assert not any(DIMENSION in p.name for p in (public / "pairs" / dataset).glob("*")) or live


def published_tables(public) -> dict[str, set[str]]:
    """Every table the build published that has more than one field: each pair, the wide fact table and each narrow table, with the
    dimensions it holds."""
    tables: dict[str, set[str]] = {}
    for pair in sorted((public / "pairs").glob("*/*.parquet")):
        tables[f"{pair.parent.name}: pair {pair.stem}"] = set(pair.stem.split(PAIR_SEPARATOR))
    for folder in sorted((public / FACTS_DIR).glob("*")):
        if not folder.is_dir():
            continue
        columns = lambda d: {p.stem for p in d.glob("*.parquet")} - {FACT_MONTH[0], FACT_COUNT[0]}
        tables[f"{folder.name}: facts"] = columns(folder)
        for narrow in sorted((folder / NARROW_DIR).glob("*")) if (folder / NARROW_DIR).is_dir() else []:
            tables[f"{folder.name}: narrow {narrow.name}"] = columns(narrow)
    return tables


def test_no_published_file_puts_buyer_type_beside_where_the_owner_lives_or_any_owner_field(built):
    cfg, public = built["cfg"], built["public"]
    dmap = privacy.load_map(cfg)
    kind = set(privacy.dimensions_in_groups(cfg, dmap, privacy.groups_named(dmap, "kind_of_owner_groups")))
    owner = set(privacy.dimensions_in_groups(cfg, dmap, privacy.groups_named(dmap, "owner_groups")))
    assert DIMENSION in kind and kind.isdisjoint(owner), "buyer type is what kind of owner, and no dimension is both"
    tables = published_tables(public)
    assert any(DIMENSION in dims for dims in tables.values()), "buyer type is in a published table, so this test checks something"
    assert any(dims & owner for dims in tables.values()), "an owner dimension is in a published table too, so the other side is not empty"
    for where, dims in tables.items():
        assert not (dims & kind and dims & owner), f"{where} holds {sorted(dims & kind)} with {sorted(dims & owner)}"
    # An owner field never reaches a fact table (D-096), so the narrow table that carries buyer type holds none either.
    for where, dims in tables.items():
        if "pair" not in where:
            assert not dims & owner, f"{where} holds {sorted(dims & owner)}"
