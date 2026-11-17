"""The roll-up of the powertrain into groups (D-124): one group for each powertrain value, in plain words.

A group is read from the same final motive power as the powertrain (after mild_hybrid_models.csv has moved hybrid nameplates
between two codes), so a vehicle's group is a function of the powertrain it ends up with only if the reference file gives every
powertrain value exactly one group. These tests hold that for the file, and (further down) for what a build publishes. No
powertrain or group value is written in this file (invariant 1): every one is read from config and the reference file.
"""

from __future__ import annotations

import csv
import math
from collections import defaultdict

import duckdb
import pytest

from pipeline import build, config, derive, reference
from pipeline.contract import OTHER, UNDEFINED, UNMAPPED
from pipeline.errors import GuardrailError

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages
from .test_register_fields import (SURVIVING, counted, expected_lookup_counts, fact_counts, new_code_in_snapshot_month,
                                   slice_counts, source_column)

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


# --- what a build publishes ---------------------------------------------------------------------------------------------

DIM = "powertrain_group"


def build_fixture(tmp_path, workspace, extra_rows=(), tweak=None):
    """The fixture register built into this workspace, after `tweak(cfg)` if one is given."""
    rows = load_rows() + list(extra_rows)
    cfg = make_cfg(workspace)
    if tweak:
        tweak(cfg)
    manifest = build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    return cfg, rows, manifest


def publishing_the_split(cfg):
    cfg.pipeline["hybrid_classification"]["publish_split_at_trailing_high_confidence_coverage"] = 0.0


def the_label_of(cfg) -> dict[str, str]:
    """Each powertrain value's group name, from the reference file alone."""
    return {r[POWERTRAIN]: r[LABEL] for r in map_rows(cfg)}


def fact_pairs(public, dataset: str = SURVIVING) -> list[tuple[str, str, int]]:
    """(powertrain, group, vehicles) for every row of the fact table: its column files line up row by row."""
    d = public / "facts" / dataset
    con = duckdb.connect()
    parts = {c: f"(SELECT row_number() OVER () AS i, {c} FROM read_parquet('{(d / (c + '.parquet')).as_posix()}')) {c}"
             for c in (POWERTRAIN, DIM, "n")}
    rows = con.execute(f"SELECT {POWERTRAIN}.{POWERTRAIN}, {DIM}.{DIM}, n.n FROM {parts[POWERTRAIN]} "
                       f"JOIN {parts[DIM]} USING (i) JOIN {parts['n']} USING (i)").fetchall()
    con.close()
    return rows


def test_every_dataset_that_cuts_by_powertrain_carries_the_group_beside_it_and_guards_it():
    cfg = make_cfg({})
    datasets = {d: spec for d, spec in cfg.pipeline["datasets"].items() if POWERTRAIN in (spec.get("facts") or [])}
    assert len(datasets) >= 3
    for dataset, spec in datasets.items():
        assert DIM in spec["facts"], dataset
        assert DIM in {d["id"] for d in derive.applicable(cfg, dataset)[0]}, dataset
    abort = cfg.pipeline["guardrails"]["abort_on_unmapped"]
    assert DIM in abort and POWERTRAIN in abort
    dims = {d["id"]: d for d in cfg.dimensions["dimensions"]}
    assert dims[DIM]["derive"]["field"] == dims[POWERTRAIN]["derive"]["field"]
    assert dims[DIM]["derive"]["value"] == LABEL, "the dimension must publish the visible name, not the key the hybrid classification reads"


def test_the_group_counts_are_the_powertrain_counts_rolled_up_and_every_vehicle_is_in_the_group_of_its_powertrain(tmp_path, workspace):
    cfg, rows, manifest = build_fixture(tmp_path, workspace, tweak=publishing_the_split)
    entry = manifest["datasets"][SURVIVING]
    assert DIM in entry["live_dimensions"] and DIM in entry["facts"]["dimensions"] and DIM not in entry["not_live"]
    # Worked out from the raw codes and the reference file, before the mild split moves a hybrid between two codes: the
    # same figures, because the two codes it moves between share a group.
    expected = expected_lookup_counts(cfg, DIM, counted(cfg, rows, entry["latest_month"]))
    assert len(expected) >= 4 and UNMAPPED not in expected
    assert slice_counts(workspace["public"], DIM) == expected
    assert fact_counts(workspace["public"], DIM) == expected
    assert entry["unmapped_rates"][DIM] == entry["unmapped_rates"][POWERTRAIN] == 0.0
    # Zero vehicles whose group is not the group of their final powertrain, and a powertrain never in two groups.
    pairs = fact_pairs(workspace["public"])
    label = the_label_of(cfg)
    disagree = sum(n for p, g, n in pairs if p in label and label[p] != g)
    assert pairs and disagree == 0, f"{disagree} vehicles sit in a group other than their powertrain's"
    assert all(g == label[p] for p, g, n in pairs if p in label)
    # A hybrid code the mild split moved is in the fixture, so the check above covers a vehicle that changed code.
    h = cfg.pipeline["hybrid_classification"]
    assert {h["mild_powertrain"], h["undivided_powertrain"]} <= {p for p, _, _ in pairs}


