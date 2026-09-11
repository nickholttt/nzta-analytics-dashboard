"""Per-dataset figures for the manifest: month counts, unmapped rates, coverage, data-quality counts,
the moving cutoff, the used-import age report and mild hybrid identification coverage."""

from __future__ import annotations

import statistics
from collections import Counter
from datetime import date

from . import reference
from .contract import UNDEFINED, UNMAPPED
from .normalise import SOURCE_SUFFIX, lit
from .reference import quote


def month_add(d: date, months: int) -> date:
    year, month = divmod(d.year * 12 + d.month - 1 + months, 12)
    return date(year, month + 1, 1)


def date_sql(d: date) -> str:
    return f"DATE {lit(d.isoformat())}"


def dataset_filter(require: list[str], snapshot_month: date) -> str:
    return " AND ".join([quote(c) for c in require] + ["reg_month IS NOT NULL", f"reg_month <= {date_sql(snapshot_month)}"])


def month_counts(con, ds: str) -> dict[str, int]:
    rows = con.execute(f"SELECT reg_month, count(*) FROM dims WHERE {ds} GROUP BY 1 ORDER BY 1").fetchall()
    return {m.strftime("%Y-%m"): int(n) for m, n in rows}


def latest_month_deviation(counts: dict[str, int], snapshot_month: date, window: int) -> float | None:
    previous = [counts.get(month_add(snapshot_month, -k).strftime("%Y-%m"), 0) for k in range(1, window + 1)]
    median = statistics.median(previous)
    if not median:
        return None
    return (counts.get(snapshot_month.strftime("%Y-%m"), 0) - median) / median


def unmapped_rates(con, derived) -> dict[str, float]:
    if not derived:
        return {}
    values = con.execute(f"SELECT {', '.join(f'avg(CAST({d.unmapped_column} AS DOUBLE))' for d in derived)} FROM dims").fetchone()
    return {d.dim_id: round(v or 0.0, 6) for d, v in zip(derived, values)}


def unmapped_guard(con, derived, g: dict, start: date, end: date, window: int) -> dict:
    """Both bases of the unmapped guard for each dimension in abort_on_unmapped: every in-scope row, and in-scope rows
    first registered in the trailing window. Headroom is how many more rows could be unmapped before the run aborts."""
    guarded = [d for d in derived if d.dim_id in g["abort_on_unmapped"]]
    if not guarded:
        return {}
    trailing = f"reg_month BETWEEN {date_sql(start)} AND {date_sql(end)}"
    parts = ["count(*)", f"count(*) FILTER (WHERE {trailing})"]
    for d in guarded:
        parts += [f"count(*) FILTER (WHERE {d.unmapped_column})", f"count(*) FILTER (WHERE {d.unmapped_column} AND {trailing})"]
    values = con.execute(f"SELECT {', '.join(parts)} FROM dims").fetchone()

    def basis(rows: int, unmapped: int, abort: float, warn: float | None = None) -> dict:
        doc = {"rows": rows, "unmapped": unmapped, "rate": round(unmapped / rows, 6) if rows else None}
        if warn is not None:
            doc["warn_above"] = warn
        doc["abort_above"] = abort
        doc["headroom_rows"] = int(abort * rows) - unmapped
        return doc

    out = {}
    for i, d in enumerate(guarded):
        whole, recent = values[2 + 2 * i], values[3 + 2 * i]
        out[d.dim_id] = {
            "whole_run": basis(values[0], whole, g["max_unmapped_rate"]),
            "trailing": {"window_months": window,
                         **basis(values[1], recent, g["max_unmapped_rate_trailing"], g["warn_unmapped_rate_trailing"])},
        }
    return out


