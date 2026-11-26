"""Dimension derivations, driven by the `derive` block of each dimension in config/dimensions.json.

Kinds:
  lookup        field value -> reference key column -> reference value column; or, with `keys`, several fields together
                -> reference key columns -> reference value column
  range_lookup  several fields -> reference key columns, plus a numeric field inside an optional range
  brand         normalised make -> a brand_registry column
  raw           the source value itself
  band          a number (a field, or `from` minus `minus`) -> labelled bands
  model         MAKE|MODEL after brand overrides, capped by trailing volume
  series        published monthly counts of a supplied source of kind series (pipeline/series.py builds it, not this file)
"""

from __future__ import annotations

from dataclasses import dataclass, field

from . import normalise, privacy, reference, supplied
from .contract import MODEL_KEY_SEPARATOR, OTHER, UNDEFINED, UNMAPPED
from .normalise import SOURCE_SUFFIX, lit
from .reference import quote

SNAPSHOT_YEAR = "snapshot_year"
# The derive kind whose values are series of a supplied source of kind series, not fields of the register.
SERIES_KIND = "series"


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


def lookup_keys(spec: dict, who: str) -> dict[str, str]:
    """The fields a lookup reads, each with the reference column it is matched against, in order. A block names them one of two
    ways: `keys`, a map of field to reference column (one or more), or `field` with `key` (one). Naming them both ways, or
    neither, is a configuration error: a build does not guess which was meant."""
    found = {k for k in ("keys", "field", "key") if k in spec}
    if found == {"keys"} and isinstance(spec["keys"], dict) and spec["keys"]:
        return dict(spec["keys"])
    if found == {"field", "key"}:
        return {spec["field"]: spec["key"]}
    raise ValueError(f"{who}: a lookup names its fields with `keys` (a map of field to reference column, at least "
                     f"one) or with `field` and `key`, and not both ways; this block has {sorted(found) or 'neither'}")


def references_for(cfg, spec: dict) -> list[str]:
    if spec["kind"] in ("lookup", "range_lookup"):
        return [spec["reference"]]
    if spec["kind"] in ("brand", "model"):
        return [cfg.pipeline["brand"]["registry"], cfg.pipeline["brand"]["model_registry"]]
    if spec["kind"] == SERIES_KIND:
        return sorted({v["label"]["from"] for v in spec["values"]})
    return []


def needed_fields(cfg, spec: dict) -> set[str]:
    """The logical source fields a derive block reads."""
    kind, b = spec["kind"], cfg.pipeline["brand"]
    if kind == "lookup":
        return set(lookup_keys(spec, "a lookup block"))
    if kind == "raw":
        return {spec["field"]}
    if kind == "range_lookup":
        return {*spec["keys"], spec["range_field"]}
    if kind in ("brand", "model"):
        return {b["make_field"], b["model_field"]}
    if kind == "band":
        needs = {spec["field"]} if "field" in spec else {spec["minus"]} | ({spec["from"]} - {SNAPSHOT_YEAR})
        if spec.get("no_engine"):
            needs.add(cfg.pipeline["engine"]["field"])
        return needs
    return set()


def carried_fields(cfg, dataset: str) -> set[str] | None:
    """The logical fields a dataset's source carries, or None for the register, which carries them all."""
    source = cfg.pipeline["datasets"].get(dataset, {}).get("source")
    if source is None:
        return None
    s = cfg.supplied(source)
    if "fields" not in s:
        # A source of published series carries no vehicle's fields.
        return set()
    return {*s["fields"], *s.get("extra_fields", {}), s["year_field"], s["month_field"], s["row_id_field"]}


