"""Narrow fact tables: a second, smaller table beside the wide one for a field that would make every question heavier.

The tests give a dataset its narrow tables in the configuration they build with, so they hold the mechanism and name no
dimension, field value or table of the committed config except by the logical field a dimension reads (design invariant 1).
The last test holds the committed config itself.
"""

from __future__ import annotations

import copy

import duckdb
import pytest

from pipeline import build, config, derive, privacy
from pipeline.contract import FACT_COUNT, FACT_MONTH, FACTS_DIR, NARROW_DIR
from pipeline.errors import GuardrailError

from .conftest import load_rows, make_cfg
from .test_guardrails import expect_abort, run
from .test_small_cells_build import owner_dimension

DATASET = "registrations_surviving"
TABLE = "probe_table"
RAW_FIELD = "basic_colour"
WAITING = "probe_waiting"


def raw_dimension(cfg) -> str:
    return next(d["id"] for d in cfg.dimensions["dimensions"] if d.get("derive", {}).get("kind") == "raw" and d["derive"]["field"] == RAW_FIELD)


def companion(cfg) -> str:
    """A dimension of the wide table other than the raw one."""
    return next(d for d in cfg.pipeline["datasets"][DATASET]["facts"] if d != raw_dimension(cfg))


def configured(workspace, narrow=None, **changes):
    cfg = make_cfg(workspace)
    cfg.pipeline = copy.deepcopy(cfg.pipeline)
    spec = cfg.pipeline["datasets"][DATASET]
    spec["narrow_facts"] = narrow if narrow is not None else [{"id": TABLE, "dimensions": [raw_dimension(cfg), companion(cfg)]}]
    spec.update(changes)
    return cfg


def folder(workspace, table=TABLE):
    return workspace["staging"] / "build" / FACTS_DIR / DATASET / NARROW_DIR / table


def read_table(path) -> list[tuple]:
    """The table's rows, month first, then the dimensions in file-name order, then n."""
    names = sorted(p.stem for p in path.glob("*.parquet"))
    ordered = [FACT_MONTH[0]] + [n for n in names if n not in (FACT_MONTH[0], FACT_COUNT[0])] + [FACT_COUNT[0]]
    sources = " POSITIONAL JOIN ".join(f"read_parquet('{(path / (n + '.parquet')).as_posix()}') AS c{i}" for i, n in enumerate(ordered))
    return duckdb.connect().execute(f"SELECT * FROM {sources}").fetchall()


def test_a_narrow_table_is_written_beside_the_wide_one_and_listed_in_the_manifest(tmp_path, workspace):
    cfg = configured(workspace)
    manifest = run(tmp_path, cfg, load_rows(), publish=False)
    wide = manifest["datasets"][DATASET]["facts"]
    entry = wide["narrow"][TABLE]
    raw, other = raw_dimension(cfg), companion(cfg)
    assert entry["dimensions"] == [raw, other] and entry["not_live"] == {}
    assert raw not in wide["dimensions"], "the narrow table's field is not a column of the wide one"
    path = folder(workspace)
    assert sorted(p.name for p in path.glob("*.parquet")) == sorted(f"{n}.parquet" for n in (FACT_MONTH[0], raw, other, FACT_COUNT[0]))
    assert entry["rows"] == len(read_table(path)) > 0
    assert [p.name for p in path.parent.iterdir()] == [TABLE], "nothing but the configured tables sits under narrow/"
    assert (path.parent.parent / "month.parquet").exists(), "the wide table is still there"


def test_a_narrow_table_counts_the_datasets_vehicles_once_in_the_months_the_wide_table_does(tmp_path, workspace):
    cfg = configured(workspace)
    manifest = run(tmp_path, cfg, load_rows(), publish=False)
    rows = read_table(folder(workspace))
    assert sum(r[-1] for r in rows) == manifest["datasets"][DATASET]["rows"]
    keys = [r[:-1] for r in rows]
    assert len(set(keys)) == len(keys), "rows are unique on month and the dimension values"
    assert keys == sorted(keys), "sorted by month, then each dimension in the order configured"
    narrow_months: dict = {}
    for month, *_values, n in rows:
        narrow_months[month] = narrow_months.get(month, 0) + n
    wide = workspace["staging"] / "build" / FACTS_DIR / DATASET
    expected = dict(duckdb.connect().execute(
        f"SELECT m.month, sum(c.n) FROM (SELECT row_number() OVER () AS i, month FROM read_parquet('{(wide / 'month.parquet').as_posix()}')) m "
        f"JOIN (SELECT row_number() OVER () AS i, n FROM read_parquet('{(wide / 'n.parquet').as_posix()}')) c USING (i) GROUP BY 1").fetchall())
    assert narrow_months == expected


def test_a_dataset_without_narrow_tables_has_no_narrow_entry_and_no_folder(tmp_path, workspace):
    cfg = make_cfg(workspace)
    cfg.pipeline = copy.deepcopy(cfg.pipeline)
    cfg.pipeline["datasets"][DATASET].pop("narrow_facts", None)
    manifest = run(tmp_path, cfg, load_rows(), publish=False)
    assert "narrow" not in manifest["datasets"][DATASET]["facts"]
    assert not (workspace["staging"] / "build" / FACTS_DIR / DATASET / NARROW_DIR).exists()


