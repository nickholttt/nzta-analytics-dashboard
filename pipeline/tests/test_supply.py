"""`python -m pipeline supply`: what it checks, what it keeps, and that it never replaces a month silently.

The fixture files are invented (fixtures/dashboard_*.csv): the history form with a month column, the one-month form
without, and the totals the dashboard would have shown. Column names are read from config, not written here.
"""

from __future__ import annotations

import csv
import json
import os
import shutil
from datetime import datetime

import duckdb
import pytest

from pipeline import supplied
from pipeline.errors import GuardrailError

from .conftest import FIXTURES, make_cfg

SOURCE = "nzta_dashboard"
TAKEN = "2026-09-05"
HISTORY, MONTH, TOTALS = (FIXTURES / n for n in ("dashboard_history.csv", "dashboard_month.csv", "dashboard_totals.csv"))


@pytest.fixture
def cfg(workspace):
    return make_cfg(workspace)


@pytest.fixture
def source(cfg):
    return cfg.supplied(SOURCE)


def supply(cfg, path, **kwargs):
    kwargs.setdefault("taken", TAKEN)
    return supplied.supply(cfg, SOURCE, path, echo=lambda *_: None, **kwargs)


def edited(tmp_path, source_file, change, name="edited.csv"):
    """A copy of a fixture file with its rows (dicts keyed by column) changed by `change(rows)`."""
    with source_file.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        header, rows = reader.fieldnames, list(reader)
    rows = change(rows) or rows
    path = tmp_path / name
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return path


def aborts(fragment, fn):
    with pytest.raises(GuardrailError) as info:
        fn()
    assert fragment in str(info.value), str(info.value)


def store_table(cfg):
    registrations, ledger = supplied.store_paths(cfg, SOURCE)
    con = duckdb.connect()
    return con, registrations, json.loads(ledger.read_text(encoding="utf-8"))


def test_the_history_file_is_added_month_by_month_with_a_ledger(cfg, source):
    result = supply(cfg, HISTORY, totals=TOTALS)
    assert result["added"] == ["2026-06", "2026-07", "2026-08"] and not result["unchanged"] and not result["replaced"]
    con, registrations, ledger = store_table(cfg)
    columns = [c for c, *_ in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{registrations.as_posix()}')").fetchall()]
    assert columns == supplied.store_columns(source)
    types = dict((c, t) for c, t, *_ in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{registrations.as_posix()}')").fetchall())
    assert types[supplied.STORE_COUNT] == "INTEGER" and types[supplied.STORE_MONTH] == "DATE"
    assert sorted(ledger["months"]) == ["2026-06", "2026-07", "2026-08"] and ledger["replaced"] == []
    first = ledger["months"]["2026-06"]
    assert first["source_file"] == HISTORY.name and first["taken"] == TAKEN and len(first["sha256"]) == 64
    stored_rows, stored_vehicles = con.execute(
        f"SELECT count(*), sum({supplied.STORE_COUNT}) FROM read_parquet('{registrations.as_posix()}')").fetchone()
    with HISTORY.open(encoding="utf-8", newline="") as fh:
        file_rows = list(csv.DictReader(fh))
    assert stored_vehicles == sum(int(r[source["count_column"]]) for r in file_rows)
    assert stored_rows < len(file_rows), "rows are summed over the dropped owner columns"
    assert sum(e["rows"] for e in ledger["months"].values()) == stored_rows


def test_no_owner_column_is_in_the_store_or_the_ledger(cfg, source):
    supply(cfg, HISTORY)
    _, registrations, ledger = store_table(cfg)
    stored = duckdb.connect().execute(f"SELECT * FROM read_parquet('{registrations.as_posix()}') LIMIT 0").description
    names = {d[0] for d in stored}
    text = supplied.store_paths(cfg, SOURCE)[1].read_text(encoding="utf-8")
    for column in source["private_columns"]:
        assert column not in names and column not in text
    assert not (names & set(source["private_columns"]))


def test_the_same_files_give_the_same_bytes(tmp_path, workspace):
    stores = []
    for name in ("one", "two"):
        cfg = make_cfg({**workspace, "supplied": tmp_path / name})
        supply(cfg, HISTORY)
        stores.append([p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)])
    assert stores[0] == stores[1]


def test_a_one_month_file_for_a_stored_month_is_unchanged_and_writes_nothing(cfg):
    supply(cfg, HISTORY)
    before = [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)]
    result = supply(cfg, MONTH, month="2026-08")
    assert result["unchanged"] == ["2026-08"] and not result["added"] and not result["written"]
    assert [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)] == before


