"""How strongly each pair of a dataset's dimensions moves together, written each build (docs/CUBE_SCHEMA.md, Associations).

The measure is the bias-corrected Cramer's V of Bergsma (2013), from 0 (no association) to 1 (one decides the other):

    phi2    = chi2 / N                                 (chi2 is Pearson's, N the vehicles counted)
    phi2c   = max(0, phi2 - (r - 1)(c - 1) / (N - 1))
    r~      = r - (r - 1)^2 / (N - 1)                  (r rows, c columns, both counted from the vehicles)
    c~      = c - (c - 1)^2 / (N - 1)
    V       = sqrt(phi2c / min(r~ - 1, c~ - 1))

phi2 is computed as the sum over the cells of n^2 / (row total x column total) less 1, which is the same number as
chi2 / N and needs no empty cell. V is not defined where a side has one value, or N is below 2, or min(r~, c~) is not above
1: those pairs are written with a null V and their counts, so a reader can judge them.

The counts of a pair are the fact table's, summed over every other dimension: a vehicle counts when both of its values are
recorded, so the reserved not-recorded, unmapped and lumped-together values, and a banded dimension's unknown band, are left
out of the pair they are in. Which pairs are not findings (a field and what is derived from it, a dimension that rolls up to
the other, a pair config/data_map.json lists) is read from config, and a dimension that reads an owner field is in no pair.
No dimension, field or value is named here (design invariant 1).
"""

from __future__ import annotations

import itertools
import json
import math
from typing import NamedTuple

from . import outputs, privacy
from .contract import ASSOCIATIONS_DIR, OTHER, UNDEFINED, UNMAPPED
from .normalise import lit
from .reference import quote

# The reserved values that are not a value of the field a visitor asks about. OTHER is a bucket of many values.
RESERVED = (UNDEFINED, UNMAPPED, OTHER)

ROLLS_UP, LISTED, SAME_FIELD = "rolls_up", "true_by_definition", "same_field"


class Measure(NamedTuple):
    v: float | None
    vehicles: int
    values_a: int
    values_b: int


def cramers_v(cells) -> Measure:
    """V for a table of (row value, column value, vehicles) with every count above zero."""
    rows: dict = {}
    columns: dict = {}
    total = 0
    cells = list(cells)
    for a, b, n in cells:
        rows[a] = rows.get(a, 0) + n
        columns[b] = columns.get(b, 0) + n
        total += n
    r, c = len(rows), len(columns)
    if total < 2 or r < 2 or c < 2:
        return Measure(None, total, r, c)
    phi2 = math.fsum(n * n / (rows[a] * columns[b]) for a, b, n in cells) - 1.0
    phi2c = max(0.0, phi2 - (r - 1) * (c - 1) / (total - 1))
    r_tilde = r - (r - 1) ** 2 / (total - 1)
    c_tilde = c - (c - 1) ** 2 / (total - 1)
    scale = min(r_tilde - 1, c_tilde - 1)
    if scale <= 0:
        return Measure(None, total, r, c)
    return Measure(math.sqrt(phi2c / scale), total, r, c)


def source_fields(cfg, dim: dict, dmap: dict) -> set[str]:
    """The register fields a dimension is derived from, as its own derive block and the data map name them: the logical
    fields its derive block mentions, and the fields the map binds to the dimension's id. Not the fields it reads only
    indirectly (privacy.fields_read has those)."""
    logical = privacy.strings(dim["derive"]) & set(cfg.pipeline["fields"])
    found = {cfg.pipeline["fields"][f] for f in logical}
    found |= {e["name"] for e in dmap["fields"] if e["source"] == privacy.REGISTER and e.get("bound") == dim["id"]}
    return found


# The derive kinds that read one field and nothing else: a dimension of one of these kinds is "a lookup, a copy or a banding" of
# its field. The site reads the data map's roll-ups the same way (src/lib/nesting.ts, standingFor).
ONE_FIELD_KINDS = ("raw", "lookup", "band")