def extra_fields_read(cfg, source_id: str) -> list[str]:
    """The logical names of a supplied source's `extra_fields` that some dimension's derive block reads, in the order the source
    lists them. The build carries these into `src` beside the register's fields and no others: an extra field nothing reads
    (the dashboard's vehicle status) stays in the store."""
    s = cfg.supplied(source_id)
    read = set().union(*(needed_fields(cfg, d["derive"]) for d in cfg.dimensions["dimensions"] if "derive" in d))
    return [name for name in s.get("extra_fields", {}) if name in read]


def series_dimension_problems(cfg) -> list[str]:
    """A dimension of the series kind reads no register field, so `applicable` would offer it to every dataset that names
    no `applies_to`. It has to name the datasets it is for, and each of those that is configured must read a source of
    kind series."""
    datasets, problems = cfg.pipeline["datasets"], []
    for dim in cfg.dimensions["dimensions"]:
        if dim.get("derive", {}).get("kind") != SERIES_KIND:
            continue
        named = dim.get("applies_to")
        if not named:
            problems.append(f"dimension {dim['id']} derives from a published series, so it must name the datasets it is for in "
                            "applies_to (config/dimensions.json); without it every dataset would be offered it")
            continue
        wrong = [d for d in named if d in datasets and not (
            "source" in datasets[d] and cfg.supplied(datasets[d]["source"]).get("kind") == supplied.SERIES)]
        if wrong:
            problems.append(f"dimension {dim['id']} derives from a published series but applies_to names {wrong}, which do not "
                            "read a supplied source of kind series")
    return problems


