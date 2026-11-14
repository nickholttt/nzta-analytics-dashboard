"""`python -m pipeline supply` for a source of kind series: what it checks in an export of Stats NZ's table, what it keeps,
and that a revised figure is never taken silently.

The export is invented (fixtures/statsnz_tpt.csv): five months, the table's title, header and footer, `..` before a series
starts. Series are found by their place in the reference file (the first total, its parts, a series that stands alone),
never by name, so no series id or label is written here (design invariant 1).
"""

from __future__ import annotations

import argparse
import csv
import json
import os
from datetime import datetime

import duckdb
import pytest

from pipeline import series, supplied
from pipeline.__main__ import main, supply_one
from pipeline.errors import GuardrailError

from .conftest import FIXTURES, make_cfg

SOURCE = "statsnz_tpt"
EXPORT = FIXTURES / "statsnz_tpt.csv"
TAKEN = "2026-09-25"
FIRST_DATA_LINE = 2  # the title and the header come first
MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]


@pytest.fixture
def cfg(workspace):
    return make_cfg(workspace)


@pytest.fixture
def source(cfg):
    return cfg.supplied(SOURCE)


@pytest.fixture
def catalogue(cfg, source):
    return series.catalogue(cfg, source)


def supply(cfg, path, **kwargs):
    kwargs.setdefault("taken", TAKEN)
    return series.supply(cfg, SOURCE, path, echo=lambda *_: None, **kwargs)


def edited(tmp_path, change, name="edited.csv", source_file=EXPORT):
    """A copy of an export with its lines (lists of cells) changed by `change(lines)`, written with CRLF as Infoshare does."""
    with source_file.open(encoding="utf-8", newline="") as fh:
        lines = list(csv.reader(fh))
    lines = change(lines) or lines
    path = tmp_path / name
    with path.open("w", encoding="utf-8", newline="") as fh:
        csv.writer(fh, lineterminator="\r\n", quoting=csv.QUOTE_ALL).writerows(lines)
    return path


def aborts(fragment, fn):
    with pytest.raises(GuardrailError) as info:
        fn()
    assert fragment in str(info.value), str(info.value)


def total_of_most_parts(catalogue):
    return max((s for s in catalogue if s.total_of), key=lambda s: len(s.total_of))


def standalone(catalogue):
    inside = {p for s in catalogue for p in s.total_of}
    return next(s for s in catalogue if not s.total_of and s.id not in inside and s.role != "subset")


def cell(catalogue, s, month_index):
    """(line index, column index) of a series' figure in a month of the fixture."""
    return FIRST_DATA_LINE + month_index, 1 + [c.id for c in catalogue].index(s.id)


def store(cfg):
    registrations, ledger_path = supplied.store_paths(cfg, SOURCE)
    return registrations, json.loads(ledger_path.read_text(encoding="utf-8"))


def figures(cfg):
    registrations, _ = store(cfg)
    rows = duckdb.connect().execute(f"SELECT month, series_id, value FROM read_parquet('{registrations.as_posix()}')").fetchall()
    return {(m.strftime("%Y-%m"), s): v for m, s, v in rows}


def set_cell(catalogue, s, month_index, value):
    line, column = cell(catalogue, s, month_index)

    def change(lines):
        lines[line][column] = value

    return change


