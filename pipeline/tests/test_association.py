"""The associations file: how strongly each pair of a dataset's dimensions moves together (pipeline/association.py).

The formula is held to tables worked by hand, and the reading of which pairs are not findings to invented names. No
dimension, field or value is named here except as config or the build names it (design invariant 1).
"""

from __future__ import annotations

import math
import random
from types import SimpleNamespace

import pytest

from pipeline import association


# --- the formula --------------------------------------------------------------------------------------------------


def table(rows: list[list[int]]):
    return [(f"r{i}", f"c{j}", n) for i, row in enumerate(rows) for j, n in enumerate(row) if n > 0]


def test_a_two_by_two_table_worked_by_hand():
    # [[30, 10], [10, 30]]: N = 80, every expected count 20, chi2 = 4 * 10^2 / 20 = 20, phi2 = 1/4.
    # phi2c = 1/4 - 1/79; r~ = c~ = 2 - 1/79, so min(r~, c~) - 1 = 78/79; V^2 = (1/4 - 1/79) / (78/79) = 18.75 / 78 = 25 / 104.
    found = association.cramers_v(table([[30, 10], [10, 30]]))
    assert found.v == pytest.approx(5 / math.sqrt(104), abs=1e-12)
    assert round(found.v, 4) == 0.4903
    assert (found.vehicles, found.values_a, found.values_b) == (80, 2, 2)


def test_a_two_by_three_table_worked_by_hand():
    # [[6, 2, 2], [2, 6, 2]]: N = 20, row totals 10, column totals 8, 8, 4; chi2 = 2 + 2 = 4, phi2 = 1/5.
    # phi2c = 1/5 - 2/19 = 1.8/19; r~ = 2 - 1/19, c~ = 3 - 4/19, so the smaller less one is 18/19; V^2 = 1.8 / 18 = 1/10.
    found = association.cramers_v(table([[6, 2, 2], [2, 6, 2]]))
    assert found.v == pytest.approx(math.sqrt(0.1), abs=1e-12)
    assert (found.vehicles, found.values_a, found.values_b) == (20, 2, 3)


def test_one_decides_the_other_is_one_and_no_association_is_zero():
    assert association.cramers_v(table([[10, 0], [0, 10]])).v == pytest.approx(1.0, abs=1e-12)
    assert association.cramers_v(table([[10, 10], [10, 10]])).v == 0.0


@pytest.mark.parametrize("cells", [[], [("r", "c", 1)], [("r", "c", 40)], [("r", "c", 20), ("r", "d", 20)],
                                   [("r", "c", 20), ("s", "c", 20)]])
def test_a_side_with_one_value_or_fewer_than_two_vehicles_has_no_v_but_keeps_its_counts(cells):
    found = association.cramers_v(cells)
    assert found.v is None
    assert found.vehicles == sum(n for *_, n in cells)


def test_v_stays_between_zero_and_one_on_random_tables():
    generator = random.Random(7)
    for _ in range(300):
        rows, columns = generator.randint(2, 7), generator.randint(2, 7)
        cells = table([[generator.choice([0, 0, 1, 2, 5, 40]) for _ in range(columns)] for _ in range(rows)])
        found = association.cramers_v(cells)
        assert found.v is None or 0.0 <= found.v <= 1.0 + 1e-12, (found, cells)


# --- the pairs that are not findings, read from config ---------------------------------------------------------------


def synthetic(rolls: list, listed: list, dims: dict):
    """A config and a data map over invented names: `dims` maps a dimension id to the logical fields its derive block mentions
    (one field is a lookup of it, several are a range lookup); `rolls` is (field, target) and `listed` is (a, b, basis)."""
    logical = {f: f.upper() for fields in dims.values() for f in fields}

    def derive(fields):
        return {"kind": "lookup", "field": fields[0]} if len(fields) == 1 else {"kind": "range_lookup", "keys": {f: f for f in fields}}

    cfg = SimpleNamespace(pipeline={"fields": logical},
                          dimensions={"dimensions": [{"id": i, "derive": derive(fields)} for i, fields in dims.items()]})
    entries = [{"name": name, "source": "register", "bound": field,
                "relations": {"rolls_up_to": [{"to": t, "via": None, "holds_on": "by_construction"} for f, t in rolls if f == name]}}
               for field, name in logical.items()]
    dmap = {"fields": entries, "moves_together": {"true_by_definition": [{"a": a, "b": b, "basis": basis} for a, b, basis in listed]}}
    return cfg, dmap


