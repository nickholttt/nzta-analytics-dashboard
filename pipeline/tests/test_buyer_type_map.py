"""The form of data/reference/buyer_type_map.csv: one row for every owner type NZTA's dashboard sends times every vehicle
usage value it sends, each giving the buyer type, with a note saying why.

Nothing reads the file yet; the build reads it as a two-key lookup once the dimension is added. This module holds what a
lookup cannot see: that no pair is missing (a pair with no row would read `__UNMAPPED__` and stop the build, so a gap in
the file is a gap caught late), that no pair is listed twice, and that the one rule beyond the owner type is kept to one
usage value. No value of the register or of the dashboard is written here (invariant 1): the file itself is the
vocabulary. Each check is shown to fail on a file made up for the purpose.
"""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from pathlib import Path

from pipeline.contract import NOT_BROKEN_DOWN, OTHER, UNDEFINED, UNMAPPED

FILE = Path(__file__).resolve().parents[2] / "data" / "reference" / "buyer_type_map.csv"
HEADER = ["nzta_owner_type", "nzta_vehicle_usage", "buyer_type", "basis"]
RESERVED = {UNDEFINED, UNMAPPED, OTHER, NOT_BROKEN_DOWN}


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
        return found + ["the file holds no row"]
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
    pairs = [(r[0], r[1]) for r in complete]
    found += [f"the pair {p} is listed more than once" for p in sorted({p for p in pairs if pairs.count(p) > 1})]
    owners, usages = {p[0] for p in pairs}, {p[1] for p in pairs}
    found += [f"no row for the pair {(o, u)}: every owner type needs a row for every usage value"
              for o in sorted(owners) for u in sorted(usages) if (o, u) not in set(pairs)]
    found += [f"the buyer type {t!r} is a reserved token" for t in sorted({r[2] for r in complete} & RESERVED)]
    # The rule beyond the owner type: the usage value that sets one owner type's rows apart. At most one owner type may
    # have more than one buyer type, and in it the buyer type that differs must hold a single usage value.
    types = defaultdict(lambda: defaultdict(set))
    for owner, usage, buyer, *_ in complete:
        types[owner][buyer].add(usage)
    split = {o: b for o, b in types.items() if len(b) > 1}
    if len(split) > 1:
        found.append(f"more than one owner type is split by usage: {sorted(split)}")
    for owner, buyers in split.items():
        if len(buyers) > 2 or min(len(u) for u in buyers.values()) != 1:
            found.append(f"the owner type {owner!r} is split by more than one usage value")
    return found


def good_file() -> str:
    return ("nzta_owner_type,nzta_vehicle_usage,buyer_type,basis\n"
            "P-1,U-1,T-1,A note.\nP-1,U-2,T-1,A note.\n"
            "P-2,U-1,T-2,A note.\nP-2,U-2,T-3,A note.\n")


def test_the_file_is_well_formed():
    assert problems(FILE.read_text(encoding="utf-8")) == []


def test_the_file_is_stored_with_lf_line_endings():
    assert b"\r" not in FILE.read_bytes()


def test_an_owner_type_that_is_not_split_by_usage_has_one_buyer_type_for_every_usage():
    rows = list(csv.DictReader(FILE.open(encoding="utf-8", newline="")))
    by_owner = defaultdict(set)
    for r in rows:
        by_owner[r["nzta_owner_type"]].add(r["buyer_type"])
    assert sum(len(b) > 1 for b in by_owner.values()) == 1, "exactly one owner type is split by usage"


def test_the_checks_pass_a_good_file_and_name_each_fault_in_a_made_up_one():
    assert problems(good_file()) == []
    faults = {
        "header": good_file().replace("basis", "notes"),
        "a short line": good_file() + "P-3,U-1,T-1\n",
        "a blank note": good_file() + 'P-1,U-3,T-1,""\n',
        "a padded cell": good_file() + "P-1,U-3, T-1,A note.\n",
        "a pair twice": good_file() + "P-1,U-1,T-1,A note.\n",
        "a missing pair": good_file().replace("P-2,U-2,T-3,A note.\n", ""),
        "a reserved buyer type": good_file().replace("T-3", UNMAPPED),
        "the catch-all token as a buyer type": good_file().replace("T-3", OTHER),
        "a second owner type split by usage": good_file().replace("P-1,U-2,T-1", "P-1,U-2,T-4"),
        "a split by two usage values": ("nzta_owner_type,nzta_vehicle_usage,buyer_type,basis\n"
                                        "P-1,U-1,T-1,A note.\nP-1,U-2,T-2,A note.\nP-1,U-3,T-2,A note.\nP-1,U-4,T-1,A note.\n"),
        "no row": "nzta_owner_type,nzta_vehicle_usage,buyer_type,basis\n",
        "CR endings": good_file().replace("\n", "\r\n"),
    }
    for name, text in faults.items():
        assert problems(text), f"the checks accept a file with {name}"