def test_an_export_is_added_with_a_ledger_that_records_what_was_checked(cfg, source, catalogue):
    result = supply(cfg, EXPORT)
    assert result["added"] == MONTHS and not result["unchanged"] and not result["revised"] and result["written"]
    registrations, ledger = store(cfg)
    con = duckdb.connect()
    described = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{registrations.as_posix()}')").fetchall()
    assert [(c, t) for c, t, *_ in described] == [("month", "DATE"), ("series_id", "VARCHAR"), ("value", "INTEGER")]
    with EXPORT.open(encoding="utf-8", newline="") as fh:
        lines = list(csv.reader(fh))[FIRST_DATA_LINE:FIRST_DATA_LINE + len(MONTHS)]
    expected = {(row[0][:4] + "-" + row[0][-2:], s.id): int(v) for row in lines for s, v in zip(catalogue, row[1:]) if v != ".."}
    assert figures(cfg) == expected and len(expected) < len(MONTHS) * len(catalogue), "a figure that is not available has no row"
    assert ledger["store_sha256"] == supplied.sha256_of(registrations) and ledger["revisions"] == []
    assert sorted(ledger["months"]) == MONTHS
    (digest, facts), = ledger["files"].items()
    assert digest == supplied.sha256_of(EXPORT) == ledger["months"][MONTHS[0]]["sha256"]
    assert facts["source_file"] == EXPORT.name and facts["taken"] == TAKEN and facts["table_reference"] == source["table_reference"]
    assert facts["last_updated"] == "19 September 2026 10:45am"
    assert facts["months"] == {"first": MONTHS[0], "last": MONTHS[-1], "count": len(MONTHS)}
    ids = [c.id for c in catalogue]
    checked = {}
    for total in (c for c in catalogue if c.total_of):
        needed = [ids.index(i) + 1 for i in (total.id, *total.total_of)]
        checked[total.id] = {"months_checked": sum(all(row[n] != ".." for n in needed) for row in lines), "differs_before": {}}
    assert facts["arithmetic"] == checked
    assert any(f["months_checked"] < len(MONTHS) for f in checked.values()), "only months that have every part are checked"
    month = ledger["months"]["2026-06"]
    assert month["rows"] == sum(1 for k in expected if k[0] == "2026-06")
    assert month["sum"] == sum(v for k, v in expected.items() if k[0] == "2026-06")


def test_the_same_export_gives_the_same_bytes(tmp_path, workspace):
    stores = []
    for name in ("one", "two"):
        cfg = make_cfg({**workspace, "supplied": tmp_path / name})
        supply(cfg, EXPORT)
        stores.append([p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)])
    assert stores[0] == stores[1]


def test_the_same_export_again_is_unchanged_and_writes_nothing(cfg):
    supply(cfg, EXPORT)
    before = [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)]
    result = supply(cfg, EXPORT)
    assert result["unchanged"] == MONTHS and not result["added"] and not result["written"]
    assert [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)] == before


def test_a_later_export_adds_its_new_months_and_keeps_the_ledger_of_the_old(tmp_path, cfg, catalogue):
    supply(cfg, EXPORT)

    def one_more(lines):
        last = lines[FIRST_DATA_LINE + len(MONTHS) - 1]
        lines.insert(FIRST_DATA_LINE + len(MONTHS), ["2026M09", *last[1:]])

    later = edited(tmp_path, one_more, name="later.csv")
    result = supply(cfg, later, taken="2026-10-25")
    assert result["added"] == ["2026-09"] and result["unchanged"] == MONTHS and not result["revised"]
    _, ledger = store(cfg)
    assert ledger["months"]["2026-09"]["source_file"] == "later.csv" and ledger["months"]["2026-09"]["taken"] == "2026-10-25"
    assert ledger["months"]["2026-08"]["source_file"] == EXPORT.name
    assert len(ledger["files"]) == 2


def test_a_month_that_would_leave_a_gap_is_refused(tmp_path, cfg):
    supply(cfg, EXPORT)

    def later_only(lines):
        return lines[:FIRST_DATA_LINE] + [["2026M10", *lines[FIRST_DATA_LINE][1:]]] + lines[FIRST_DATA_LINE + len(MONTHS):]

    aborts("2026-09", lambda: supply(cfg, edited(tmp_path, later_only), taken="2026-11-25"))


