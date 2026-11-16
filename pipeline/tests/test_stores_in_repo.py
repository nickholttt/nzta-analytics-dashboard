"""The supplied sources' stores live in the repository (D-097), and GitHub's builds read them.

Three kinds of test. (1) What a build does when a committed store lags the register, and when a dataset appears for the
first time in a state file that has never held it: the two situations the Monthly build meets after the stores are
committed. (2) What a store must be to be committed: its two files and no others, belonging together, with no owner field
in any form, and carrying the terms of its source. (3) Replacing a whole store, which a change of the export's columns
needs. Source ids, column names and dates come from config and the data map (design invariant 1); the fixtures are the
invented exports the other supply tests use.
"""

from __future__ import annotations

import copy
import csv
import json
import re
from datetime import date, datetime
from pathlib import Path

import duckdb
import pytest

from pipeline import build, config, metrics, supplied
from pipeline.errors import GuardrailError

from .conftest import FIXTURES, NOW, load_rows, make_cfg, source_for, write_pages
from .test_statsnz_supply import EXPORT, FIRST_DATA_LINE, MONTHS, TAKEN, edited

ROOT = Path(__file__).resolve().parent.parent.parent
HISTORY = FIXTURES / "dashboard_history.csv"
REAL = config.load()
SOURCES = [s for s in REAL.pipeline["supplied"] if not s.startswith("$")]
BY_KIND = {kind: [s for s in SOURCES if REAL.supplied(s).get("kind", supplied.COUNTED_ROWS) == kind]
           for kind in (supplied.COUNTED_ROWS, supplied.SERIES)}
COUNTED, SERIES = BY_KIND[supplied.COUNTED_ROWS][0], BY_KIND[supplied.SERIES][0]
DATASETS = {s: next(d for d, c in REAL.pipeline["datasets"].items() if c.get("source") == s) for s in SOURCES}
SURVIVING = next(d for d, c in REAL.pipeline["datasets"].items() if "source" not in c)


# --- helpers -------------------------------------------------------------------------------------------------------


def supply_counted(cfg, path, **kwargs):
    kwargs.setdefault("taken", "2026-09-05")
    return supplied.supply(cfg, COUNTED, path, echo=lambda *_: None, **kwargs)


def supply_series(cfg, path, **kwargs):
    from pipeline import series
    kwargs.setdefault("taken", TAKEN)
    return series.supply(cfg, SERIES, path, echo=lambda *_: None, **kwargs)


def run(tmp_path, cfg, state=None, name="pages"):
    rows = load_rows()
    return build.build(cfg, source_for(rows), write_pages(tmp_path / name, rows), state, NOW, publish=True)


def read_state(cfg) -> dict:
    return json.loads(cfg.path("state").read_text(encoding="utf-8"))


def expect_abort(fn, fragment):
    with pytest.raises(GuardrailError) as info:
        fn()
    assert fragment in str(info.value), str(info.value)


def counted_history(cfg, directory: Path, lag: int = 0, extra: dict | None = None, name: str = "history.csv") -> Path:
    """The invented dashboard history without its last `lag` months, optionally with more columns (name to value)."""
    source = cfg.supplied(COUNTED)
    column, fmt = source["month"]["column"], source["month"]["format"]
    with HISTORY.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        header, rows = list(reader.fieldnames), list(reader)
    months = sorted({datetime.strptime(r[column], fmt) for r in rows})
    keep = {m.strftime(fmt) for m in months[:len(months) - lag]}
    path = directory / name
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=[*header, *(extra or {})], lineterminator="\n")
        writer.writeheader()
        writer.writerows({**r, **(extra or {})} for r in rows if r[column] in keep)
    return path


def series_export(directory: Path, lag: int = 0, name: str = "export.csv") -> Path:
    def drop_last_months(lines):
        end = FIRST_DATA_LINE + len(MONTHS)
        del lines[end - lag:end]
    return edited(directory, drop_last_months, name=name)


def stores(workspace, tmp_path, lag: int = 0):
    """A configuration whose two stores are made from the invented exports, the last `lag` months of each left out."""
    cfg = make_cfg(workspace)
    supply_counted(cfg, counted_history(cfg, tmp_path, lag))
    supply_series(cfg, series_export(tmp_path, lag))
    return cfg


def register_month(manifest: dict) -> date:
    return date.fromisoformat(manifest["datasets"][SURVIVING]["latest_month"] + "-01")


# --- a store that lags the register ----------------------------------------------------------------------------------


