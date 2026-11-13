"""`run`: find the service, check it, decide whether the source changed, pull rows, build."""

from __future__ import annotations

import calendar
import hashlib
import json
import statistics
import sys
import time
from collections import Counter
from datetime import date, datetime, timedelta, timezone
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
    """Snapshot = the latest first-registration month that holds a month of registrations, no later than the month
    before the fetch. Returns (change key, rows dated after the snapshot)."""
    fields = [cfg.source_field(k) for k in cfg.pipeline["change_key_fields"]]
    year_f, month_f = cfg.source_field("registration_year"), cfg.source_field("registration_month")
    totals: Counter = Counter()
    for r in stats:
        if r[year_f] is not None and r[month_f] is not None and 1 <= r[month_f] <= 12:
            totals[(r[year_f], r[month_f])] += r["n"]
    months = sorted(m for m, n in totals.items() if n > 0)
    if not months:
        raise GuardrailError("snapshot", "the source has no rows with a valid first-registration month")
    cap = (fetch_date.year, fetch_date.month - 1) if fetch_date.month > 1 else (fetch_date.year - 1, 12)
    window, share = cfg.pipeline["trailing_window_months"], cfg.pipeline["snapshot"]["min_share_of_trailing_median"]

    def holds_a_month(i: int) -> bool:
        # A few rows dated after the register's own month are not the next snapshot. Without this, once the cap
        # passes them they would be built as a month, and the real refresh of that month then refused as a rebuild.
        before = [totals[m] for m in months[max(0, i - window):i]]
        return not before or totals[months[i]] >= share * statistics.median(before)

    found = next((months[i] for i in reversed(range(len(months))) if months[i] <= cap and holds_a_month(i)), None)
    if found is None:
        raise GuardrailError("snapshot", "the source has no month of registrations before the month of the fetch")
    year, month = found
    after_cap = sum(r["n"] for r in stats
                    if r[year_f] is not None and r[month_f] is not None and (r[year_f], r[month_f]) > (year, month))
    snapshot = date(year, month, calendar.monthrange(year, month)[1]).isoformat()
    canonical = sorted(([r[f] for f in fields] + [r["n"]] for r in stats), key=lambda row: json.dumps(row))
    digest = hashlib.sha256(json.dumps(canonical, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()
    return {"row_count": row_count, "snapshot": snapshot, "stats_sha256": digest}, after_cap


def plan(key: dict, state: dict | None, force: bool) -> tuple[bool, str | None]:
    """Whether this run builds and, when it does not, the line that says why.

    The run is tried every day, so a snapshot month could be built twice: NZTA edits the register again within the
    month, the key differs, and the rebuild would replace what the first build published. Each month is built once;
    only a forced run rebuilds it.
    """
    if force or not state:
        return True, None
    last = state["change_key"]
    # The snapshot in the key is capped by the fetch date, so it can move on the first of a month while the register
    # has not. Only the row count and the digest say whether the source changed.
    if (last["row_count"], last["stats_sha256"]) == (key["row_count"], key["stats_sha256"]):
        return False, f"Source unchanged since the last good build (snapshot {state['latest_snapshot']}); nothing to do."
    if key["snapshot"] == state["latest_snapshot"]:
        month = key["snapshot"][:7]
        changed = (f"The source changed after snapshot {month} was built: {last['row_count']:,} rows then, "
                   f"{key['row_count']:,} now. Each month is built once, so nothing was built.")
        # A forced run of an unchanged row count is stopped by the build's own check (docs/CUBE_SCHEMA.md, Freshness),
        # so the advice is given only where it works.
        if last["row_count"] == key["row_count"]:
            return False, f"{changed} A forced run would stop too: the build refuses a source that changed without its row count moving."
        return False, f"{changed} To rebuild {month} from the changed source, start the run by hand with force ticked."
    return True, None


def missed_month(cfg, state: dict | None, today: date) -> str | None:
    """The month whose snapshot should have been built by now and has not been, as YYYY-MM.

    A run that skips is green, so a month NZTA never published, or one every build of failed, would otherwise pass
    unseen. From the alarm day of each month, the month before must be the last good build's snapshot or later.
    """
    alarm_day = cfg.pipeline["schedule"]["missed_month_alarm_day"]
    # Every month has a 28th. A later day would never come in a short month and the alarm would stay silent.
    if not isinstance(alarm_day, int) or not 1 <= alarm_day <= 28:
        raise GuardrailError("config", f"schedule.missed_month_alarm_day must be a day from 1 to 28, not {alarm_day!r}")
    if not state or today.day < alarm_day:
        return None
    due = today.replace(day=1) - timedelta(days=1)
    return due.strftime("%Y-%m") if date.fromisoformat(state["latest_snapshot"]) < due else None


def emit(github_output: str | None, values: dict) -> None:
    if github_output:
        with open(github_output, "a", encoding="utf-8") as fh:
            fh.writelines(f"{k}={v}\n" for k, v in values.items())


def report(github_summary: str | None, line: str) -> None:
    """Say why nothing was built: in the log, and on the run's summary page, where a green run is otherwise silent."""
    print(line)
    if github_summary:
        with open(github_summary, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def run(cfg, force: bool = False, github_output: str | None = None, now: datetime | None = None,
        github_summary: str | None = None) -> int:
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
    building, reason = plan(key, state, force)
    if not building:
        report(github_summary, reason)
        emit(github_output, {"built": "false"})
        # Only a run that builds nothing raises the alarm: a build of an older month must still be committed, and the
        # next day's run then reports the month still missing.
        missing = missed_month(cfg, state, now.date())
        if missing:
            detail = (f"snapshot {missing} has not been built and it is {now:%Y-%m-%d}. The last good build is "
                      f"{state['latest_snapshot'][:7]} and the source holds {key['snapshot'][:7]}. Either NZTA has not "
                      "refreshed the register or the builds since have failed. This run fails every day until "
                      f"{missing} is built.")
            report(github_summary, f"Missed month: {detail}")
            raise GuardrailError("missed_month", detail)
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
    started = time.monotonic()
    source["rows_saved"] = client.pull_rows(service.layer_url, object_id, list(cfg.pipeline["fields"].values()), pull_dir / "pages")
    # The runner log can then split the step's time between the pull and the build.
    print(f"Pulled {source['rows_saved']:,} rows in {time.monotonic() - started:.1f}s")
    (pull_dir / "source.json").write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8", newline="\n")

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