def test_a_roll_up_a_listed_pair_and_a_shared_field_are_each_marked_and_a_finding_is_not():
    cfg, dmap = synthetic(
        rolls=[("A", "narrow")],
        listed=[("B", "Z", "by_construction")],
        dims={"src": ["a"], "narrow": ["n"], "wide": ["b"], "twin": ["b"], "other": ["z"]})
    found = association.relations(cfg, dmap, ["src", "narrow", "wide", "twin", "other"])
    # The dimension read from field A alone stands for it, and A rolls up to the dimension "narrow".
    assert found[frozenset(("src", "narrow"))] == [{"kind": "rolls_up", "basis": "by_construction"}]
    assert found[frozenset(("wide", "twin"))] == [{"kind": "same_field", "basis": None}]
    assert found[frozenset(("wide", "other"))] == [{"kind": "true_by_definition", "basis": "by_construction"}]
    assert found[frozenset(("twin", "other"))] == [{"kind": "true_by_definition", "basis": "by_construction"}]
    for finding in (("src", "other"), ("narrow", "wide"), ("src", "wide")):
        assert frozenset(finding) not in found, finding


def test_a_dimension_read_from_several_fields_does_not_carry_a_fields_roll_up():
    cfg, dmap = synthetic(rolls=[("A", "narrow"), ("N", "B")], listed=[], dims={"src": ["a"], "narrow": ["n"], "multi": ["a", "b"], "b_alone": ["b"]})
    found = association.relations(cfg, dmap, ["src", "narrow", "multi", "b_alone"])
    # "multi" is derived from A but is not A, so A's roll-up does not make it roll up to "narrow"; it does share a field with "src".
    assert found.get(frozenset(("multi", "narrow"))) is None
    assert found[frozenset(("src", "multi"))] == [{"kind": "same_field", "basis": None}]
    # Nor does anything roll up to "multi" by naming field B, which it is partly derived from: only a dimension read from B alone is B.
    assert found.get(frozenset(("narrow", "multi"))) is None
    assert found[frozenset(("narrow", "b_alone"))] == [{"kind": "rolls_up", "basis": "by_construction"}]
    assert found[frozenset(("src", "narrow"))] == [{"kind": "rolls_up", "basis": "by_construction"}]


def test_rolling_up_is_followed_through_other_dimensions_and_both_directions_of_a_pair_are_one_pair():
    cfg, dmap = synthetic(
        rolls=[("A", "mid"), ("M", "top")],
        listed=[],
        dims={"low": ["a"], "mid": ["m"], "top": ["t"], "side": ["s"]})
    found = association.relations(cfg, dmap, ["low", "mid", "top", "side"])
    assert found[frozenset(("low", "mid"))] == [{"kind": "rolls_up", "basis": "by_construction"}]
    assert found[frozenset(("mid", "top"))] == [{"kind": "rolls_up", "basis": "by_construction"}]
    assert found[frozenset(("low", "top"))] == [{"kind": "rolls_up", "basis": "by_construction"}]
    assert frozenset(("side", "top")) not in found and frozenset(("low", "side")) not in found


def test_a_listed_pair_is_matched_on_a_dimension_id_or_a_field_it_is_derived_from_in_either_order():
    cfg, dmap = synthetic(rolls=[], listed=[("B", "p", "by_definition_inferred")], dims={"p": ["x"], "q": ["b"], "r": ["y"]})
    found = association.relations(cfg, dmap, ["p", "q", "r"])
    assert found == {frozenset(("p", "q")): [{"kind": "true_by_definition", "basis": "by_definition_inferred"}]}
