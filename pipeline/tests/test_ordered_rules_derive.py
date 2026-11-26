"""The ordered_rules derive kind (pipeline/derive.py): a vehicle takes the value of the first rule of a file whose tests it meets,
and a vehicle no rule takes is unmapped. Held on a made-up file for what each test does, and on the live Market type file
(data/reference/market_type_map.csv, D-154, D-155, D-161) against a second evaluator written out here, over every combination of
the values and bounds the file itself names.

No type, body, class or value is written in this file (invariant 1): the made-up file uses made-up words, and the live file's
words are read from it and from the reference files it points at.
"""

from __future__ import annotations

import itertools
from pathlib import Path
from types import SimpleNamespace

import duckdb
import pytest

from pipeline import config, derive, reference
from pipeline.contract import UNMAPPED
from pipeline.errors import GuardrailError
from pipeline.normalise import lit

SPEC = {
    "kind": "ordered_rules", "reference": "rules.csv", "order": "no", "value": "result",
    "tests": [
        {"column": "kinds", "field": "kind", "test": "any_of", "separator": "|"},
        {"column": "size_min", "field": "size", "test": "at_least"},
        {"column": "size_max", "field": "size", "test": "at_most"},
        {"column": "size_known", "field": "size", "test": "recorded"},
        {"column": "tag", "field": "tag", "test": "equals"},
    ],
}
HEADER = "no,kinds,size_min,size_max,size_known,tag,result\n"
FILE = HEADER + "\n".join([
    "1,alpha|beta,3501,,,,heavy",
    "2,alpha,,3500,,,light",
    "3,alpha|beta,,,false,,unknown",
    "4,gamma,,,,north,north",
    "5,gamma,,,,,south",
    "6,,,,,,rest",
]) + "\n"


def evaluate(tmp_path: Path, vehicles: list[tuple], text: str = FILE, spec: dict = SPEC) -> list[tuple]:
    """(value, unmapped flag) of each (kind, size, tag) vehicle, in order, read the way the build reads a derive block."""
    (tmp_path / "rules.csv").write_text(text, encoding="utf-8", newline="")
    con = duckdb.connect()
    con.execute('CREATE TABLE rows (id INTEGER, "kind" VARCHAR, "size" BIGINT, "tag" VARCHAR)')
    con.executemany("INSERT INTO rows VALUES (?, ?, ?, ?)", [(i, *v) for i, v in enumerate(vehicles)])
    cfg = SimpleNamespace(reference=lambda name: tmp_path / name, pipeline={})
    d = derive.derive(con, cfg, {"id": "probe", "derive": spec}, 0, 2026)
    assert d.joins == []
    return con.execute(f"SELECT {d.expr}, {d.unmapped} FROM rows r ORDER BY r.id").fetchall()


def test_the_first_rule_a_vehicle_meets_wins_and_a_bound_is_inclusive(tmp_path):
    got = evaluate(tmp_path, [("alpha", 3501, None), ("alpha", 3500, None), ("alpha", 3502, None), ("beta", 3500, None), ("alpha", None, None)])
    # Rule 1 comes first, so it takes 3501 and over; 3500 is rule 2's; beta at 3500 meets neither of the first two and is rule 3's
    # only when it has no size; a size of beta's own that no rule takes falls to the last rule.
    assert got == [("heavy", False), ("light", False), ("heavy", False), ("rest", False), ("unknown", False)]


def test_a_bound_needs_a_recorded_value_and_a_test_that_cannot_be_answered_is_not_met(tmp_path):
    got = evaluate(tmp_path, [("alpha", None, None), (None, 3501, None), (None, None, None), ("gamma", None, None), ("gamma", None, "north")])
    assert got == [("unknown", False), ("rest", False), ("rest", False), ("south", False), ("north", False)]


def test_a_vehicle_no_rule_takes_reads_unmapped_and_is_counted_as_unmapped(tmp_path):
    without_last = FILE.rsplit("6,", 1)[0]
    got = evaluate(tmp_path, [("alpha", 10, None), ("delta", 5, None), (None, None, None)], text=without_last)
    assert got == [("light", False), (UNMAPPED, True), (UNMAPPED, True)]


def test_the_blank_cells_of_a_rule_ask_nothing_so_a_rule_with_none_takes_every_vehicle(tmp_path):
    assert evaluate(tmp_path, [(None, None, None), ("alpha", 1, "x")], text=HEADER + "1,,,,,,rest\n") == [("rest", False)] * 2


