"""Dimension derivations, driven by the `derive` block of each dimension in config/dimensions.json.

Kinds:
  lookup        field value -> reference key column -> reference value column
  range_lookup  several fields -> reference key columns, plus a numeric field inside an optional range
  brand         normalised make -> a brand_registry column
  raw           the source value itself
  band          a number (a field, or `from` minus `minus`) -> labelled bands
  model         MAKE|MODEL after brand overrides, capped by trailing volume
"""

from __future__ import annotations

from dataclasses import dataclass, field

from . import reference
from .contract import MODEL_KEY_SEPARATOR, OTHER, UNDEFINED, UNMAPPED
from .normalise import lit
from .reference import quote

SNAPSHOT_YEAR = "snapshot_year"


@dataclass
class Derived:
    dim_id: str
    kind: str
    expr: str
    unmapped: str
    joins: list[str]
    vocabulary: set[str] | None
    band_value: str | None = None
    band_source: str | None = None
    band_unknown: str | None = None
    cap: int | None = None
    extra: dict = field(default_factory=dict)

    @property
    def column(self) -> str:
        return quote(f"d__{self.dim_id}")

    @property
    def unmapped_column(self) -> str:
        return quote(f"u__{self.dim_id}")


def references_for(cfg, spec: dict) -> list[str]:
    if spec["kind"] in ("lookup", "range_lookup"):
        return [spec["reference"]]
    if spec["kind"] in ("brand", "model"):
        return [cfg.pipeline["brand"]["registry"], cfg.pipeline["brand"]["model_registry"]]
    return []


def applicable(cfg, dataset: str) -> tuple[list[dict], dict[str, str]]:
    dims, not_live = [], {}
    for dim in cfg.dimensions["dimensions"]:
        applies = dim.get("applies_to")
        if applies is not None and dataset not in applies:
            not_live[dim["id"]] = "does not apply to this dataset"
        elif "derive" not in dim:
            not_live[dim["id"]] = "no derive block in dimensions.json"
        else:
            dims.append(dim)
    return dims, not_live


def _field(name: str) -> str:
    return f"r.{quote(name)}"


def derive(con, cfg, dim: dict, index: int, snapshot_year: int) -> Derived:
    spec, dim_id, alias = dim["derive"], dim["id"], f"j{index}"
    kind = spec["kind"]

    if kind == "lookup":
        rows = reference.read(cfg.reference(spec["reference"]))
        reference.require_unique([r[spec["key"]] for r in rows], spec["reference"])
        table = f"ref_dim_{index}"
        reference.register(con, table, ["key", "value"], [(r[spec["key"]], r[spec["value"]]) for r in rows])
        f = _field(spec["field"])
        return Derived(
            dim_id, kind,
            f"CASE WHEN {f} IS NULL THEN {lit(UNDEFINED)} WHEN {alias}.key IS NULL THEN {lit(UNMAPPED)} ELSE {alias}.value END",
            f"({f} IS NOT NULL AND {alias}.key IS NULL)",
            [f"LEFT JOIN {table} {alias} ON {f} = {alias}.key"],
            {r[spec["value"]] for r in rows},
        )

    if kind == "range_lookup":
        rows = reference.read(cfg.reference(spec["reference"]))
        key_fields = list(spec["keys"].keys())
        key_cols = [spec["keys"][f] for f in key_fields]
        lo, hi = spec["range_min"], spec["range_max"]
        reference.validate_ranges(rows, key_cols, lo, hi, spec["reference"])
        table = f"ref_dim_{index}"
        columns = [f"k{i}" for i in range(len(key_cols))] + ["lo", "hi", "value"]
        reference.register(con, table, columns, [
            tuple(r[c] for c in key_cols) + (r[lo] or None, r[hi] or None, r[spec["value"]]) for r in rows
        ])
        con.execute(f"CREATE OR REPLACE TABLE {table}_keys AS SELECT {', '.join(columns[:len(key_cols)])}, "
                    f"bool_or(lo IS NOT NULL OR hi IS NOT NULL) AS ranged FROM {table} GROUP BY ALL")
        g = _field(spec["range_field"])
        match_keys = " AND ".join(f"{_field(f)} = {alias}.k{i}" for i, f in enumerate(key_fields))
        key_keys = " AND ".join(f"{_field(f)} = {alias}k.k{i}" for i, f in enumerate(key_fields))
        any_null = " OR ".join(f"{_field(f)} IS NULL" for f in key_fields)
        range_undefined = f"coalesce({alias}k.ranged AND {g} IS NULL, FALSE)"
        return Derived(
            dim_id, kind,
            f"CASE WHEN {any_null} THEN {lit(UNDEFINED)} WHEN {alias}.value IS NOT NULL THEN {alias}.value "
            f"WHEN {range_undefined} THEN {lit(UNDEFINED)} ELSE {lit(UNMAPPED)} END",
            f"(NOT ({any_null}) AND {alias}.value IS NULL AND NOT {range_undefined})",
            [
                f"LEFT JOIN {table} {alias} ON {match_keys} AND (({alias}.lo IS NULL AND {alias}.hi IS NULL) "
                f"OR {g} BETWEEN CAST({alias}.lo AS BIGINT) AND CAST({alias}.hi AS BIGINT))",
                f"LEFT JOIN {table}_keys {alias}k ON {key_keys}",
            ],
            {r[spec["value"]] for r in rows},
        )

    if kind == "brand":
        b = cfg.pipeline["brand"]
        rows = reference.read(cfg.reference(b["registry"]))
        make = _field(b["make_field"])
        return Derived(
            dim_id, kind,
            f"CASE WHEN {make} IS NULL THEN {lit(UNDEFINED)} WHEN r.make_key IS NULL THEN {lit(UNMAPPED)} "
            f"ELSE rb.{quote(spec['value'])} END",
            f"({make} IS NOT NULL AND r.make_key IS NULL)",
            [f"LEFT JOIN ref_brand rb ON rb.{quote(b['canonical'])} = r.make_final"],
            {r[spec["value"]] for r in rows},
        )

    if kind == "raw":
        f = _field(spec["field"])
        return Derived(dim_id, kind, f"coalesce(CAST({f} AS VARCHAR), {lit(UNDEFINED)})", "FALSE", [], None)

    if kind == "band":
        bands = dim["bands"]
        if "field" in spec:
            value, source = _field(spec["field"]), spec["field"]
        else:
            start = str(int(snapshot_year)) if spec["from"] == SNAPSHOT_YEAR else _field(spec["from"])
            value, source = f"({start} - {_field(spec['minus'])})", spec["minus"]
        unknown = next(b["label"] for b in bands if b.get("unknown"))
        whens = []
        if spec.get("no_engine"):
            none_label = next(b["label"] for b in bands if b.get("no_engine"))
            whens.append(f"WHEN r.has_engine = FALSE THEN {lit(none_label)}")
        whens.append(f"WHEN {value} IS NULL THEN {lit(unknown)}")
        for band in bands:
            if "min" not in band:
                continue
            cond = f"{value} >= {int(band['min'])}"
            if band["max"] is not None:
                cond += f" AND {value} <= {int(band['max'])}"
            whens.append(f"WHEN {cond} THEN {lit(band['label'])}")
        return Derived(
            dim_id, kind, f"CASE {' '.join(whens)} ELSE {lit(unknown)} END", "FALSE", [],
            {b["label"] for b in bands}, band_value=value, band_source=source, band_unknown=unknown,
        )

    if kind == "model":
        b = cfg.pipeline["brand"]
        make = _field(b["make_field"])
        return Derived(
            dim_id, kind,
            f"CASE WHEN {make} IS NULL OR r.model_final IS NULL THEN {lit(UNDEFINED)} "
            f"ELSE coalesce(r.make_final, {make}) || {lit(MODEL_KEY_SEPARATOR)} || r.model_final END",
            "FALSE", [], None, cap=int(spec["cap"]),
        )

    raise ValueError(f"dimension {dim_id}: unknown derive kind {kind!r}")