def standing_for(entry: dict, dimensions: list[dict]) -> list[str]:
    """The dimensions a data map field stands for: the one with its bound name, and any that is a lookup, a copy or a banding of
    that field alone. A dimension read from several fields is not that field, so the field's roll-up does not carry to it."""
    bound = entry.get("bound")
    if not bound:
        return []
    return [d["id"] for d in dimensions
            if d["id"] == bound or (d["derive"].get("field") == bound and d["derive"]["kind"] in ONE_FIELD_KINDS)]


def relations(cfg, dmap: dict, dim_ids: list[str]) -> dict[frozenset, list[dict]]:
    """For each pair of the given dimensions that is not a finding, why. Three kinds, any of which may apply:

    - `rolls_up`: the data map says the field one dimension stands for rolls up to the other (a field it stands for, or the
      dimension's own id), directly or through other dimensions: a model under its make under its parent group.
    - `true_by_definition`: the pair, as dimension ids or as the register fields the dimensions are derived from, is in
      `moves_together.true_by_definition`.
    - `same_field`: both are derived from the same register field.
    """
    dimensions = [d for d in cfg.dimensions["dimensions"] if "derive" in d]
    fields = {d["id"]: source_fields(cfg, d, dmap) for d in dimensions}
    names = {i: fields[i] | {i} for i in dim_ids}
    found: dict[frozenset, list[dict]] = {}

    def add(x: str, y: str, kind: str, basis: str | None) -> None:
        entry = {"kind": kind, "basis": basis}
        known = found.setdefault(frozenset((x, y)), [])
        if entry not in known:
            known.append(entry)

    register = [e for e in dmap["fields"] if e["source"] == privacy.REGISTER]
    by_name = {e["name"]: e for e in register}
    edges: dict[str, dict[str, str]] = {d["id"]: {} for d in dimensions}
    for entry in register:
        for roll in entry["relations"]["rolls_up_to"]:
            # The target is another field of the map, by its name, or a dimension that is not a field of its own, by its id.
            targets = standing_for(by_name[roll["to"]], dimensions) if roll["to"] in by_name else [d["id"] for d in dimensions if d["id"] == roll["to"]]
            for x in standing_for(entry, dimensions):
                for y in targets:
                    if x != y:
                        edges[x].setdefault(y, roll["holds_on"])
    # Rolling up is transitive: a model rolls up to its make, and the make to its parent group.
    for x in dim_ids:
        reached: dict[str, str] = {}
        pending = list(edges[x].items())
        while pending:
            y, basis = pending.pop()
            if y in reached or y == x:
                continue
            reached[y] = basis
            pending += [(z, basis) for z in edges[y]]
        for y, basis in reached.items():
            if y in dim_ids:
                add(x, y, ROLLS_UP, basis)

    for pair in dmap["moves_together"]["true_by_definition"]:
        for x, y in itertools.permutations(dim_ids, 2):
            if pair["a"] in names[x] and pair["b"] in names[y]:
                add(x, y, LISTED, pair["basis"])

    for x, y in itertools.combinations(dim_ids, 2):
        if fields[x] & fields[y]:
            add(x, y, SAME_FIELD, None)

    return {key: sorted(kinds, key=lambda e: (e["kind"], e["basis"] or "")) for key, kinds in found.items()}


def excluded_values(live: dict) -> dict[str, list[str]]:
    """The values left out of each dimension's side of a pair: the reserved ones, and a banded dimension's unknown band."""
    return {i: sorted({*RESERVED, *([d.band_unknown] if d.band_unknown else [])}) for i, d in live.items()}


def month_key(month) -> str:
    return month.strftime("%Y-%m")


