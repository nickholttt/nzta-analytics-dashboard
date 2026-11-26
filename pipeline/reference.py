"""Reference files: reading, validation, and registration as DuckDB tables."""

from __future__ import annotations

import csv
import re
from collections import Counter
from datetime import date
from pathlib import Path

from .contract import OTHER, UNDEFINED, UNMAPPED
from .errors import GuardrailError

# Registry match columns that bound the vehicle year, with the comparison each applies. Every other match column names a
# value that must be equal.
YEAR_FROM, YEAR_TO = "vehicle_year_min", "vehicle_year_max"
RANGE_CONDITIONS = {YEAR_FROM: ">=", YEAR_TO: "<="}


def read(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise GuardrailError("reference", f"{path} is missing")
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def register(con, table: str, columns: list[str], rows: list[tuple]) -> None:
    con.execute(f"CREATE OR REPLACE TABLE {table} ({', '.join(f'{quote(c)} VARCHAR' for c in columns)})")
    if rows:
        con.executemany(f"INSERT INTO {table} VALUES ({', '.join('?' for _ in columns)})", rows)


def quote(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def require_unique(keys, what: str) -> None:
    dupes = sorted(k for k, n in Counter(keys).items() if n > 1)
    if dupes:
        raise GuardrailError("reference", f"{what}: keys defined more than once: {dupes}")


def split(value: str, sep: str) -> list[str]:
    return [v for v in value.split(sep) if v]


def condition_vocabularies(cfg) -> dict[str, set[str]]:
    """What each equality match column may hold: the vocabulary of the reference file it is checked against."""
    p = cfg.pipeline
    engine, vehicle, status = p["engine"], p["scope"]["vehicle"], p["scope"]["status"]
    return {
        "motive_power": {r[engine["key"]] for r in read(cfg.reference(engine["reference"]))},
        "import_status": {r[status["label"]] for r in read(cfg.reference(status["file"]))},
        "vehicle_type": {r[vehicle["key"]] for r in read(cfg.reference(vehicle["file"]))},
    }


def parse_conditions(row: dict, conditions: dict[str, str], vocabularies: dict[str, set[str]], label: str) -> dict:
    """A reference row's match columns, validated. Blank means any vehicle."""
    match = {condition: (row[column] or None) for condition, column in conditions.items()}
    for condition, value in match.items():
        if value is None:
            continue
        if condition in RANGE_CONDITIONS:
            if not value.isdigit():
                raise GuardrailError("reference", f"{label}: {conditions[condition]} {value!r} is not a year")
        elif value not in vocabularies[condition]:
            raise GuardrailError("reference", f"{label}: {conditions[condition]} {value!r} is not a known {condition}")
    if match.get(YEAR_FROM) and match.get(YEAR_TO) and int(match[YEAR_FROM]) > int(match[YEAR_TO]):
        raise GuardrailError("reference", f"{label}: {conditions[YEAR_FROM]} is after {conditions[YEAR_TO]}")
    return match


def conditions_overlap(a: dict, b: dict) -> bool:
    """Whether some vehicle could satisfy both sets of parsed match conditions."""
    for condition in a:
        if condition not in RANGE_CONDITIONS and a[condition] and b[condition] and a[condition] != b[condition]:
            return False
    starts = [int(m[YEAR_FROM]) for m in (a, b) if m.get(YEAR_FROM)]
    ends = [int(m[YEAR_TO]) for m in (a, b) if m.get(YEAR_TO)]
    return not (starts and ends and max(starts) > min(ends))


def brand_tables(con, cfg) -> None:
    """ref_brand_keys (raw make -> canonical), ref_brand (attributes), ref_model_alias, ref_promotion.

    make_promotion and not_promoted rows may narrow their match with the registry's match columns. not_promoted rows
    are never applied: the build aborts if a make_promotion row could move a vehicle that a not_promoted row with the
    same make and override_value covers."""
    b = cfg.pipeline["brand"]
    sep = b["alias_separator"]
    registry = read(cfg.reference(b["registry"]))
    for row in registry:
        if row[b["as_at"]]:
            try:
                date.fromisoformat(row[b["as_at"]])
            except ValueError:
                raise GuardrailError("reference", f"{b['registry']}: {row[b['canonical']]} has {b['as_at']} "
                                                  f"{row[b['as_at']]!r}, not an ISO date")
    keys = []
    for row in registry:
        canonical = row[b["canonical"]]
        keys += [(canonical, canonical)] + [(alias, canonical) for alias in split(row[b["aliases"]], sep)]
    require_unique([k for k, _ in keys], b["registry"])
    register(con, "ref_brand_keys", ["key", "canonical"], keys)
    columns = list(registry[0].keys())
    register(con, "ref_brand", columns, [tuple(row[c] for c in columns) for row in registry])
    canonical_makes = {row[b["canonical"]] for row in registry}

    file, conditions = b["model_registry"], b["model_registry_conditions"]
    vocabularies = condition_vocabularies(cfg)
    matched_types = (b["make_promotion_type"], b["not_promoted_type"])
    alias_rows, promotion_rows, exclusions = [], [], []
    for row in read(cfg.reference(file)):
        make, model, kind = row[b["model_registry_make"]], row[b["model_registry_model"]], row[b["model_registry_type"]]
        label = f"{file}: {make}|{model}"
        model_keys = [model] + split(row[b["model_registry_aliases"]], sep)
        match = parse_conditions(row, conditions, vocabularies, label)
        values = tuple(match.values())
        if any(values) and kind not in matched_types:
            raise GuardrailError("reference", f"{label}: match columns apply only to {', '.join(matched_types)} rows, not {kind}")
        if kind in b["model_alias_types"]:
            alias_rows += [(make, key, model) for key in model_keys]
        elif kind == b["make_promotion_type"]:
            target = row[b["model_registry_value"]]
            for make_name in (make, target):
                if make_name not in canonical_makes:
                    raise GuardrailError("reference", f"{file}: {make_name!r} is not a make in {b['registry']}")
            promotion_rows += [(make, key, target, model, *values) for key in model_keys]
        elif kind == b["not_promoted_type"]:
            exclusions.append((make, row[b["model_registry_value"]], match))
    blocked = sorted({f"{make}|{model} -> {target}" for make, _, target, model, *values in promotion_rows
                      for excluded_make, excluded_target, excluded in exclusions
                      if (make, target) == (excluded_make, excluded_target)
                      and conditions_overlap(dict(zip(conditions, values)), excluded)})
    if blocked:
        raise GuardrailError("reference", f"{file}: {b['make_promotion_type']} rows {blocked} can move vehicles that "
                                          f"{b['not_promoted_type']} rows forbid moving")
    require_unique([(m, k) for m, k, *_ in alias_rows + promotion_rows], file)
    register(con, "ref_model_alias", ["make", "model_key", "model_canonical"], alias_rows)
    register(con, "ref_promotion", ["make", "model_key", "target_make", "model_canonical", *conditions], promotion_rows)


def hybrid_keys(cfg) -> dict:
    """From powertrain_map.csv: each key's powertrain, the keys the source records as hybrids, and the keys that map to
    the mild hybrid powertrain."""
    p = cfg.pipeline
    h, engine = p["hybrid_classification"], p["engine"]
    rows = read(cfg.reference(engine["reference"]))
    return {
        "labels": {r[engine["key"]]: r[h["powertrain_column"]] for r in rows},
        "source_hybrid": {r[engine["key"]] for r in rows if r[h["source_hybrid"]["column"]] == h["source_hybrid"]["value"]},
        "mild": {r[engine["key"]] for r in rows if r[h["powertrain_column"]] == h["mild_powertrain"]},
    }


def hybrid_tables(con, cfg) -> None:
    """ref_hybrid from mild_hybrid_models.csv: one row per make and model key, with its classification, override and
    match columns. Every row is checked so that no vehicle can match two rows and no classification can contradict the
    powertrain the vehicle ends up with."""
    p = cfg.pipeline
    h, b = p["hybrid_classification"], p["brand"]
    sep, conditions, types = b["alias_separator"], b["model_registry_conditions"], h["types"]
    file = h["file"]
    keys = hybrid_keys(cfg)
    makes = {r[b["canonical"]] for r in read(cfg.reference(b["registry"]))}
    vocabularies = condition_vocabularies(cfg)
    rows, seen = [], {}
    for row in read(cfg.reference(file)):
        make, kind, target = row[h["make"]], row[h["type"]], row[h["override"]] or None
        models = split(row[h["models"]], sep)
        label = f"{file}: {make}|{row[h['models']]} ({kind})"
        match = parse_conditions(row, conditions, vocabularies, label)
        motive = match["motive_power"]
        if make not in makes:
            raise GuardrailError("reference", f"{label}: {make!r} is not a make in {b['registry']}")
        if not models:
            raise GuardrailError("reference", f"{label}: no {h['models']}")
        if kind not in types.values():
            raise GuardrailError("reference", f"{label}: {h['type']} must be one of {sorted(types.values())}")
        if row[h["confidence"]] not in h["confidence_levels"] or not row[h["basis"]]:
            raise GuardrailError("reference", f"{label}: every row needs a {h['basis']} and a {h['confidence']} "
                                              f"of {h['confidence_levels']}")
        if target is not None:
            if target not in keys["labels"]:
                raise GuardrailError("reference", f"{label}: {h['override']} {target!r} is not a known motive_power")
            if motive is None:
                raise GuardrailError("reference", f"{label}: rows with an {h['override']} must set {conditions['motive_power']}")
        shown = keys["labels"].get(target or motive) if (target or motive) else None
        if kind == types["mild"] and shown != h["mild_powertrain"] or kind == types["full"] and shown == h["mild_powertrain"]:
            raise GuardrailError("reference", f"{label}: classified {kind} but its powertrain would be {shown!r}; set "
                                              f"{h['override']} or {conditions['motive_power']}")
        for model in models:
            for other_label, other in seen.get((make, model), []):
                if conditions_overlap(match, other):
                    raise GuardrailError("reference", f"{label} and {other_label} both match some {make}|{model} vehicles")
            seen.setdefault((make, model), []).append((label, match))
            rows.append((make, model, kind, row[h["confidence"]], target, *match.values()))
    register(con, "ref_hybrid", ["make", "model_key", "hybrid_type", "confidence", "target", *conditions], rows)


def validate_ranges(rows: list[dict], key_cols: list[str], lo_col: str, hi_col: str, what: str) -> None:
    groups: dict[tuple, list[tuple]] = {}
    for row in rows:
        groups.setdefault(tuple(row[c] for c in key_cols), []).append((row[lo_col], row[hi_col]))
    for key, bounds in groups.items():
        open_rows = [b for b in bounds if b == ("", "")]
        if open_rows and len(bounds) > 1:
            raise GuardrailError("reference", f"{what}: {key} mixes a blank range with other rows")
        if open_rows:
            continue
        try:
            spans = sorted((int(lo), int(hi)) for lo, hi in bounds)
        except ValueError:
            raise GuardrailError("reference", f"{what}: {key} has a half-blank or non-numeric range")
        for (lo, hi), (next_lo, _) in zip(spans, spans[1:] + [(None, None)]):
            if lo > hi or (next_lo is not None and next_lo <= hi):
                raise GuardrailError("reference", f"{what}: {key} has inverted or overlapping ranges")


# What a column of an ordered rule file can ask of a row (config/dimensions.json, `tests` of a derive block of kind ordered_rules).
# The file's own words are read from config; these are only the kinds of question.
ANY_OF, AT_LEAST, AT_MOST, RECORDED, EQUALS = "any_of", "at_least", "at_most", "recorded", "equals"
RULE_TESTS = (ANY_OF, AT_LEAST, AT_MOST, RECORDED, EQUALS)
# What a `recorded` column may hold besides nothing: the field is recorded, or it is not.
RECORDED_CELLS = ("true", "false")
WHOLE_NUMBER = re.compile(r"[0-9]+")


def rule_vocabularies(cfg, tests: list[dict]) -> dict[str, set[str]]:
    """The values each tested column of a rule file may name, for the tests that say where those values come from
    (`values_from`: a reference file and its column)."""
    return {t["column"]: {r[t["values_from"]["column"]] for r in read(cfg.reference(t["values_from"]["reference"]))}
            for t in tests if t.get("values_from")}


def rule_problems(rows: list[dict], spec: dict, vocabularies: dict[str, set[str]], reserved: set[str]) -> list[str]:
    """Everything wrong with an ordered rule file, one line each, empty when it is well formed. `spec` is the derive block:
    `order` and `value` name the file's rule number and result columns, `tests` the other columns and what each asks.

    The first rule a vehicle meets wins, so the order is part of the definition: rule numbers must rise down the file, so that
    the order a person reads is the order the build applies. A bound needs a recorded value (a vehicle with none meets no
    rule that bounds it), so a rule that bounds a field and also says it is not recorded could never be met."""
    order, value, tests = spec["order"], spec["value"], spec["tests"]
    if not rows:
        return ["the file has no rules"]
    problems = [f"the file has no column {c!r}" for c in (order, value, *(t["column"] for t in tests)) if c not in rows[0]]
    problems += [f"the test {t['test']!r} on column {t['column']!r} is not one of {list(RULE_TESTS)}" for t in tests if t["test"] not in RULE_TESTS]
    if problems:
        return problems
    previous = None
    for line, row in enumerate(rows, start=2):
        # A comma outside quotes makes a row longer than the header (the reader keeps the rest under a key of None), and a row
        # that stops early has no value for its last columns.
        if None in row or any(v is None for v in row.values()):
            problems.append(f"line {line}: has {'more' if None in row else 'fewer'} fields than the header (a comma outside quotes?)")
            continue
        label = f"rule {row[order]!r} (line {line})"
        if not WHOLE_NUMBER.fullmatch(row[order]):
            problems.append(f"{label}: {order} is not a whole number")
        else:
            if previous is not None and int(row[order]) <= previous:
                problems.append(f"{label}: {order} must rise down the file and does not follow {previous}")
            previous = int(row[order])
        if not row[value] or row[value] != row[value].strip():
            problems.append(f"{label}: {value} must be a trimmed, non-empty word")
        elif row[value] in reserved:
            problems.append(f"{label}: {value} {row[value]!r} is a reserved value of the cube")
        bounds: dict[str, dict[str, int]] = {}
        not_recorded: set[str] = set()
        for t in tests:
            cell, kind, field = row[t["column"]], t["test"], t["field"]
            if cell == "":
                continue
            known = vocabularies.get(t["column"])
            if kind == ANY_OF:
                names = cell.split(t["separator"])
                if any(n == "" or n != n.strip() for n in names) or len(set(names)) != len(names):
                    problems.append(f"{label}: {t['column']} must be trimmed, non-empty names with none repeated")
                elif known is not None and set(names) - known:
                    problems.append(f"{label}: {t['column']} names {sorted(set(names) - known)}, which {t['values_from']['reference']} does not hold")
            elif kind in (AT_LEAST, AT_MOST):
                if not WHOLE_NUMBER.fullmatch(cell):
                    problems.append(f"{label}: {t['column']} {cell!r} is not a whole number")
                else:
                    bounds.setdefault(field, {})[kind] = int(cell)
            elif kind == RECORDED:
                if cell not in RECORDED_CELLS:
                    problems.append(f"{label}: {t['column']} must be empty or one of {list(RECORDED_CELLS)}, not {cell!r}")
                elif cell == RECORDED_CELLS[1]:
                    not_recorded.add(field)
            elif known is not None and cell not in known:
                problems.append(f"{label}: {t['column']} {cell!r} is not held by {t['values_from']['reference']}")
        for field, pair in bounds.items():
            if AT_LEAST in pair and AT_MOST in pair and pair[AT_LEAST] > pair[AT_MOST]:
                problems.append(f"{label}: the lower bound on {field} is above the upper bound")
            if field in not_recorded:
                problems.append(f"{label}: {field} is bounded and also said not to be recorded, and a bound needs a recorded value")
    return problems


def ordered_rules(cfg, spec: dict, who: str) -> list[dict[str, str]]:
    """The rules of an ordered rule file, in the order the file gives them, validated: a file that breaks a rule of
    rule_problems aborts the build, naming each fault."""
    rows = read(cfg.reference(spec["reference"]))
    problems = rule_problems(rows, spec, rule_vocabularies(cfg, spec["tests"]), {UNDEFINED, UNMAPPED, OTHER})
    if problems:
        raise GuardrailError("reference", f"{who}: {spec['reference']}: " + "; ".join(problems))
    return rows

