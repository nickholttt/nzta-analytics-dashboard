"""data/reference/model_segment.csv is well formed (D-117). Nothing reads the file in a build yet, so this is the only check
that stands between a bad row and the day a build starts to read it: a row with the wrong number of fields, a value outside
the allowed words, two rows that could match one vehicle, a make the brand registry does not know, a call made at high
confidence without a page and the date it was read.

The checks are written over the text of a file so that the tests below can show each one failing on a made-up file."""

from __future__ import annotations

import csv
import io
import re

import pytest

from pipeline import config, reference

FILE = "model_segment.csv"
HEADER = ["make", "models", "class", "match_vehicle_year_min", "match_vehicle_year_max", "confidence", "basis", "note"]
CLASSES = {"suv", "car", "unresolved"}
CONFIDENCE = {"high", "medium", "low"}
URL = re.compile(r"https?://[^\s;,)]+")
DATE_READ = re.compile(r"\bread \d{4}-\d{2}-\d{2}\b")


def problems(text: str, makes: set[str]) -> list[str]:
    """Everything wrong with a file's text, one line each; empty when it is well formed."""
    found: list[str] = []
    if "\r" in text:
        found.append("the file has carriage returns: it must be written with LF line endings")
    rows = list(csv.reader(io.StringIO(text, newline="")))
    if not rows or rows[0] != HEADER:
        return found + [f"the header must be exactly {HEADER}, not {rows[0] if rows else 'empty'}"]
    seen: dict[tuple[str, str], list[tuple[int, int | None, int | None]]] = {}
    for line, row in enumerate(rows[1:], start=2):
        if len(row) != len(HEADER):
            found.append(f"line {line}: {len(row)} fields where the header has {len(HEADER)}")
            continue
        r = dict(zip(HEADER, row))
        label = f"line {line} ({r['make']}|{r['models']})"
        if r["make"] not in makes:
            found.append(f"{label}: make is not a make_canonical in the brand registry")
        models = r["models"].split("|")
        if not r["models"] or any(m == "" or m != m.strip() for m in models) or len(set(models)) != len(models):
            found.append(f"{label}: models must be non-empty, trimmed, pipe-separated names with none repeated")
        if r["class"] not in CLASSES:
            found.append(f"{label}: class {r['class']!r} is not one of {sorted(CLASSES)}")
        if r["confidence"] not in CONFIDENCE:
            found.append(f"{label}: confidence {r['confidence']!r} is not one of {sorted(CONFIDENCE)}")
        if (r["class"] == "unresolved") != (r["confidence"] == "low"):
            found.append(f"{label}: a row is unresolved exactly when its confidence is low")
        years = []
        for column in ("match_vehicle_year_min", "match_vehicle_year_max"):
            value = r[column]
            if value and not (value.isdigit() and len(value) == 4):
                found.append(f"{label}: {column} {value!r} is not a four-digit year")
            years.append(int(value) if value.isdigit() else None)
        if None not in years and years[0] > years[1]:
            found.append(f"{label}: match_vehicle_year_min is after match_vehicle_year_max")
        if not r["basis"].strip():
            found.append(f"{label}: every row needs a basis")
        if r["confidence"] in ("high", "medium") and not (URL.search(r["basis"]) and DATE_READ.search(r["basis"])):
            found.append(f"{label}: a {r['confidence']} row's basis must carry a URL and the date it was read ('read YYYY-MM-DD')")
        for model in models:
            for other_line, lo, hi in seen.get((r["make"], model), []):
                starts = [y for y in (years[0], lo) if y is not None]
                ends = [y for y in (years[1], hi) if y is not None]
                if not (starts and ends and max(starts) > min(ends)):
                    found.append(f"{label}: {model} is also matched by line {other_line}, and some vehicle could meet both")
            seen.setdefault((r["make"], model), []).append((line, years[0], years[1]))
    return found


def registry_makes() -> set[str]:
    cfg = config.load()
    b = cfg.pipeline["brand"]
    return {r[b["canonical"]] for r in reference.read(cfg.reference(b["registry"]))}


def test_the_file_is_well_formed():
    text = config.load().reference(FILE).read_bytes().decode("utf-8")
    assert problems(text, registry_makes()) == []


def test_the_file_holds_rows_of_every_class():
    rows = list(csv.DictReader(io.StringIO(config.load().reference(FILE).read_text(encoding="utf-8"), newline="")))
    assert {r["class"] for r in rows} == CLASSES


PAGE = "a page https://example.org/a read 2026-01-01"


def build(*rows: list[str], header: list[str] = HEADER, newline: str = chr(10)) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator=newline)
    writer.writerow(header)
    writer.writerows(rows)
    return out.getvalue()


# make, models, class, year min, year max, confidence, basis, note
CAR = ["AAAA", "XX1|XX2", "car", "", "", "medium", PAGE, ""]
SUV = ["AAAA", "XX3", "suv", "", "2019", "high", PAGE, ""]
LATER = ["AAAA", "XX3", "unresolved", "2020", "", "low", "nothing read", ""]


def with_(row: list[str], **changes: str) -> list[str]:
    return [changes.get(name, value) for name, value in zip(HEADER, row)]


@pytest.mark.parametrize("text, said", [
    (build(CAR, SUV, LATER), None),
    (build(CAR + ["extra"]), "9 fields where the header has 8"),
    (build(CAR[:-1]), "7 fields where the header has 8"),
    (build(with_(CAR, **{"class": "wagon"})), "is not one of ['car', 'suv', 'unresolved']"),
    (build(with_(CAR, make="ZZZZ")), "not a make_canonical"),
    (build(with_(CAR, models="XX1||XX2")), "non-empty, trimmed"),
    (build(with_(CAR, models="XX1|XX1")), "none repeated"),
    (build(with_(SUV, basis="https://example.org/a")), "the date it was read"),
    (build(with_(CAR, basis="a page read 2026-01-01")), "a URL and the date"),
    (build(with_(CAR, basis="")), "every row needs a basis"),
    (build(SUV, with_(LATER, match_vehicle_year_min="2018")), "also matched by line 2"),
    (build(SUV, with_(LATER, match_vehicle_year_min="")), "also matched by line 2"),
    (build(with_(CAR, confidence="certain")), "is not one of ['high', 'low', 'medium']"),
    (build(with_(CAR, confidence="low")), "exactly when its confidence is low"),
    (build(with_(LATER, confidence="medium")), "exactly when its confidence is low"),
    (build(with_(SUV, match_vehicle_year_max="19")), "not a four-digit year"),
    (build(with_(SUV, match_vehicle_year_min="2021")), "is after match_vehicle_year_max"),
    (build(CAR, newline=chr(13) + chr(10)), "carriage returns"),
    (build(CAR, header=["make", "model", *HEADER[2:]]), "the header must be exactly"),
])
def test_each_check_fails_on_a_file_that_breaks_it(text, said):
    found = problems(text, {"AAAA"})
    if said is None:
        assert found == []
    else:
        assert any(said in line for line in found), found