def test_a_file_the_validator_refuses_stops_the_build_before_any_vehicle_is_read(tmp_path):
    with pytest.raises(GuardrailError, match="must rise down the file"):
        evaluate(tmp_path, [("alpha", 1, None)], text=HEADER + "2,,,,,,one\n1,,,,,,two\n")


def test_the_fields_a_block_reads_are_the_fields_of_its_tests_and_a_block_over_a_missing_field_is_not_read():
    cfg = config.load()
    spec = {**SPEC, "tests": [{"column": "a", "field": "vehicle_type", "test": "any_of", "separator": "|"},
                              {"column": "b", "field": "gvm", "test": "at_most"},
                              {"column": "c", "field": cfg.pipeline["model_classes"]["column"], "test": "equals"}]}
    b, m = cfg.pipeline["brand"], cfg.pipeline["model_classes"]
    assert derive.needed_fields(cfg, spec) == {"vehicle_type", "gvm", b["make_field"], b["model_field"], m["year_field"], m["gvm_field"]}
    with pytest.raises(ValueError, match="neither a field"):
        derive.needed_fields(cfg, {**SPEC, "tests": [{"column": "a", "field": "no_such_field", "test": "equals"}]})


# --- the live file ---------------------------------------------------------------------------------------------------------

def live():
    cfg = config.load()
    dim = next(d for d in cfg.dimensions["dimensions"] if d["derive"]["kind"] == derive.ORDERED_RULES)
    return cfg, dim, reference.ordered_rules(cfg, dim["derive"], dim["id"])


def test_the_live_file_is_one_the_validator_accepts_and_its_values_are_the_dimensions():
    cfg, dim, rules = live()
    values = {r[dim["derive"]["value"]] for r in rules}
    assert len(values) > 1
    con = duckdb.connect()
    assert derive.derive(con, cfg, dim, 0, 2026).vocabulary == values


def test_the_live_file_names_every_vehicle_type_the_vehicle_scope_file_holds():
    """The fleet counts every type, and a type no rule names would stop its build."""
    cfg, dim, rules = live()
    tests = {t["column"]: t for t in dim["derive"]["tests"]}
    spec = cfg.pipeline["scope"]["vehicle"]
    named = {n for r in rules for n in reference.split(r["vehicle_types"], tests["vehicle_types"]["separator"])}
    held = {r[spec["key"]] for r in reference.read(cfg.reference(spec["file"]))}
    assert named == held


def grid(cfg, dim, rules) -> list[dict]:
    """Vehicles made of every value and bound the file names and one value it does not, so each rule is met and each edge is crossed."""
    d = dim["derive"]
    tests = {t["column"]: t for t in d["tests"]}
    spec = cfg.pipeline["scope"]["vehicle"]

    def named(column):
        return sorted({n for r in rules for n in reference.split(r[column], tests[column]["separator"])})

    types = [*sorted(r[spec["key"]] for r in reference.read(cfg.reference(spec["file"]))), "no such type"]
    bodies = [*named("body_types"), "no such body", None]
    classes = [*named("nzta_classes"), "no such class", None]
    model_classes = [*sorted({r["class"] for r in reference.read(cfg.reference(cfg.pipeline["model_classes"]["file"]))}), "no such class", None]
    bounds = sorted({int(r[c]) for r in rules for c in ("gvm_min_kg", "gvm_max_kg") if r[c]})
    masses = [None, *sorted({m for b in bounds for m in (b - 1, b, b + 1)}), 1_000_000]
    return [{"vehicle_type": t, "body_type": b, "nzta_class": c, "gvm": g, "model_class": m}
            for t, b, c, g, m in itertools.product(types, bodies, classes, masses, model_classes)]


def written_out(rules: list[dict], v: dict) -> tuple[str, int | None]:
    """The value and the rule number the file gives one vehicle, the rules applied one after the other, in plain Python."""
    for rule in rules:
        if rule["vehicle_types"] and v["vehicle_type"] not in rule["vehicle_types"].split("|"):
            continue
        if rule["body_types"] and v["body_type"] not in rule["body_types"].split("|"):
            continue
        if rule["nzta_classes"] and v["nzta_class"] not in rule["nzta_classes"].split("|"):
            continue
        if rule["gvm_min_kg"] and (v["gvm"] is None or v["gvm"] < int(rule["gvm_min_kg"])):
            continue
        if rule["gvm_max_kg"] and (v["gvm"] is None or v["gvm"] > int(rule["gvm_max_kg"])):
            continue
        if rule["gvm_recorded"] and (v["gvm"] is not None) != (rule["gvm_recorded"] == "true"):
            continue
        if rule["model_class"] and v["model_class"] != rule["model_class"]:
            continue
        return rule["market_type"], int(rule["rule_order"])
    return UNMAPPED, None


