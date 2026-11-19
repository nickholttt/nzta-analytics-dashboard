"""The data map (config/data_map.json) covers every source field once and agrees with the pipeline's own config.

The map is what Build, the pipeline and the method page will read to know what a field means, how it may be used and
whether it may be published (CLAUDE.md, the goal's point 8; docs/DATA_MAP.md). These tests keep it whole and keep it
true to config/pipeline.json, config/dimensions.json and data/reference/sentinels.csv, so the map cannot drift from
what the pipeline does. No field value is written here (design invariant #1): every name and value is read from config.
"""

from __future__ import annotations

import copy
import csv
import json
import re
from pathlib import Path

import pytest

from pipeline import config, reference
from pipeline.privacy import fields_read, resolve as _resolve, strings as _strings

ROOT = Path(__file__).resolve().parent.parent.parent
DATA_MAP = ROOT / "config" / "data_map.json"
DECISIONS = ROOT / "docs" / "DECISIONS.md"
# Records D-001 to D-140 were moved, unchanged, out of DECISIONS.md into a file under this folder (D-147).
DECISION_ARCHIVES = ROOT / "docs" / "decisions"

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


def recorded_decisions(files: list[Path] | None = None) -> set[str]:
    """The decisions that have a record: a heading of their own in DECISIONS.md or in an archive beside it. A line of
    the index in DECISIONS.md is a list item, not a heading, so a number that is only indexed does not count."""
    files = [DECISIONS, *sorted(DECISION_ARCHIVES.glob("*.md"))] if files is None else files
    return {d for f in files for d in re.findall(r"^## (D-\d{3})\b", f.read_text(encoding="utf-8"), flags=re.MULTILINE)}


def entries(dmap: dict, source: str) -> list[dict]:
    return [e for e in dmap["fields"] if e["source"] == source]


def by_name(dmap: dict, source: str) -> dict[str, dict]:
    return {e["name"]: e for e in entries(dmap, source)}


def schema_fields(cfg: config.Config) -> list[str]:
    schema = json.loads(cfg.path("expected_schema").read_text(encoding="utf-8"))
    return [f["name"] for f in schema["fields"]]


def published_classes(dmap: dict) -> set[str]:
    return {name for name, spec in dmap["privacy_classes"].items() if spec["published"]}


# --- which source fields a dimension reads, from its derive block (pipeline/privacy.py) --------------------------------

SNAPSHOT_ARCHIVE = "snapshot_archive"


def privacy_breaches(dmap: dict, pipeline: dict, dimensions: dict) -> list[str]:
    """Every published output whose fields are not cleared for it.

    Checked: each dataset's fact-table columns and pairs, every dimension's slice, and the committed snapshot
    aggregate (pipeline.json snapshot_archive.group_by), which is in the public repository.
    """
    fields = by_name(dmap, REGISTER)
    published = published_classes(dmap)
    dims = {d["id"]: d for d in dimensions["dimensions"] if "derive" in d}
    owner_groups, rule = set(dmap["owner_groups"]), dmap["owner_rule"]
    problems: list[str] = []

    def cleared(name: str, output: str, dim_id: str | None) -> bool:
        entry = fields[name]
        # The user's rule binds whatever a class or an exception says: an owner field reaches only the outputs
        # the rule names, and a field the rule holds back reaches none (D-096).
        if entry["group"] in owner_groups and (output not in rule["outputs"] or name in rule["not_published"]):
            return False
        if entry["privacy"] in published:
            return True
        return any(
            output in x["outputs"] and (dim_id is None or x["dimension"] == dim_id)
            for x in entry.get("published_exceptions", [])
        )

    def check(dim_id: str, output: str) -> None:
        for name in sorted(fields_read(dims[dim_id], pipeline, dmap["derive_reads"])):
            if not cleared(name, output, dim_id):
                problems.append(f"{output} {dim_id!r} reads {name} ({fields[name]['privacy']})")

    for spec in pipeline["datasets"].values():
        for dim_id in spec.get("facts", []):
            check(dim_id, "facts")
        for pair in spec.get("pairs", []):
            for dim_id in pair:
                check(dim_id, "pair")
    for dim_id in dims:
        check(dim_id, "slice")
    for logical in pipeline[SNAPSHOT_ARCHIVE]["group_by"]:
        name = pipeline["fields"][logical]
        if not cleared(name, SNAPSHOT_ARCHIVE, None):
            problems.append(f"{SNAPSHOT_ARCHIVE} groups by {name} ({fields[name]['privacy']})")
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
    if dmap["privacy_classes"][entry["privacy"]]["restricted"]:
        assert entry["after_review"] is not None, f"{label}: a restricted field must say which form its rule takes"
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
    recorded = recorded_decisions()
    dims = {d["id"] for d in cfg.dimensions["dimensions"]}
    for entry in dmap["fields"]:
        for exception in entry.get("published_exceptions", []):
            assert exception["decision"] in recorded, f"{entry['name']}: {exception['decision']} is not in DECISIONS.md"
            assert exception["dimension"] in dims, f"{entry['name']}: {exception['dimension']} is not a dimension"


