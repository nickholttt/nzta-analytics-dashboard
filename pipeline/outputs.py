"""Writing artefacts: slices, JSON, the snapshot archive, state; promoting staging to public."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from .contract import FACT_COUNT, FACT_MONTH, FACT_ROW_ORDER
from .normalise import lit
from .reference import quote


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # "\n" on every platform: a Windows build otherwise writes "\r\n", and its files and payload_bytes differ from the runner's.
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def write_slice(con, cfg, derived, ds: str, path: Path, fuel: bool = True) -> None:
    """A dimension's 1-D slice. `fuel` False writes the three fuel columns null on every row: a slice a protected pair stands
    on carries none, since its fuel-eligible counts would bound the pair's hidden cells (D-135)."""
    _write_counts(con, cfg, [(derived.column, "dim_value")], ds, path, fuel)


def write_pair(con, cfg, a, b, ds: str, path: Path) -> None:
    _write_counts(con, cfg, [(a.column, "a_value"), (b.column, "b_value")], ds, path)


def write_series_slice(con, values: str, totals: str, path: Path) -> None:
    """A 1-D slice in the cube's schema from counts that are given, not counted from vehicle rows. `values` is a table of
    (month, dim_value, n) and `totals` one of (month, total). The source carries no fuel consumption, so fc_sum is null
    and both fuel counts are 0, as for a dataset whose source lacks the field."""
    path.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"""
        COPY (
            SELECT v.month AS month,
                   v.dim_value AS dim_value,
                   CAST(v.n AS INTEGER) AS n,
                   CAST(t.total AS INTEGER) AS denominator,
                   CAST(NULL AS DOUBLE) AS fc_sum,
                   CAST(0 AS INTEGER) AS fc_n,
                   CAST(0 AS INTEGER) AS fc_eligible_n
            FROM {values} v JOIN {totals} t USING (month)
            ORDER BY month, dim_value
        ) TO {lit(path.as_posix())} (FORMAT PARQUET, COMPRESSION ZSTD)
    """)


def write_facts(con, derived: list, ds: str, directory: Path) -> tuple[int, int]:
    """The fact table: counts by month and each given dimension, written one column per file. Every file holds the same
    rows in the same order (month, then the dimensions as configured), so the site rebuilds any subset of columns row
    for row. Returns the row count and the total of the counts."""
    directory.mkdir(parents=True, exist_ok=True)
    month, count = FACT_MONTH[0], FACT_COUNT[0]
    names = [month] + [d.dim_id for d in derived]
    # With no dimension live, the table is the month totals alone, still a valid table.
    selected = ", ".join([f"reg_month AS {month}"] + [f"{d.column} AS {quote(d.dim_id)}" for d in derived])
    order = ", ".join(quote(n) for n in names)
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE facts AS
        SELECT row_number() OVER (ORDER BY {order}) AS {FACT_ROW_ORDER}, *
        FROM (SELECT {selected}, CAST(count(*) AS INTEGER) AS {count}
              FROM dims WHERE {ds} GROUP BY ALL)
    """)
    for name in names + [count]:
        con.execute(f"""
            COPY (SELECT {quote(name)} FROM facts ORDER BY {FACT_ROW_ORDER})
            TO {lit((directory / f"{name}.parquet").as_posix())} (FORMAT PARQUET, COMPRESSION ZSTD)
        """)
    con.execute("DROP TABLE facts")
    # Read back from the file the site downloads, so the caller's check is of what is published, not of the query.
    written = lit((directory / f"{count}.parquet").as_posix())
    rows, total = con.execute(f"SELECT count(*), coalesce(sum({count}), 0) FROM read_parquet({written})").fetchone()
    return rows, total


def counts_sql(cfg, keys: list[tuple[str, str]], ds: str) -> str:
    """The query for counts by month and the given dimension columns. The denominator is the dataset's whole month in
    both kinds of slice, so a pair summed over either value reproduces that value's 1-D slice."""
    decimals = int(cfg.pipeline["fuel_consumption"]["sum_decimals"])
    selected = ", ".join(f"{column} AS {alias}" for column, alias in keys)
    names = ", ".join(alias for _, alias in keys)
    grouped = ", ".join(f"b.{alias}" for _, alias in keys)
    return f"""
            WITH base AS (
                SELECT reg_month, {selected}, has_engine, fc_status, fc_value FROM dims WHERE {ds}
            ),
            totals AS (SELECT reg_month, count(*) AS denominator FROM base GROUP BY 1)
            SELECT b.reg_month AS month,
                   {grouped},
                   CAST(count(*) AS INTEGER) AS n,
                   CAST(any_value(t.denominator) AS INTEGER) AS denominator,
                   round(sum(b.fc_value) FILTER (WHERE b.has_engine AND b.fc_status = 'valid'), {decimals}) AS fc_sum,
                   CAST(count(*) FILTER (WHERE b.has_engine AND b.fc_status = 'valid') AS INTEGER) AS fc_n,
                   CAST(count(*) FILTER (WHERE b.has_engine) AS INTEGER) AS fc_eligible_n
            FROM base b JOIN totals t USING (reg_month)
            GROUP BY b.reg_month, {grouped}
            ORDER BY month, {names}
        """


def _write_counts(con, cfg, keys: list[tuple[str, str]], ds: str, path: Path, fuel: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    query = counts_sql(cfg, keys, ds)
    if not fuel:
        names = ", ".join(alias for _, alias in keys)
        query = (f"SELECT month, {names}, n, denominator, CAST(NULL AS DOUBLE) AS fc_sum, CAST(NULL AS INTEGER) AS fc_n, "
                 f"CAST(NULL AS INTEGER) AS fc_eligible_n FROM ({query}) ORDER BY month, {names}")
    con.execute(f"COPY ({query}) TO {lit(path.as_posix())} (FORMAT PARQUET, COMPRESSION ZSTD)")


def write_archive(con, cfg, path: Path) -> None:
    columns = ", ".join(quote(c) for c in cfg.pipeline["snapshot_archive"]["group_by"])
    path.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"""
        COPY (SELECT {columns}, CAST(count(*) AS INTEGER) AS n FROM src GROUP BY ALL ORDER BY ALL)
        TO {lit(path.as_posix())} (FORMAT PARQUET, COMPRESSION ZSTD)
    """)


def same_parquet(con, a: Path, b: Path) -> bool:
    left, right = f"read_parquet({lit(a.as_posix())})", f"read_parquet({lit(b.as_posix())})"
    differing = con.execute(f"""
        SELECT count(*) FROM (
            (SELECT * FROM {left} EXCEPT ALL SELECT * FROM {right})
            UNION ALL
            (SELECT * FROM {right} EXCEPT ALL SELECT * FROM {left})
        )
    """).fetchone()[0]
    return differing == 0


def payload_bytes(directory: Path) -> int:
    return sum(p.stat().st_size for p in directory.rglob("*") if p.is_file())


def promote(staging: Path, public: Path) -> None:
    public.parent.mkdir(parents=True, exist_ok=True)
    previous = public.with_name(public.name + ".previous")
    if previous.exists():
        shutil.rmtree(previous)
    if public.exists():
        public.rename(previous)
    staging.rename(public)
    if previous.exists():
        shutil.rmtree(previous)
