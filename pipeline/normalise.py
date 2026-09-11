"""Raw pages -> `raw` -> `src` (sentinels applied) -> `rows` (scope, brand overrides, hybrid classification, engine flag,
fuel consumption)."""

from __future__ import annotations

import glob
from pathlib import Path

from . import reference
from .errors import GuardrailError
from .reference import quote

# Suffix of the column in `rows` that keeps a value as NZTA recorded it, beside the overridden one.
SOURCE_SUFFIX = "__source"


def lit(value) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def ingest(con, pages_glob: str, types: dict[str, str]) -> int:
    """Load saved pages one at a time: a page is one large JSON object, and reading them all in one
    query holds every page's nested feature list in memory at once."""
    pages = sorted(glob.glob(pages_glob))
    if not pages:
        raise GuardrailError("pull", f"no saved pages match {pages_glob}")
    struct = ", ".join(f"{quote(name)} {typ}" for name, typ in types.items())
    features_type = f"STRUCT(attributes STRUCT({struct}))[]"
    con.execute(f"CREATE OR REPLACE TABLE raw ({', '.join(f'{quote(n)} {t}' for n, t in types.items())})")
    for page in pages:
        con.execute(f"""
            INSERT INTO raw
            SELECT unnest(feature.attributes)
            FROM (
                SELECT unnest(features) AS feature
                FROM read_json({lit(Path(page).as_posix())},
                               columns = {{'features': {lit(features_type)}}},
                               maximum_object_size = 268435456)
            )
        """)
    return con.execute("SELECT count(*) FROM raw").fetchone()[0]


def sentinel_values(cfg, schema_fields: set[str]) -> dict[str, list[str]]:
    s = cfg.pipeline["sentinels"]
    tokens = {s["null_token"], s["empty_token"]}
    by_field: dict[str, list[str]] = {}
    for row in reference.read(cfg.reference(s["file"])):
        by_field.setdefault(row[s["field"]], [])
        if row[s["value"]] not in tokens:
            by_field[row[s["field"]]].append(row[s["value"]])
    unknown = sorted(f for f in by_field if f != s["any_field"] and f not in schema_fields)
    if unknown:
        raise GuardrailError("reference", f"{s['file']} names fields that are not in the source schema: {unknown}")
    return by_field


def build_src(con, cfg, types: dict[str, str], schema_fields: set[str]) -> None:
    """Logical column names; empty and sentinel values become NULL, with flags recording which it was."""
    by_field = sentinel_values(cfg, schema_fields)
    any_values = by_field.get(cfg.pipeline["sentinels"]["any_field"], [])
    columns = []
    for logical, source in cfg.pipeline["fields"].items():
        col = quote(source)
        text = f"trim(CAST({col} AS VARCHAR))"
        missing = f"({col} IS NULL OR {text} = '')"
        values = by_field.get(source, []) + any_values
        sentinel = f"coalesce({text} IN ({', '.join(lit(v) for v in values)}), FALSE)" if values else "FALSE"
        value = f"trim({col})" if types[source] == "VARCHAR" else col
        columns += [
            f"CASE WHEN {missing} OR {sentinel} THEN NULL ELSE {value} END AS {quote(logical)}",
            f"{missing} AS {quote(logical + '__missing')}",
            f"(NOT {missing} AND {sentinel}) AS {quote(logical + '__sentinel')}",
        ]
    con.execute(f"CREATE OR REPLACE TABLE src AS SELECT {', '.join(columns)} FROM raw")