def test_the_group_is_published_where_the_mild_split_is_withheld_and_does_not_move(tmp_path, workspace):
    cfg = make_cfg(workspace)
    h = cfg.pipeline["hybrid_classification"]
    mild = h["mild_powertrain"]
    rows = load_rows()

    h["publish_split_at_trailing_high_confidence_coverage"] = 0.0
    shown = build.build(cfg, source_for(rows), write_pages(tmp_path / "shown", rows), None, NOW)
    assert shown["datasets"][SURVIVING]["mild_hybrid_identification_coverage"]["mild_split_published"] is True
    published = slice_counts(workspace["public"], DIM)
    assert mild in {p for p, _, _ in fact_pairs(workspace["public"])}

    h["publish_split_at_trailing_high_confidence_coverage"] = 1.0
    withheld = build.build(cfg, source_for(rows), write_pages(tmp_path / "held", rows), None, NOW)
    entry = withheld["datasets"][SURVIVING]
    assert entry["mild_hybrid_identification_coverage"]["mild_split_published"] is False
    assert DIM in entry["live_dimensions"] and DIM in entry["facts"]["dimensions"] and DIM not in entry["not_live"]
    pairs = fact_pairs(workspace["public"])
    assert mild not in {p for p, _, _ in pairs}, "the split is withheld, so no vehicle shows the mild value"
    assert slice_counts(workspace["public"], DIM) == published, "withholding the split moved a vehicle between groups"
    label = the_label_of(cfg)
    assert all(label[p] == g for p, g, n in pairs if p in label)


def test_the_group_adds_no_row_to_the_fact_table(tmp_path, workspace):
    """A group is a function of the powertrain, so the table's rows split no further."""
    _, _, with_group = build_fixture(tmp_path / "with", workspace)

    def without(cfg):
        facts = cfg.pipeline["datasets"][SURVIVING]["facts"]
        cfg.pipeline["datasets"][SURVIVING]["facts"] = [f for f in facts if f != DIM]

    other = {k: v.parent / "without" / v.name for k, v in workspace.items()}
    _, _, plain = build_fixture(tmp_path / "without", other, tweak=without)
    assert DIM not in plain["datasets"][SURVIVING]["facts"]["dimensions"]
    assert with_group["datasets"][SURVIVING]["facts"]["rows"] == plain["datasets"][SURVIVING]["facts"]["rows"] > 0


def test_a_motive_power_the_map_does_not_hold_is_unmapped_in_the_group_and_stops_the_build_by_the_groups_own_guard(tmp_path, workspace):
    rows, cfg0 = load_rows(), make_cfg(workspace)
    g = cfg0.pipeline["guardrails"]
    _, _, manifest = build_fixture(tmp_path / "base", workspace)
    base = manifest["datasets"][SURVIVING]["unmapped_guard"][DIM]["trailing"]["rows"]
    rate = g["max_unmapped_rate_trailing"]
    over = math.floor(rate * base / (1 - rate)) + 1
    assert over >= 2
    assert source_column(cfg0, DIM) == source_column(cfg0, POWERTRAIN)

    beyond = new_code_in_snapshot_month(rows, cfg0, POWERTRAIN, over, 6000)

    def only_the_group(cfg):
        cfg.pipeline["guardrails"]["abort_on_unmapped"] = [DIM]

    with pytest.raises(GuardrailError) as info:
        build_fixture(tmp_path / "over", {k: v.parent / "over" / v.name for k, v in workspace.items()}, beyond, tweak=only_the_group)
    assert f"{SURVIVING}.{DIM}: unmapped rate" in str(info.value), str(info.value)

    def neither(cfg):
        guarded = cfg.pipeline["guardrails"]["abort_on_unmapped"]
        cfg.pipeline["guardrails"]["abort_on_unmapped"] = [d for d in guarded if d not in (DIM, POWERTRAIN)]

    _, _, quiet = build_fixture(tmp_path / "quiet", {k: v.parent / "quiet" / v.name for k, v in workspace.items()}, beyond, tweak=neither)
    assert quiet["datasets"][SURVIVING]["unmapped_rates"][DIM] > 0, "the same rows build when neither dimension is guarded"
