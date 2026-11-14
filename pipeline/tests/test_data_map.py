"""The data map (config/data_map.json) covers every source field once and agrees with the pipeline's own config.

The map is what Build, the pipeline and the method page will read to know what a field means, how it may be used and
whether it may be published (CLAUDE.md, the goal's point 8; docs/DATA_MAP.md). These tests keep it whole and keep it
true to config/pipeline.json, config/dimensions.json and data/reference/sentinels.csv, so the map cannot drift from
what the pipeline does. No field value is written here (design invariant #1): every name and value is read from config.
"""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path

import pytest

from pipeline import config, reference

ROOT = Path(__file__).resolve().parent.parent.parent
DATA_MAP = ROOT / "config" / "data_map.json"
DECISIONS = ROOT / "docs" / "DECISIONS.md"

REGISTER = "register"
DASHBOARD = "dashboard"

REQUIRED = {
    "name", "source", "group", "kind", "cardinality", "definition", "uses", "recorded_for", "nothing_means",
    "not_recorded", "privacy", "privacy_reason", "after_review", "bound", "relations",
}
REQUIRED_BY_SOURCE = {REGISTER: {"sentinels_pending"}, DASHBOARD: {"register_fields"}}
RELATION_KEYS = {"rolls_up_to", "derived_from", "follows_vehicle"}
ROLL_UP_KEYS = {"to", "via", "holds_on"}
# A number offered as one of these needs a guard: the register holds placeholder and impossible values (DATA_MAP.md).
GUARDED_MEASURES = {"average", "median", "total"}
ALWAYS_MANY = {"number", "identifier", "free_text"}


def load_map() -> dict:
    return json.loads(DATA_MAP.read_text(encoding="utf-8"))


def entries(dmap: dict, source: str) -> list[dict]:
    return [e for e in dmap["fields"] if e["source"] == source]


def by_name(dmap: dict, source: str) -> dict[str, dict]:
    return {e["name"]: e for e in entries(dmap, source)}


def schema_fields(cfg: config.Config) -> list[str]:
    schema = json.loads(cfg.path("expected_schema").read_text(encoding="utf-8"))
    return [f["name"] for f in schema["fields"]]


def published_classes(dmap: dict) -> set[str]:
    return {name for name, spec in dmap["privacy_classes"].items() if spec["published"]}


# --- which source fields a dimension reads, from its derive block -------------------------------------------------


def _strings(node) -> set[str]:
    """Every string value and object key anywhere in a derive block."""
    if isinstance(node, str):
        return {node}
    if isinstance(node, dict):
        found = set(node)
        for value in node.values():
            found |= _strings(value)
        return found
    if isinstance(node, list):
        found = set()
        for value in node:
            found |= _strings(value)
        return found
    return set()


def _resolve(pipeline: dict, item: str) -> set[str]:
    logical = set(pipeline["fields"])
    if "." not in item:
        assert item in logical, f"data_map derive_reads names {item!r}, which is not a logical field of pipeline.json"
        return {item}
    node = pipeline
    for part in item.split("."):
        assert isinstance(node, dict) and part in node, f"data_map derive_reads path {item!r} is not in pipeline.json"
        node = node[part]
    found = ({node} if isinstance(node, str) else set(node)) & logical
    assert found, f"data_map derive_reads path {item!r} names no logical field of pipeline.json"
    return found


def fields_read(dim: dict, pipeline: dict, reads: dict) -> set[str]:
    """The register field names a dimension's derivation reads."""
    derive = dim["derive"]
    logical = _strings(derive) & set(pipeline["fields"])
    for item in reads["by_kind"].get(derive["kind"], []):
        logical |= _resolve(pipeline, item)
    for flag, items in reads["by_flag"].items():
        if derive.get(flag):
            for item in items:
                logical |= _resolve(pipeline, item)
    return {pipeline["fields"][f] for f in logical}


def privacy_breaches(dmap: dict, pipeline: dict, dimensions: dict) -> list[str]:
    """Every published output (fact table column, pair, slice) whose dimension reads a field not cleared for it."""
    fields = by_name(dmap, REGISTER)
    published = published_classes(dmap)
    dims = {d["id"]: d for d in dimensions["dimensions"] if "derive" in d}
    problems: list[str] = []

    def check(dim_id: str, output: str) -> None:
        for name in sorted(fields_read(dims[dim_id], pipeline, dmap["derive_reads"])):
            entry = fields[name]
            if entry["privacy"] in published:
                continue
            excepted = any(
                x["dimension"] == dim_id and output in x["outputs"] for x in entry.get("published_exceptions", [])
            )
            if not excepted:
                problems.append(f"{output} {dim_id!r} reads {name} ({entry['privacy']})")

    for spec in pipeline["datasets"].values():
        for dim_id in spec.get("facts", []):
            check(dim_id, "facts")
        for pair in spec.get("pairs", []):
            for dim_id in pair:
                check(dim_id, "pair")
    for dim_id in dims:
        check(dim_id, "slice")
    return problems