def test_an_older_export_with_fewer_months_changes_nothing(tmp_path, cfg):
    supply(cfg, EXPORT)
    before = [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)]

    def fewer(lines):
        return lines[:FIRST_DATA_LINE] + lines[FIRST_DATA_LINE:FIRST_DATA_LINE + 3] + lines[FIRST_DATA_LINE + len(MONTHS):]

    result = supply(cfg, edited(tmp_path, fewer))
    assert result["unchanged"] == MONTHS[:3] and not result["written"]
    assert [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)] == before


def test_the_title_must_be_the_configured_one(tmp_path, cfg):
    aborts("Another table", lambda: supply(cfg, edited(tmp_path, lambda lines: lines[0].__setitem__(0, "Another table"))))
    assert not supplied.store_paths(cfg, SOURCE)[0].exists()


def test_the_header_must_be_the_configured_columns_in_order(tmp_path, cfg, catalogue):
    renamed = edited(tmp_path, lambda lines: lines[1].__setitem__(3, "A column Stats NZ added"), name="renamed.csv")
    aborts("A column Stats NZ added", lambda: supply(cfg, renamed))

    def swapped(lines):
        lines[1][1], lines[1][2] = lines[1][2], lines[1][1]

    aborts("different order", lambda: supply(cfg, edited(tmp_path, swapped, name="swapped.csv")))

    def dropped(lines):
        for line in lines[:FIRST_DATA_LINE + len(MONTHS)]:
            del line[-1]

    aborts(f"missing ['{catalogue[-1].header}']", lambda: supply(cfg, edited(tmp_path, dropped, name="dropped.csv")))
    assert not supplied.store_paths(cfg, SOURCE)[0].exists()


def test_a_line_with_the_wrong_number_of_fields_is_refused(tmp_path, cfg):
    aborts("line 5 has 28 fields", lambda: supply(cfg, edited(tmp_path, lambda lines: lines[FIRST_DATA_LINE + 2].append("1"))))


def test_a_month_must_read_as_a_month_once_and_in_order_without_a_gap(tmp_path, cfg):
    aborts("2026M13", lambda: supply(cfg, edited(tmp_path, lambda l: l[FIRST_DATA_LINE].__setitem__(0, "2026M13"), name="a.csv")))
    aborts("more than once", lambda: supply(cfg, edited(tmp_path, lambda l: l[FIRST_DATA_LINE + 1].__setitem__(0, l[FIRST_DATA_LINE][0]), name="b.csv")))

    def swapped(lines):
        a, b = FIRST_DATA_LINE + 1, FIRST_DATA_LINE + 2
        lines[a][0], lines[b][0] = lines[b][0], lines[a][0]

    aborts("oldest first", lambda: supply(cfg, edited(tmp_path, swapped, name="c.csv")))
    aborts("no row for 2026-05", lambda: supply(cfg, edited(tmp_path, lambda l: l.__delitem__(FIRST_DATA_LINE + 1), name="d.csv")))
    assert not supplied.store_paths(cfg, SOURCE)[0].exists()


@pytest.mark.parametrize("text", ["1.5", "-3", "1,000", "many", "", "2147483648", "1e3"])
def test_a_figure_is_a_whole_number_or_not_available(tmp_path, cfg, catalogue, text):
    s = standalone(catalogue)
    aborts("whole number", lambda: supply(cfg, edited(tmp_path, set_cell(catalogue, s, 3, text))))
    assert not supplied.store_paths(cfg, SOURCE)[0].exists()


@pytest.mark.parametrize("month_index", [3, 4])
def test_not_available_is_only_for_the_months_before_a_series_starts(tmp_path, cfg, catalogue, source, month_index):
    s = total_of_most_parts(catalogue)
    path = edited(tmp_path, set_cell(catalogue, s, month_index, source["missing"]))
    aborts(f"{s.label} has no figure in", lambda: supply(cfg, path))