def build_dims(con, cfg, derived: list[Derived]) -> None:
    """One row per in-scope vehicle, with every derived dimension value and unmapped flag."""
    p = cfg.pipeline
    alt = p["alternative_fuel"]
    joins: list[str] = []
    for d in derived:
        joins += [j for j in d.joins if j not in joins]
    columns = [
        "r.in_scope", "r.fleet_entry", "r.status_label", "r.reg_month", "r.registration_year", "r.vehicle_year",
        "r.has_engine", "r.fc_value", "r.fc_status",
        f"{_field(alt['primary'])} AS fuel_primary", f"{_field(alt['alternative'])} AS fuel_alternative",
    ]
    for d in derived:
        columns += [f"{d.expr} AS {d.column}", f"{d.unmapped} AS {d.unmapped_column}"]
        if d.kind == "band":
            columns += [
                f"{d.band_value} AS {quote(f'bv__{d.dim_id}')}",
                f"{_field(d.band_source + '__missing')} AS {quote(f'bm__{d.dim_id}')}",
                f"{_field(d.band_source + '__sentinel')} AS {quote(f'bs__{d.dim_id}')}",
            ]
    con.execute(f"CREATE OR REPLACE TABLE dims AS SELECT {', '.join(columns)} FROM rows r {' '.join(joins)} WHERE r.in_scope")


def apply_model_cap(con, d: Derived, dataset_filter: str, window_start, snapshot_month) -> dict:
    col = d.column
    undefined = lit(UNDEFINED)
    con.execute(f"""
        CREATE OR REPLACE TABLE model_keep AS
        SELECT {col} AS key FROM dims
        WHERE {dataset_filter} AND reg_month BETWEEN ? AND ? AND {col} <> {undefined}
        GROUP BY 1 ORDER BY count(*) DESC, key LIMIT {d.cap}
    """, [window_start, snapshot_month])
    trailing, all_time = con.execute(f"""
        SELECT
            count(*) FILTER (WHERE reg_month BETWEEN ? AND ? AND {col} IN (SELECT key FROM model_keep))
                / nullif(count(*) FILTER (WHERE reg_month BETWEEN ? AND ?), 0),
            count(*) FILTER (WHERE {col} IN (SELECT key FROM model_keep)) / nullif(count(*), 0)
        FROM dims WHERE {dataset_filter}
    """, [window_start, snapshot_month, window_start, snapshot_month]).fetchone()
    con.execute(f"UPDATE dims SET {col} = {lit(OTHER)} WHERE {col} <> {undefined} AND {col} NOT IN (SELECT key FROM model_keep)")
    return {
        "cap": d.cap,
        "basis": f"trailing_{cfg_window(window_start, snapshot_month)}_months",
        "coverage_trailing": round(trailing or 0.0, 4),
        "coverage_all_time": round(all_time or 0.0, 4),
    }


def cfg_window(window_start, snapshot_month) -> int:
    return (snapshot_month.year - window_start.year) * 12 + snapshot_month.month - window_start.month + 1