# --- coverage ------------------------------------------------------------------------------------------------------


def test_every_register_field_has_exactly_one_entry():
    cfg, dmap = config.load(), load_map()
    names = [e["name"] for e in entries(dmap, REGISTER)]
    duplicated = sorted({n for n in names if names.count(n) > 1})
    assert not duplicated, f"fields with more than one entry: {duplicated}"
    schema = set(schema_fields(cfg))
    assert not schema - set(names), f"source fields with no entry: {sorted(schema - set(names))}"
    assert not set(names) - schema, f"entries for fields the register does not have: {sorted(set(names) - schema)}"


def test_dashboard_entries_are_unique_and_name_real_register_fields():
    cfg, dmap = config.load(), load_map()
    names = [e["name"] for e in entries(dmap, DASHBOARD)]
    assert names, "no dashboard entry"
    assert len(names) == len(set(names)), "a dashboard column has more than one entry"
    schema = set(schema_fields(cfg))
    for entry in entries(dmap, DASHBOARD):
        unknown = set(entry["register_fields"]) - schema
        assert not unknown, f"{entry['name']}: register_fields names fields the register does not have: {unknown}"


def test_every_source_is_known():
    dmap = load_map()
    sources = {e["source"] for e in dmap["fields"]}
    assert sources <= set(dmap["enums"]["source"]), f"unknown sources: {sources - set(dmap['enums']['source'])}"
    assert {REGISTER, DASHBOARD} <= set(dmap["enums"]["source"])


# --- shape of every entry ------------------------------------------------------------------------------------------


def _entry_ids():
    return [f"{e['source']}:{e['name']}" for e in load_map()["fields"]]


@pytest.mark.parametrize("index", range(len(load_map()["fields"])), ids=_entry_ids())
def test_entry_has_required_keys_and_enum_values(index: int):
    dmap = load_map()
    entry, enums = dmap["fields"][index], dmap["enums"]
    label = entry.get("name")
    missing = (REQUIRED | REQUIRED_BY_SOURCE.get(entry.get("source"), set())) - set(entry)
    assert not missing, f"{label}: missing keys {sorted(missing)}"
    for key in ("source", "group", "kind", "cardinality", "nothing_means"):
        assert entry[key] in enums[key], f"{label}: {key} {entry[key]!r} is not one of {enums[key]}"
    assert entry["privacy"] in dmap["privacy_classes"], f"{label}: privacy {entry['privacy']!r} is not a class"
    if entry["kind"] in ALWAYS_MANY:
        assert entry["cardinality"] == "many", f"{label}: a {entry['kind']} field is always 'many'"
    assert entry["recorded_for"] and set(entry["recorded_for"]) <= set(enums["recorded_for"]), (
        f"{label}: recorded_for {entry['recorded_for']} is empty or outside {enums['recorded_for']}"
    )
    uses = entry["uses"]
    assert set(uses) == {"break_down", "filter", "measure"}, f"{label}: uses must have break_down, filter, measure"
    assert isinstance(uses["break_down"], bool) and isinstance(uses["filter"], bool), f"{label}: uses flags are booleans"
    assert set(uses["measure"]) <= set(enums["measure"]), f"{label}: measure {uses['measure']} outside {enums['measure']}"
    definition = entry["definition"]
    assert isinstance(definition, str) and definition.strip() and "\n" not in definition, f"{label}: one-line definition"
    assert entry["privacy_reason"].strip(), f"{label}: privacy_reason is empty"
    if entry["after_review"] is not None:
        assert entry["after_review"] in enums["after_review"], f"{label}: after_review outside {enums['after_review']}"
    if dmap["privacy_classes"][entry["privacy"]]["pending_review"]:
        assert entry["after_review"] is not None, f"{label}: a field held for the review must say what follows it"
    assert entry["bound"] is None or (isinstance(entry["bound"], str) and entry["bound"]), f"{label}: bound"
    assert isinstance(entry["not_recorded"], list), f"{label}: not_recorded is a list"
    relations = entry["relations"]
    assert set(relations) == RELATION_KEYS, f"{label}: relations must be exactly {sorted(RELATION_KEYS)}"
    assert relations["follows_vehicle"] in enums["follows_vehicle"], f"{label}: follows_vehicle"
    for roll in relations["rolls_up_to"]:
        assert set(roll) == ROLL_UP_KEYS, f"{label}: a roll-up has exactly {sorted(ROLL_UP_KEYS)}"
        assert roll["holds_on"] in enums["holds_on"], f"{label}: holds_on {roll['holds_on']!r}"
    for exception in entry.get("published_exceptions", []):
        assert set(exception["outputs"]) <= set(enums["output"]), f"{label}: exception outputs outside {enums['output']}"