def test_a_series_that_never_starts_is_allowed(tmp_path, cfg, catalogue, source):
    s = standalone(catalogue)

    def never(lines):
        for i in range(len(MONTHS)):
            lines[FIRST_DATA_LINE + i][1 + [c.id for c in catalogue].index(s.id)] = source["missing"]

    supply(cfg, edited(tmp_path, never))
    assert not any(k[1] == s.id for k in figures(cfg))


def footer_lines(lines, label):
    return next(i for i, row in enumerate(lines) if len(row) == 1 and row[0].strip() == label)


def test_the_footer_must_name_the_configured_table(tmp_path, cfg, source):
    labels = source["footer"]

    def wrong(lines):
        lines[footer_lines(lines, labels["table_reference"]) + 1] = ["TPT999ZZ"]

    aborts("TPT999ZZ", lambda: supply(cfg, edited(tmp_path, wrong, name="a.csv")))

    def missing(lines):
        i = footer_lines(lines, labels["table_reference"])
        del lines[i:i + 2]

    aborts(f"has no {labels['table_reference']!r} line", lambda: supply(cfg, edited(tmp_path, missing, name="b.csv")))
    assert not supplied.store_paths(cfg, SOURCE)[0].exists()


def test_the_export_must_say_when_it_was_last_updated(tmp_path, cfg, source):
    label = source["footer"]["last_updated"]

    def cut(lines):
        i = footer_lines(lines, label)
        del lines[i:i + 2]

    aborts(label, lambda: supply(cfg, edited(tmp_path, cut)))

    def empty(lines):
        lines[footer_lines(lines, label) + 1] = [""]

    aborts("vintage", lambda: supply(cfg, edited(tmp_path, empty, name="empty.csv")))


def test_a_total_that_no_longer_equals_its_parts_aborts_from_the_configured_month_and_warns_before(tmp_path, workspace, catalogue):
    total = total_of_most_parts(catalogue)

    def off_by_one(month_index):
        line, column = cell(catalogue, total, month_index)

        def change(lines):
            lines[line][column] = str(int(lines[line][column]) + 1)

        return change

    def configured(name):
        cfg = make_cfg({**workspace, "supplied": tmp_path / name})
        cfg.pipeline["supplied"][SOURCE]["arithmetic_from"] = "2026-08"
        return cfg

    cfg = configured("early")
    result = supply(cfg, edited(tmp_path, off_by_one(3), name="early.csv"))
    assert any("2026-07 (-1)" in w and total.label in w and "before 2026-08" in w for w in result["warnings"]), result["warnings"]
    assert list(store(cfg)[1]["files"].values())[0]["arithmetic"][total.id]["differs_before"] == {"2026-07": -1}

    late = configured("late")
    aborts("2026-08 (-1)", lambda: supply(late, edited(tmp_path, off_by_one(4), name="late.csv")))
    assert not supplied.store_paths(late, SOURCE)[0].exists()


def changed_export(tmp_path, catalogue, name="revised.csv", month_index=3, by=5):
    s = standalone(catalogue)
    line, column = cell(catalogue, s, month_index)

    def change(lines):
        lines[line][column] = str(int(lines[line][column]) + by)

    return edited(tmp_path, change, name=name), s


def test_a_revised_figure_is_refused_with_every_changed_cell_unless_it_is_accepted(tmp_path, cfg, catalogue):
    supply(cfg, EXPORT)
    before = [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)]
    path, s = changed_export(tmp_path, catalogue)
    old = figures(cfg)[("2026-07", s.id)]
    with pytest.raises(GuardrailError) as info:
        supply(cfg, path)
    message = str(info.value)
    assert "--accept-revisions" in message and f"2026-07 {s.label}: {old:,} in the store, {old + 5:,} in the file" in message
    assert [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)] == before

    result = supply(cfg, path, accept_revisions=True, taken="2026-10-25")
    assert result["revised"] == ["2026-07"] and result["written"]
    assert figures(cfg)[("2026-07", s.id)] == old + 5
    _, ledger = store(cfg)
    (entry,) = ledger["revisions"]
    assert entry["month"] == "2026-07" and entry["cells"] == [{"series_id": s.id, "old": old, "new": old + 5}]
    assert entry["old"]["taken"] == TAKEN and entry["new"]["taken"] == "2026-10-25"
    assert entry["old"]["sha256"] != entry["new"]["sha256"] and entry["new"]["source_file"] == "revised.csv"
    assert entry["old"]["last_updated"] == entry["new"]["last_updated"] == "19 September 2026 10:45am"
    assert ledger["months"]["2026-07"]["sha256"] == entry["new"]["sha256"] and ledger["months"]["2026-06"]["sha256"] == entry["old"]["sha256"]
    assert ledger["store_sha256"] == supplied.sha256_of(supplied.store_paths(cfg, SOURCE)[0])