def measure_pairs(con, cfg, dim_ids: list[str], live: dict, ds: str, window_start, snapshot_month) -> list[dict]:
    """Every pair of the dimensions, sorted, with its figures in both windows, from the dataset's counts by month and
    dimension (the fact table's rows)."""
    if len(dim_ids) < 2:
        # A table with one live dimension, or none, has no pair to measure.
        return []
    columns = ", ".join(f"{live[i].column} AS {quote(i)}" for i in dim_ids)
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE association_cells AS
        SELECT reg_month, {columns}, CAST(count(*) AS INTEGER) AS n FROM dims WHERE {ds} GROUP BY ALL
    """)
    left_out = excluded_values(live)
    decimals = int(cfg.pipeline["associations"]["decimals"])
    pairs = []
    for a, b in itertools.combinations(sorted(dim_ids), 2):
        qa, qb = quote(a), quote(b)
        skip = " AND ".join(f"{q} NOT IN ({', '.join(lit(v) for v in left_out[i])})" for q, i in ((qa, a), (qb, b)))
        rows = con.execute(f"""
            SELECT {qa}, {qb}, sum(n) AS whole,
                   coalesce(sum(n) FILTER (WHERE reg_month BETWEEN ? AND ?), 0) AS trailing
            FROM association_cells WHERE {skip} GROUP BY 1, 2 ORDER BY 1, 2
        """, [window_start, snapshot_month]).fetchall()
        pair = {"a": a, "b": b}
        for window, position in (("all", 2), ("trailing", 3)):
            m = cramers_v((x[0], x[1], int(x[position])) for x in rows if x[position] > 0)
            pair[window] = {
                "v": None if m.v is None else round(m.v, decimals),
                "vehicles": m.vehicles,
                "values_a": m.values_a,
                "values_b": m.values_b,
            }
        pairs.append(pair)
    con.execute("DROP TABLE association_cells")
    return pairs


def check(doc: dict, dim_ids: list[str]) -> list[str]:
    """The faults in a written file: a pair missing or repeated, or a V outside 0 to 1. A pair on few vehicles is not one."""
    problems = []
    expected = {frozenset(p) for p in itertools.combinations(sorted(dim_ids), 2)}
    seen = [frozenset((p["a"], p["b"])) for p in doc["pairs"]]
    for pair in sorted(expected - set(seen), key=sorted):
        problems.append(f"the pair {' and '.join(sorted(pair))} is missing")
    for pair in sorted({p for p in seen if seen.count(p) > 1}, key=sorted):
        problems.append(f"the pair {' and '.join(sorted(pair))} is written more than once")
    for pair in sorted(set(seen) - expected, key=sorted):
        problems.append(f"the pair {' and '.join(sorted(pair))} is not of the dataset's dimensions")
    for p in doc["pairs"]:
        for window in ("all", "trailing"):
            v = p[window]["v"]
            if v is not None and not 0.0 <= v <= 1.0:
                problems.append(f"{p['a']} and {p['b']}: V is {v} in the {window} window, outside 0 to 1")
    return problems


def write(con, cfg, dataset: str, fact_dims: list[str], live: dict, ds: str, window_start, snapshot_month, first_month,
          protected: dict[str, list[str]], staging, aborts: list[str]) -> dict:
    """The dataset's associations file under staging, read back and checked, and the manifest's entry for it. Dimensions
    that read an owner field (`protected`) are left out of every pair and named in the entry."""
    dmap = privacy.load_map(cfg)
    left_out = {i: "reads an owner field" for i in fact_dims if i in protected}
    dim_ids = sorted(i for i in fact_dims if i not in protected)
    pairs = measure_pairs(con, cfg, dim_ids, live, ds, window_start, snapshot_month)
    marks = relations(cfg, dmap, dim_ids)
    for pair in pairs:
        pair["relation"] = marks.get(frozenset((pair["a"], pair["b"])), [])
    doc = {
        "dataset": dataset,
        "measure": "cramers_v_bias_corrected",
        "decimals": int(cfg.pipeline["associations"]["decimals"]),
        "windows": {
            "all": {"from": month_key(first_month), "to": month_key(snapshot_month)},
            "trailing": {"from": month_key(window_start), "to": month_key(snapshot_month)},
        },
        "dimensions": dim_ids,
        "pairs": pairs,
    }
    path = staging / ASSOCIATIONS_DIR / f"{dataset}.json"
    outputs.write_json(path, doc)
    # Checked on what was written, as the fact table is.
    written = json.loads(path.read_text(encoding="utf-8"))
    aborts += [f"{dataset}: associations: {problem}" for problem in check(written, dim_ids)]
    return {"file": f"{ASSOCIATIONS_DIR}/{dataset}.json", "dimensions": len(dim_ids), "pairs": len(written["pairs"]),
            "not_findings": sum(1 for p in written["pairs"] if p["relation"]), "left_out": left_out}
