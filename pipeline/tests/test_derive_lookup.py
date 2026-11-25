"""The lookup derive kind with more than one key (pipeline/derive.py): a vehicle's value is read from a reference file by two or
more fields together, as the buyer type is read from the owner type and the usage at registration.

The tests use made-up field names and a made-up reference file, so they hold the rule and no domain value (invariant 1). They
hold that a pair the file does not hold reads `__UNMAPPED__` and is counted as unmapped (the guardrail that stops a build), that
a missing field reads `__UNDEFINED__` and is not counted as unmapped, that a key listed twice aborts, that the older form with
`field` and `key` still reads the same way, and that the fields and the reference file the block names are the ones the build
looks for.
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import duckdb
import pytest

from pipeline import derive
from pipeline.contract import UNDEFINED, UNMAPPED
from pipeline.errors import GuardrailError

REFERENCE = "pairs.csv"
HEADER = "k_one,k_two,result,basis\n"
GOOD = HEADER + "a1,b1,x,why\na1,b2,y,why\na2,b1,y,why\na2,b2,y,why\n"


def cfg_for(directory: Path, text: str = GOOD):
    (directory / REFERENCE).write_text(text, encoding="utf-8", newline="")
    return SimpleNamespace(reference=lambda name: directory / name, pipeline={})


def dim(**derive_block) -> dict:
    return {"id": "d", "derive": {"kind": "lookup", "reference": REFERENCE, "value": "result", **derive_block}}


TWO_KEYS = {"keys": {"f_one": "k_one", "f_two": "k_two"}}


def read(tmp_path, dimension: dict, vehicles: list[tuple], text: str = GOOD) -> list[tuple]:
    """(value, unmapped flag) of each vehicle, in order, read the way the build reads a derive block."""
    con = duckdb.connect()
    con.execute("CREATE TABLE rows (id INTEGER, f_one VARCHAR, f_two VARCHAR)")
    con.executemany("INSERT INTO rows VALUES (?, ?, ?)", [(i, *v) for i, v in enumerate(vehicles)])
    d = derive.derive(con, cfg_for(tmp_path, text), dimension, 0, 2026)
    return con.execute(f"SELECT {d.expr}, {d.unmapped} FROM rows r {' '.join(d.joins)} ORDER BY r.id").fetchall()


def test_two_fields_together_pick_the_value_and_the_same_first_field_can_give_two_values(tmp_path):
    got = read(tmp_path, dim(**TWO_KEYS), [("a1", "b1"), ("a1", "b2"), ("a2", "b1"), ("a2", "b2")])
    assert got == [("x", False), ("y", False), ("y", False), ("y", False)]


def test_a_pair_the_file_does_not_hold_is_unmapped_and_counted_as_unmapped(tmp_path):
    got = read(tmp_path, dim(**TWO_KEYS), [("a1", "new"), ("new", "b1"), ("new", "new")])
    assert got == [(UNMAPPED, True)] * 3


def test_a_missing_field_is_undefined_and_is_not_counted_as_unmapped_whatever_the_other_holds(tmp_path):
    got = read(tmp_path, dim(**TWO_KEYS), [(None, "b1"), ("a1", None), (None, None), (None, "new")])
    assert got == [(UNDEFINED, False)] * 4


def test_three_keys_read_the_same_way(tmp_path):
    text = "k_one,k_two,k_three,result\na1,b1,c1,x\na1,b1,c2,y\n"
    con = duckdb.connect()
    con.execute("CREATE TABLE rows (id INTEGER, f_one VARCHAR, f_two VARCHAR, f_three VARCHAR)")
    con.executemany("INSERT INTO rows VALUES (?, ?, ?, ?)", [(0, "a1", "b1", "c1"), (1, "a1", "b1", "c2"), (2, "a1", "b1", "c3")])
    block = dim(keys={"f_one": "k_one", "f_two": "k_two", "f_three": "k_three"})
    d = derive.derive(con, cfg_for(tmp_path, text), block, 0, 2026)
    got = con.execute(f"SELECT {d.expr}, {d.unmapped} FROM rows r {' '.join(d.joins)} ORDER BY r.id").fetchall()
    assert got == [("x", False), ("y", False), (UNMAPPED, True)]


def test_a_pair_listed_twice_aborts_the_build_and_names_the_pair(tmp_path):
    with pytest.raises(GuardrailError, match="a1"):
        read(tmp_path, dim(**TWO_KEYS), [("a1", "b1")], text=GOOD + "a1,b1,z,why\n")


def test_a_single_key_listed_twice_still_aborts_and_names_the_key(tmp_path):
    text = "k_one,result\na1,x\na1,y\n"
    with pytest.raises(GuardrailError, match="a1"):
        read(tmp_path, dim(field="f_one", key="k_one"), [("a1", "b1")], text=text)


def test_the_older_form_with_one_field_and_one_key_reads_as_before(tmp_path):
    text = "k_one,result\na1,x\na2,y\n"
    got = read(tmp_path, dim(field="f_one", key="k_one"), [("a1", "b1"), ("a2", "b1"), ("new", "b1"), (None, "b1")], text=text)
    assert got == [("x", False), ("y", False), (UNMAPPED, True), (UNDEFINED, False)]
    assert read(tmp_path, dim(keys={"f_one": "k_one"}), [("a1", "b1"), ("new", "b1"), (None, "b1")], text=text) == [
        ("x", False), (UNMAPPED, True), (UNDEFINED, False)]


@pytest.mark.parametrize("block", [
    {"field": "f_one", "key": "k_one", **TWO_KEYS},
    {"field": "f_one", **TWO_KEYS},
    {"key": "k_one", **TWO_KEYS},
    {"keys": {}},
    {},
    {"field": "f_one"},
])
def test_a_block_that_names_its_keys_two_ways_or_not_at_all_is_refused_and_not_guessed_at(tmp_path, block):
    with pytest.raises(ValueError, match="dimension d"):
        read(tmp_path, dim(**block), [("a1", "b1")])


def test_the_fields_a_lookup_reads_are_every_key_it_names_and_the_older_form_names_one():
    cfg = SimpleNamespace(pipeline={"brand": {}})
    assert derive.needed_fields(cfg, dim(**TWO_KEYS)["derive"]) == {"f_one", "f_two"}
    assert derive.needed_fields(cfg, dim(field="f_one", key="k_one")["derive"]) == {"f_one"}
    assert derive.needed_fields(cfg, {"kind": "raw", "field": "f_one"}) == {"f_one"}


def test_the_reference_file_a_lookup_names_is_the_one_the_build_looks_for():
    cfg = SimpleNamespace(pipeline={"brand": {}})
    assert derive.references_for(cfg, dim(**TWO_KEYS)["derive"]) == [REFERENCE]


def test_the_mild_hybrid_rewrite_finds_a_lookup_of_the_motive_power_in_either_form_and_leaves_a_lookup_of_two_fields_alone():
    engine = {"field": "f_one", "reference": REFERENCE}
    hybrid = {"powertrain_column": "result", "undivided_powertrain": "whole", "mild_powertrain": "part"}
    blocks = {"older": dict(field="f_one", key="k_one"), "keys": dict(keys={"f_one": "k_one"}), "pair": TWO_KEYS}
    cfg = SimpleNamespace(pipeline={"hybrid_classification": hybrid, "engine": engine},
                          dimensions={"dimensions": [{**dim(**b), "id": i} for i, b in blocks.items()]})
    con = duckdb.connect()
    con.execute('CREATE TABLE dims (d__older VARCHAR, d__keys VARCHAR, d__pair VARCHAR)')
    con.execute("INSERT INTO dims VALUES ('part', 'part', 'part')")
    derived = [derive.Derived(i, "lookup", "", "", [], None) for i in blocks]
    assert derive.undivide_hybrids(con, cfg, derived) == ["older", "keys"]
    assert con.execute("SELECT d__older, d__keys, d__pair FROM dims").fetchall() == [("whole", "whole", "part")]
