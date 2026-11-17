"""The form of data/reference/transmission_map.csv: each raw gearbox value NZTA writes, its group, a readable label and the basis
for the group (D-128).

The file is read as a lookup by the `transmission` dimension (tests in test_register_fields.py). This module holds what the
lookup cannot see: that every row is complete, that a raw value is listed once, that groups and labels are plain words and not
the cube's reserved tokens, and that every row says why its value is in its group. Each check is shown to fail on a file made
up for the purpose, so a test that cannot fail does not pass for one that holds. No value of the register is written here
(invariant 1): the file itself is the vocabulary.
"""

from __future__ import annotations

import csv
import io
from pathlib import Path

from pipeline.contract import OTHER, UNDEFINED, UNMAPPED

FILE = Path(__file__).resolve().parents[2] / "data" / "reference" / "transmission_map.csv"
HEADER = ["nzta_transmission", "group", "label", "notes"]
RESERVED = {UNDEFINED, UNMAPPED, OTHER}


def problems(text: str) -> list[str]:
    """Everything wrong with a file's text, as sentences. Empty means the file is well formed."""
    found: list[str] = []
    lines = list(csv.reader(io.StringIO(text, newline="")))
    if not lines or lines[0] != HEADER:
        return [f"the header is {lines[0] if lines else 'missing'}, not {HEADER}"]
    body = lines[1:]
    if "\r" in text:
        found.append("the file has CR characters: it must end its lines with LF")
    if not body:
        return found + ["the file holds no value"]
    for number, row in enumerate(body, start=2):
        if len(row) != len(HEADER):
            found.append(f"line {number} has {len(row)} fields, not {len(HEADER)}")
            continue
        for name, cell in zip(HEADER, row):
            if not cell.strip():
                found.append(f"line {number}: {name} is blank")
            elif cell != cell.strip():
                found.append(f"line {number}: {name} has spaces at an end")
    complete = [r for r in body if len(r) == len(HEADER)]
    keys = [r[0] for r in complete]
    found += [f"{k!r} is listed more than once" for k in sorted({k for k in keys if keys.count(k) > 1})]
    labels = [r[2] for r in complete]
    found += [f"two values share the label {k!r}" for k in sorted({k for k in labels if labels.count(k) > 1})]
    groups = {r[1] for r in complete}
    if len(groups) < 2:
        found.append("the file holds fewer than two groups, so it would not divide anything")
    found += [f"the group {g!r} is a reserved token" for g in sorted(groups & RESERVED)]
    found += [f"the label {l!r} is a reserved token" for l in sorted(set(labels) & RESERVED)]
    found += [f"the group {g!r} is also a raw value, so a group could be read as a code" for g in sorted(groups & set(keys))]
    return found


def good_file() -> str:
    return "nzta_transmission,group,label,notes\nA-1,Group one,Value one,The value says so.\nB-2,Group two,Value two,The value says so.\n"


def test_the_file_is_well_formed():
    assert problems(FILE.read_text(encoding="utf-8")) == []


def test_the_file_is_stored_with_lf_line_endings():
    assert b"\r" not in FILE.read_bytes()


def test_the_checks_pass_a_good_file_and_name_each_fault_in_a_made_up_one():
    assert problems(good_file()) == []
    faults = {
        "header": good_file().replace("notes", "basis"),
        "a short line": good_file() + "C-3,Group one,Value three\n",
        "a blank basis": good_file() + 'C-3,Group one,Value three,""\n',
        "a padded cell": good_file() + "C-3,Group one, Value three,A note.\n",
        "a value twice": good_file() + "A-1,Group two,Value three,A note.\n",
        "a label twice": good_file() + "C-3,Group two,Value one,A note.\n",
        "one group only": good_file().replace("Group two", "Group one"),
        "a reserved group": good_file().replace("Group two", UNMAPPED),
        "a group that is a value": good_file().replace("Group two", "A-1"),
        "no value": "nzta_transmission,group,label,notes\n",
        "CR endings": good_file().replace("\n", "\r\n"),
    }
    for name, text in faults.items():
        assert problems(text), f"the checks accept a file with {name}"