def hybrid_coverage(con, cfg, ds: str, start: date, end: date, window: int) -> dict:
    """mild_hybrid_identification_coverage for one dataset (docs/METRICS.md): of the vehicles recorded under a hybrid
    code, how many are identified mild, identified full, or unknown, and the label the category must carry."""
    h = cfg.pipeline["hybrid_classification"]
    keys, kind = reference.hybrid_keys(cfg), h["types"]
    shown, recorded = cfg.pipeline["engine"]["field"], cfg.pipeline["engine"]["field"] + SOURCE_SUFFIX

    def among(column: str, values: set[str]) -> str:
        return f"coalesce({quote(column)} IN ({', '.join(lit(v) for v in sorted(values)) or 'NULL'}), FALSE)"

    classified_mild = f"coalesce(hybrid_class = {lit(kind['mild'])}, FALSE)"
    code_default = f"(hybrid_class IS NULL AND {among(recorded, keys['mild'])})"
    mild = f"({classified_mild} OR {code_default})"
    full = f"coalesce(hybrid_class = {lit(kind['full'])}, FALSE)"
    measures = [
        "count(*)", f"count(*) FILTER (WHERE {mild})", f"count(*) FILTER (WHERE {full})",
        f"count(*) FILTER (WHERE NOT {mild} AND NOT {full})", f"count(*) FILTER (WHERE {code_default})",
    ] + [f"count(*) FILTER (WHERE {classified_mild} AND hybrid_confidence = {lit(level)})" for level in h["confidence_levels"]]
    base = f"in_scope AND {ds} AND {among(recorded, keys['source_hybrid'])}"

    def basis(where: str) -> dict:
        n, identified, full_n, unknown, code, *levels = con.execute(f"SELECT {', '.join(measures)} FROM rows WHERE {where}").fetchone()
        by_confidence = dict(zip(h["confidence_levels"], levels))
        denominator = identified + unknown
        # High confidence only: medium- and low-confidence mild rows count as unknown. Vehicles identified by the code
        # mapping alone rest on no nameplate call, so they count at both levels.
        high = by_confidence[h["high_confidence_level"]] + code
        return {
            "source_hybrids": n,
            "identified_mild": identified,
            "identified_full": full_n,
            "unknown": unknown,
            "coverage_stated_confidence": round(identified / denominator, 4) if denominator else None,
            "coverage_high_confidence_only": round(high / denominator, 4) if denominator else None,
            "mild_share_of_source_hybrids": round(identified / n, 4) if n else None,
            "identified_mild_by_confidence": {**by_confidence, "code_default": code},
        }

    whole = basis(base)
    recent = basis(f"{base} AND reg_month BETWEEN {date_sql(start)} AND {date_sql(end)}")
    disagreeing = con.execute(f"""
        SELECT count(*) FROM rows WHERE {base}
          AND (({classified_mild} AND NOT {among(shown, keys['mild'])}) OR ({full} AND {among(shown, keys['mild'])}))
    """).fetchone()[0]
    figures = [b["coverage_stated_confidence"] for b in (whole, recent) if b["coverage_stated_confidence"] is not None]
    complete = bool(figures) and min(figures) >= h["complete_at_coverage"]
    return {
        "all_time": whole,
        "trailing": {"window_months": window, **recent},
        "complete_at_coverage": h["complete_at_coverage"],
        "warn_below_trailing_high_confidence_coverage": h["warn_below_trailing_high_confidence_coverage"],
        "label": h["labels"]["complete" if complete else "partial"],
        "classification_disagrees_with_powertrain": disagreeing,
    }


def coverage(con, derived, ds: str, start: date, end: date, window: int) -> dict:
    tokens = f"({lit(UNDEFINED)}, {lit(UNMAPPED)})"
    named = [d for d in derived if d.kind != "band"]
    parts = ["count(*) FILTER (WHERE has_engine AND fc_status = 'valid') / nullif(count(*) FILTER (WHERE has_engine), 0)"]
    parts += [f"count(*) FILTER (WHERE {d.column} NOT IN {tokens}) / nullif(count(*), 0)" for d in named]
    values = con.execute(
        f"SELECT {', '.join(parts)} FROM dims WHERE {ds} AND reg_month BETWEEN {date_sql(start)} AND {date_sql(end)}"
    ).fetchone()
    return {
        "window_months": window,
        "fuel_consumption": round(values[0] or 0.0, 4),
        "dimensions": {d.dim_id: round(v or 0.0, 4) for d, v in zip(named, values[1:])},
    }