@pytest.mark.parametrize("lag", [1, 2])
def test_a_store_that_lags_the_register_warns_and_everything_else_is_still_built_and_published(tmp_path, workspace, lag):
    bare = make_cfg({**workspace, "supplied": tmp_path / "nowhere", "public": tmp_path / "bare_public",
                     "staging": tmp_path / "bare_staging", "state": tmp_path / "bare_state" / "last_good.json"})
    run(tmp_path, bare, name="bare_pages")

    cfg = stores(workspace, tmp_path, lag)
    manifest = run(tmp_path, cfg)
    ahead = register_month(manifest)
    for source, dataset in DATASETS.items():
        entry = manifest["datasets"][dataset]
        assert "not_built" not in entry, f"{dataset}: a lagging store is not an absent one"
        assert entry["latest_month"] == metrics.month_add(ahead, -lag).strftime("%Y-%m")
        assert any(w.startswith(f"{source}: the export is missing") and "the store ends at" in w for w in manifest["warnings"]), source
        assert (cfg.path("public") / "cube" / dataset).is_dir(), f"{dataset} was not published"
    assert sum("the export is missing" in w for w in manifest["warnings"]) == len(DATASETS)

    # Everything else is built exactly as it is with no store at all.
    for path in sorted((bare.path("public") / "cube" / SURVIVING).rglob("*.parquet")):
        other = cfg.path("public") / path.relative_to(bare.path("public"))
        assert other.read_bytes() == path.read_bytes(), other.name
    assert read_state(cfg)["latest_snapshot"] == read_state(bare)["latest_snapshot"]


@pytest.mark.parametrize("lag", [1, 2])
def test_a_lagging_store_catches_up_in_a_later_build_that_is_guarded_by_the_one_before(tmp_path, workspace, lag):
    cfg = stores(workspace, tmp_path, lag)
    run(tmp_path, cfg, name="lagging")
    state = read_state(cfg)

    supply_counted(cfg, counted_history(cfg, tmp_path, 0, name="full.csv"))
    supply_series(cfg, series_export(tmp_path, 0, name="full_export.csv"))
    manifest = run(tmp_path, cfg, state=copy.deepcopy(state), name="caught_up")
    for dataset in DATASETS.values():
        assert manifest["datasets"][dataset]["latest_month"] == manifest["datasets"][SURVIVING]["latest_month"]
    assert not any("the export is missing" in w for w in manifest["warnings"])


def test_a_store_ahead_of_the_register_is_the_one_thing_that_aborts(tmp_path, workspace):
    # Not changed by D-097: the register is the clock (D-092, option 5). The playbooks say to commit a month only once the
    # register has reached it.
    cfg = stores(workspace, tmp_path)
    later = tmp_path / "later.csv"
    source = cfg.supplied(COUNTED)
    column, fmt = source["month"]["column"], source["month"]["format"]
    with HISTORY.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        header, rows = list(reader.fieldnames), list(reader)
    newest = max(datetime.strptime(r[column], fmt) for r in rows)
    next_month = metrics.month_add(newest.date(), 1).strftime(fmt)
    with later.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows({**r, column: next_month} for r in rows if datetime.strptime(r[column], fmt) == newest)
    supply_counted(cfg, later, taken="2026-10-02")
    expect_abort(lambda: run(tmp_path, cfg), "the register is the clock")


# --- a dataset appearing for the first time in a state that has never held it -----------------------------------------


def test_a_dataset_that_appears_for_the_first_time_is_accepted_and_the_next_builds_guard_it(tmp_path, workspace):
    # The state file GitHub's builds have committed so far: built without the stores, so no entry for their datasets.
    bare = make_cfg({**workspace, "supplied": tmp_path / "nowhere"})
    run(tmp_path, bare, name="first")
    first = read_state(bare)
    first.pop("supplied_totals", None)
    assert not set(DATASETS.values()) & set(first["live_dimensions"]) and not set(DATASETS.values()) & set(first["month_counts"])

    cfg = stores(workspace, tmp_path)
    manifest = run(tmp_path, cfg, state=copy.deepcopy(first), name="second")
    assert all("not_built" not in manifest["datasets"][d] for d in DATASETS.values())
    assert not any("last good run" in w for w in manifest["warnings"])
    second = read_state(cfg)
    for dataset in DATASETS.values():
        assert second["live_dimensions"][dataset] and second["month_counts"][dataset] and second["supplied_totals"][dataset]

    # Now the datasets are in the state, and the same builds that accepted them going in guard them.
    run(tmp_path, cfg, state=copy.deepcopy(second), name="third")
    for source, dataset in DATASETS.items():
        moved = copy.deepcopy(second)
        month = sorted(moved["supplied_totals"][dataset])[0]
        moved["supplied_totals"][dataset][month] *= 2
        expect_abort(lambda: run(tmp_path, cfg, state=moved, name="moved"), f"{dataset}: 1 month(s) differ from the last good build")
    gone = make_cfg({**workspace, "supplied": tmp_path / "nowhere"})
    for dataset in DATASETS.values():
        expect_abort(lambda: run(tmp_path, gone, state=copy.deepcopy(second), name="gone"), f"{dataset}: it was built in the last good run")


