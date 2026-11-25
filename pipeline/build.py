"""One build: saved pages -> cube slices, manifest, events. Publishes only if every guardrail passes."""

from __future__ import annotations

import json
import re
import shutil
from datetime import date, datetime, timezone
from typing import NamedTuple

import duckdb

from . import (association, derive, events, guardrails, metrics, normalise, outputs, pair_cells, privacy, reconcile, schema, series,
               small_cells, supplied)
from .contract import (FACT_COUNT, FACT_MONTH, FACT_ROW_ORDER, FACTS_DIR, NARROW_DIR, PAIR_COLUMNS, PAIR_SEPARATOR,
                       SLICE_COLUMNS)
from .normalise import lit
from .errors import GuardrailError
from .reference import quote


# A narrow fact table's id is a folder name under facts/{dataset}/narrow/.
NARROW_ID = re.compile(r"[a-z][a-z0-9_]*")


def iso_utc(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def owner_protection(cfg) -> tuple[dict[str, list[str]], privacy.SmallCellRule, privacy.SmallCellRule]:
    """The dimensions that read an owner field, with the fields they read, the small-cell rule that holds their slices
    (D-127) and the rule that holds a pair with one (D-135), both from config/data_map.json. A data map the build cannot
    read aborts, as a missing reference file does."""
    try:
        dmap = privacy.load_map(cfg)
        return privacy.owner_dimensions(cfg, dmap), privacy.small_cell_rule(dmap), privacy.pair_cell_rule(dmap)
    except (privacy.DataMapError, OSError, KeyError) as exc:
        raise GuardrailError("data map", f"config/data_map.json cannot be used to protect owner fields: {exc!r}") from exc


def pair_slice_dimensions(dataset_cfg: dict, protected: dict[str, list[str]]) -> set[str]:
    """The dimensions on either side of a pair of this dataset that has a dimension reading an owner field: their one-field
    slices carry no fuel figure (D-135). Read from config and the data map's protection; a pair that is not two dimension
    ids is left to write_pairs to refuse."""
    found: set[str] = set()
    for pair in dataset_cfg.get("pairs") or []:
        if isinstance(pair, list) and len(pair) == 2 and all(isinstance(d, str) for d in pair) and any(d in protected for d in pair):
            found.update(pair)
    return found


def write_pairs(con, cfg, dataset: str, dataset_cfg: dict, live: list, ds: str, staging, aborts: list[str],
                warnings: list[str], protected: dict[str, list[str]], pair_rule: privacy.SmallCellRule
                ) -> tuple[list[str], dict[str, str], dict[str, dict]]:
    """The pair slices config/pipeline.json names for this dataset, and the figures of those held to the pair rule. An
    entry that is not two different dimension ids, a pair listed twice in either order, or a dimension the dataset cannot
    derive is a configuration error and aborts. A pair with a dimension that reads an owner field is written under the
    rule for a table of two fields and then read back from the file; one that breaks it aborts the run (D-135). A pair
    whose dimension is not live this run waits, as the dimension does, with a warning. The one-field slices of both
    dimensions have been written by then: the rule is held to what they publish."""
    known = {d["id"] for d in derive.applicable(cfg, dataset)[0]}
    by_id = {d.dim_id: d for d in live}
    written, waiting, seen, figures = [], {}, set(), {}
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
        path = staging / "pairs" / dataset / f"{key}.parquet"
        if not any(d in protected for d in pair):
            outputs.write_pair(con, cfg, by_id[pair[0]], by_id[pair[1]], ds, path)
        else:
            slices = [staging / "cube" / dataset / f"{d}.parquet" for d in pair]
            stats = pair_cells.write_protected_pair(con, cfg, by_id[pair[0]], by_id[pair[1]], ds, path, pair_rule, *slices)
            aborts += [f"{dataset}.{key}: {problem}" for problem in pair_cells.check_pair(con, path, pair_rule, *slices, stats)]
            figures[key] = stats
        written.append(key)
    return written, waiting, figures


def listed_dimensions_problem(dataset: str, label: str, configured, known: set[str]) -> str | None:
    """What is wrong with a list of dimension ids a fact table is to carry, or None. `label` says which list it is."""
    reserved = {FACT_MONTH[0], FACT_COUNT[0], FACT_ROW_ORDER}
    if (
        not (isinstance(configured, list) and configured and all(isinstance(d, str) for d in configured))
        or len(set(configured)) != len(configured)
    ):
        return f"{dataset}: {label} must list distinct dimension ids, at least one"
    taken = [d for d in configured if d in reserved]
    if taken:
        # A dimension may well be derivable; its id is the problem, because the id becomes a column and file name.
        return (f"{dataset}: {label} names {', '.join(taken)}, a name the fact table reserves for its own columns "
                f"({', '.join(sorted(reserved))}); a dimension cannot take it, so rename its id in dimensions.json")
    problems = [d for d in configured if d not in known]
    if problems:
        return f"{dataset}: {label} names {', '.join(problems)}, not a derivable dimension of this dataset in dimensions.json"
    return None


def write_listed_table(con, dataset: str, noun: str, configured: list[str], live: list, ds: str, directory, aborts: list[str],
                       warnings: list[str]) -> dict:
    """One fact table of the listed dimensions that are live, written to `directory`, and its manifest entry. A dimension not
    live this run waits, with a warning, and the table is written without it. Its counts must total the dataset's vehicles."""
    by_id = {d.dim_id: d for d in live}
    waiting = {d: "dimension not live" for d in configured if d not in by_id}
    for dim_id in waiting:
        warnings.append(f"{dataset}: {noun} is written without {dim_id}, which is not live")
    columns = [by_id[d] for d in configured if d in by_id]
    fact_rows, total = outputs.write_facts(con, columns, ds, directory)
    # Counted from rows, the vehicles before the dimension lookups are joined on. The table is grouped from dims, so a
    # count of dims would agree with it even where one of those joins had repeated or lost a vehicle.
    vehicles = con.execute(f"SELECT count(*) FROM rows WHERE {ds}").fetchone()[0]
    if total != vehicles:
        aborts.append(f"{dataset}: {noun} counts {total:,} vehicles, but the dataset has {vehicles:,}")
    return {"rows": fact_rows, "dimensions": [d.dim_id for d in columns], "not_live": waiting}


def narrow_table_problems(dataset: str, tables) -> list[str]:
    """What is wrong with a dataset's `narrow_facts` apart from the dimensions each table lists: the list, and each table's id,
    which becomes a folder name under facts/{dataset}/narrow/."""
    if not isinstance(tables, list):
        return [f"{dataset}: narrow_facts must be a list of tables, each with an id and the dimensions it carries"]
    problems, seen = [], set()
    for table in tables:
        table_id = table.get("id") if isinstance(table, dict) else None
        if not isinstance(table_id, str) or not table_id:
            problems.append(f"{dataset}: a narrow_facts table must have an id")
        elif not NARROW_ID.fullmatch(table_id):
            problems.append(f"{dataset}: a narrow_facts table id {table_id!r} must be lower case letters, digits and underscores")
        elif table_id in seen:
            problems.append(f"{dataset}: narrow_facts lists the id {table_id} twice")
        else:
            seen.add(table_id)
    return problems


def write_narrow_tables(con, cfg, dataset: str, tables, live: list, ds: str, staging, aborts: list[str], warnings: list[str]) -> dict:
    """The narrow fact tables config/pipeline.json names for this dataset (D-144), each under facts/{dataset}/narrow/{id}/ with the
    wide table's rows, order, validation and total check. A table of owner dimensions is refused before anything is read
    (fact_table_owner_problems). A misconfigured table aborts the run; a bad id stops the check before any table's dimensions are read."""
    problems = narrow_table_problems(dataset, tables)
    aborts.extend(problems)
    if problems:
        return {}
    known = {d["id"] for d in derive.applicable(cfg, dataset)[0]}
    written = {}
    for table in tables:
        problem = listed_dimensions_problem(dataset, f"narrow_facts '{table['id']}'", table.get("dimensions"), known)
        if problem:
            aborts.append(problem)
            continue
        directory = staging / FACTS_DIR / dataset / NARROW_DIR / table["id"]
        written[table["id"]] = write_listed_table(con, dataset, f"the narrow table {table['id']}", table["dimensions"], live, ds,
                                                  directory, aborts, warnings)
    return written


def write_fact_table(con, cfg, dataset: str, dataset_cfg: dict, live: list, ds: str, staging,
                     aborts: list[str], warnings: list[str]) -> dict | None:
    """The fact table config/pipeline.json names for this dataset, and its narrow tables. A list that is not distinct dimension
    ids, or names a dimension the dataset cannot derive, aborts; a dimension not live this run waits, with a warning, and the
    table is written without it. Its counts must total the dataset's vehicles, or the run aborts."""
    configured = dataset_cfg.get("facts")
    narrow = dataset_cfg.get("narrow_facts")
    if configured is None:
        if narrow is not None:
            aborts.append(f"{dataset}: narrow_facts needs the dataset's facts: a narrow table is read beside the wide one")
        return None
    known = {d["id"] for d in derive.applicable(cfg, dataset)[0]}
    problem = listed_dimensions_problem(dataset, "facts", configured, known)
    if problem:
        aborts.append(problem)
        return None
    entry = write_listed_table(con, dataset, "the fact table", configured, live, ds, staging / FACTS_DIR / dataset, aborts, warnings)
    if narrow is not None:
        entry["narrow"] = write_narrow_tables(con, cfg, dataset, narrow, live, ds, staging, aborts, warnings)
    return entry


class Built(NamedTuple):
    entry: dict
    counts: dict[str, int]
    live: list[str]
    ds: str


def register_datasets(p: dict) -> dict:
    """The datasets read from the register itself: those that name no other source."""
    return {name: cfg for name, cfg in p["datasets"].items() if "source" not in cfg}


def stock_configuration_problems(cfg) -> list[str]:
    """What the configuration of the stock datasets breaks, found before anything is read (D-135).

    A dataset that is a stock (`stock` in config/pipeline.json) counts every vehicle of the register as at the snapshot, so it
    names no other source, no scope flag, and the dimensions it is offered: it is offered no dimension that reads a field it
    is never broken down by (`not_by`, the fields that give a vehicle's month or year of first registration). A dimension
    that reads a field the data map marks `stock_only` (a field that describes the vehicle as at the snapshot) is for stock
    datasets alone: its `applies_to` names only stock datasets, and no other dataset lists it among its dimensions, pairs or
    fact-table columns. Every one of these is read from config, not named here."""
    try:
        dmap = privacy.load_map(cfg)
        held = privacy.stock_only_dimensions(cfg, dmap)
    except (privacy.DataMapError, OSError, KeyError) as exc:
        raise GuardrailError("data map", f"config/data_map.json cannot be used to protect owner fields: {exc!r}") from exc
    datasets = cfg.pipeline["datasets"]
    stocks = {name for name, spec in datasets.items() if spec.get("stock")}
    dims = {d["id"]: d for d in cfg.dimensions["dimensions"] if "derive" in d}
    problems = []
    for dim_id, fields in sorted(held.items()):
        applies = dims[dim_id].get("applies_to")
        if applies is None:
            problems.append(f"dimension {dim_id} reads {', '.join(fields)}, which describes the vehicle as at the snapshot, so it must "
                            "name the stock datasets it is for in applies_to (config/dimensions.json); without it every dataset would be offered it")
        elif [d for d in applies if d not in stocks]:
            problems.append(f"dimension {dim_id} reads {', '.join(fields)}, which describes the vehicle as at the snapshot, but applies_to "
                            f"names {[d for d in applies if d not in stocks]}, which are not stock datasets")
        for dataset, spec in datasets.items():
            named = set(spec.get("dimensions") or []) | set(spec.get("facts") or []) | {d for pair in spec.get("pairs") or [] for d in pair}
            if dataset not in stocks and dim_id in named:
                problems.append(f"{dataset} lists {dim_id}, which reads {', '.join(fields)}: it describes the vehicle as at the snapshot, "
                                "so only a stock dataset counts it")
    for dataset in sorted(stocks):
        spec = datasets[dataset]
        if "source" in spec:
            problems.append(f"{dataset}: a stock counts the register's own vehicles, so it names no other source")
        if spec.get("require"):
            problems.append(f"{dataset}: a stock counts every vehicle, so its require must be empty; it names {spec['require']}")
        offered = spec.get("dimensions")
        if not (isinstance(offered, list) and offered and all(isinstance(d, str) for d in offered)):
            problems.append(f"{dataset}: a stock lists the dimensions it is offered (dimensions)")
            continue
        unknown = [d for d in offered if d not in dims]
        if unknown:
            problems.append(f"{dataset}: dimensions names {unknown}, which are not dimensions with a derive block in dimensions.json")
        outside = [pair for pair in spec.get("pairs") or [] if not set(pair) <= set(offered)]
        if outside:
            problems.append(f"{dataset}: pairs {outside} name a dimension the dataset is not offered")
        never = spec.get("not_by") or []
        unbound = [f for f in never if f not in cfg.pipeline["fields"]]
        if unbound:
            problems.append(f"{dataset}: not_by names {unbound}, which are not fields of config/pipeline.json")
            continue
        refused = {cfg.pipeline["fields"][f] for f in never}
        for dim_id in (d for d in offered if d in dims):
            read = privacy.fields_read(dims[dim_id], cfg.pipeline, dmap["derive_reads"]) & refused
            if read:
                problems.append(f"{dataset}: {dim_id} reads {', '.join(sorted(read))}, which a stock is never broken down by (not_by)")
    return problems


def fact_table_owner_problems(cfg) -> list[str]:
    """Each dataset whose `facts`, or a table of its `narrow_facts`, names a dimension that reads an owner field, found before
    anything is read or written.

    The user's rule for an owner field allows it in a slice of its own or in a pair, never in a table that crosses many
    fields (D-096, D-078): with the owner's region beside the model and the month, most rows of the wide table counted one
    vehicle, and a narrow table crosses fields all the same. Which dimensions read an owner field is worked out from
    config/data_map.json (privacy.owner_dimensions), so no dimension is named here. tests/test_data_map.py holds the committed
    config to the same rule; this holds the build."""
    try:
        owner = privacy.owner_dimensions(cfg)
    except (privacy.DataMapError, OSError, KeyError) as exc:
        raise GuardrailError("data map", f"config/data_map.json cannot be used to protect owner fields: {exc!r}") from exc
    lists = []
    for dataset, spec in cfg.pipeline["datasets"].items():
        lists.append((dataset, "facts", spec.get("facts")))
        for table in spec.get("narrow_facts") if isinstance(spec.get("narrow_facts"), list) else []:
            if isinstance(table, dict):
                lists.append((dataset, f"narrow_facts '{table.get('id')}'", table.get("dimensions")))
    problems = []
    for dataset, label, listed in lists:
        for dim_id in (listed if isinstance(listed, list) else []):
            if dim_id in owner:
                problems.append(f"{dataset}: {label} names {dim_id}, which reads {', '.join(owner[dim_id])}, an owner field in "
                                f"config/data_map.json; a fact table crosses many fields and the owner rule allows an owner field "
                                f"in a slice or a pair only (D-096). Remove {dim_id} from {label} of {dataset} in config/pipeline.json")
    return problems


def kind_of_owner_floor_problems(cfg) -> list[str]:
    """Each table config/pipeline.json writes that puts a field saying what kind of owner beside a field that says who or where
    the owner is, found before anything is read or written (privacy.floor_problems). A build whose config breaks the floor
    aborts and leaves the last good build in place; tests/test_data_map.py and test_privacy.py hold the committed config to
    the same rule."""
    try:
        return privacy.floor_problems(cfg)
    except (privacy.DataMapError, OSError, KeyError) as exc:
        raise GuardrailError("data map", f"config/data_map.json cannot be used to protect owner fields: {exc!r}") from exc


def stock_problems(con, staging, dataset: str, snapshot_month: date, counts: dict[str, int]) -> list[str]:
    """What a stock's written files break: it counts every vehicle the register holds, it has the one period, the snapshot's
    month, and every slice and pair file has the contract's columns and that month alone, so that no vehicle's own month or
    year of first registration is a column or a value of any file (D-135)."""
    found = []
    held = con.execute("SELECT count(*) FROM rows").fetchone()[0]
    if sum(counts.values()) != held:
        found.append(f"counts {sum(counts.values()):,} vehicles, but the register holds {held:,} and a stock counts every vehicle")
    if set(counts) != {snapshot_month.strftime("%Y-%m")}:
        found.append(f"has the periods {sorted(counts)[:5]}, but a stock has one, the snapshot's month")
    for folder, columns in (("cube", SLICE_COLUMNS), ("pairs", PAIR_COLUMNS)):
        for path in sorted((staging / folder / dataset).glob("*.parquet")):
            source = f"read_parquet({lit(path.as_posix())})"
            described = [row[0] for row in con.execute(f"DESCRIBE SELECT * FROM {source}").fetchall()]
            if described != [name for name, _ in columns]:
                found.append(f"{folder}/{path.name} has the columns {described}, not the contract's")
            months = [row[0] for row in con.execute(f"SELECT DISTINCT month FROM {source}").fetchall()]
            if months != [snapshot_month]:
                found.append(f"{folder}/{path.name} has the months {[m.isoformat() for m in months][:5]}, but a stock has one, the snapshot's")
    return found


def build_dataset(con, cfg, dataset: str, dataset_cfg: dict, snapshot_month: date, previous_live: dict, staging,
                  aborts: list[str], warnings: list[str]) -> Built:
    """One dataset's slices, pairs and fact table from the tables `rows` and `dims` the caller has built, and its
    manifest entry. `snapshot_month` is the dataset's own latest month. A dataset that is a stock (`stock` in its config,
    D-135) counts every vehicle of the register as at that month: it has the one period, and none of the figures that
    describe a series of months of first registration (the mild hybrid split)."""
    p, g = cfg.pipeline, cfg.pipeline["guardrails"]
    stock = bool(dataset_cfg.get("stock"))
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
    derive.build_dims(con, cfg, derived, normalise.scope_flag(cfg, dataset, require, stock), snapshot_month if stock else None)
    # Judged on this dataset's own hybrids, before any slice is written: a dataset that identifies too few of its mild
    # hybrids shows its hybrids undivided, whatever another dataset publishes.
    hybrid, high_counts = (None, None) if stock else metrics.hybrid_coverage(con, cfg, ds, window_start, snapshot_month, window)
    if hybrid and not hybrid["mild_split_published"]:
        derive.undivide_hybrids(con, cfg, derived)
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
    protected, small_rule, pair_rule = owner_protection(cfg)
    small_cell_figures = {}
    no_fuel = pair_slice_dimensions(dataset_cfg, protected)
    for d in live:
        path = staging / "cube" / dataset / f"{d.dim_id}.parquet"
        if d.dim_id not in protected:
            outputs.write_slice(con, cfg, d, ds, path, fuel=d.dim_id not in no_fuel)
            continue
        # A slice of an owner dimension is written under the small-cell rule and then read back from the file: one that
        # breaks the rule aborts the run, so it never reaches public/data (D-127).
        figures = small_cells.write_protected_slice(con, cfg, d, ds, path, small_rule, fuel=d.dim_id not in no_fuel)
        aborts += [f"{dataset}.{d.dim_id}: {problem}" for problem in small_cells.check_slice(con, path, small_rule, figures)]
        small_cell_figures[d.dim_id] = figures
    live_pairs, not_live_pairs, pair_figures = write_pairs(con, cfg, dataset, dataset_cfg, live, ds, staging, aborts, warnings,
                                                           protected, pair_rule)

    counts = metrics.month_counts(con, ds)
    facts = write_fact_table(con, cfg, dataset, dataset_cfg, live, ds, staging, aborts, warnings)
    # From the same counts as the fact table, so only its live dimensions: a table that did not get written has no pairs.
    associations = None
    if facts is not None and counts:
        associations = association.write(con, cfg, dataset, facts["dimensions"], {d.dim_id: d for d in live}, ds, window_start,
                                         snapshot_month, date.fromisoformat(min(counts) + "-01"), protected, staging, aborts)
    if counts.get(snapshot_key, 0) == 0:
        aborts.append(f"{dataset}: the snapshot month {snapshot_key} has no rows")
    deviation = metrics.latest_month_deviation(counts, snapshot_month, window)
    if deviation is not None and abs(deviation) > g["latest_month_max_deviation"]:
        warnings.append(f"{dataset}: {snapshot_key} count deviates {deviation:+.0%} from the median of the previous {window} months")
    quality = metrics.quality_counts(con, derived, require, snapshot_month)
    if stock:
        aborts += [f"{dataset}: {problem}" for problem in stock_problems(con, staging, dataset, snapshot_month, counts)]
    if quality["registration_after_snapshot"]:
        warnings.append(f"{dataset}: {quality['registration_after_snapshot']:,} rows are dated after the snapshot month and were excluded")
    entry = {
        "definition": dataset_definition(cfg, dataset),
        "rows": sum(counts.values()),
        "months": len(counts),
        "latest_month": snapshot_key,
        "live_dimensions": [d.dim_id for d in live],
        "not_live": not_live,
        "live_pairs": live_pairs,
        "not_live_pairs": not_live_pairs,
        "small_cells": small_cell_figures,
        **({"small_cell_pairs": pair_figures} if pair_figures else {}),
        "facts": facts,
        "associations": associations,
        "unmapped_rates": rates,
        "unmapped_guard": guard,
        **({} if stock else {"mild_hybrid_identification_coverage": hybrid}),
        "coverage_trailing": metrics.coverage(con, derived, ds, window_start, snapshot_month, window),
        "counts": quality,
        "model_cap": caps,
    }
    if stock:
        return Built(entry, counts, [d.dim_id for d in live], ds)
    disagreeing = hybrid["classification_disagrees_with_powertrain"]
    if disagreeing:
        warnings.append(f"{dataset}: {disagreeing:,} vehicles show a powertrain that contradicts their classification in "
                        f"{p['hybrid_classification']['file']}")
    # Judged on whole counts, as the split is (metrics.hybrid_coverage): the figure shown is rounded, the comparison is not.
    high, denominator = high_counts["trailing"]
    warn_floor = hybrid["warn_below_trailing_high_confidence_coverage"]
    detail = (f"mild hybrid identification coverage over the trailing {window} months is "
              f"{hybrid['trailing']['coverage_high_confidence_only'] or 0:.1%} counting high-confidence classifications only")
    if not hybrid["mild_split_published"]:
        publish_floor = hybrid["publish_split_at_trailing_high_confidence_coverage"]
        warnings.append(f"{dataset}: {detail}, below {publish_floor:.0%}, so the mild hybrid split is not published: "
                        f"its mild hybrids are counted as {p['hybrid_classification']['undivided_powertrain']}")
    elif denominator and high / denominator < warn_floor:
        warnings.append(f"{dataset}: {detail}, below {warn_floor:.0%}")
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
    # The source's own extra columns that a dimension reads (derive.extra_fields_read), under their logical names: they are
    # not register fields, so they have no source name or type of the register's.
    columns += [f"{quote(name)}" for name in derive.extra_fields_read(cfg, source_id)]
    # unnest(range(n)) repeats each store row n times: a vehicle each.
    con.execute(f"""
        CREATE OR REPLACE TABLE raw AS
        SELECT {', '.join(columns)}
        FROM (SELECT *, unnest(range({quote(supplied.STORE_COUNT)})) AS repeat_index FROM supplied_store)
    """)


def excused_months(ledger: dict, replaced_key: str, since: str, files_before: dict[str, str]) -> set[str]:
    """The months whose store total may differ from the last good build's because a recorded replacement (or revision)
    explains it. A replacement counts if its file was taken on or after the last good build's day, or if it describes
    the file the ledger now cites for that month and the last good build did not see that file: the owner can take an
    export before a build lands and commit it after, and the build that follows must not mistake the restatement for a
    silent one. A replacement the ledger does not record never excuses anything."""
    out = set()
    for entry in ledger[replaced_key]:
        month, new = entry["month"], entry["new"]
        current = ledger["months"].get(month, {}).get("sha256")
        if new["taken"] >= since or (new.get("sha256") is not None and new["sha256"] == current and files_before.get(month) != current):
            out.add(month)
    return out


def build_supplied(con, cfg, source_id: str, types: dict[str, str], schema_names: set[str], register_month: date,
                   state: dict | None, staging, aborts: list[str], warnings: list[str]) -> tuple[dict, dict, dict, dict, dict]:
    """Every dataset that reads the supplied source: (manifest entries, month counts, live dimensions,
    the store's own vehicles per month, the file each month came from). The store is checked
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
        return entries, {}, {}, {}, {}
    if not (registrations.exists() and ledger_path.exists()):
        aborts.append(f"{source_id}: the supplied store has only one of {s[supplied.layout(s).file_key]} and {s['ledger_file']}")
        return {}, {}, {}, {}, {}

    loaded = supplied.load_store(con, cfg, source_id, aborts, warnings)
    if loaded is None or not supplied.check_clock(source_id, loaded[2], register_month, aborts, warnings):
        return {}, {}, {}, {}, {}
    ledger, first, latest = loaded

    lay = supplied.layout(s)
    extra = {}
    if s["kind"] == supplied.SERIES:
        # The datasets are written from the published series, not from vehicle rows; their month total is the store's own.
        built = series.build(con, cfg, source_id, names, latest, previous_live, staging, aborts, warnings, lambda d: dataset_definition(cfg, d))
        store_totals = {d: b.counts for d, b in built.items()}
        extra = series.manifest_facts(ledger, s)
    else:
        supplied_raw(con, cfg, source_id, types)
        normalise.build_src(con, cfg, types, schema_names, derive.extra_fields_read(cfg, source_id))
        con.execute("DROP TABLE raw")
        normalise.build_rows(con, cfg)
        built = {d: build_dataset(con, cfg, d, p["datasets"][d], latest, previous_live, staging, aborts, warnings) for d in names}
        # The store's own total for each month, whatever scope says: the guard compares these, so an edit to a scope file
        # cannot move them.
        store_totals = {d: {m: int(e["vehicles"]) for m, e in ledger["months"].items()} for d in names}

    taken = sorted({e["taken"] for e in ledger["months"].values()})
    since = ((state or {}).get("generated_at") or "")[:10]
    sources = {d: {m: e["sha256"] for m, e in ledger["months"].items()} for d in built}
    entries, counts, live = {}, {}, {}
    for dataset, b in built.items():
        entries[dataset] = {**b.entry, "supplied": {
            "source": source_id,
            "months": {"first": supplied.month_key(first), "last": supplied.month_key(latest), "count": len(ledger["months"])},
            "taken": taken,
            lay.replaced_key: ledger[lay.replaced_key],
            **extra,
        }}
        counts[dataset], live[dataset] = b.counts, b.live
        replaced = excused_months(ledger, lay.replaced_key, since, ((state or {}).get("supplied_files") or {}).get(dataset, {}))
        aborts += guardrails.supplied_month_changes(
            dataset, store_totals[dataset], ((state or {}).get("supplied_totals") or {}).get(dataset, {}), replaced, s["max_month_change"])
    return entries, counts, live, store_totals, sources


def build(cfg, source: dict, pages_glob: str, state: dict | None, now: datetime | None = None, publish: bool = True) -> dict:
    now = now or datetime.now(timezone.utc)
    p, g = cfg.pipeline, cfg.pipeline["guardrails"]
    # Before anything is read: a series dimension that would be offered to a register dataset cannot be derived there.
    misconfigured = (derive.series_dimension_problems(cfg) + stock_configuration_problems(cfg)
                     + fact_table_owner_problems(cfg) + kind_of_owner_floor_problems(cfg) + guardrails.continuation_problems(cfg))
    if misconfigured:
        raise GuardrailError("build", "\n  - " + "\n  - ".join(misconfigured))
    # A dataset that replaced others is compared with the records they left (guardrails.inherit_history).
    state = guardrails.inherit_history(cfg, state)
    # After those, which read the data map and the dimensions: the two published-figures files are checked against them, so a
    # configuration they cannot be checked against stops the run with its own message first.
    published, reconciliation_problems = reconcile.prepare(cfg)
    if reconciliation_problems:
        raise GuardrailError("build", "\n  - " + "\n  - ".join(reconciliation_problems))
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

    datasets, month_counts, live_dimensions, stock_totals = {}, {}, {}, {}
    moving = {"vehicle_year": None, "age": None, "snapshot_year": snapshot_month.year}
    age_report = {"window_months": window, "rows": 0}
    for dataset, dataset_cfg in register_datasets(p).items():
        built = build_dataset(con, cfg, dataset, dataset_cfg, snapshot_month, previous_live, staging, aborts, warnings)
        datasets[dataset] = built.entry
        if dataset_cfg.get("stock"):
            # One period, the snapshot's: the next build is compared by its total, not by months it would lack (guardrails.compare).
            stock_totals[dataset] = {"snapshot": latest_snapshot, "vehicles": sum(built.counts.values())}
        else:
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

    supplied_totals: dict[str, dict[str, int]] = {}
    supplied_files: dict[str, dict[str, str]] = {}
    # After this point `src`, `rows` and `dims` hold a supplied source, not the register.
    schema_names = {f["name"] for f in expected["fields"]}
    for source_id in supplied_sources(p):
        entries, counts, live, totals, files = build_supplied(con, cfg, source_id, types, schema_names, snapshot_month, state, staging,
                                               aborts, warnings)
        datasets.update(entries)
        month_counts.update(counts)
        live_dimensions.update(live)
        supplied_totals.update(totals)
        supplied_files.update(files)

    current = {
        "row_count": source["row_count"],
        "in_scope_row_count": in_scope_rows,
        "latest_snapshot": latest_snapshot,
        "change_key": source["change_key"],
        "month_counts": month_counts,
        "stock_totals": stock_totals,
        "moving_cutoff": moving,
        "mild_split": guardrails.split_record(datasets),
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

    # After every dataset is staged and before the payload is counted: each published figure is answered from the files a visitor
    # would read, so what is checked is what is about to be published (D-149).
    reconciled = reconcile.run(con, cfg, published, datasets, staging, latest_snapshot)
    aborts += reconciled.aborts
    warnings += reconciled.warnings
    outputs.write_json(staging / reconciled.entry["file"], reconciled.document)

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
        "reconciliation": reconciled.entry,
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
            "stock_totals": stock_totals,
            "mild_split": current["mild_split"],
            "supplied_totals": supplied_totals,
            "supplied_files": supplied_files,
        })
    return manifest
