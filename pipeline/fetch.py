"""`run`: find the service, check it, decide whether the source changed, pull rows, build."""

from __future__ import annotations

import calendar
import hashlib
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

from . import build as build_step
from . import schema
from .arcgis import Client
from .build import iso_utc
from .errors import GuardrailError


def load_state(cfg) -> dict | None:
    path = cfg.path("state")
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def snapshot_and_key(cfg, stats: list[dict], row_count: int, fetch_date: date) -> tuple[dict, int]:
    """Snapshot = latest first-registration month, capped at the month before the fetch. Returns (change key, rows after cap)."""
    fields = [cfg.source_field(k) for k in cfg.pipeline["change_key_fields"]]
    year_f, month_f = cfg.source_field("registration_year"), cfg.source_field("registration_month")
    months = sorted({(r[year_f], r[month_f]) for r in stats
                     if r[year_f] is not None and r[month_f] is not None and 1 <= r[month_f] <= 12 and r["n"] > 0})
    if not months:
        raise GuardrailError("snapshot", "the source has no rows with a valid first-registration month")
    cap = (fetch_date.year, fetch_date.month - 1) if fetch_date.month > 1 else (fetch_date.year - 1, 12)
    year, month = min(months[-1], cap)
    after_cap = sum(r["n"] for r in stats
                    if r[year_f] is not None and r[month_f] is not None and (r[year_f], r[month_f]) > (year, month))
    snapshot = date(year, month, calendar.monthrange(year, month)[1]).isoformat()
    canonical = sorted(([r[f] for f in fields] + [r["n"]] for r in stats), key=lambda row: json.dumps(row))
    digest = hashlib.sha256(json.dumps(canonical, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()
    return {"row_count": row_count, "snapshot": snapshot, "stats_sha256": digest}, after_cap


def emit(github_output: str | None, values: dict) -> None:
    if github_output:
        with open(github_output, "a", encoding="utf-8") as fh:
            fh.writelines(f"{k}={v}\n" for k, v in values.items())


def run(cfg, force: bool = False, github_output: str | None = None, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    client = Client(cfg.pipeline["source"])
    service = client.discover()
    expected_path = cfg.path("expected_schema")
    if not expected_path.exists():
        raise GuardrailError("schema", f"{expected_path} is missing: run `python -m pipeline init-schema` once and commit it")
    expected = json.loads(expected_path.read_text(encoding="utf-8"))
    warnings = service.warnings + schema.check(expected, service.layer, list(cfg.pipeline["fields"].values()))

    object_id = cfg.source_field("object_id")
    row_count = client.count(service.layer_url)
    stats = client.grouped_counts(service.layer_url, [cfg.source_field(k) for k in cfg.pipeline["change_key_fields"]], object_id)
    key, after_cap = snapshot_and_key(cfg, stats, row_count, now.date())
    if after_cap:
        warnings.append(f"{after_cap:,} rows have a first-registration month after the snapshot cap {key['snapshot']}")
    state = load_state(cfg)
    emit(github_output, {"snapshot": key["snapshot"][:7]})
    if state and state.get("change_key") == key and not force:
        print(f"Source unchanged since the last good build (snapshot {key['snapshot']}); nothing to do.")
        emit(github_output, {"built": "false"})
        return 0

    pull_dir = cfg.path("raw") / key["snapshot"][:7] / now.strftime("%Y%m%dT%H%M%SZ")
    edited = (service.layer.get("editingInfo") or {}).get("dataLastEditDate")
    source = {
        "item_id": service.item_id,
        "discovery": service.discovery,
        "service_name": service.service_name,
        "service_url": service.layer_url,
        "data_last_edit": iso_utc(datetime.fromtimestamp(edited / 1000, timezone.utc)) if edited else None,
        "fetched_at": iso_utc(now),
        "row_count": row_count,
        "change_key": key,
        "warnings": warnings,
    }
    print(f"Pulling {row_count:,} rows from {service.service_name} (snapshot {key['snapshot']}) into {pull_dir}")
    source["rows_saved"] = client.pull_rows(service.layer_url, object_id, list(cfg.pipeline["fields"].values()), pull_dir / "pages")
    (pull_dir / "source.json").write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8")

    manifest = build_step.build(cfg, source, (pull_dir / "pages" / "*.json.gz").as_posix(), state, now)
    emit(github_output, {"built": "true"})
    print_summary(manifest)
    return 0


def print_summary(manifest: dict) -> None:
    print(f"Built snapshot {manifest['latest_snapshot']} from {manifest['source']['rows_pulled']:,} rows.")
    for dataset, d in manifest["datasets"].items():
        print(f"  {dataset}: {d['rows']:,} rows over {d['months']} months; live: {', '.join(d['live_dimensions'])}")
        if d["not_live"]:
            print(f"    not live: {d['not_live']}")
    print(f"  moving cutoff: vehicle year {manifest['moving_cutoff_vehicle_year']}, age {manifest['moving_cutoff_age']}")
    report = manifest["used_import_age_trailing"]
    if report.get("rows"):
        print(f"  used-import age (trailing {report['window_months']} months): median {report['median']}, mode {report['mode']}, "
              f"{report['share_cluster']:.1%} aged {report['cluster'][0]}-{report['cluster'][1]}")
    for warning in manifest["warnings"]:
        print(f"  WARNING: {warning}", file=sys.stderr)