# --- replacing a whole store -----------------------------------------------------------------------------------------


def test_a_history_with_other_columns_is_refused_over_the_old_store_and_replaces_it_from_scratch(tmp_path, workspace):
    cfg = make_cfg(workspace)
    supply_counted(cfg, counted_history(cfg, tmp_path))
    run(tmp_path, cfg, name="before")
    before = read_state(cfg)
    registrations, ledger_path = supplied.store_paths(cfg, COUNTED)

    # The export gains a column (a grouping the dashboard did not offer before); config says so.
    grouped = make_cfg(workspace)
    grouped.pipeline["supplied"][COUNTED]["extra_fields"]["grouping"] = "Grouping"
    retaken = counted_history(grouped, tmp_path, extra={"Grouping": "A"}, name="retaken.csv")
    kept = (registrations.read_bytes(), ledger_path.read_bytes())
    expect_abort(lambda: supply_counted(grouped, retaken), "replaces the whole history")
    assert (registrations.read_bytes(), ledger_path.read_bytes()) == kept, "a refused file must change nothing"

    registrations.unlink()
    ledger_path.unlink()
    supply_counted(grouped, retaken, taken="2026-09-06")
    assert "grouping" in [c for c, *_ in duckdb.connect().execute(
        f"DESCRIBE SELECT * FROM read_parquet('{registrations.as_posix()}')").fetchall()]

    # The guard of the last good build still applies: the same totals pass, and a month that moved by more than the limit does not.
    manifest = run(tmp_path, grouped, state=copy.deepcopy(before), name="after")
    assert manifest["datasets"][DATASETS[COUNTED]]["supplied"]["taken"] == ["2026-09-06"]
    moved = copy.deepcopy(before)
    month = sorted(moved["supplied_totals"][DATASETS[COUNTED]])[0]
    moved["supplied_totals"][DATASETS[COUNTED]][month] *= 2
    expect_abort(lambda: run(tmp_path, grouped, state=moved, name="moved"), "differ from the last good build")


# --- what a store must be to be committed --------------------------------------------------------------------------


def data_map() -> dict:
    return json.loads((ROOT / "config" / "data_map.json").read_text(encoding="utf-8"))