def test_a_decision_counts_only_where_it_has_a_record(tmp_path: Path):
    """D-147: the records up to D-140 live in an archive and DECISIONS.md lists them in an index. A number counts as
    recorded where it heads a record, in either file, and not where it is only a line of the index."""
    current, archive = tmp_path / "DECISIONS.md", tmp_path / "archive.md"
    current.write_text("# Decisions\n\n- D-001 2026-01-01 — indexed only\n\n## D-150 2026-01-02 — a record\n", encoding="utf-8", newline="\n")
    archive.write_text("# Archive\n\n## D-002 2026-01-01 — an archived record\n", encoding="utf-8", newline="\n")
    assert recorded_decisions([current, archive]) == {"D-150", "D-002"}


def test_derive_reads_resolve():
    cfg, dmap = config.load(), load_map()
    reads = dmap["derive_reads"]
    by_field = reads.get("by_field", {})
    for items in list(reads["by_kind"].values()) + list(reads["by_flag"].values()) + list(by_field.values()):
        for item in items:
            _resolve(cfg.pipeline, item)
    for key in by_field:
        _resolve(cfg.pipeline, key)
    other_source = set(reads.get("other_source_kinds", []))
    for dim in cfg.dimensions["dimensions"]:
        if "derive" in dim and dim["derive"]["kind"] not in other_source:
            assert fields_read(dim, cfg.pipeline, reads), f"dimension {dim['id']} reads no field the map can see"


def test_a_dimension_reading_the_engine_field_reads_what_the_hybrid_classification_reads():
    """The powertrain is a plain lookup on motive power, but motive power is rewritten from make and model first."""
    cfg, dmap = config.load(), load_map()
    reads = dmap["derive_reads"]
    engine = cfg.pipeline["engine"]["field"]
    make = cfg.pipeline["fields"][cfg.pipeline["brand"]["make_field"]]
    readers = [d for d in cfg.dimensions["dimensions"] if "derive" in d and engine in _strings(d["derive"])]
    assert readers, "no dimension reads the engine field; the check would prove nothing"
    for dim in readers:
        assert make in fields_read(dim, cfg.pipeline, reads), f"{dim['id']}: the hybrid classification's reads are missed"


def test_the_check_catches_a_held_field_in_the_snapshot_archive():
    cfg, dmap = config.load(), load_map()
    published = published_classes(dmap)
    held = [e["bound"] for e in entries(dmap, REGISTER) if e["bound"] and e["privacy"] not in published]
    if not held:
        pytest.skip("no bound field is held back, so there is nothing to probe")
    pipeline = copy.deepcopy(cfg.pipeline)
    pipeline[SNAPSHOT_ARCHIVE]["group_by"].append(held[0])
    found = privacy_breaches(dmap, pipeline, cfg.dimensions)
    assert any(p.startswith(SNAPSHOT_ARCHIVE) for p in found), found


def test_approval_names_its_decision():
    dmap = load_map()
    approval = dmap["approval"]
    states = dmap["enums"]["approval"]
    assert approval["privacy_classes"] in states, f"approval {approval['privacy_classes']!r} outside {states}"
    if approval["privacy_classes"] == states[0]:
        assert approval["decision"] is None, "the classes are proposed, so no decision approves them yet"
    else:
        recorded = recorded_decisions()
        assert approval["decision"] in recorded, "approved classes must name the decision record that approved them"