def test_the_next_month_joins_the_store_and_the_ledger_names_its_file(tmp_path, cfg):
    supply(cfg, HISTORY)
    result = supply(cfg, MONTH, month="2026-09", taken="2026-10-02")
    assert result["added"] == ["2026-09"]
    _, _, ledger = store_table(cfg)
    assert ledger["months"]["2026-09"]["source_file"] == MONTH.name and ledger["months"]["2026-09"]["taken"] == "2026-10-02"
    assert ledger["months"]["2026-08"]["taken"] == TAKEN


def test_a_month_that_would_leave_a_gap_is_refused(cfg):
    supply(cfg, HISTORY)
    aborts("2026-09", lambda: supply(cfg, MONTH, month="2026-10", taken="2026-11-02"))


def test_a_changed_month_is_refused_with_both_totals_unless_it_is_named(tmp_path, cfg, source):
    supply(cfg, HISTORY)
    count = source["count_column"]

    def more(rows):
        rows[0][count] = str(int(rows[0][count]) + 1)

    month_file = edited(tmp_path, MONTH, more)
    before = [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)]
    with pytest.raises(GuardrailError) as info:
        supply(cfg, month_file, month="2026-08")
    message = str(info.value)
    assert "2026-08" in message and "--replace" in message
    stored = store_table(cfg)[2]["months"]["2026-08"]["vehicles"]
    assert f"{stored:,}" in message and f"{stored + 1:,}" in message
    assert [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)] == before

    result = supply(cfg, month_file, month="2026-08", replace=["2026-08"], taken="2026-10-02")
    assert result["replaced"] == ["2026-08"]
    ledger = store_table(cfg)[2]
    entry = ledger["replaced"][0]
    assert entry["month"] == "2026-08" and entry["old"]["vehicles"] == stored and entry["new"]["vehicles"] == stored + 1
    assert entry["old"]["taken"] == TAKEN and entry["new"]["taken"] == "2026-10-02"
    assert entry["old"]["sha256"] != entry["new"]["sha256"] and entry["new"]["source_file"] == month_file.name
    assert ledger["months"]["2026-08"]["vehicles"] == stored + 1


def test_replace_must_name_a_month_that_is_in_both(cfg):
    supply(cfg, HISTORY)
    aborts("--replace", lambda: supply(cfg, MONTH, month="2026-08", replace=["2026-03"]))


def with_columns(tmp_path, drop=None, add=None):
    """The history fixture with one column removed, or one extra column added."""
    with HISTORY.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.reader(fh))
    if drop:
        at = rows[0].index(drop)
        rows = [r[:at] + r[at + 1:] for r in rows]
    if add:
        rows = [r + [add if i == 0 else "x"] for i, r in enumerate(rows)]
    path = tmp_path / "columns.csv"
    with path.open("w", encoding="utf-8", newline="") as fh:
        csv.writer(fh, lineterminator="\n").writerows(rows)
    return path


def test_the_header_must_be_the_configured_columns(tmp_path, cfg, source):
    owner = source["private_columns"][0]
    aborts(owner, lambda: supply(cfg, with_columns(tmp_path, drop=owner)))
    aborts("Surprise", lambda: supply(cfg, with_columns(tmp_path, add="Surprise")))
    assert not supplied.store_paths(cfg, SOURCE)[0].exists()


def test_month_is_required_without_a_month_column_and_refused_with_one(cfg):
    aborts("--month", lambda: supply(cfg, MONTH))
    aborts("refused", lambda: supply(cfg, HISTORY, month="2026-08"))
    aborts("YYYY-MM", lambda: supply(cfg, MONTH, month="August"))


