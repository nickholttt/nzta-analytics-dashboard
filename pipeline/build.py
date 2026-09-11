"""One build: saved pages -> cube slices, manifest, events. Publishes only if every guardrail passes."""

from __future__ import annotations

import json
import shutil
from datetime import date, datetime, timezone

import duckdb

from . import derive, events, guardrails, metrics, normalise, outputs, schema
from .errors import GuardrailError
from .reference import quote


def iso_utc(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build(cfg, source: dict, pages_glob: str, state: dict | None, now: datetime | None = None, publish: bool = True) -> dict:
    now = now or datetime.now(timezone.utc)
    p, g = cfg.pipeline, cfg.pipeline["guardrails"]
    aborts: list[str] = []
    warnings: list[str] = list(source.get("warnings", []))

    expected = json.loads(cfg.path("expected_schema").read_text(encoding="utf-8"))
    types = schema.pull_types(expected, list(p["fields"].values()))
    # A disk-backed working database: the full register does not have to fit in memory.
    work = cfg.path("staging")
    work.mkdir(parents=True, exist_ok=True)
    database = work / "work.duckdb"
    for stale in (database, work / "work.duckdb.wal"):
        stale.unlink(missing_ok=True)
    con = duckdb.connect(str(database))
    con.execute(f"SET temp_directory = {normalise.lit((work / 'duckdb_tmp').as_posix())}")
    pulled = normalise.ingest(con, pages_glob, types)
    if pulled != source["row_count"]:
        aborts.append(f"rows pulled ({pulled:,}) differ from the service row count ({source['row_count']:,})")
    repeated = con.execute(f"SELECT count(*) - count(DISTINCT {quote(p['fields']['object_id'])}) FROM raw").fetchone()[0]
    if repeated:
        aborts.append(f"{repeated:,} rows repeat an OBJECTID: the pull overlapped")
    normalise.build_src(con, cfg, types, {f["name"] for f in expected["fields"]})
    con.execute("DROP TABLE raw")
    normalise.build_rows(con, cfg)

    latest_snapshot = source["change_key"]["snapshot"]
    snapshot_month = date.fromisoformat(latest_snapshot).replace(day=1)
    snapshot_key = snapshot_month.strftime("%Y-%m")
    window = int(p["trailing_window_months"])
    window_start = metrics.month_add(snapshot_month, -(window - 1))
    in_scope_rows = con.execute("SELECT count(*) FROM rows WHERE in_scope").fetchone()[0]
    previous_live = (state or {}).get("live_dimensions", {})

    staging = cfg.path("staging") / "build"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)

    datasets, month_counts, live_dimensions = {}, {}, {}
    moving = {"vehicle_year": None, "age": None, "snapshot_year": snapshot_month.year}
    age_report = {"window_months": window, "rows": 0}
    for dataset, dataset_cfg in p["datasets"].items():
        require = dataset_cfg["require"]
        ds = metrics.dataset_filter(require, snapshot_month)
        candidates, not_live = derive.applicable(cfg, dataset)
        was_live = set(previous_live.get(dataset, []))

        def exclude(dim_id: str, reason: str) -> None:
            if dim_id in g["abort_on_unmapped"] or dim_id in was_live:
                aborts.append(f"{dataset}.{dim_id}: {reason}")
            else:
                not_live[dim_id] = reason
                warnings.append(f"{dataset}.{dim_id} is not live: {reason}")

        derived = []
        for index, dim in enumerate(candidates):
            missing = [r for r in derive.references_for(cfg, dim["derive"]) if not cfg.reference(r).exists()]
            if missing:
                exclude(dim["id"], f"reference files missing: {missing}")
            else:
                derived.append(derive.derive(con, cfg, dim, index, snapshot_month.year))
        derive.build_dims(con, cfg, derived)
        caps = {d.dim_id: derive.apply_model_cap(con, d, ds, window_start, snapshot_month) for d in derived if d.kind == "model"}
        rates = metrics.unmapped_rates(con, derived)
        guard = metrics.unmapped_guard(con, derived, g, window_start, snapshot_month, window)
        for dim_id, figures in guard.items():
            t = figures["trailing"]
            detail = (f"{dataset}.{dim_id}: unmapped rate over the trailing {window} months is {t['rate'] or 0:.2%} "
                      f"({t['unmapped']:,} of {t['rows']:,} in-scope rows)")
            if t["unmapped"] > t["abort_above"] * t["rows"]:
                aborts.append(f"{detail}, above {t['abort_above']:.0%}")
            elif t["unmapped"] > t["warn_above"] * t["rows"]:
                warnings.append(f"{detail}, above the {t['warn_above']:.1%} warning level; the run aborts above "
                                f"{t['abort_above']:.0%}, {t['headroom_rows']:,} rows away")
        live = []
        for d in derived:
            if rates[d.dim_id] <= g["max_unmapped_rate"]:
                live.append(d)
            else:
                exclude(d.dim_id, f"unmapped rate {rates[d.dim_id]:.2%} is above {g['max_unmapped_rate']:.0%} of in-scope rows")
        for d in live:
            outputs.write_slice(con, cfg, d, ds, staging / "cube" / dataset / f"{d.dim_id}.parquet")

        counts = metrics.month_counts(con, ds)
        month_counts[dataset] = counts
        live_dimensions[dataset] = [d.dim_id for d in live]
        if counts.get(snapshot_key, 0) == 0:
            aborts.append(f"{dataset}: the snapshot month {snapshot_key} has no rows")
        deviation = metrics.latest_month_deviation(counts, snapshot_month, window)
        if deviation is not None and abs(deviation) > g["latest_month_max_deviation"]:
            warnings.append(f"{dataset}: {snapshot_key} count deviates {deviation:+.0%} from the median of the previous {window} months")
        quality = metrics.quality_counts(con, derived, require, snapshot_month)
        if quality["registration_after_snapshot"]:
            warnings.append(f"{dataset}: {quality['registration_after_snapshot']:,} rows are dated after the snapshot month and were excluded")
        datasets[dataset] = {
            "definition": next((x.get("definition") for x in cfg.dimensions["datasets"] if x["id"] == dataset), None),
            "rows": sum(counts.values()),
            "months": len(counts),
            "live_dimensions": live_dimensions[dataset],
            "not_live": not_live,
            "unmapped_rates": rates,
            "unmapped_guard": guard,
            "mild_hybrid_identification_coverage": metrics.hybrid_coverage(con, cfg, ds, window_start, snapshot_month, window),
            "coverage_trailing": metrics.coverage(con, derived, ds, window_start, snapshot_month, window),
            "counts": quality,
            "model_cap": caps,
        }
        hybrid_coverage = datasets[dataset]["mild_hybrid_identification_coverage"]
        disagreeing = hybrid_coverage["classification_disagrees_with_powertrain"]
        if disagreeing:
            warnings.append(f"{dataset}: {disagreeing:,} vehicles show a powertrain that contradicts their classification in "
                            f"{p['hybrid_classification']['file']}")
        trailing_high = hybrid_coverage["trailing"]["coverage_high_confidence_only"]
        floor = hybrid_coverage["warn_below_trailing_high_confidence_coverage"]
        if trailing_high is not None and trailing_high < floor:
            warnings.append(f"{dataset}: mild hybrid identification coverage over the trailing {window} months is "
                            f"{trailing_high:.1%} counting high-confidence classifications only, below {floor:.0%}")
        if dataset == p["used_imports"]["dataset"]:
            by_vehicle_year, by_age = metrics.used_import_years(con, cfg, ds, window_start, snapshot_month)
            year, age = metrics.moving_cutoff(by_vehicle_year, snapshot_month.year, cfg)
            moving = {"vehicle_year": year, "age": age, "snapshot_year": snapshot_month.year}
            age_report = metrics.age_report(by_age, cfg, window)
            if year is None:
                warnings.append("moving cutoff not detected in the trailing window")

    event_rows, event_problems = events.build(cfg, events.vocabularies(con, cfg, snapshot_month.year))
    aborts += [f"events: {problem}" for problem in event_problems]

    current = {
        "row_count": source["row_count"],
        "in_scope_row_count": in_scope_rows,
        "latest_snapshot": latest_snapshot,
        "change_key": source["change_key"],
        "month_counts": month_counts,
        "moving_cutoff": moving,
    }
    compare_aborts, compare_warnings = guardrails.compare(cfg, current, state)
    aborts += compare_aborts
    warnings += compare_warnings

    archive_path = cfg.path("snapshots") / f"{snapshot_key}.parquet"
    staged_archive = staging.parent / "archive.parquet"
    outputs.write_archive(con, cfg, staged_archive)
    archive_status = "new"
    if archive_path.exists():
        if outputs.same_parquet(con, staged_archive, archive_path):
            archive_status = "unchanged"
        else:
            archive_status = "kept_first_observation"
            warnings.append(f"{archive_path.name} already exists with different content; the first observation is kept")

    outputs.write_json(staging / "events.json", event_rows)
    size = outputs.payload_bytes(staging)
    if size > g["size_budget_bytes"]:
        warnings.append(f"payload is {size:,} bytes, over the {g['size_budget_bytes']:,} byte budget")

    manifest = {
        "contract_version": p["contract_version"],
        "generated_at": iso_utc(now),
        "latest_snapshot": latest_snapshot,
        "source": {
            "id": p["source"]["id"],
            "item_id": source["item_id"],
            "discovery": source["discovery"],
            "service_name": source["service_name"],
            "service_url": source["service_url"],
            "data_last_edit": source.get("data_last_edit"),
            "fetched_at": source["fetched_at"],
            "row_count": source["row_count"],
            "rows_pulled": pulled,
            "in_scope_row_count": in_scope_rows,
            "change_key": source["change_key"],
            "changed": True,
        },
        "datasets": datasets,
        "moving_cutoff_vehicle_year": moving["vehicle_year"],
        "moving_cutoff_age": moving["age"],
        "used_import_age_trailing": age_report,
        "snapshot_archive": {"path": f"{p['snapshot_archive']['dir']}/{archive_path.name}", "status": archive_status},
        "payload_bytes": size,
        "warnings": warnings,
    }
    outputs.write_json(staging / "manifest.json", manifest)
    con.close()

    if aborts:
        raise GuardrailError("build", "\n  - " + "\n  - ".join(aborts))

    if publish:
        outputs.promote(staging, cfg.path("public"))
        if archive_status == "new":
            archive_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(staged_archive), archive_path)
        outputs.write_json(cfg.path("state"), {
            "contract_version": p["contract_version"],
            "generated_at": manifest["generated_at"],
            "latest_snapshot": latest_snapshot,
            "row_count": source["row_count"],
            "in_scope_row_count": in_scope_rows,
            "change_key": source["change_key"],
            "live_dimensions": live_dimensions,
            "moving_cutoff": moving,
            "month_counts": month_counts,
        })
    return manifest
