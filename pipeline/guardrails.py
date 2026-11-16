"""Checks that compare this run with the last good run (data/state/last_good.json)."""

from __future__ import annotations


def split_record(datasets: dict) -> dict[str, dict]:
    """What the last good state keeps of each built dataset's mild hybrid split: whether it was published and the
    trailing coverage at high confidence it was judged on. Datasets with no hybrid coverage block (a series, or one not
    built) have no split to keep."""
    out = {}
    for dataset, entry in datasets.items():
        block = entry.get("mild_hybrid_identification_coverage")
        if block:
            out[dataset] = {"published": block["mild_split_published"],
                            "trailing_high_confidence_coverage": block["trailing"]["coverage_high_confidence_only"]}
    return out


def split_flips(cfg, current: dict[str, dict], previous: dict | None) -> list[str]:
    """A warning for each dataset whose mild hybrid split is published now and was withheld in the last good build, or the
    reverse. Either way the dataset's whole history of the two powertrain values is rewritten by one build, and nothing
    else in the manifest says so. A state written before the record existed, or without this dataset, has nothing to
    compare, and a record that is not in the shape written here, whether the whole `mild_split` or one dataset's, is ignored
    the same way (a guard that raised on a bad state would hide what is wrong with it)."""
    h = cfg.pipeline["hybrid_classification"]
    mild, undivided, threshold = h["mild_powertrain"], h["undivided_powertrain"], h["publish_split_at_trailing_high_confidence_coverage"]

    def figure(record: dict) -> str:
        coverage = record.get("trailing_high_confidence_coverage")
        # Null is a window with no hybrid at all and also one with only `full` calls at the high level (docs/METRICS.md): neither
        # has a figure to divide, so the wording must hold for both.
        if coverage is None:
            return "no hybrid in the window that could be mild"
        # A flag written by hand with a figure that is not a number still flips; only the figure is unreadable.
        return f"{coverage:.2%}" if isinstance(coverage, (int, float)) and not isinstance(coverage, bool) else "an unreadable figure"

    kept = previous.get("mild_split") if isinstance(previous, dict) else None
    kept = kept if isinstance(kept, dict) else {}
    warnings = []
    for dataset, now in current.items():
        before = kept.get(dataset)
        if not isinstance(before, dict) or not isinstance(before.get("published"), bool) or before["published"] == now["published"]:
            continue
        move = (f"trailing coverage at high confidence was {figure(before)} in the last good build and is {figure(now)} now, "
                f"against {threshold:.0%}")
        if now["published"]:
            warnings.append(
                f"{dataset}: the mild hybrid split was withheld in the last good build and is published now ({move}). "
                f"Every month of the dataset's history changes: {mild} reappears in every slice, pair and fact table and "
                f"{undivided} falls by the same amount; no total moves, and any figure quoted from the earlier build "
                "no longer matches")
        else:
            warnings.append(
                f"{dataset}: the mild hybrid split was published in the last good build and is withheld now ({move}). "
                f"Every month of the dataset's history changes: {mild} disappears from every slice, pair and fact table "
                f"and {undivided} rises by the same amount; no total moves, and any figure quoted from the earlier build "
                "no longer matches")
    return warnings


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
    warnings += split_flips(cfg, current.get("mild_split", {}), previous)
    return aborts, warnings


def supplied_month_changes(dataset: str, totals: dict[str, int], before: dict[str, int], replaced: set[str], limit: float) -> list[str]:
    """A supplied month whose own total (every vehicle the store holds for it, before any scope is applied) moved by more
    than `limit` since the last good build, with no replacement recorded since then. The source restates past months; a
    restatement has to be recorded, not slip in."""
    moved = []
    for month in sorted(set(totals) & set(before)):
        if before[month] and month not in replaced and abs(totals[month] - before[month]) / before[month] > limit:
            moved.append(f"{month} ({before[month]:,} -> {totals[month]:,})")
    if not moved:
        return []
    return [f"{dataset}: {len(moved)} month(s) differ from the last good build by more than {limit:.0%} and have no "
            f"replacement recorded in the ledger since then: {', '.join(moved[:12])}"]