def applicable(cfg, dataset: str) -> tuple[list[dict], dict[str, str]]:
    """The dimensions a dataset can derive and why each of the others cannot. A dataset that lists its `dimensions` in
    config/pipeline.json is offered those and no others. A dimension that reads a field describing the vehicle as at the
    snapshot (the data map's `stock_only`, D-135) is offered to a dataset that is a stock and to no other, whatever its
    `applies_to` says."""
    dims, not_live = [], {}
    carried = carried_fields(cfg, dataset)
    spec = cfg.pipeline["datasets"].get(dataset, {})
    offered, stock = spec.get("dimensions"), bool(spec.get("stock"))
    held = privacy.stock_only_dimensions(cfg)
    for dim in cfg.dimensions["dimensions"]:
        applies = dim.get("applies_to")
        lacking = sorted(needed_fields(cfg, dim["derive"]) - carried) if carried is not None and "derive" in dim else []
        if applies is not None and dataset not in applies:
            not_live[dim["id"]] = "does not apply to this dataset"
        elif dim["id"] in held and not stock:
            not_live[dim["id"]] = "reads a field that describes the vehicle as at the snapshot, which only a stock dataset counts"
        elif offered is not None and dim["id"] not in offered:
            not_live[dim["id"]] = "not offered to this dataset (its dimensions in config/pipeline.json)"
        elif lacking:
            not_live[dim["id"]] = "the source does not carry " + ", ".join(cfg.pipeline["fields"].get(f, f) for f in lacking)
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
        keys = lookup_keys(spec, f"dimension {dim_id}")
        key_fields, key_cols = list(keys), list(keys.values())
        rows = reference.read(cfg.reference(spec["reference"]))
        reference.require_unique([r[key_cols[0]] if len(key_cols) == 1 else tuple(r[c] for c in key_cols) for r in rows],
                                 spec["reference"])
        table = f"ref_dim_{index}"
        columns = [f"k{i}" for i in range(len(key_cols))] + ["value"]
        reference.register(con, table, columns, [tuple(r[c] for c in key_cols) + (r[spec["value"]],) for r in rows])
        match = " AND ".join(f"{_field(f)} = {alias}.k{i}" for i, f in enumerate(key_fields))
        any_null = " OR ".join(f"{_field(f)} IS NULL" for f in key_fields)
        return Derived(
            dim_id, kind,
            f"CASE WHEN {any_null} THEN {lit(UNDEFINED)} WHEN {alias}.k0 IS NULL THEN {lit(UNMAPPED)} ELSE {alias}.value END",
            f"(NOT ({any_null}) AND {alias}.k0 IS NULL)",
            [f"LEFT JOIN {table} {alias} ON {match}"],
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


def build_dims(con, cfg, derived: list[Derived], scope: str | None = None, stock_month=None) -> None:
    """One row per vehicle the dataset's scope counts, with every derived dimension value and unmapped flag. `scope` is
    the flag of `rows` that decides which vehicle types are in (normalise.scope_flag): the default scope when none is given.
    Every scope flag stays a column, so a dataset's `require` can name its own.

    A stock (`stock_month` given, D-135) counts every vehicle of the register, whatever its type, status or date, as at that
    month: its period column `reg_month` is that month for every row, so the counting code that groups by period gives it one
    period, and no vehicle's own month of first registration reaches any file of the dataset."""
    p = cfg.pipeline
    scopes = list(normalise.scope_columns(cfg))
    scope = scope or scopes[0]
    alt = p["alternative_fuel"]
    joins: list[str] = []
    for d in derived:
        joins += [j for j in d.joins if j not in joins]
    # The alternative fuel is compared with the motive power NZTA recorded, before any model_registry override.
    primary = alt["primary"] + (SOURCE_SUFFIX if alt["primary"] == p["engine"]["field"] else "")
    columns = [
        *(f"r.{quote(flag)}" for flag in scopes), "r.fleet_entry", "r.status_label",
        "r.reg_month" if stock_month is None else f"DATE {lit(stock_month.isoformat())} AS reg_month",
        "r.registration_year", "r.vehicle_year",
        "r.has_engine", "r.fc_value", "r.fc_status",
        f"{_field(primary)} AS fuel_primary", f"{_field(alt['alternative'])} AS fuel_alternative",
    ]
    for d in derived:
        columns += [f"{d.expr} AS {d.column}", f"{d.unmapped} AS {d.unmapped_column}"]
        if d.kind == "band":
            columns += [
                f"{d.band_value} AS {quote(f'bv__{d.dim_id}')}",
                f"{_field(d.band_source + '__missing')} AS {quote(f'bm__{d.dim_id}')}",
                f"{_field(d.band_source + '__sentinel')} AS {quote(f'bs__{d.dim_id}')}",
            ]
    where = "TRUE" if stock_month is not None else f"r.{quote(scope)}"
    con.execute(f"CREATE OR REPLACE TABLE dims AS SELECT {', '.join(columns)} FROM rows r {' '.join(joins)} WHERE {where}")


def undivide_hybrids(con, cfg, derived: list[Derived]) -> list[str]:
    """Count a dataset's mild hybrids under the undivided powertrain, for a dataset that does not publish the split
    (config/pipeline.json, hybrid_classification). The dimensions it changes are those that look up the motive power in
    the powertrain reference and return its powertrain column, found from config, not named here. Returns their ids."""
    h, engine = cfg.pipeline["hybrid_classification"], cfg.pipeline["engine"]
    specs = {d["id"]: d["derive"] for d in cfg.dimensions["dimensions"] if "derive" in d}
    changed = []
    for d in derived:
        spec = specs[d.dim_id]
        if (spec["kind"] == "lookup" and list(lookup_keys(spec, f"dimension {d.dim_id}")) == [engine["field"]]
                and spec["reference"] == engine["reference"] and spec["value"] == h["powertrain_column"]):
            con.execute(f"UPDATE dims SET {d.column} = {lit(h['undivided_powertrain'])} "
                        f"WHERE {d.column} = {lit(h['mild_powertrain'])}")
            changed.append(d.dim_id)
    return changed


def apply_model_cap(con, d: Derived, dataset_filter: str, window_start, snapshot_month) -> dict:
    # `key` in the ORDER BY breaks a tie at the cap, and sorts as bytes: DuckDB's default collation, which no code here
    # changes and a test holds (docs/CUBE_SCHEMA.md, Ties at the cap).
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