def test_the_sql_agrees_with_the_rules_written_out_for_every_combination_and_every_rule_is_the_first_to_take_some_vehicle():
    cfg, dim, rules = live()
    vehicles = grid(cfg, dim, rules)
    assert len(vehicles) > 10_000
    con = duckdb.connect()
    con.execute('CREATE TABLE rows (id INTEGER, "vehicle_type" VARCHAR, "body_type" VARCHAR, "nzta_class" VARCHAR, "gvm" BIGINT, "model_class" VARCHAR)')
    # One statement: a row at a time would take minutes.
    values = ", ".join("(" + ", ".join("NULL" if x is None else lit(x) if isinstance(x, str) else str(x) for x in
                                       (i, v["vehicle_type"], v["body_type"], v["nzta_class"], v["gvm"], v["model_class"])) + ")"
                       for i, v in enumerate(vehicles))
    con.execute(f"INSERT INTO rows VALUES {values}")
    d = derive.derive(con, cfg, dim, 0, 2026)
    got = con.execute(f"SELECT {d.expr}, {d.unmapped} FROM rows r ORDER BY r.id").fetchall()
    taken_by = set()
    for v, (value, unmapped) in zip(vehicles, got):
        expected, rule_number = written_out(rules, v)
        assert (value, unmapped) == (expected, expected == UNMAPPED), v
        taken_by.add(rule_number)
    assert {int(r["rule_order"]) for r in rules} <= taken_by, "a rule no vehicle can reach is a rule that is never applied"


def test_a_passenger_registered_car_or_van_is_classified_only_by_a_class_the_file_names_and_the_rest_is_not_yet_classified():
    """A nameplate class a rule names gives that rule's value; any other class, no row and a vehicle whose year fell outside its row
    (all of which reach the build as no class, or as a class no rule names) give the value of the rule that follows, which names none."""
    cfg, dim, rules = live()
    classes = {r["class"] for r in reference.read(cfg.reference(cfg.pipeline["model_classes"]["file"]))}
    reading = [r for r in rules if r["model_class"]]
    assert {r["model_class"] for r in reading} < classes, "a class of the file that no rule reads is the point of the check below"
    first = reading[0]
    types, bodies = first["vehicle_types"].split("|"), first["body_types"].split("|")
    for r in reading:
        assert (r["vehicle_types"], r["body_types"]) == (first["vehicle_types"], first["body_types"])
        v = {"vehicle_type": types[0], "body_type": bodies[0], "nzta_class": None, "gvm": None, "model_class": r["model_class"]}
        assert written_out(rules, v)[0] == r["market_type"]
    after = next(r for r in rules[rules.index(reading[-1]) + 1:] if (r["vehicle_types"], r["body_types"]) == (first["vehicle_types"], first["body_types"]))
    assert not after["model_class"]
    for model_class in [*sorted(classes - {r["model_class"] for r in reading}), None]:
        v = {"vehicle_type": types[0], "body_type": bodies[0], "nzta_class": None, "gvm": 1800, "model_class": model_class}
        assert written_out(rules, v)[0] == after["market_type"]
    assert after["market_type"] not in {r["market_type"] for r in reading}


def test_a_type_outside_the_five_takes_the_rule_of_its_own_whatever_its_body_class_or_mass():
    cfg, dim, rules = live()
    spec = cfg.pipeline["scope"]["vehicle"]
    wider = next(iter(spec["also"].values()))
    outside = [r[spec["key"]] for r in reference.read(cfg.reference(spec["file"])) if r[wider] != cfg.pipeline["boolean_true"] and r[spec["in_scope"]] != cfg.pipeline["boolean_true"]]
    assert len(outside) == 9
    for vehicle_type in outside:
        got = {written_out(rules, {"vehicle_type": vehicle_type, "body_type": b, "nzta_class": c, "gvm": g, "model_class": m})[0]
               for b in ("no such body", None) for c in ("no such class", None) for g in (None, 1, 3500, 3501, 90_000) for m in ("no such class", None)}
        assert len(got) == 1 and UNMAPPED not in got, (vehicle_type, got)
    assert len({written_out(rules, {"vehicle_type": t, "body_type": None, "nzta_class": None, "gvm": None, "model_class": None})[0] for t in outside}) == 1
