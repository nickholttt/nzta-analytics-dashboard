"""The rule of an ordered rule file (pipeline/reference.py, rule_problems): what a file read in order, first rule wins, must hold
before a build reads it, shown failing on made-up files.

The file's own words are not here (invariant 1): the tests use a made-up file, made-up names and made-up column names, and
hold the rules that make a file safe to apply: the numbers rise down the file, a result is a plain word and never one of the
cube's reserved values, a list names each thing once and only things the vocabulary it points at holds, a bound is a whole
number and its lower end is not above its upper end, and a field cannot be bounded and also said not to be recorded.
"""

from __future__ import annotations

import csv
import io

import pytest

from pipeline import reference
from pipeline.contract import OTHER, UNDEFINED, UNMAPPED
from pipeline.errors import GuardrailError

SPEC = {
    "order": "no", "value": "result",
    "tests": [
        {"column": "kinds", "field": "kind", "test": "any_of", "separator": "|", "values_from": {"reference": "kinds.csv", "column": "kind"}},
        {"column": "shapes", "field": "shape", "test": "any_of", "separator": "|"},
        {"column": "size_min", "field": "size", "test": "at_least"},
        {"column": "size_max", "field": "size", "test": "at_most"},
        {"column": "size_known", "field": "size", "test": "recorded"},
        {"column": "tag", "field": "tag", "test": "equals", "values_from": {"reference": "tags.csv", "column": "tag"}},
    ],
}
COLUMNS = ["no", "kinds", "shapes", "size_min", "size_max", "size_known", "tag", "result"]
VOCABULARIES = {"kinds": {"alpha", "beta", "gamma"}, "tag": {"north", "south"}}
RESERVED = {UNDEFINED, UNMAPPED, OTHER}


def rule(**cells: str) -> dict[str, str]:
    return {c: cells.get(c, "") for c in COLUMNS} | {"no": cells.get("no", "1"), "result": cells.get("result", "one")}


GOOD = [
    rule(no="1", kinds="alpha|beta", size_min="3501", result="heavy"),
    rule(no="2", kinds="alpha", shapes="round|flat", size_max="3500", result="light"),
    rule(no="3", kinds="gamma", size_known="false", result="unknown"),
    rule(no="5", tag="north", result="north"),
    rule(no="9", result="rest"),
]


def problems(rows: list[dict[str, str]], spec: dict = SPEC) -> list[str]:
    return reference.rule_problems(rows, spec, VOCABULARIES, RESERVED)


def test_a_well_formed_file_has_no_problem_and_numbers_may_leave_gaps():
    assert problems(GOOD) == []


@pytest.mark.parametrize("rows, said", [
    ([rule(no="2"), rule(no="1")], "must rise down the file"),
    ([rule(no="2"), rule(no="2")], "must rise down the file"),
    ([rule(no="one")], "is not a whole number"),
    ([rule(no="1", result="")], "trimmed, non-empty word"),
    ([rule(no="1", result=" padded")], "trimmed, non-empty word"),
    ([rule(no="1", result=UNMAPPED)], "reserved value"),
    ([rule(no="1", result=OTHER)], "reserved value"),
    ([rule(no="1", kinds="alpha|delta")], "which kinds.csv does not hold"),
    ([rule(no="1", kinds="alpha||beta")], "none repeated"),
    ([rule(no="1", shapes="round|round")], "none repeated"),
    ([rule(no="1", shapes="round| flat")], "none repeated"),
    ([rule(no="1", size_min="3.5")], "is not a whole number"),
    ([rule(no="1", size_max="-1")], "is not a whole number"),
    ([rule(no="1", size_min="400", size_max="300")], "lower bound on size is above the upper bound"),
    ([rule(no="1", size_known="yes")], "must be empty or one of"),
    ([rule(no="1", size_min="10", size_known="false")], "a bound needs a recorded value"),
    ([rule(no="1", tag="east")], "is not held by tags.csv"),
])
def test_each_fault_is_named(rows, said):
    assert any(said in p for p in problems(rows)), problems(rows)


def test_a_bound_on_both_sides_that_meet_is_allowed_and_a_recorded_field_may_be_bounded():
    rows = [rule(no="1", size_min="300", size_max="300", size_known="true")]
    assert problems(rows) == []


def test_a_row_longer_or_shorter_than_the_header_is_named_and_the_others_are_still_read(tmp_path):
    text = "\n".join([",".join(COLUMNS), "1,,,,,,,one,extra", "2,,,,,,", "3,,,,,,,three", ""])
    (tmp_path / "rules.csv").write_text(text, encoding="utf-8", newline="")
    got = problems(reference.read(tmp_path / "rules.csv"))
    assert got == ["line 2: has more fields than the header (a comma outside quotes?)",
                   "line 3: has fewer fields than the header (a comma outside quotes?)"]


def test_an_empty_file_and_a_missing_column_are_named():
    assert problems([]) == ["the file has no rules"]
    short = [{c: "x" for c in COLUMNS if c != "size_max"}]
    assert problems(short) == ["the file has no column 'size_max'"]


def test_a_test_the_code_does_not_know_is_named():
    spec = {**SPEC, "tests": [{"column": "kinds", "field": "kind", "test": "contains", "separator": "|"}]}
    assert any("is not one of" in p for p in reference.rule_problems([rule(no="1")], spec, {}, RESERVED))


def test_a_faulty_file_aborts_with_every_fault_named(tmp_path):
    out = io.StringIO()
    writer = csv.DictWriter(out, COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows([rule(no="2", kinds="delta"), rule(no="1", result=UNMAPPED)])
    (tmp_path / "rules.csv").write_text(out.getvalue(), encoding="utf-8", newline="")
    (tmp_path / "kinds.csv").write_text("kind\nalpha\nbeta\n", encoding="utf-8", newline="")
    (tmp_path / "tags.csv").write_text("tag\nnorth\n", encoding="utf-8", newline="")

    class Cfg:
        def reference(self, name):
            return tmp_path / name

    with pytest.raises(GuardrailError) as raised:
        reference.ordered_rules(Cfg(), {**SPEC, "reference": "rules.csv"}, "dimension probe")
    text = str(raised.value)
    assert "dimension probe" in text and "kinds.csv does not hold" in text and "reserved value" in text and "must rise" in text


def test_the_vocabulary_of_a_test_is_read_from_the_file_it_names(tmp_path):
    (tmp_path / "kinds.csv").write_text("kind\nalpha\nbeta\n", encoding="utf-8", newline="")
    (tmp_path / "tags.csv").write_text("tag\nnorth\n", encoding="utf-8", newline="")

    class Cfg:
        def reference(self, name):
            return tmp_path / name

    assert reference.rule_vocabularies(Cfg(), SPEC["tests"]) == {"kinds": {"alpha", "beta"}, "tag": {"north"}}