def build_rows(con, cfg) -> None:
    p = cfg.pipeline
    true = lit(p["boolean_true"])
    vehicle, status = p["scope"]["vehicle"], p["scope"]["status"]
    reference.register(con, "ref_vehicle_scope", ["key", "in_scope"],
                       [(r[vehicle["key"]], r[vehicle["in_scope"]]) for r in reference.read(cfg.reference(vehicle["file"]))])
    reference.register(con, "ref_status", ["key", "in_scope", "fleet_entry", "label"],
                       [(r[status["key"]], r[status["in_scope"]], r[status["fleet_entry"]], r[status["label"]])
                        for r in reference.read(cfg.reference(status["file"]))])
    for table, logical, file in (("ref_vehicle_scope", vehicle["field"], vehicle["file"]), ("ref_status", status["field"], status["file"])):
        unknown = con.execute(
            f"SELECT DISTINCT {quote(logical)} FROM src WHERE {quote(logical)} IS NULL "
            f"OR {quote(logical)} NOT IN (SELECT key FROM {table}) ORDER BY 1"
        ).fetchall()
        if unknown:
            raise GuardrailError("scope", f"{logical} values with no row in {file}, so scope cannot be decided: {[u[0] for u in unknown]}")

    reference.brand_tables(con, cfg)
    reference.hybrid_tables(con, cfg)
    hybrids = reference.hybrid_keys(cfg)
    engine = p["engine"]
    engine_rows = reference.read(cfg.reference(engine["reference"]))
    reference.require_unique([r[engine["key"]] for r in engine_rows], engine["reference"])
    reference.register(con, "ref_engine", ["key", "flag"], [(r[engine["key"]], r[engine["flag"]]) for r in engine_rows])

    b, fc = p["brand"], p["fuel_consumption"]
    make, model = f"s.{quote(b['make_field'])}", f"s.{quote(b['model_field'])}"
    fuel = f"s.{quote(fc['field'])}"
    number = f"TRY_CAST({fuel} AS DOUBLE)"
    # Match columns compare against the raw motive power, vehicle type and vehicle year, and the import status label.
    # A vehicle with no vehicle year matches no row that bounds it.
    condition_values = {
        "motive_power": f"s.{quote(engine['field'])}",
        "import_status": "st.label",
        "vehicle_type": f"s.{quote(vehicle['field'])}",
        reference.YEAR_FROM: "s.vehicle_year",
        reference.YEAR_TO: "s.vehicle_year",
    }

    def matches(alias: str) -> str:
        parts = []
        for c in b["model_registry_conditions"]:
            column = f"{alias}.{quote(c)}"
            if c in reference.RANGE_CONDITIONS:
                parts.append(f"({column} IS NULL OR {condition_values[c]} {reference.RANGE_CONDITIONS[c]} CAST({column} AS BIGINT))")
            else:
                parts.append(f"({column} IS NULL OR {column} = {condition_values[c]})")
        return " AND ".join(parts)

    # Hybrid classification applies only to vehicles recorded under a hybrid code, keyed on the make and model after brand
    # aliases and model overrides. Its override replaces the motive power every later lookup sees; the recorded value
    # stays alongside.
    motive = quote(engine["field"])
    make_final = "coalesce(pr.target_make, bk.canonical)"
    model_final = f"coalesce(pr.model_canonical, ma.model_canonical, {model})"
    source_hybrid = ", ".join(lit(k) for k in sorted(hybrids["source_hybrid"])) or "NULL"
    resolved = f"coalesce(hy.target, s.{motive})"
    con.execute(f"""
        CREATE OR REPLACE TABLE rows AS
        SELECT s.* REPLACE ({resolved} AS {motive}),
            s.{motive} AS {quote(engine['field'] + SOURCE_SUFFIX)},
            hy.hybrid_type AS hybrid_class,
            hy.confidence AS hybrid_confidence,
            (vs.in_scope = {true} AND st.in_scope = {true}) AS in_scope,
            (st.fleet_entry = {true}) AS fleet_entry,
            st.label AS status_label,
            CASE WHEN s.registration_year IS NOT NULL AND s.registration_month BETWEEN 1 AND 12
                 THEN make_date(CAST(s.registration_year AS INTEGER), CAST(s.registration_month AS INTEGER), 1) END AS reg_month,
            bk.canonical AS make_key,
            {make_final} AS make_final,
            {model_final} AS model_final,
            CASE WHEN eng.key IS NULL THEN NULL ELSE eng.flag = {true} END AS has_engine,
            {number} AS fc_value,
            CASE WHEN {fuel} IS NULL THEN 'missing'
                 WHEN {number} IS NULL THEN 'parse_failure'
                 WHEN {number} <= {float(fc['valid_min_exclusive'])} OR {number} > {float(fc['valid_max_inclusive'])} THEN 'out_of_range'
                 ELSE 'valid' END AS fc_status
        FROM src s
        JOIN ref_vehicle_scope vs ON s.{quote(vehicle['field'])} = vs.key
        JOIN ref_status st ON s.{quote(status['field'])} = st.key
        LEFT JOIN ref_brand_keys bk ON {make} = bk.key
        LEFT JOIN ref_model_alias ma ON ma.make = bk.canonical AND ma.model_key = {model}
        LEFT JOIN ref_promotion pr ON pr.make = bk.canonical AND pr.model_key = {model} AND {matches('pr')}
        LEFT JOIN ref_hybrid hy ON hy.make = {make_final} AND hy.model_key = {model_final}
            AND s.{motive} IN ({source_hybrid}) AND {matches('hy')}
        LEFT JOIN ref_engine eng ON {resolved} = eng.key
    """)
