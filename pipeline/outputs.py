"""Writing artefacts: slices, JSON, the snapshot archive, state; promoting staging to public."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from .normalise import lit
from .reference import quote


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_slice(con, cfg, derived, ds: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    decimals = int(cfg.pipeline["fuel_consumption"]["sum_decimals"])
    con.execute(f"""
        COPY (
            WITH base AS (
                SELECT reg_month, {derived.column} AS dim_value, has_engine, fc_status, fc_value FROM dims WHERE {ds}
            ),
            totals AS (SELECT reg_month, count(*) AS denominator FROM base GROUP BY 1)
            SELECT b.reg_month AS month,
                   b.dim_value,
                   CAST(count(*) AS INTEGER) AS n,
                   CAST(any_value(t.denominator) AS INTEGER) AS denominator,
                   round(sum(b.fc_value) FILTER (WHERE b.has_engine AND b.fc_status = 'valid'), {decimals}) AS fc_sum,
                   CAST(count(*) FILTER (WHERE b.has_engine AND b.fc_status = 'valid') AS INTEGER) AS fc_n,
                   CAST(count(*) FILTER (WHERE b.has_engine) AS INTEGER) AS fc_eligible_n
            FROM base b JOIN totals t USING (reg_month)
            GROUP BY b.reg_month, b.dim_value
            ORDER BY month, dim_value
        ) TO {lit(path.as_posix())} (FORMAT PARQUET, COMPRESSION ZSTD)
    """)


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