def test_the_owner_rule_is_the_users_and_never_reaches_the_fact_table():
    """D-096: owner fields only in tables of one or two fields, with small cells hidden."""
    dmap = load_map()
    rule = dmap["owner_rule"]
    recorded = recorded_decisions()
    assert rule["decision"] in recorded, "the owner rule must name the decision record that holds the user's word"
    assert rule["outputs"] and set(rule["outputs"]) <= set(dmap["enums"]["output"])
    assert "facts" not in rule["outputs"], "the fact table crosses many fields; the rule allows one or two"
    assert isinstance(rule["minimum_count"], int) and rule["minimum_count"] > 1
    assert isinstance(rule["enforced"], bool)
    fields, published = {e["name"]: e for e in dmap["fields"]}, published_classes(dmap)
    owner_groups = set(dmap["owner_groups"])
    for name in rule["not_published"]:
        assert fields[name]["group"] in owner_groups, f"{name}: the rule holds back owner fields only"
        assert fields[name]["privacy"] not in published, f"{name}: held back by the user, but marked published"


def test_the_owner_rule_binds_even_a_field_marked_published():
    """Once the rule is enforced and an owner field is public, it still reaches only a slice or a pair."""
    cfg, dmap = config.load(), load_map()
    owner_groups = set(dmap["owner_groups"])
    bound = [e for e in entries(dmap, REGISTER) if e["bound"] and e["group"] in owner_groups]
    if not bound:
        pytest.skip("no owner field is bound, so there is nothing to probe")
    opened = copy.deepcopy(dmap)
    opened["owner_rule"]["enforced"] = True
    public = next(name for name, spec in opened["privacy_classes"].items() if spec["published"])
    for entry in opened["fields"]:
        if entry["group"] in owner_groups:
            entry["privacy"] = public
            entry.pop("published_exceptions", None)
    assert privacy_breaches(opened, cfg.pipeline, cfg.dimensions) == [], "a slice of a public owner field is allowed"

    pipeline, dimensions = copy.deepcopy(cfg.pipeline), copy.deepcopy(cfg.dimensions)
    dimensions["dimensions"].append({"id": "probe", "derive": {"kind": "raw", "field": bound[0]["bound"]}})
    dataset = next(name for name, spec in pipeline["datasets"].items() if "facts" in spec)
    pipeline["datasets"][dataset]["facts"].append("probe")
    pipeline[SNAPSHOT_ARCHIVE]["group_by"].append(bound[0]["bound"])
    found = privacy_breaches(opened, pipeline, dimensions)
    assert any(p.startswith("facts 'probe'") for p in found), found
    assert any(p.startswith(SNAPSHOT_ARCHIVE) for p in found), found


def test_owner_fields_and_vin_derivatives_stay_unpublished_until_the_owner_has_seen_the_first_table():
    """The pipeline hides small cells since D-127, and that alone publishes no owner field: the user asked to be shown the
    first table of an owner field before any build publishes it (D-120 item 4). The one that is published, the region slice,
    is a recorded exception, not a published class. A field leaves this test only with a new decision record from the owner."""
    dmap = load_map()
    published = published_classes(dmap)
    owner_groups = set(dmap["owner_groups"])
    assert owner_groups <= set(dmap["enums"]["group"])
    derived_only = {v for v in dmap["enums"]["after_review"] if v.startswith("derived")}
    assert derived_only, "no after_review value means 'derived fields only'"
    for entry in dmap["fields"]:
        if entry["after_review"] in derived_only:
            assert entry["privacy"] not in published, f"{entry['name']}: only a field derived from it may be published"
        if entry["group"] in owner_groups:
            assert entry["privacy"] not in published, f"{entry['name']}: an owner field, and its first table has not been shown to the owner"


def test_a_new_dimension_over_an_owner_field_is_refused_although_the_rule_is_enforced():
    """`enforced` publishes nothing: a dimension that reads an owner field, other than the recorded exception, is still a breach."""
    cfg, dmap = config.load(), load_map()
    owner = next(e for e in entries(dmap, REGISTER) if e["bound"] and e["group"] in set(dmap["owner_groups"]))
    excepted = {x["dimension"] for e in dmap["fields"] for x in e.get("published_exceptions", [])}
    assert "probe" not in excepted
    dims = copy.deepcopy(cfg.dimensions)
    dims["dimensions"].append({"id": "probe", "derive": {"kind": "raw", "field": owner["bound"]}})
    assert dmap["owner_rule"]["enforced"] is True
    found = privacy_breaches(dmap, cfg.pipeline, dims)
    assert any(p.startswith("slice 'probe'") for p in found), found
    assert not any(f"'{dim}'" in p for dim in excepted for p in found), "the recorded exception is not a breach"