def test_every_changed_cell_is_listed_including_one_that_appears_and_every_one_of_a_series_that_is_withdrawn(tmp_path, cfg, catalogue, source):
    supply(cfg, EXPORT)
    withdrawn, appears = standalone(catalogue), next(c for c in catalogue if c.role == "subset")
    before = figures(cfg)

    def change(lines):
        for i in range(len(MONTHS)):
            lines[FIRST_DATA_LINE + i][cell(catalogue, withdrawn, i)[1]] = source["missing"]
        for i in (0, 1):
            lines[FIRST_DATA_LINE + i][cell(catalogue, appears, i)[1]] = "7"

    with pytest.raises(GuardrailError) as info:
        supply(cfg, edited(tmp_path, change))
    message = str(info.value)
    assert message.startswith("[supply] 7 figure(s) in 5 month(s)"), message
    assert f"2026-04 {appears.label}: no figure in the store, 7 in the file" in message
    old = before[("2026-06", withdrawn.id)]
    assert f"2026-06 {withdrawn.label}: {old:,} in the store, no figure in the file" in message

    result = supply(cfg, edited(tmp_path, change), accept_revisions=True)
    assert result["revised"] == MONTHS
    assert not any(k[1] == withdrawn.id for k in figures(cfg)) and figures(cfg)[("2026-04", appears.id)] == 7
    cells = [c for e in store(cfg)[1]["revisions"] for c in e["cells"]]
    assert {"series_id": withdrawn.id, "old": old, "new": None} in cells


def test_accepting_revisions_when_there_are_none_changes_nothing(cfg):
    supply(cfg, EXPORT)
    before = [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)]
    assert not supply(cfg, EXPORT, accept_revisions=True)["written"]
    assert [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE)] == before


def test_taken_may_not_be_before_the_last_month_ends(cfg):
    aborts("2026-08 ends", lambda: supply(cfg, EXPORT, taken="2026-08-30"))
    supply(cfg, EXPORT, taken="2026-08-31")


def test_taken_defaults_to_the_files_modified_date(tmp_path, cfg):
    copy = edited(tmp_path, lambda lines: None, name="copy.csv")
    stamp = datetime(2026, 9, 21, 12).timestamp()
    os.utime(copy, (stamp, stamp))
    series.supply(cfg, SOURCE, copy, echo=lambda *_: None)
    assert store(cfg)[1]["months"]["2026-08"]["taken"] == "2026-09-21"
    aborts("YYYY-MM-DD", lambda: supply(cfg, EXPORT, taken="yesterday"))


def test_a_store_that_disagrees_with_its_ledger_stops_the_command(cfg):
    supply(cfg, EXPORT)
    _, ledger_path = supplied.store_paths(cfg, SOURCE)
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    ledger["months"]["2026-07"]["sum"] += 1
    ledger_path.write_text(json.dumps(ledger), encoding="utf-8", newline="\n")
    aborts("2026-07", lambda: supply(cfg, EXPORT))


