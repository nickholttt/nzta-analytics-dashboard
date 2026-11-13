"""`archive`: the whole register as it stood for one snapshot month, as one Parquet file kept outside git.

Not the committed aggregate in data/snapshots/ (`outputs.write_archive`), which the guardrails compare with. This is one
row per vehicle at every field the project may keep, so that anything not derived today can be derived later from the
month as it was first seen. The file holds vehicle rows: it goes to a private store, is never published and is never
uploaded as an artifact of this repository.
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import duckdb

from . import fetch, normalise, schema
from .arcgis import Client
from .errors import GuardrailError
from .reference import quote


def fields(cfg, expected: dict) -> list[str]:
    """The fields the archive pulls: every field of the expected schema except those config says are never pulled.

    Taken from the expected schema, not from the live service, so a field NZTA adds is not archived until the schema
    is deliberately captured again.
    """
    names = [f["name"] for f in expected["fields"]]
    never = cfg.pipeline["register_archive"]["never_pulled"]
    # A misspelt name here would let the field it meant to exclude through.
    unknown = sorted(set(never) - set(names))
    if unknown:
        raise GuardrailError("archive", f"register_archive.never_pulled names fields absent from expected_schema.json: {unknown}")
    object_id = cfg.source_field("object_id")
    return [object_id] + [n for n in names if n != object_id and n not in never]


def write(cfg, pages_glob: str, expected: dict, source: dict, out: Path) -> dict:
    """Saved pages -> one Parquet file: values as NZTA records them, rows sorted so the same register gives the same
    rows in the same order. The row id is dropped: it is the service's paging key, not a property of a vehicle."""
    names = fields(cfg, expected)
    pulled_fields = source.get("out_fields")
    if pulled_fields is None or set(names) - set(pulled_fields):
        missing = sorted(set(names) - set(pulled_fields or []))
        raise GuardrailError("archive", f"the pull did not take every archive field; missing: {missing}")
    object_id = cfg.source_field("object_id")
    kept = [n for n in names if n != object_id]

    work = cfg.path("staging") / "archive"
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    con = duckdb.connect(str(work / "archive.duckdb"))
    try:
        con.execute(f"SET temp_directory = {normalise.lit((work / 'duckdb_tmp').as_posix())}")
        rows = normalise.ingest(con, pages_glob, schema.pull_types(expected, names))
        problems = []
        if rows != source["row_count"]:
            problems.append(f"rows pulled ({rows:,}) differ from the service row count ({source['row_count']:,})")
        repeated = con.execute(f"SELECT count(*) - count(DISTINCT {quote(object_id)}) FROM raw").fetchone()[0]
        if repeated:
            problems.append(f"{repeated:,} rows repeat an OBJECTID: the pull overlapped")
        if problems:
            raise GuardrailError("archive", "\n  - " + "\n  - ".join(problems))
        about = {
            "attribution": cfg.pipeline["register_archive"]["attribution"],
            "snapshot": source["change_key"]["snapshot"],
            "rows": str(rows),
            "source_item_id": source["item_id"],
            "source_service_name": source["service_name"],
            "source_data_last_edit": source.get("data_last_edit") or "",
            "fetched_at": source["fetched_at"],
            "stats_sha256": source["change_key"]["stats_sha256"],
        }
        metadata = ", ".join(f"{key}: {normalise.lit(value)}" for key, value in about.items())
        out.parent.mkdir(parents=True, exist_ok=True)
        columns = ", ".join(quote(c) for c in kept)
        con.execute(f"""
            COPY (SELECT {columns} FROM raw ORDER BY ALL)
            TO {normalise.lit(out.as_posix())} (FORMAT PARQUET, COMPRESSION ZSTD, KV_METADATA {{{metadata}}})
        """)
    finally:
        con.close()
        shutil.rmtree(work, ignore_errors=True)
    return {"snapshot": about["snapshot"][:7], "rows": rows, "fields": len(kept), "bytes": out.stat().st_size}


def run(cfg, out: Path, snapshot: str | None = None, now: datetime | None = None) -> dict:
    """Archive the snapshot the last good build was made from, from the live register.

    The archive runs after the build, in a job of its own, so it pulls again. It goes ahead only while the register
    still is what the build read: the same row count and digest as the last good state.
    """
    now = now or datetime.now(timezone.utc)
    client = Client(cfg.pipeline["source"])
    source, expected = fetch.look(cfg, client, now)
    state = fetch.load_state(cfg)
    if not state:
        raise GuardrailError("archive", "there is no last good build, so there is no snapshot to archive")
    built = state["latest_snapshot"]
    if snapshot and snapshot != built[:7]:
        raise GuardrailError("archive", f"asked to archive {snapshot} but the last good build is {built[:7]}")
    key, last = source["change_key"], state["change_key"]
    if (key["row_count"], key["stats_sha256"]) != (last["row_count"], last["stats_sha256"]):
        raise GuardrailError("archive", f"the register no longer is the one snapshot {built[:7]} was built from "
                                        f"({last['row_count']:,} rows then, {key['row_count']:,} now), so {built[:7]} "
                                        "cannot be archived from it")
    # The snapshot in today's key is capped by today's date; the month this register was built as is the state's.
    source["change_key"] = dict(key, snapshot=built)
    pull_dir = cfg.path("raw") / "archive" / built[:7] / now.strftime("%Y%m%dT%H%M%SZ")
    pages = fetch.pull(cfg, client, source, fields(cfg, expected), pull_dir)
    return write(cfg, pages, expected, source, out)


def from_pull(cfg, pull_dir: Path, out: Path) -> dict:
    """The same file from a pull already saved on disk, for a month whose archive was missed and pulled by hand."""
    source = json.loads((pull_dir / "source.json").read_text(encoding="utf-8"))
    expected = json.loads(cfg.path("expected_schema").read_text(encoding="utf-8"))
    return write(cfg, (pull_dir / "pages" / "*.json.gz").as_posix(), expected, source, out)
