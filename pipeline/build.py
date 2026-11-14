"""One build: saved pages -> cube slices, manifest, events. Publishes only if every guardrail passes."""

from __future__ import annotations

import json
import shutil
from datetime import date, datetime, timezone
from typing import NamedTuple

import duckdb

from . import derive, events, guardrails, metrics, normalise, outputs, schema, supplied
from .contract import FACT_COUNT, FACT_MONTH, FACT_ROW_ORDER, FACTS_DIR, PAIR_SEPARATOR
from .errors import GuardrailError
from .reference import quote


def iso_utc(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def write_pairs(con, cfg, dataset: str, dataset_cfg: dict, live: list, ds: str, staging, aborts: list[str],
                warnings: list[str]) -> tuple[list[str], dict[str, str]]:
    """The pair slices config/pipeline.json names for this dataset. An entry that is not two different dimension ids, a
    pair listed twice in either order, or a dimension the dataset cannot derive is a configuration error and aborts; a
    pair whose dimension is not live this run waits, as the dimension does, with a warning."""
    known = {d["id"] for d in derive.applicable(cfg, dataset)[0]}
    by_id = {d.dim_id: d for d in live}
    written, waiting, seen = [], {}, set()
    for pair in dataset_cfg.get("pairs") or []:
        if not (isinstance(pair, list) and len(pair) == 2 and all(isinstance(d, str) for d in pair)) or pair[0] == pair[1]:
            aborts.append(f"{dataset}: pair {pair!r} must name two different dimensions")
            continue
        # The separator is how a pair file's name is read back into its two dimensions.
        if any(PAIR_SEPARATOR in d for d in pair):
            aborts.append(f"{dataset}: pair {pair!r} names a dimension id containing {PAIR_SEPARATOR!r}, "
                          f"which separates the two ids in a pair file's name; rename the dimension in dimensions.json")
            continue
        key = PAIR_SEPARATOR.join(pair)
        # The same two dimensions in the other order would write a second, transposed copy of the same counts.
        if frozenset(pair) in seen:
            aborts.append(f"{dataset}: pair {pair} is listed twice, in one order or the other")
            continue
        seen.add(frozenset(pair))
        unknown = [d for d in pair if d not in known]
        if unknown:
            aborts.append(f"{dataset}.{key}: {', '.join(unknown)} is not a derivable dimension of this dataset in dimensions.json")
            continue
        missing = [d for d in pair if d not in by_id]
        if missing:
            waiting[key] = f"dimensions not live: {', '.join(missing)}"
            warnings.append(f"{dataset}.{key} is not live: {waiting[key]}")
            continue
        outputs.write_pair(con, cfg, by_id[pair[0]], by_id[pair[1]], ds, staging / "pairs" / dataset / f"{key}.parquet")
        written.append(key)
    return written, waiting


def write_fact_table(con, cfg, dataset: str, dataset_cfg: dict, live: list, ds: str, staging,
                     aborts: list[str], warnings: list[str]) -> dict | None:
    """The fact table config/pipeline.json names for this dataset. A list that is not distinct dimension ids, or names a
    dimension the dataset cannot derive, aborts; a dimension not live this run waits, with a warning, and the table is
    written without it. Its counts must total the dataset's vehicles, or the run aborts."""
    configured = dataset_cfg.get("facts")
    if configured is None:
        return None
    known = {d["id"] for d in derive.applicable(cfg, dataset)[0]}
    reserved = {FACT_MONTH[0], FACT_COUNT[0], FACT_ROW_ORDER}
    if (
        not (isinstance(configured, list) and configured and all(isinstance(d, str) for d in configured))
        or len(set(configured)) != len(configured)
    ):
        aborts.append(f"{dataset}: facts must list distinct dimension ids, at least one")
        return None
    taken = [d for d in configured if d in reserved]
    if taken:
        # A dimension may well be derivable; its id is the problem, because the id becomes a column and file name.
        aborts.append(f"{dataset}: facts names {', '.join(taken)}, a name the fact table reserves for its own columns "
                      f"({', '.join(sorted(reserved))}); a dimension cannot take it, so rename its id in dimensions.json")
        return None
    problems = [d for d in configured if d not in known]
    if problems:
        aborts.append(f"{dataset}: facts names {', '.join(problems)}, not a derivable dimension of this dataset in dimensions.json")
        return None
    by_id = {d.dim_id: d for d in live}
    waiting = {d: "dimension not live" for d in configured if d not in by_id}
    for dim_id in waiting:
        warnings.append(f"{dataset}: the fact table is written without {dim_id}, which is not live")
    columns = [by_id[d] for d in configured if d in by_id]
    fact_rows, total = outputs.write_facts(con, columns, ds, staging / FACTS_DIR / dataset)
    # Counted from rows, the vehicles before the dimension lookups are joined on. The table is grouped from dims, so a
    # count of dims would agree with it even where one of those joins had repeated or lost a vehicle.
    vehicles = con.execute(f"SELECT count(*) FROM rows WHERE {ds}").fetchone()[0]
    if total != vehicles:
        aborts.append(f"{dataset}: the fact table counts {total:,} vehicles, but the dataset has {vehicles:,}")
    return {"rows": fact_rows, "dimensions": [d.dim_id for d in columns], "not_live": waiting}


class Built(NamedTuple):
    entry: dict
    counts: dict[str, int]
    live: list[str]
    ds: str


def register_datasets(p: dict) -> dict:
    """The datasets read from the register itself: those that name no other source."""
    return {name: cfg for name, cfg in p["datasets"].items() if "source" not in cfg}


def build_dataset(con, cfg, dataset: str, dataset_cfg: dict, snapshot_month: date, previous_live: dict, staging,
                  aborts: list[str], warnings: list[str]) -> Built:
    """One dataset's slices, pairs and fact table from the tables `rows` and `dims` the caller has built, and its
    manifest entry. `snapshot_month` is the dataset's own latest month."""
    p, g = cfg.pipeline, cfg.pipeline["guardrails"]
    snapshot_key = snapshot_month.strftime("%Y-%m")
    window = int(p["trailing_window_months"])
    window_start = metrics.month_add(snapshot_month, -(window - 1))
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
    live_pairs, not_live_pairs = write_pairs(con, cfg, dataset, dataset_cfg, live, ds, staging, aborts, warnings)

    counts = metrics.month_counts(con, ds)
    facts = write_fact_table(con, cfg, dataset, dataset_cfg, live, ds, staging, aborts, warnings)
    if counts.get(snapshot_key, 0) == 0:
        aborts.append(f"{dataset}: the snapshot month {snapshot_key} has no rows")
    deviation = metrics.latest_month_deviation(counts, snapshot_month, window)
    if deviation is not None and abs(deviation) > g["latest_month_max_deviation"]:
        warnings.append(f"{dataset}: {snapshot_key} count deviates {deviation:+.0%} from the median of the previous {window} months")
    quality = metrics.quality_counts(con, derived, require, snapshot_month)
    if quality["registration_after_snapshot"]:
        warnings.append(f"{dataset}: {quality['registration_after_snapshot']:,} rows are dated after the snapshot month and were excluded")
    entry = {
        "definition": next((x.get("definition") for x in cfg.dimensions["datasets"] if x["id"] == dataset), None),
        "rows": sum(counts.values()),
        "months": len(counts),
        "latest_month": snapshot_key,
        "live_dimensions": [d.dim_id for d in live],
        "not_live": not_live,
        "live_pairs": live_pairs,
        "not_live_pairs": not_live_pairs,
        "facts": facts,
        "unmapped_rates": rates,
        "unmapped_guard": guard,
        "mild_hybrid_identification_coverage": metrics.hybrid_coverage(con, cfg, ds, window_start, snapshot_month, window),
        "coverage_trailing": metrics.coverage(con, derived, ds, window_start, snapshot_month, window),
        "counts": quality,
        "model_cap": caps,
    }
    hybrid_coverage = entry["mild_hybrid_identification_coverage"]
    disagreeing = hybrid_coverage["classification_disagrees_with_powertrain"]
    if disagreeing:
        warnings.append(f"{dataset}: {disagreeing:,} vehicles show a powertrain that contradicts their classification in "
                        f"{p['hybrid_classification']['file']}")
    trailing_high = hybrid_coverage["trailing"]["coverage_high_confidence_only"]
    floor = hybrid_coverage["warn_below_trailing_high_confidence_coverage"]
    if trailing_high is not None and trailing_high < floor:
        warnings.append(f"{dataset}: mild hybrid identification coverage over the trailing {window} months is "
                        f"{trailing_high:.1%} counting high-confidence classifications only, below {floor:.0%}")
    return Built(entry, counts, [d.dim_id for d in live], ds)


def dataset_definition(cfg, dataset: str) -> str | None:
    return next((x.get("definition") for x in cfg.dimensions["datasets"] if x["id"] == dataset), None)


def supplied_sources(p: dict) -> list[str]:
    """The supplied sources some dataset names, in the order the datasets are configured."""
    return list(dict.fromkeys(c["source"] for c in p["datasets"].values() if "source" in c))


def supplied_raw(con, cfg, source_id: str, types: dict[str, str]) -> None:
    """`raw` in the register's shape from the store: one row per vehicle, the register's column names and types, NULL for
    a field the source does not carry, the registration year and month from the store's month, and a running row id."""
    s = cfg.supplied(source_id)
    month = quote(supplied.STORE_MONTH)
    special = {
        s["row_id_field"]: "row_number() OVER ()",
        s["year_field"]: f"year({month})",
        s["month_field"]: f"month({month})",
    }
    columns = []
    for logical, source_name in cfg.pipeline["fields"].items():
        if logical in special:
            value = special[logical]
        elif logical in s["fields"]:
            value = quote(logical)
        else:
            value = "NULL"
        columns.append(f"CAST({value} AS {types[source_name]}) AS {quote(source_name)}")
    # unnest(range(n)) repeats each store row n times: a vehicle each.
    con.execute(f"""
        CREATE OR REPLACE TABLE raw AS
        SELECT {', '.join(columns)}
        FROM (SELECT *, unnest(range({quote(supplied.STORE_COUNT)})) AS repeat_index FROM supplied_store)
    """)


def build_supplied(con, cfg, source_id: str, types: dict[str, str], schema_names: set[str], register_month: date,
                   state: dict | None, staging, aborts: list[str], warnings: list[str]) -> tuple[dict, dict, dict]:
    """Every dataset that reads the supplied source: (manifest entries, month counts, live dimensions). The store is checked
    against its ledger first. The source's own latest month is the dataset's snapshot month: older than the register's is a
    warning, newer aborts (the register is the clock). With no store the datasets are not built, and say so."""
    p, s = cfg.pipeline, cfg.supplied(source_id)
    names = [d for d, c in p["datasets"].items() if c.get("source") == source_id]
    previous_live = (state or {}).get("live_dimensions", {})
    registrations, ledger_path = supplied.store_paths(cfg, source_id)
    if not registrations.exists() and not ledger_path.exists():
        reason = (f"the supplied store for {source_id} is absent ({s['store']}); add a file with "
                  f"`python -m pipeline supply {source_id} <csv>`")
        entries = {d: {"definition": dataset_definition(cfg, d), "not_built": reason} for d in names}
        for dataset in names:
            warnings.append(f"{dataset} was not built: {reason}")
            if dataset in previous_live:
                aborts.append(f"{dataset}: it was built in the last good run, but {reason}")
        return entries, {}, {}
    if not (registrations.exists() and ledger_path.exists()):
        aborts.append(f"{source_id}: the supplied store has only one of {s['registrations_file']} and {s['ledger_file']}")
        return {}, {}, {}

    con.execute(f"CREATE OR REPLACE TABLE supplied_store AS SELECT * FROM read_parquet({normalise.lit(registrations.as_posix())})")
    found = [c for c, *_ in con.execute("DESCRIBE supplied_store").fetchall()]
    if found != supplied.store_columns(s):
        aborts.append(f"{source_id}: the store's columns are {found}, but config/pipeline.json expects {supplied.store_columns(s)}")
        return {}, {}, {}
    ledger = supplied.read_ledger(ledger_path)
    problems = supplied.store_problems(con, "supplied_store", ledger)
    if problems:
        aborts.extend(f"{source_id}: the store disagrees with its ledger: {problem}" for problem in problems)
        return {}, {}, {}

    first, latest = con.execute(f"SELECT min({supplied.STORE_MONTH}), max({supplied.STORE_MONTH}) FROM supplied_store").fetchone()
    if latest > register_month:
        aborts.append(f"{source_id}: the store's latest month {supplied.month_key(latest)} is after the register's "
                      f"{supplied.month_key(register_month)}; the register is the clock, so the store cannot be ahead of it")
        return {}, {}, {}
    if latest < register_month:
        missing = [supplied.month_key(m) for m in supplied.month_range(metrics.month_add(latest, 1), register_month)]
        warnings.append(f"{source_id}: the export is missing {', '.join(missing)}: the store ends at "
                        f"{supplied.month_key(latest)} and the register at {supplied.month_key(register_month)}")

    supplied_raw(con, cfg, source_id, types)
    normalise.build_src(con, cfg, types, schema_names)
    con.execute("DROP TABLE raw")
    normalise.build_rows(con, cfg)

    taken = sorted({e["taken"] for e in ledger["months"].values()})
    replaced = {e["month"] for e in ledger["replaced"]}
    entries, counts, live = {}, {}, {}
    for dataset in names:
        built = build_dataset(con, cfg, dataset, p["datasets"][dataset], latest, previous_live, staging, aborts, warnings)
        entries[dataset] = {**built.entry, "supplied": {
            "source": source_id,
            "months": {"first": supplied.month_key(first), "last": supplied.month_key(latest), "count": len(ledger["months"])},
            "taken": taken,
            "replaced": ledger["replaced"],
        }}
        counts[dataset], live[dataset] = built.counts, built.live
        aborts += guardrails.supplied_month_changes(
            dataset, built.counts, ((state or {}).get("month_counts") or {}).get(dataset, {}), replaced, s["max_month_change"])
    return entries, counts, live


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
    for dataset, dataset_cfg in register_datasets(p).items():
        built = build_dataset(con, cfg, dataset, dataset_cfg, snapshot_month, previous_live, staging, aborts, warnings)
        datasets[dataset] = built.entry
        month_counts[dataset] = built.counts
        live_dimensions[dataset] = built.live
        if dataset == p["used_imports"]["dataset"]:
            by_vehicle_year, by_age = metrics.used_import_years(con, cfg, built.ds, window_start, snapshot_month)
            year, age = metrics.moving_cutoff(by_vehicle_year, snapshot_month.year, cfg)
            moving = {"vehicle_year": year, "age": age, "snapshot_year": snapshot_month.year}
            age_report = metrics.age_report(by_age, cfg, window)
            if year is None:
                warnings.append("moving cutoff not detected in the trailing window")

    event_rows, event_problems = events.build(cfg, events.vocabularies(con, cfg, snapshot_month.year))
    aborts += [f"events: {problem}" for problem in event_problems]

    archive_path = cfg.path("snapshots") / f"{snapshot_key}.parquet"
    staged_archive = staging.parent / "archive.parquet"
    outputs.write_archive(con, cfg, staged_archive)

    # After this point `src`, `rows` and `dims` hold a supplied source, not the register.
    schema_names = {f["name"] for f in expected["fields"]}
    for source_id in supplied_sources(p):
        entries, counts, live = build_supplied(con, cfg, source_id, types, schema_names, snapshot_month, state, staging,
                                               aborts, warnings)
        datasets.update(entries)
        month_counts.update(counts)
        live_dimensions.update(live)

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