def test_a_store_that_is_not_the_one_the_ledger_was_written_with_stops_the_command(cfg):
    supply(cfg, EXPORT)
    registrations = supplied.store_paths(cfg, SOURCE)[0]
    path = registrations.as_posix()
    # Move one figure to another series: every month's rows and sum stay as the ledger says.
    duckdb.connect().execute(f"""COPY (SELECT * EXCLUDE (rn) REPLACE (CASE WHEN rn = 1 THEN (SELECT max(series_id) FROM read_parquet('{path}'))
                                                          ELSE series_id END AS series_id)
                          FROM (SELECT *, row_number() OVER () AS rn FROM read_parquet('{path}')))
                TO '{path}.moved' (FORMAT PARQUET)""")
    registrations.with_name(registrations.name + ".moved").replace(registrations)
    aborts("store_sha256", lambda: supply(cfg, EXPORT))


@pytest.mark.parametrize("keep", ["series_file", "ledger_file"])
def test_a_store_with_one_of_its_two_files_stops_the_command(cfg, source, keep):
    supply(cfg, EXPORT)
    gone = "ledger_file" if keep == "series_file" else "series_file"
    (cfg.supplied_store(SOURCE) / source[gone]).unlink()
    aborts("one of its two files", lambda: supply(cfg, EXPORT))


def test_an_interruption_between_the_two_renames_leaves_a_pair_the_next_run_refuses(tmp_path, cfg, monkeypatch, catalogue):
    supply(cfg, EXPORT)
    real, calls = os.replace, []

    def interrupted(src, dst):
        calls.append(dst)
        if len(calls) == 2:
            raise OSError("interrupted")
        return real(src, dst)

    path, _ = changed_export(tmp_path, catalogue)
    monkeypatch.setattr(supplied.os, "replace", interrupted)
    with pytest.raises(OSError):
        supply(cfg, path, accept_revisions=True)
    monkeypatch.undo()
    aborts("disagrees with its ledger", lambda: supply(cfg, EXPORT))


@pytest.mark.parametrize("case", ["names", "role", "total"])
def test_a_reference_file_that_contradicts_itself_is_refused(tmp_path, workspace, source, case):
    c = source["catalogue"]
    with make_cfg(workspace).reference(c["file"]).open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    target = next(r for r in rows if r[c["total_of"]])
    if case == "names":
        target[c["total_of"]] += c["separator"] + "nowhere"
    elif case == "role":
        target[c["role"]] = "invented"
    else:
        target[c["role"]] = rows[0][c["role"]]
    reference_dir = tmp_path / "reference"
    reference_dir.mkdir()
    with (reference_dir / c["file"]).open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    aborts("contradicts itself", lambda: supply(make_cfg(workspace, reference_dir=reference_dir), EXPORT))


def test_the_real_reference_file_describes_a_table_the_code_can_read(cfg, source, catalogue):
    c = source["catalogue"]
    assert len(catalogue) > 1 and all(s.header and s.label for s in catalogue)
    totals = [s for s in catalogue if s.total_of]
    assert totals and all(s.role == c["total_role"] for s in totals)
    assert {s.role for s in catalogue} <= set(c["roles"])


def test_the_command_hands_a_series_file_to_the_series_code_and_refuses_the_other_kinds_flags(cfg, capsys):
    args = argparse.Namespace(source=SOURCE, csv=EXPORT, month=None, taken=TAKEN, totals=None, replace=[], accept_revisions=False)
    supply_one(cfg, args)
    assert sorted({k[0] for k in figures(cfg)}) == MONTHS
    for flag in ("--month", "--totals", "--replace"):
        assert main(["supply", SOURCE, "no-such-file.csv", flag, "2026-01"]) == 2
        err = capsys.readouterr().err
        assert flag in err and "the store is unchanged" in err
    assert main(["supply", "nzta_dashboard", "no-such-file.csv", "--accept-revisions"]) == 2
    assert "--replace" in capsys.readouterr().err


