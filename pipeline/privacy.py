"""Which dimensions read an owner field, and the user's rule for publishing them (config/data_map.json `owner_rule`).

The data map says which source fields describe or locate the owner (`owner_groups`) and, for each kind of derivation,
which fields it reads without naming them (`derive_reads`). From those, this module says which of the dimensions in
`config/dimensions.json` are owner dimensions, so the build can protect their slices without naming one (design
invariant 1). The same reading is what `pipeline/tests/test_data_map.py` holds the published outputs to.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

REGISTER = "register"


class DataMapError(ValueError):
    """config/data_map.json cannot be read the way the pipeline needs; a build must not guess."""


def load_map(cfg) -> dict:
    return json.loads(cfg.path("data_map").read_text(encoding="utf-8"))


def strings(node) -> set[str]:
    """Every string value and object key anywhere in a derive block."""
    if isinstance(node, str):
        return {node}
    if isinstance(node, dict):
        found = set(node)
        for value in node.values():
            found |= strings(value)
        return found
    if isinstance(node, list):
        found = set()
        for value in node:
            found |= strings(value)
        return found
    return set()


def resolve(pipeline: dict, item: str) -> set[str]:
    """The logical field names a `derive_reads` item stands for: a logical name, or a dotted path into pipeline.json."""
    logical = set(pipeline["fields"])
    if "." not in item:
        if item not in logical:
            raise DataMapError(f"data_map derive_reads names {item!r}, which is not a logical field of pipeline.json")
        return {item}
    node = pipeline
    for part in item.split("."):
        if not (isinstance(node, dict) and part in node):
            raise DataMapError(f"data_map derive_reads path {item!r} is not in pipeline.json")
        node = node[part]
    found = ({node} if isinstance(node, str) else set(node)) & logical
    if not found:
        raise DataMapError(f"data_map derive_reads path {item!r} names no logical field of pipeline.json")
    return found


def fields_read(dim: dict, pipeline: dict, reads: dict) -> set[str]:
    """The register field names a dimension's derivation reads."""
    derive = dim["derive"]
    logical = strings(derive) & set(pipeline["fields"])
    for item in reads["by_kind"].get(derive["kind"], []):
        logical |= resolve(pipeline, item)
    for flag, items in reads["by_flag"].items():
        if derive.get(flag):
            for item in items:
                logical |= resolve(pipeline, item)
    # Fields read because another field is read (the hybrid classification rewrites motive power from make and model).
    for key, items in reads.get("by_field", {}).items():
        if resolve(pipeline, key) & logical:
            for item in items:
                logical |= resolve(pipeline, item)
    return {pipeline["fields"][f] for f in logical}


def owner_fields(dmap: dict) -> set[str]:
    """The register fields the map puts in an owner group."""
    groups = set(dmap["owner_groups"])
    return {e["name"] for e in dmap["fields"] if e["source"] == REGISTER and e["group"] in groups}


def dimensions_reading(cfg, dmap: dict, fields: set[str]) -> dict[str, list[str]]:
    """Each dimension of config/dimensions.json that reads any of `fields`, with the ones it reads. A dimension that reads
    none is not here; whatever a dimension reads is decided by its derive block and the map's `derive_reads`."""
    found = {}
    for dim in cfg.dimensions["dimensions"]:
        if "derive" not in dim:
            continue
        read = sorted(fields_read(dim, cfg.pipeline, dmap["derive_reads"]) & fields)
        if read:
            found[dim["id"]] = read
    return found


def owner_dimensions(cfg, dmap: dict | None = None) -> dict[str, list[str]]:
    """Each dimension of config/dimensions.json that reads an owner field, with the owner fields it reads."""
    dmap = dmap if dmap is not None else load_map(cfg)
    return dimensions_reading(cfg, dmap, owner_fields(dmap))


def stock_only_fields(dmap: dict) -> set[str]:
    """The register fields the map marks `stock_only`: they describe the vehicle as it is at the snapshot, so a count of them
    by the month a vehicle was first registered would misread them (D-135)."""
    return {e["name"] for e in dmap["fields"] if e["source"] == REGISTER and e.get("stock_only") is True}


def stock_only_dimensions(cfg, dmap: dict | None = None) -> dict[str, list[str]]:
    """Each dimension that reads a `stock_only` field, with the fields it reads. Such a dimension is built for a dataset that
    is a stock and for no other."""
    dmap = dmap if dmap is not None else load_map(cfg)
    return dimensions_reading(cfg, dmap, stock_only_fields(dmap))


