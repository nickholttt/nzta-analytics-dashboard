"""The roll-up of the powertrain into groups (D-124): one group for each powertrain value, in plain words.

A group is read from the same final motive power as the powertrain (after mild_hybrid_models.csv has moved hybrid nameplates
between two codes), so a vehicle's group is a function of the powertrain it ends up with only if the reference file gives every
powertrain value exactly one group. These tests hold that for the file, and (further down) for what a build publishes. No
powertrain or group value is written in this file (invariant 1): every one is read from config and the reference file.
"""

from __future__ import annotations

import csv
from collections import defaultdict

from pipeline import config, reference
from pipeline.contract import OTHER, UNDEFINED, UNMAPPED

from .conftest import make_cfg

POWERTRAIN, GROUP, LABEL, DETAIL = "powertrain", "powertrain_group", "powertrain_group_label", "powertrain_detail"


def map_rows(cfg=None) -> list[dict]:
    cfg = cfg or make_cfg({})
    return reference.read(cfg.reference(cfg.pipeline["engine"]["reference"]))


def groups_of_each(rows, key: str, value: str) -> dict[str, set[str]]:
    out: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        out[r[key]].add(r[value])
    return out


def test_every_powertrain_value_sits_in_exactly_one_group_and_has_one_label():
    rows = map_rows()
    assert len({r[POWERTRAIN] for r in rows}) >= 8, "too few powertrain values to prove anything"
    for column in (GROUP, LABEL):
        split = {p: v for p, v in groups_of_each(rows, POWERTRAIN, column).items() if len(v) != 1}
        assert not split, f"a powertrain value in more than one {column}: {split}"


def test_a_group_has_one_label_and_a_label_one_group():
    rows = map_rows()
    by_group, by_label = groups_of_each(rows, GROUP, LABEL), groups_of_each(rows, LABEL, GROUP)
    assert all(len(v) == 1 for v in by_group.values()), by_group
    assert all(len(v) == 1 for v in by_label.values()), by_label


def test_the_two_values_the_mild_split_moves_between_are_in_the_same_group():
    """The split moves a vehicle between the two (pipeline.json hybrid_classification), and withholding it moves the
    mild ones back, so the group must not depend on which of the two a vehicle shows."""
    cfg = make_cfg({})
    h = cfg.pipeline["hybrid_classification"]
    groups = groups_of_each(map_rows(cfg), POWERTRAIN, GROUP)
    assert groups[h["mild_powertrain"]] == groups[h["undivided_powertrain"]] and len(groups[h["mild_powertrain"]]) == 1
    # Every override the hybrid file can write is a code of the map, so the vehicle's final code has a group.
    codes = {r[cfg.pipeline["engine"]["key"]] for r in map_rows(cfg)}
    overrides = {r[h["override"]] for r in reference.read(cfg.reference(h["file"])) if r[h["override"]]}
    assert overrides and overrides <= codes


def test_a_label_is_plain_words_that_cannot_be_taken_for_a_single_powertrain_value():
    """A visitor sees only the label. It may share its words with a powertrain value only of its own group (a group
    that holds the values none of the others do is called by the word those values share); it is never the name of a
    value of another group, nor the internal key of any other group, nor a reserved value."""
    rows = map_rows()
    labels = {r[LABEL] for r in rows}
    assert len(labels) >= 4
    reserved = {UNDEFINED, UNMAPPED, OTHER}
    for r in rows:
        label = r[LABEL]
        assert label and label.strip() == label and not label.startswith("_") and label not in reserved, repr(label)
    for label in labels:
        group = next(r[GROUP] for r in rows if r[LABEL] == label)
        others = {name.lower() for r in rows if r[GROUP] != group for name in (r[POWERTRAIN], r[DETAIL], r[GROUP])}
        assert label.lower() not in others, f"{label!r} is also the name of a value in another group"
    # The internal key is not the label of any group: the hybrid classification reads the key's own values.
    h = config.load().pipeline["hybrid_classification"]["source_hybrid"]
    assert h["column"] == GROUP
    assert h["value"] not in labels, "the key the hybrid classification reads is also a visible label"


def test_the_label_column_is_in_the_file_the_file_is_read_with_and_ends_in_a_line_break():
    cfg = make_cfg({})
    path = cfg.reference(cfg.pipeline["engine"]["reference"])
    raw = path.read_bytes()
    assert b"\r" not in raw and raw.endswith(b"\n")
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.reader(handle))
    assert LABEL in rows[0] and len({len(r) for r in rows}) == 1, "a row with a different number of fields"
