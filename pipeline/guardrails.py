"""Checks that compare this run with the last good run (data/state/last_good.json)."""

from __future__ import annotations


def compare(cfg, current: dict, previous: dict | None) -> tuple[list[str], list[str]]:
    g = cfg.pipeline["guardrails"]
    aborts: list[str] = []
    warnings: list[str] = []
    if previous is None:
        warnings.append("no last good state: first run, so previous-run comparisons were skipped")
        return aborts, warnings

    before = previous["in_scope_row_count"]
    if before:
        change = (current["in_scope_row_count"] - before) / before
        if abs(change) > g["max_in_scope_row_change"]:
            aborts.append(
                f"in-scope source rows moved {change:+.2%} since the last good run ({before:,} -> "
                f"{current['in_scope_row_count']:,}); limit is {g['max_in_scope_row_change']:.0%}"
            )

    if current["latest_snapshot"] < previous["latest_snapshot"]:
        aborts.append(f"latest_snapshot {current['latest_snapshot']} is older than the last good run's {previous['latest_snapshot']}")
    elif (current["latest_snapshot"] == previous["latest_snapshot"] and current["row_count"] == previous["row_count"]
          and current["change_key"] != previous["change_key"]):
        aborts.append(
            f"snapshot {current['latest_snapshot']} and row count {current['row_count']:,} are unchanged but the change key "
            "differs: the source changed without advancing"
        )

    floor = g["zero_row_min_previous_rows"]
    for dataset, counts in current["month_counts"].items():
        before_counts = previous.get("month_counts", {}).get(dataset, {})
        emptied = sorted(m for m, n in before_counts.items() if n >= floor and counts.get(m, 0) == 0)
        if emptied:
            aborts.append(f"{dataset}: {len(emptied)} month(s) with at least {floor:,} rows last good run now have none: {emptied[:12]}")

    cut, before_cut = current["moving_cutoff"], previous.get("moving_cutoff") or {}
    if cut.get("vehicle_year") is not None and before_cut.get("vehicle_year") not in (None, cut["vehicle_year"]):
        warnings.append(
            f"moving cutoff vehicle year changed from {before_cut['vehicle_year']} to {cut['vehicle_year']}: "
            "an import rule or the data changed"
        )
    return aborts, warnings