def test_every_count_is_a_whole_number_above_zero(tmp_path, cfg, source):
    for value in ("0", "-2", "1.5", "", "many"):
        bad = edited(tmp_path, HISTORY, lambda rows, v=value: rows[0].__setitem__(source["count_column"], v))
        aborts(source["count_column"], lambda: supply(cfg, bad))


def test_a_repeated_key_is_refused(tmp_path, cfg):
    repeated = edited(tmp_path, HISTORY, lambda rows: rows.append(dict(rows[0])))
    aborts("more than one row", lambda: supply(cfg, repeated))


def test_a_month_that_does_not_parse_is_refused(tmp_path, cfg, source):
    bad = edited(tmp_path, HISTORY, lambda rows: rows[0].__setitem__(source["month"]["column"], "Smarch 2026"))
    aborts("Smarch 2026", lambda: supply(cfg, bad))


def test_months_in_the_file_must_be_consecutive(tmp_path, cfg, source):
    column = source["month"]["column"]
    first, last = (datetime(2026, m, 1).strftime(source["month"]["format"]) for m in (6, 8))
    gap = edited(tmp_path, HISTORY, lambda rows: [r for r in rows if r[column] in (first, last)])
    aborts("2026-07", lambda: supply(cfg, gap))


def test_a_non_numeric_year_is_refused(tmp_path, cfg, source):
    bad = edited(tmp_path, HISTORY, lambda rows: rows[0].__setitem__(source["fields"]["vehicle_year"], "19x5"))
    aborts(source["fields"]["vehicle_year"], lambda: supply(cfg, bad))


def test_taken_may_not_be_before_the_last_month_ends(cfg):
    aborts("2026-08 ends", lambda: supply(cfg, HISTORY, taken="2026-08-30"))
    supply(cfg, HISTORY, taken="2026-08-31")


def test_taken_defaults_to_the_files_modified_date(tmp_path, cfg):
    copy = tmp_path / "copy.csv"
    shutil.copyfile(HISTORY, copy)
    stamp = datetime(2026, 9, 20, 12).timestamp()
    os.utime(copy, (stamp, stamp))
    supplied.supply(cfg, SOURCE, copy, echo=lambda *_: None)
    assert store_table(cfg)[2]["months"]["2026-08"]["taken"] == "2026-09-20"


def test_totals_that_disagree_with_the_file_abort_and_nothing_is_written(tmp_path, cfg):
    totals = edited(tmp_path, TOTALS, lambda rows: rows[0].__setitem__("vehicles", "999"), name="totals.csv")
    aborts("999", lambda: supply(cfg, HISTORY, totals=totals))
    assert not supplied.store_paths(cfg, SOURCE)[0].exists()


def test_without_totals_it_runs_and_warns(cfg):
    result = supply(cfg, HISTORY)
    assert any("totals were not checked" in w for w in result["warnings"])
    assert not supply(cfg, HISTORY, totals=TOTALS)["warnings"]


def test_a_store_that_disagrees_with_its_ledger_stops_the_command(cfg):
    supply(cfg, HISTORY)
    ledger_path = supplied.store_paths(cfg, SOURCE)[1]
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    ledger["months"]["2026-07"]["vehicles"] += 1
    ledger_path.write_text(json.dumps(ledger), encoding="utf-8", newline="\n")
    aborts("2026-07", lambda: supply(cfg, MONTH, month="2026-09", taken="2026-10-02"))


def test_an_unknown_source_id_is_refused(cfg):
    aborts("not a supplied source", lambda: supplied.supply(cfg, "nowhere", HISTORY, echo=lambda *_: None))


def test_the_summary_names_few_months_and_ranges_many(cfg):
    lines = []
    supplied.supply(cfg, SOURCE, HISTORY, taken=TAKEN, echo=lines.append)
    assert lines[0] == "Months added: 2026-06, 2026-07, 2026-08"
    assert supplied.span([f"2021-{m:02d}" for m in range(1, 8)]) == "7 months, 2021-01 to 2021-07"
    assert supplied.span([]) == "none"