def test_a_narrow_dimension_that_is_not_live_is_left_out_with_a_warning(tmp_path, workspace):
    cfg = configured(workspace)
    # A lookup of a reference file that is not there is not live (and is not guarded by abort_on_unmapped), so the table waits for it.
    source = next(d for d in cfg.dimensions["dimensions"] if d.get("derive", {}).get("kind") == "lookup"
                  and d["id"] not in cfg.pipeline["guardrails"]["abort_on_unmapped"] and "applies_to" not in d
                  and d["derive"]["field"] in cfg.pipeline["fields"])
    cfg.dimensions = copy.deepcopy(cfg.dimensions)
    probe = copy.deepcopy(source)
    probe.update(id=WAITING)
    probe["derive"]["reference"] = "absent_reference_file.csv"
    cfg.dimensions["dimensions"].append(probe)
    cfg.pipeline["datasets"][DATASET]["narrow_facts"][0]["dimensions"].append(WAITING)
    manifest = run(tmp_path, cfg, load_rows(), publish=False)
    entry = manifest["datasets"][DATASET]["facts"]["narrow"][TABLE]
    assert WAITING not in entry["dimensions"] and entry["not_live"] == {WAITING: "dimension not live"}
    assert any(f"narrow table {TABLE} is written without {WAITING}" in w for w in manifest["warnings"]), manifest["warnings"]
    assert not (folder(workspace) / f"{WAITING}.parquet").exists()


@pytest.mark.parametrize("narrow, fragment", [
    ("text", "narrow_facts must be a list of tables"),
    ([{"id": TABLE, "dimensions": []}], "narrow_facts 'probe_table' must list distinct dimension ids, at least one"),
    ([{"id": TABLE, "dimensions": "x"}], "narrow_facts 'probe_table' must list distinct dimension ids"),
    ([{"id": TABLE}], "narrow_facts 'probe_table' must list distinct dimension ids"),
    ([{"dimensions": ["x"]}], "narrow_facts table must have an id"),
    ([{"id": "Bad Id", "dimensions": ["x"]}], "narrow_facts table id 'Bad Id' must be lower case letters, digits and underscores"),
    ([{"id": TABLE, "dimensions": ["x"]}, {"id": TABLE, "dimensions": ["y"]}], "narrow_facts lists the id probe_table twice"),
    ([{"id": TABLE, "dimensions": ["no_such_dimension"]}], "narrow_facts 'probe_table' names no_such_dimension, not a derivable dimension"),
])
def test_a_misconfigured_narrow_table_aborts(tmp_path, workspace, narrow, fragment):
    cfg = configured(workspace, narrow=narrow)
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), fragment)


@pytest.mark.parametrize("name", ["month", "n", "rid"])
def test_a_narrow_table_cannot_take_a_reserved_column_name(tmp_path, workspace, name):
    cfg = configured(workspace, narrow=[{"id": TABLE, "dimensions": [companion(make_cfg(workspace)), name]}])
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), f"narrow_facts 'probe_table' names {name}, a name the fact table reserves")


def test_narrow_tables_need_the_wide_table(tmp_path, workspace):
    cfg = configured(workspace)
    del cfg.pipeline["datasets"][DATASET]["facts"]
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "narrow_facts needs the dataset's facts")


def test_a_narrow_table_that_names_an_owner_dimension_aborts_before_anything_is_written(tmp_path, workspace):
    base = make_cfg(workspace)
    dimension = owner_dimension()
    fields = privacy.owner_dimensions(base)[dimension]
    cfg = configured(workspace, narrow=[{"id": TABLE, "dimensions": [raw_dimension(base), dimension]}])
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, load_rows(), publish=False)
    message = str(info.value)
    for named in (DATASET, TABLE, dimension, *fields):
        assert named in message, (named, message)
    assert "Remove" in message and "narrow_facts" in message, message
    assert not (workspace["staging"] / "build").exists(), "the abort comes before the build writes a file"


def test_a_narrow_table_whose_counts_do_not_total_the_datasets_vehicles_aborts(tmp_path, workspace, monkeypatch):
    build_dims = derive.build_dims

    def repeating_one_vehicle(con, cfg, derived, *scope):
        build_dims(con, cfg, derived, *scope)
        con.execute("INSERT INTO dims SELECT * FROM dims WHERE fleet_entry AND reg_month IS NOT NULL ORDER BY reg_month LIMIT 1")

    monkeypatch.setattr(derive, "build_dims", repeating_one_vehicle)
    cfg = configured(workspace)
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, load_rows(), publish=False)
    assert f"the narrow table {TABLE} counts" in str(info.value), str(info.value)


def test_the_committed_config_gives_the_raw_dimension_a_narrow_table_and_the_wide_table_none_of_it():
    cfg = config.load()
    spec = cfg.pipeline["datasets"][DATASET]
    raw = raw_dimension(cfg)
    assert raw not in spec["facts"]
    tables = [t for t in spec.get("narrow_facts", []) if raw in t["dimensions"]]
    assert len(tables) == 1, "the field has one narrow table"
    assert build.fact_table_owner_problems(cfg) == []