def test_cardinality_threshold_is_config():
    few = load_map()["cardinality"]["few_max_values"]
    assert isinstance(few, int) and few > 0


# --- agreement with config/pipeline.json --------------------------------------------------------------------------


def test_bound_fields_carry_their_logical_names():
    cfg, dmap = config.load(), load_map()
    fields = by_name(dmap, REGISTER)
    for logical, name in cfg.pipeline["fields"].items():
        assert name in fields, f"pipeline.json binds {name}, which has no data map entry"
        assert fields[name]["bound"] == logical, f"{name}: bound is {fields[name]['bound']!r}, pipeline.json says {logical!r}"
    bound_in_map = {e["name"]: e["bound"] for e in entries(dmap, REGISTER) if e["bound"] is not None}
    unbound = {n: b for n, b in bound_in_map.items() if cfg.pipeline["fields"].get(b) != n}
    assert not unbound, f"marked bound in the data map but not in pipeline.json: {unbound}"
    assert not [e["name"] for e in entries(dmap, DASHBOARD) if e["bound"] is not None], (
        "a dashboard column is marked bound, but pipeline.json binds no dashboard column"
    )


def test_never_pulled_fields_match_the_register_archive():
    cfg, dmap = config.load(), load_map()
    classes = dmap["privacy_classes"]
    never_pulled = {e["name"] for e in entries(dmap, REGISTER) if not classes[e["privacy"]]["pulled"]}
    assert never_pulled == set(cfg.pipeline["register_archive"]["never_pulled"])


def test_bound_guards_match_the_pipeline():
    """A guard the pipeline already applies is the guard the map declares, so the method page cannot disagree."""
    cfg, dmap = config.load(), load_map()
    fields = by_name(dmap, REGISTER)
    checked = 0
    for block in cfg.pipeline.values():
        if not (isinstance(block, dict) and "field" in block and any(k.startswith("valid_") for k in block)):
            continue
        name = cfg.pipeline["fields"][block["field"]]
        guard = fields[name].get("guard")
        assert guard is not None, f"{name}: the pipeline guards it and the data map declares no guard"
        assert guard["status"] == "bound", f"{name}: its guard is applied by the pipeline, so its status is 'bound'"
        for key, value in block.items():
            if key.startswith("valid_"):
                assert guard.get(key) == value, f"{name}: guard {key} is {guard.get(key)!r}, pipeline.json says {value!r}"
        checked += 1
    assert checked, "no guarded field found in pipeline.json; the check would prove nothing"


def test_a_number_offered_as_an_average_declares_its_guard():
    dmap = load_map()
    for entry in dmap["fields"]:
        if entry["kind"] != "number" or not GUARDED_MEASURES & set(entry["uses"]["measure"]):
            continue
        guard = entry.get("guard")
        assert guard, f"{entry['name']}: offered as {entry['uses']['measure']} with no guard"
        low = guard.get("valid_min_inclusive", guard.get("valid_min_exclusive"))
        high = guard.get("valid_max_inclusive")
        assert low is not None and high is not None and low < high, f"{entry['name']}: a guard needs a minimum below its maximum"
        assert isinstance(guard.get("requires_engine"), bool), f"{entry['name']}: guard says whether it needs an engine"


# --- agreement with data/reference/sentinels.csv ------------------------------------------------------------------