@dataclass(frozen=True)
class SmallCellRule:
    """The user's rule for an owner field in a table of one field (D-096) and the second rule that limits what a total
    gives away of a hidden cell (D-127). All three numbers are data in `owner_rule`."""

    minimum: int
    hidden_cells: int
    hidden_vehicles: int


def small_cell_rule(dmap: dict) -> SmallCellRule:
    rule = dmap["owner_rule"]
    second = rule.get("second_rule") or {}
    try:
        found = SmallCellRule(int(rule["minimum_count"]), int(second["minimum_hidden_cells"]),
                              int(second["minimum_hidden_vehicles"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise DataMapError(f"data_map owner_rule has no usable minimum_count and second_rule ({exc!r})") from exc
    # A hidden group smaller than the minimum would let a total point at one vehicle; one cell hides nothing.
    if found.minimum < 2 or found.hidden_cells < 2 or found.hidden_vehicles < found.minimum:
        raise DataMapError(f"data_map owner_rule is too weak to protect a cell: {found}")
    return found


def pair_cell_rule(dmap: dict) -> SmallCellRule:
    """The numbers of the rule for a table of two fields, one an owner field (D-135): the same minimum count as for one
    field, and the least a line of the table may hide, with its own numbers in `owner_rule.pair_rule`. The same strength
    tests apply as for a slice."""
    rule = dmap["owner_rule"]
    pair = rule.get("pair_rule") or {}
    try:
        found = SmallCellRule(int(rule["minimum_count"]), int(pair["minimum_hidden_cells_per_line"]),
                              int(pair["minimum_hidden_vehicles_per_line"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise DataMapError(f"data_map owner_rule has no usable minimum_count and pair_rule ({exc!r})") from exc
    if found.minimum < 2 or found.hidden_cells < 2 or found.hidden_vehicles < found.minimum:
        raise DataMapError(f"data_map owner_rule.pair_rule is too weak to protect a cell: {found}")
    return found


# --- the floor under a field that says what kind of owner, never where the owner is (config/data_map.json) -------------------


DASHBOARD = "dashboard"


def groups_named(dmap: dict, key: str) -> set[str]:
    """The map's list of groups under `key` (`owner_groups`, `kind_of_owner_groups`), each a group the map defines."""
    named = dmap.get(key)
    if not isinstance(named, list) or not all(isinstance(g, str) for g in named):
        raise DataMapError(f"data_map {key} must be a list of group names")
    unknown = sorted(set(named) - set(dmap["enums"]["group"]))
    if unknown:
        raise DataMapError(f"data_map {key} names {unknown}, which are not in enums.group")
    return set(named)


def dashboard_columns(cfg) -> dict[str, str]:
    """The logical name a dimension's derive block uses for each column of a supplied source's export, with the column: every
    entry of `fields` and `extra_fields` of every supplied source that counts rows (config/pipeline.json, supplied). The private
    columns are not here: they are checked and dropped, so no dimension can read one."""
    found: dict[str, str] = {}
    for source in cfg.pipeline.get("supplied", {}).values():
        if isinstance(source, dict):
            found.update(source.get("fields", {}))
            found.update(source.get("extra_fields", {}))
    return found


def names_in_groups(dmap: dict, groups: set[str], source: str) -> set[str]:
    """The names of the map's entries of one source (`register` or `dashboard`) that are in one of `groups`."""
    return {e["name"] for e in dmap["fields"] if e["source"] == source and e["group"] in groups}


def dimensions_in_groups(cfg, dmap: dict, groups: set[str]) -> dict[str, list[str]]:
    """Each dimension of config/dimensions.json that reads a field the map puts in one of `groups`, with the fields it reads.
    The field is a register field, found as `dimensions_reading` finds it, or a column of a supplied export, found by the
    logical name its derive block gives it (`dashboard_columns`)."""
    register, exports = names_in_groups(dmap, groups, REGISTER), names_in_groups(dmap, groups, DASHBOARD)
    columns = dashboard_columns(cfg)
    found = {}
    for dim in cfg.dimensions["dimensions"]:
        if "derive" not in dim:
            continue
        read = sorted((fields_read(dim, cfg.pipeline, dmap["derive_reads"]) & register)
                      | ({columns[f] for f in strings(dim["derive"]) & set(columns)} & exports))
        if read:
            found[dim["id"]] = read
    return found


def floor_problems(cfg, dmap: dict | None = None) -> list[str]:
    """Where config/pipeline.json puts a field that says what kind of owner (the map's `kind_of_owner_groups`) in one table with a
    field that says where the owner lives or describes the owner (its `owner_groups`): a pair, a fact table, a narrow fact table,
    or the committed snapshot aggregate. A slice holds one field and cannot cross them. This is the floor under the user's
    direction that buyer type be published in full (`owner_rule`): it is never shown beside a district, a region or any other
    owner field, and the owner fields still never reach a fact table (build.fact_table_owner_problems).

    Which dimensions read which fields is worked out from the map and the derive blocks, so no dimension is named here. Returns
    sentences, empty when the floor holds."""
    dmap = dmap if dmap is not None else load_map(cfg)
    kind_groups, owner_groups = groups_named(dmap, "kind_of_owner_groups"), groups_named(dmap, "owner_groups")
    if kind_groups & owner_groups:
        raise DataMapError(f"data_map puts {sorted(kind_groups & owner_groups)} in both kind_of_owner_groups and owner_groups")
    kind = dimensions_in_groups(cfg, dmap, kind_groups)
    owner = dimensions_in_groups(cfg, dmap, owner_groups)
    tables = []
    for dataset, spec in cfg.pipeline["datasets"].items():
        tables += [(f"{dataset}: pair {pair!r}", pair) for pair in spec.get("pairs") or []]
        tables.append((f"{dataset}: facts", spec.get("facts")))
        for table in spec.get("narrow_facts") if isinstance(spec.get("narrow_facts"), list) else []:
            if isinstance(table, dict):
                tables.append((f"{dataset}: narrow_facts '{table.get('id')}'", table.get("dimensions")))
    problems = []
    for label, listed in tables:
        listed = listed if isinstance(listed, list) else []
        kinds, owners = [d for d in listed if d in kind], [d for d in listed if d in owner]
        if kinds and owners:
            problems.append(
                f"{label} puts {', '.join(kinds)} (which says what kind of owner) with {', '.join(owners)} (which reads "
                f"{', '.join(sorted({f for d in owners for f in owner[d]}))}, a field that describes or locates the owner). "
                "A kind of owner is never published beside where the owner lives (owner_rule in config/data_map.json); "
                "remove one of them from this table in config/pipeline.json")
    # The snapshot aggregate is a table too: its group_by names logical fields, not dimensions.
    grouped = set(cfg.pipeline.get("snapshot_archive", {}).get("group_by", []))
    columns = dashboard_columns(cfg)
    register = {cfg.pipeline["fields"][f] for f in grouped if f in cfg.pipeline["fields"]}
    exports = {columns[f] for f in grouped if f in columns}
    held_kind = (register & names_in_groups(dmap, kind_groups, REGISTER)) | (exports & names_in_groups(dmap, kind_groups, DASHBOARD))
    held_owner = (register & names_in_groups(dmap, owner_groups, REGISTER)) | (exports & names_in_groups(dmap, owner_groups, DASHBOARD))
    if held_kind and held_owner:
        problems.append(f"snapshot_archive.group_by puts {sorted(held_kind)} (what kind of owner) with {sorted(held_owner)} "
                        "(where or who the owner is); remove one in config/pipeline.json")
    return problems


# --- the dashboard columns the map holds back: never stored, whatever config says ------------------------------------------


def squash(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def held_columns(dmap: dict) -> set[str]:
    """The dashboard export's columns that the data map holds back: those whose privacy class is not a published one, or whose
    group describes or locates the owner. `supply` checks and drops them; no store, ledger or output carries one."""
    published = {n for n, spec in dmap["privacy_classes"].items() if spec["published"]}
    owner = groups_named(dmap, "owner_groups")
    return {e["name"] for e in dmap["fields"]
            if e["source"] == DASHBOARD and (e["privacy"] not in published or e["group"] in owner)}


def held_names(cfg, dmap: dict) -> set[str]:
    """Every name a held column could carry in a stored file: its own, the register field it mirrors, the logical name config gives
    that field, and the place a roll-up of it leads to."""
    logical = {v: k for k, v in cfg.pipeline["fields"].items()}
    held = held_columns(dmap)
    names = set()
    for entry in dmap["fields"]:
        if entry["source"] != DASHBOARD or entry["name"] not in held:
            continue
        names.add(entry["name"])
        for field in entry.get("register_fields", []):
            names.update({field, logical.get(field, field)})
        names.update(r["to"] for r in entry["relations"]["rolls_up_to"])
    return {n for n in names if n}