def squash(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def held_columns(dmap: dict) -> set[str]:
    """The dashboard's columns that the data map holds back: those whose privacy class is not a published one, or whose
    group describes the owner."""
    published = {n for n, spec in dmap["privacy_classes"].items() if spec["published"]}
    return {e["name"] for e in dmap["fields"]
            if e["source"] == "dashboard" and (e["privacy"] not in published or e["group"] in dmap["owner_groups"])}


def held_names(cfg, dmap: dict) -> set[str]:
    """Every name a held column could carry in a committed file: its own, the register field it mirrors, the logical name
    config gives that field, and the place a roll-up of it leads to."""
    logical = {v: k for k, v in cfg.pipeline["fields"].items()}
    names = set()
    for entry in dmap["fields"]:
        if entry["source"] != "dashboard" or entry["name"] not in held_columns(dmap):
            continue
        names.add(entry["name"])
        for field in entry.get("register_fields", []):
            names.update({field, logical.get(field, field)})
        names.update(r["to"] for r in entry["relations"]["rolls_up_to"])
    return {n for n in names if n}


def strings_of(node):
    if isinstance(node, dict):
        for key, value in node.items():
            yield str(key)
            yield from strings_of(value)
    elif isinstance(node, list):
        for value in node:
            yield from strings_of(value)
    elif isinstance(node, str):
        yield node


def owner_field_problems(registrations: Path, ledger_path: Path, names: set[str]) -> list[str]:
    """Where a held name shows in a store: a column, a key or text of the ledger, or anywhere in either file's bytes."""
    squashed = {squash(n): n for n in names}
    columns = [c for c, *_ in duckdb.connect().execute(f"DESCRIBE SELECT * FROM read_parquet('{registrations.as_posix()}')").fetchall()]
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    found = [f"column {c}" for c in columns if squash(c) in squashed]
    found += [f"ledger text {s!r}" for s in strings_of(ledger) if squash(s) in squashed]
    for path in (registrations, ledger_path):
        content = path.read_bytes().lower()
        # A name of three letters would turn up by chance in compressed bytes; the long ones cannot.
        found += [f"bytes of {path.name}: {n}" for n in names if len(n) >= 8 and n.lower().encode() in content]
    return found


@pytest.mark.parametrize("source_id", SOURCES)
def test_the_stores_files_are_the_two_the_config_names_and_no_other(source_id):
    directory = REAL.supplied_store(source_id)
    if not directory.exists():
        pytest.skip("this store is not committed yet")
    source = REAL.supplied(source_id)
    assert sorted(p.name for p in directory.iterdir()) == sorted([source[supplied.layout(source).file_key], source["ledger_file"]])


@pytest.mark.parametrize("source_id", SOURCES)
def test_the_committed_store_belongs_to_its_ledger_and_to_the_configured_columns(source_id):
    registrations, ledger_path = supplied.store_paths(REAL, source_id)
    if not registrations.exists():
        pytest.skip("this store is not committed yet")
    con, aborts = duckdb.connect(), []
    loaded = supplied.load_store(con, REAL, source_id, aborts)
    assert not aborts, aborts
    assert loaded is not None
    # The newest month a store holds is not later than today: a typing slip in a month would otherwise pass.
    assert loaded[2] <= date.today()


@pytest.mark.parametrize("source_id", SOURCES)
def test_the_committed_store_holds_no_owner_field_in_any_form(source_id):
    registrations, ledger_path = supplied.store_paths(REAL, source_id)
    if not registrations.exists():
        pytest.skip("this store is not committed yet")
    dmap = data_map()
    assert owner_field_problems(registrations, ledger_path, held_names(REAL, dmap)) == []


def test_the_held_columns_come_from_the_data_map_and_are_all_dropped_by_supply():
    dmap = data_map()
    held = held_columns(dmap)
    assert len(held) >= 3, "the data map no longer holds any dashboard column back, so the check would prove nothing"
    assert held <= set(REAL.supplied(COUNTED)["private_columns"]), "a held column must be one `supply` checks for and drops"
    stored = set(supplied.store_columns(REAL.supplied(COUNTED)))
    assert not {squash(n) for n in held_names(REAL, dmap)} & {squash(c) for c in stored}


def test_the_check_catches_an_owner_column_in_a_store_and_in_a_ledger(tmp_path, workspace):
    cfg = make_cfg(workspace)
    supply_counted(cfg, counted_history(cfg, tmp_path))
    registrations, ledger_path = supplied.store_paths(cfg, COUNTED)
    names = held_names(cfg, data_map())
    assert owner_field_problems(registrations, ledger_path, names) == []

    column = sorted(held_columns(data_map()))[0]
    leaky = tmp_path / "leaky.parquet"
    duckdb.connect().execute(f"COPY (SELECT *, 'x' AS \"{column}\" FROM read_parquet('{registrations.as_posix()}')) "
                             f"TO '{leaky.as_posix()}' (FORMAT PARQUET)")
    assert any(p.startswith("column ") for p in owner_field_problems(leaky, ledger_path, names))

    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    ledger["files"]["extra"] = {"note": column}
    marked = tmp_path / "marked.json"
    marked.write_text(json.dumps(ledger), encoding="utf-8")
    assert any(p.startswith("ledger text") for p in owner_field_problems(registrations, marked, names))


@pytest.mark.parametrize("source_id", SOURCES)
def test_every_supplied_source_states_its_terms_and_a_written_ledger_carries_them(source_id, tmp_path, workspace):
    source = REAL.supplied(source_id)
    for key in supplied.SOURCE_BLOCK_KEYS:
        assert isinstance(source.get(key), str) and source[key].strip(), f"{source_id} has no {key} in config/pipeline.json"
    cfg = make_cfg(workspace)
    if source_id == COUNTED:
        supply_counted(cfg, counted_history(cfg, tmp_path))
    else:
        supply_series(cfg, EXPORT)
    ledger = json.loads(supplied.store_paths(cfg, source_id)[1].read_text(encoding="utf-8"))
    assert ledger["source"] == supplied.source_block(source)
    assert list(ledger)[0] == "source"


@pytest.mark.parametrize("source_id", SOURCES)
def test_the_committed_ledger_carries_the_terms_and_no_path_from_any_computer(source_id):
    registrations, ledger_path = supplied.store_paths(REAL, source_id)
    if not ledger_path.exists():
        pytest.skip("this store is not committed yet")
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    for key in ("publisher", "licence", "attribution", "origin"):
        assert ledger["source"].get(key), f"the committed ledger of {source_id} has no {key}"
    for entry in ledger["files"].values():
        assert Path(entry["source_file"]).name == entry["source_file"], "a file's name is kept, never its folder"
        date.fromisoformat(entry["taken"])
    # A drive letter, a backslash or a home folder: nothing that shows where a file was on someone's computer.
    pattern = re.compile(r"[A-Za-z]:[\\/]|\\|/(Users|home)/")
    assert [s for s in strings_of(ledger) if pattern.search(s)] == []
    assert b"\r" not in ledger_path.read_bytes(), "the ledger is written with LF"


def test_git_keeps_a_stores_bytes_as_they_are():
    # The ledger names the SHA-256 of the Parquet file; a checkout that rewrote it would break every build.
    lines = [l.strip() for l in (ROOT / ".gitattributes").read_text(encoding="utf-8").splitlines()]
    assert "*.parquet binary" in lines
