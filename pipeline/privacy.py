"""Which dimensions read an owner field, and the user's rule for publishing them (config/data_map.json `owner_rule`).

The data map says which source fields describe or locate the owner (`owner_groups`) and, for each kind of derivation,
which fields it reads without naming them (`derive_reads`). From those, this module says which of the dimensions in
`config/dimensions.json` are owner dimensions, so the build can protect their slices without naming one (design
invariant 1). The same reading is what `pipeline/tests/test_data_map.py` holds the published outputs to.
"""

from __future__ import annotations

import json
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


def owner_dimensions(cfg, dmap: dict | None = None) -> dict[str, list[str]]:
    """Each dimension of config/dimensions.json that reads an owner field, with the owner fields it reads. A dimension
    that reads none is not here; whatever a dimension reads is decided by its derive block and the map's `derive_reads`."""
    dmap = dmap if dmap is not None else load_map(cfg)
    owners = owner_fields(dmap)
    found = {}
    for dim in cfg.dimensions["dimensions"]:
        if "derive" not in dim:
            continue
        read = sorted(fields_read(dim, cfg.pipeline, dmap["derive_reads"]) & owners)
        if read:
            found[dim["id"]] = read
    return found


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
