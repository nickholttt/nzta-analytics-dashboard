"""Reference files: reading, validation, and registration as DuckDB tables."""

from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

from .errors import GuardrailError


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
    """What each model_registry.csv match column may hold: the vocabulary of the reference file it is checked against."""
    p = cfg.pipeline
    engine, vehicle, status = p["engine"], p["scope"]["vehicle"], p["scope"]["status"]
    return {
        "motive_power": {r[engine["key"]] for r in read(cfg.reference(engine["reference"]))},
        "import_status": {r[status["label"]] for r in read(cfg.reference(status["file"]))},
        "vehicle_type": {r[vehicle["key"]] for r in read(cfg.reference(vehicle["file"]))},
    }


def brand_tables(con, cfg) -> None:
    """ref_brand_keys (raw make -> canonical), ref_brand (attributes), ref_model_alias, ref_promotion.

    make_promotion rows may narrow their match with the registry's match columns. not_promoted rows are never applied:
    each forbids any make_promotion from its make to its override_value, and the build aborts if one exists."""
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
    alias_rows, promotion_rows, forbidden = [], [], set()
    for row in read(cfg.reference(file)):
        make, model, kind = row[b["model_registry_make"]], row[b["model_registry_model"]], row[b["model_registry_type"]]
        model_keys = [model] + split(row[b["model_registry_aliases"]], sep)
        match = tuple(row[column] or None for column in conditions.values())
        for (condition, column), value in zip(conditions.items(), match):
            if value is not None and value not in vocabularies[condition]:
                raise GuardrailError("reference", f"{file}: {make}|{model}: {column} {value!r} is not a known {condition}")
        if any(match) and kind != b["make_promotion_type"]:
            raise GuardrailError("reference", f"{file}: {make}|{model}: match columns apply only to "
                                              f"{b['make_promotion_type']} rows, not {kind}")
        if kind in b["model_alias_types"]:
            alias_rows += [(make, key, model) for key in model_keys]
        elif kind == b["make_promotion_type"]:
            target = row[b["model_registry_value"]]
            for make_name in (make, target):
                if make_name not in canonical_makes:
                    raise GuardrailError("reference", f"{file}: {make_name!r} is not a make in {b['registry']}")
            promotion_rows += [(make, key, target, model, *match) for key in model_keys]
        elif kind == b["not_promoted_type"]:
            forbidden.add((make, row[b["model_registry_value"]]))
    blocked = sorted({(make, target) for make, _, target, *_ in promotion_rows if (make, target) in forbidden})
    if blocked:
        raise GuardrailError("reference", f"{file}: {b['make_promotion_type']} rows move {blocked}, "
                                          f"which {b['not_promoted_type']} rows forbid")
    require_unique([(m, k) for m, k, *_ in alias_rows + promotion_rows], file)
    register(con, "ref_model_alias", ["make", "model_key", "model_canonical"], alias_rows)
    register(con, "ref_promotion", ["make", "model_key", "target_make", "model_canonical", *conditions], promotion_rows)


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