def quality_counts(con, derived, require: list[str], snapshot_month: date) -> dict:
    member = " AND ".join(quote(c) for c in require)
    ds = dataset_filter(require, snapshot_month)
    no_month, after = con.execute(
        f"SELECT count(*) FILTER (WHERE reg_month IS NULL), count(*) FILTER (WHERE reg_month > {date_sql(snapshot_month)}) "
        f"FROM dims WHERE {member}"
    ).fetchone()
    bands = {}
    for d in derived:
        if d.kind != "band":
            continue
        bv, bm, bs = (quote(f"{p}__{d.dim_id}") for p in ("bv", "bm", "bs"))
        missing, sentinel, negative, out = con.execute(f"""
            SELECT count(*) FILTER (WHERE {bm}), count(*) FILTER (WHERE {bs}), count(*) FILTER (WHERE {bv} < 0),
                   count(*) FILTER (WHERE {bv} >= 0 AND {d.column} = {lit(d.band_unknown)})
            FROM dims WHERE {ds}
        """).fetchone()
        bands[d.dim_id] = {"source_missing": missing, "source_sentinel": sentinel, "negative": negative, "out_of_bands": out}
    parse, out_of_range, no_engine, alternative = con.execute(f"""
        SELECT count(*) FILTER (WHERE has_engine AND fc_status = 'parse_failure'),
               count(*) FILTER (WHERE has_engine AND fc_status = 'out_of_range'),
               count(*) FILTER (WHERE has_engine = FALSE AND fc_status <> 'missing'),
               count(*) FILTER (WHERE fuel_alternative IS NOT NULL AND fuel_alternative <> fuel_primary)
        FROM dims WHERE {ds}
    """).fetchone()
    return {
        "no_registration_month": no_month,
        "registration_after_snapshot": after,
        "bands": bands,
        "fuel_consumption": {"parse_failures": parse, "out_of_range": out_of_range, "on_no_engine": no_engine},
        "alternative_fuel_differs": alternative,
    }


def used_import_years(con, cfg, ds: str, start: date, end: date) -> tuple[Counter, Counter]:
    labels = ", ".join(lit(x) for x in cfg.pipeline["used_imports"]["status_labels"])
    rows = con.execute(f"""
        SELECT vehicle_year, registration_year, count(*) FROM dims
        WHERE {ds} AND status_label IN ({labels}) AND vehicle_year IS NOT NULL
          AND reg_month BETWEEN {date_sql(start)} AND {date_sql(end)}
        GROUP BY 1, 2
    """).fetchall()
    by_vehicle_year, by_age = Counter(), Counter()
    for vehicle_year, registration_year, n in rows:
        by_vehicle_year[int(vehicle_year)] += n
        by_age[int(registration_year) - int(vehicle_year)] += n
    return by_vehicle_year, by_age


def moving_cutoff(by_vehicle_year: Counter, snapshot_year: int, cfg) -> tuple[int | None, int | None]:
    """Oldest vehicle year below the exemption age that arrives in volume, with a cliff to the year before it."""
    rule = cfg.pipeline["moving_cutoff"]
    total = sum(by_vehicle_year.values())
    if not total:
        return None, None
    for year in sorted((y for y in by_vehicle_year if snapshot_year - y < rule["exemption_age"]), reverse=True):
        older_is_exempt = snapshot_year - (year - 1) >= rule["exemption_age"]
        if (not older_is_exempt and by_vehicle_year[year] >= rule["min_share"] * total
                and by_vehicle_year.get(year - 1, 0) * rule["cliff_ratio"] < by_vehicle_year[year]):
            return year, snapshot_year - year
    return None, None


def age_report(by_age: Counter, cfg, window: int) -> dict:
    rule = cfg.pipeline["used_import_age_report"]
    valid = {a: n for a, n in by_age.items() if a >= 0}
    total = sum(valid.values())
    if not total:
        return {"window_months": window, "rows": 0}
    running, median = 0, None
    for age in sorted(valid):
        running += valid[age]
        if running * 2 >= total:
            median = age
            break
    shares = {str(a): round(valid.get(a, 0) / total, 4) for a in range(rule["max_age"] + 1)}
    shares[f"{rule['max_age'] + 1}+"] = round(sum(n for a, n in valid.items() if a > rule["max_age"]) / total, 4)
    cluster = sum(n for a, n in valid.items() if rule["cluster_min"] <= a <= rule["cluster_max"])
    return {
        "window_months": window,
        "rows": total,
        "median": median,
        "mode": max(valid, key=lambda a: (valid[a], -a)),
        "cluster": [rule["cluster_min"], rule["cluster_max"]],
        "share_cluster": round(cluster / total, 4),
        "shares": shares,
    }