def test_sentinels_pending_is_exactly_what_sentinels_csv_lacks():
    """The map lists each field's forms of 'not recorded' and which of them sentinels.csv does not yet cover."""
    cfg, dmap = config.load(), load_map()
    s = cfg.pipeline["sentinels"]
    rows = reference.read(cfg.reference(s["file"]))
    for entry in entries(dmap, REGISTER):
        covered = {r[s["value"]] for r in rows if r[s["field"]] in (entry["name"], s["any_field"])}
        expected = {form for form in entry["not_recorded"] if form not in covered}
        assert set(entry["sentinels_pending"]) == expected, (
            f"{entry['name']}: sentinels_pending is {sorted(entry['sentinels_pending'])}, "
            f"but the forms sentinels.csv lacks are {sorted(expected)}"
        )


def test_sentinels_csv_names_only_mapped_fields():
    cfg, dmap = config.load(), load_map()
    s = cfg.pipeline["sentinels"]
    names = set(by_name(dmap, REGISTER)) | {s["any_field"]}
    stray = {r[s["field"]] for r in reference.read(cfg.reference(s["file"]))} - names
    assert not stray, f"sentinels.csv names fields the data map does not have: {stray}"


# --- privacy: what reaches a published file -----------------------------------------------------------------------


def test_no_published_output_reads_a_field_held_back():
    cfg, dmap = config.load(), load_map()
    assert privacy_breaches(dmap, cfg.pipeline, cfg.dimensions) == []


def test_the_check_catches_a_held_field_in_the_fact_table():
    cfg, dmap = config.load(), load_map()
    published = published_classes(dmap)
    held = [e["bound"] for e in entries(dmap, REGISTER) if e["bound"] and e["privacy"] not in published]
    if not held:
        pytest.skip("no bound field is held back, so there is nothing to probe")
    pipeline, dimensions = copy.deepcopy(cfg.pipeline), copy.deepcopy(cfg.dimensions)
    dimensions["dimensions"].append({"id": "probe", "derive": {"kind": "raw", "field": held[0]}})
    dataset = next(name for name, spec in pipeline["datasets"].items() if "facts" in spec)
    pipeline["datasets"][dataset]["facts"].append("probe")
    found = privacy_breaches(dmap, pipeline, dimensions)
    assert any(p.startswith("facts 'probe'") for p in found), found


def test_the_check_catches_a_slice_without_its_recorded_exception():
    cfg, dmap = config.load(), load_map()
    if not any(e.get("published_exceptions") for e in dmap["fields"]):
        pytest.skip("no recorded exception to remove")
    stripped = copy.deepcopy(dmap)
    for entry in stripped["fields"]:
        entry.pop("published_exceptions", None)
    assert privacy_breaches(stripped, cfg.pipeline, cfg.dimensions)


def test_every_exception_names_a_decision_record_and_a_real_dimension():
    cfg, dmap = config.load(), load_map()
    recorded = set(re.findall(r"^## (D-\d{3})\b", DECISIONS.read_text(encoding="utf-8"), flags=re.MULTILINE))
    dims = {d["id"] for d in cfg.dimensions["dimensions"]}
    for entry in dmap["fields"]:
        for exception in entry.get("published_exceptions", []):
            assert exception["decision"] in recorded, f"{entry['name']}: {exception['decision']} is not in DECISIONS.md"
            assert exception["dimension"] in dims, f"{entry['name']}: {exception['dimension']} is not a dimension"


def test_derive_reads_resolve():
    cfg, dmap = config.load(), load_map()
    reads = dmap["derive_reads"]
    for items in list(reads["by_kind"].values()) + list(reads["by_flag"].values()):
        for item in items:
            _resolve(cfg.pipeline, item)
    for dim in cfg.dimensions["dimensions"]:
        if "derive" in dim:
            assert fields_read(dim, cfg.pipeline, reads), f"dimension {dim['id']} reads no field the map can see"


# --- relations ----------------------------------------------------------------------------------------------------


def test_relations_point_at_known_fields_and_files():
    cfg, dmap = config.load(), load_map()
    dims = {d["id"] for d in cfg.dimensions["dimensions"]}
    for entry in dmap["fields"]:
        same_source = set(by_name(dmap, entry["source"]))
        for roll in entry["relations"]["rolls_up_to"]:
            assert roll["to"] in same_source | dims, f"{entry['name']}: rolls up to unknown {roll['to']!r}"
            assert roll["to"] != entry["name"], f"{entry['name']}: rolls up to itself"
            if roll["via"] is not None:
                assert cfg.reference(roll["via"]).exists(), f"{entry['name']}: no reference file {roll['via']}"
        unknown = set(entry["relations"]["derived_from"]) - same_source
        assert not unknown, f"{entry['name']}: derived from unknown fields {unknown}"
