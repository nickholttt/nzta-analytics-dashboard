"""Reference files: reading, validation, and registration as DuckDB tables."""

from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

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
    """A registry row's match columns, validated. Blank means any vehicle."""
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
    """ref_brand_keys (raw make -> canonical), ref_brand (attributes), ref_model_alias, ref_promotion, ref_motive_override.

    make_promotion, motive_power_override and not_promoted rows may narrow their match with the registry's match
    columns. not_promoted rows are never applied: the build aborts if a make_promotion row could move a vehicle that a
    not_promoted row with the same make and override_value covers."""
    b = cfg.pipeline["brand"]
    sep = b["alias_separator"]
    registry = read(cfg.reference(b["registry"]))
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
    matched_types = (b["make_promotion_type"], b["motive_power_override_type"], b["not_promoted_type"])
    alias_rows, promotion_rows, override_rows, exclusions = [], [], [], []
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
        elif kind == b["motive_power_override_type"]:
            target, motive_column = row[b["model_registry_value"]], conditions["motive_power"]
            if make not in canonical_makes:
                raise GuardrailError("reference", f"{file}: {make!r} is not a make in {b['registry']}")
            if target not in vocabularies["motive_power"]:
                raise GuardrailError("reference", f"{label}: override_value {target!r} is not a known motive_power")
            if not row[motive_column]:
                raise GuardrailError("reference", f"{label}: {kind} rows must set {motive_column}")
            override_rows += [(make, key, target, *values) for key in model_keys]
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
    require_unique([(m, k) for m, k, *_ in override_rows], file)
    register(con, "ref_model_alias", ["make", "model_key", "model_canonical"], alias_rows)
    register(con, "ref_promotion", ["make", "model_key", "target_make", "model_canonical", *conditions], promotion_rows)
    register(con, "ref_motive_override", ["make", "model_key", "target", *conditions], override_rows)


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