def test_a_source_of_another_kind_is_refused(cfg):
    aborts("not a source of kind", lambda: series.supply(cfg, "nzta_dashboard", EXPORT, echo=lambda *_: None))
    aborts("not a supplied source", lambda: series.supply(cfg, "nowhere", EXPORT, echo=lambda *_: None))


def test_the_summary_says_what_was_added_and_what_the_store_holds(cfg):
    lines = []
    series.supply(cfg, SOURCE, EXPORT, taken=TAKEN, echo=lines.append)
    assert lines[0] == "Months added: " + ", ".join(MONTHS)
    assert any(line.startswith("The store now holds 5 months, 2026-04 to 2026-08") for line in lines)
    assert any("19 September 2026 10:45am" in line for line in lines)


def later_export_lines(lines):
    """The fixture with one more month, as a later export would be."""
    last = lines[FIRST_DATA_LINE + len(MONTHS) - 1]
    lines.insert(FIRST_DATA_LINE + len(MONTHS), ["2026M09", *last[1:]])


def blank_line_in_the_data(lines):
    later_export_lines(lines)
    lines.insert(FIRST_DATA_LINE + 3, [])


def mistyped_month_in_the_data(lines):
    later_export_lines(lines)
    lines[FIRST_DATA_LINE + 2][0] = "2026-06"


def row_after_the_footer_starts(first_line):
    def change(lines):
        later_export_lines(lines)
        first = next(i for i, row in enumerate(lines) if len(row) == 1 and row[0].strip() == first_line)
        lines.insert(first + 1, list(lines[FIRST_DATA_LINE + 1]))

    return change


DAMAGE = {
    "a blank line in the data": (blank_line_in_the_data, "a blank line"),
    "a month that does not read as one in the data": (mistyped_month_in_the_data, "'2026-06'"),
}


@pytest.mark.parametrize("held", [False, True], ids=["a fresh store", "a store holding the earlier months"])
@pytest.mark.parametrize("damage", DAMAGE)
def test_a_break_in_the_month_rows_is_refused_instead_of_dropping_every_month_after_it(tmp_path, cfg, source, damage, held):
    change, found = DAMAGE[damage]
    if held:
        supply(cfg, EXPORT)
    before = [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE) if p.exists()]
    first_line = source["footer"]["first_line"]
    with pytest.raises(GuardrailError) as info:
        supply(cfg, edited(tmp_path, change), taken="2026-10-25")
    message = str(info.value)
    assert "should be the footer's first line" in message and first_line in message and found in message, message
    assert [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE) if p.exists()] == before


@pytest.mark.parametrize("held", [False, True], ids=["a fresh store", "a store holding the earlier months"])
def test_a_row_of_the_table_after_the_footer_starts_is_refused(tmp_path, cfg, source, held):
    if held:
        supply(cfg, EXPORT)
    before = [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE) if p.exists()]
    path = edited(tmp_path, row_after_the_footer_starts(source["footer"]["first_line"]))
    aborts("come after the footer starts but look like rows", lambda: supply(cfg, path, taken="2026-10-25"))
    assert [p.read_bytes() for p in supplied.store_paths(cfg, SOURCE) if p.exists()] == before


def test_the_footer_must_start_straight_after_the_last_month_row(tmp_path, cfg):
    def cut(lines):
        del lines[FIRST_DATA_LINE + len(MONTHS):]

    aborts("the end of the file", lambda: supply(cfg, edited(tmp_path, cut)))


def test_an_export_that_ends_before_the_store_says_so(tmp_path, cfg):
    supply(cfg, EXPORT)
    lines = []
    older = edited(tmp_path, lambda rows: rows.__delitem__(FIRST_DATA_LINE + len(MONTHS) - 1), name="older.csv")
    result = series.supply(cfg, SOURCE, older, taken=TAKEN, echo=lines.append)
    assert not result["written"] and not result["added"]
    assert any(line == f"This export ends at {MONTHS[-2]}, before the store's {MONTHS[-1]}: it has nothing newer than the store." for line in lines)