def test_free_text_is_never_a_breakdown_or_a_filter():
    for entry in load_map()["fields"]:
        if entry["kind"] == "free_text":
            assert not entry["uses"]["break_down"] and not entry["uses"]["filter"], f"{entry['name']}: free text"


def test_an_exception_stays_inside_what_its_decision_covers():
    dmap = load_map()
    owner_groups = set(dmap["owner_groups"])
    for entry in dmap["fields"]:
        for exception in entry.get("published_exceptions", []):
            covers = set(exception["decision_covers"])
            assert set(exception["outputs"]) <= covers, f"{entry['name']}: outputs reach past {exception['decision']}"
            if entry["group"] in owner_groups:
                assert "facts" not in covers, f"{entry['name']}: no owner field reaches the fact table (D-096)"


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


def test_a_by_construction_rollup_through_a_reference_file_holds_in_that_file():
    """A roll-up or a pair marked by_construction through a reference file is only true while the file makes it so: each
    value of the lower column has one value of the higher (for the brand registry, one manufacturer group, owner
    country and heritage country per make, and one owner country per group). Read from the map, not named here."""
    cfg, dmap = config.load(), load_map()
    dims = {d["id"]: d for d in cfg.dimensions["dimensions"]}
    checked = 0
    for entry in dmap["fields"]:
        lower = dims.get(entry.get("bound") or "")
        for roll in entry["relations"]["rolls_up_to"]:
            higher = dims.get(roll["to"])
            if roll["holds_on"] != "by_construction" or not roll["via"] or not lower or not higher:
                continue
            key, value = lower["derive"].get("value"), higher["derive"].get("value")
            if lower["derive"].get("kind") != higher["derive"].get("kind") or not key or not value:
                continue
            rows = list(csv.DictReader(cfg.reference(roll["via"]).open(encoding="utf-8", newline="")))
            if key not in rows[0] or value not in rows[0]:
                continue
            seen: dict[str, set[str]] = {}
            for row in rows:
                seen.setdefault(row[key], set()).add(row[value])
            split = {k: v for k, v in seen.items() if len(v) > 1}
            assert not split, f"{entry['name']} -> {roll['to']} through {roll['via']}: more than one {value} for {split}"
            checked += 1
    together = dmap["moves_together"]["true_by_definition"]
    for pair in together:
        a, b = dims.get(pair["a"]), dims.get(pair["b"])
        if pair["basis"] != "by_construction" or not a or not b or a["derive"].get("kind") != b["derive"].get("kind"):
            continue
        reference = a["derive"].get("reference") or cfg.pipeline.get("brand", {}).get("registry")
        if not reference or not cfg.reference(reference).exists():
            continue
        rows = list(csv.DictReader(cfg.reference(reference).open(encoding="utf-8", newline="")))
        ka, kb = a["derive"].get("value"), b["derive"].get("value")
        if not rows or ka not in rows[0] or kb not in rows[0]:
            continue
        seen = {}
        for row in rows:
            seen.setdefault(row[ka], set()).add(row[kb])
        split = {k: v for k, v in seen.items() if len(v) > 1}
        assert not split, f"{pair['a']} with {pair['b']}: more than one {kb} for {split}"
        checked += 1
    assert checked >= 1, "no by_construction relation through a reference file was checked"


def test_pairs_true_by_definition_name_known_fields():
    cfg, dmap = config.load(), load_map()
    known = set(by_name(dmap, REGISTER)) | {d["id"] for d in cfg.dimensions["dimensions"]}
    together = dmap["moves_together"]
    seen = set()
    for pair in together["true_by_definition"]:
        assert {pair["a"], pair["b"]} <= known, f"unknown field in {pair}"
        assert pair["a"] != pair["b"], f"a field paired with itself: {pair}"
        assert pair["basis"] in together["basis"], f"basis {pair['basis']!r} outside {together['basis']}"
        key = frozenset((pair["a"], pair["b"]))
        assert key not in seen, f"pair listed twice: {pair}"
        seen.add(key)
