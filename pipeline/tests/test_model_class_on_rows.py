"""The build reads the model class file (config/pipeline.json, model_classes; D-161): every vehicle takes the class of the row of
`model_segment.csv` its canonical make and model meets, inside the row's vehicle-year and mass bounds, and a vehicle that meets
no row has none. This changes no output of its own: the column is in `rows` for the market type rules to read.

The expected class of each vehicle is worked out here from the fixture rows and a made-up copy of the file, not from the
pipeline's own joins. No make, model or class is written in this file (invariant 1): the nameplates are picked from the fixture
rows, and the classes are made-up words.
"""

from __future__ import annotations

import csv
import io
import json
import shutil
from collections import Counter

import duckdb
import pytest

from pipeline import config, normalise, reference, schema
from pipeline.errors import GuardrailError

from .conftest import load_rows, make_cfg, write_pages

HEADER = ["make", "models", "class", "match_vehicle_year_min", "match_vehicle_year_max", "match_gvm_min", "match_gvm_max", "confidence", "basis", "note"]


def plain_nameplates(cfg, rows: list[dict]) -> list[tuple[str, str]]:
    """The fixture's make and model pairs, most vehicles first, whose make the brand registry holds as written and that no model
    override renames: for these the canonical make and model are the register's own, so the expected class needs no pipeline step."""
    f, b = cfg.pipeline["fields"], cfg.pipeline["brand"]
    canonical = {r[b["canonical"]] for r in reference.read(cfg.reference(b["registry"]))}
    overridden = {(r[b["model_registry_make"]], m) for r in reference.read(cfg.reference(b["model_registry"]))
                  for m in [r[b["model_registry_model"]], *reference.split(r[b["model_registry_aliases"]], b["alias_separator"])]}
    counts = Counter((r[f["make"]], r[f["model"]]) for r in rows)
    return [pair for pair, _ in counts.most_common() if pair[0] in canonical and pair not in overridden]


def file_text(rows: list[list[str]]) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(HEADER)
    writer.writerows(rows)
    return out.getvalue()


def segment_row(pair: tuple[str, str], cls: str, **bounds: str) -> list[str]:
    cells = {"make": pair[0], "models": pair[1], "class": cls, "confidence": "high", "basis": "made up", **bounds}
    return [cells.get(h, "") for h in HEADER]


def rows_table(tmp_path, workspace, text: str, fixture: list[dict]):
    """`rows` as the build makes it, with `text` as the model class file."""
    live = config.load()
    reference_dir = tmp_path / "reference"
    shutil.copytree(live.reference("x").parent, reference_dir, dirs_exist_ok=True)
    (reference_dir / live.pipeline["model_classes"]["file"]).write_text(text, encoding="utf-8", newline="")
    cfg = make_cfg(workspace, reference_dir=reference_dir)
    expected = json.loads(cfg.path("expected_schema").read_text(encoding="utf-8"))
    types = schema.pull_types(expected, list(cfg.pipeline["fields"].values()))
    con = duckdb.connect()
    normalise.ingest(con, write_pages(tmp_path / "pages", fixture), types)
    normalise.build_src(con, cfg, types, {f["name"] for f in expected["fields"]})
    con.execute("DROP TABLE raw")
    normalise.build_rows(con, cfg)
    return cfg, con


def classes_by_vehicle(cfg, con) -> dict[int, str | None]:
    column = cfg.pipeline["model_classes"]["column"]
    return dict(con.execute(f'SELECT "object_id", "{column}" FROM rows').fetchall())


def expected_class(cfg, vehicle: dict, spec: list[tuple[tuple[str, str], str, dict]]) -> str | None:
    """What the file says of one vehicle by the rule written out: the row whose make and model it carries and whose bounds it is inside."""
    f = cfg.pipeline["fields"]
    year, mass = vehicle.get(f["vehicle_year"]), vehicle.get(f["gvm"]) or None
    for pair, cls, bounds in spec:
        if (vehicle[f["make"]], vehicle[f["model"]]) != pair:
            continue
        low_year, high_year = bounds.get("match_vehicle_year_min"), bounds.get("match_vehicle_year_max")
        low_mass, high_mass = bounds.get("match_gvm_min"), bounds.get("match_gvm_max")
        if (low_year and not (year is not None and year >= int(low_year))) or (high_year and not (year is not None and year <= int(high_year))):
            continue
        if (low_mass and not (mass is not None and mass >= int(low_mass))) or (high_mass and not (mass is not None and mass <= int(high_mass))):
            continue
        return cls
    return None


def test_each_vehicle_takes_the_class_of_the_row_it_meets_and_no_vehicle_is_lost_or_doubled(tmp_path, workspace):
    fixture = load_rows()
    cfg = make_cfg(workspace)
    f = cfg.pipeline["fields"]
    plain = plain_nameplates(cfg, fixture)

    def mass_of(pair):
        return sorted({r[f["gvm"]] for r in fixture if (r[f["make"]], r[f["model"]]) == pair and r[f["gvm"]]})

    first, second = plain[:2]
    third = next(p for p in plain[2:] if mass_of(p))
    years = sorted({r[f["vehicle_year"]] for r in fixture if (r[f["make"]], r[f["model"]]) == second})
    masses = mass_of(third)
    # One nameplate with no bounds; one whose rows split at a year the fixture has vehicles on both sides of (if it has only one
    # year, the row is bounded to exclude it); one bounded by mass; the fourth has no row at all.
    split = years[0] if len(years) == 1 else years[len(years) // 2]
    rows = [
        (first, "alpha-class", {}),
        (second, "beta-class", {"match_vehicle_year_max": str(split - 1)}),
        (second, "gamma-class", {"match_vehicle_year_min": str(split)}),
        (third, "alpha-class", {"match_gvm_min": str(masses[0]), "match_gvm_max": str(masses[0])}),
    ]
    text = file_text([segment_row(pair, cls, **bounds) for pair, cls, bounds in rows])
    cfg, con = rows_table(tmp_path, workspace, text, fixture)
    got = classes_by_vehicle(cfg, con)
    assert len(got) == len(fixture)
    for vehicle in fixture:
        assert got[vehicle[f["object_id"]]] == expected_class(cfg, vehicle, rows), vehicle
    # The fixture has vehicles of each kind of answer, or the test would prove nothing.
    answers = Counter(got.values())
    assert answers["alpha-class"] and answers[None] and (answers["beta-class"] or answers["gamma-class"])


def test_a_vehicle_with_no_recorded_mass_meets_no_row_that_bounds_the_mass(tmp_path, workspace):
    fixture = load_rows()
    cfg = make_cfg(workspace)
    f = cfg.pipeline["fields"]
    # The mass is read after the sentinel list: a recorded 0 is no mass, so a row bounding the mass from below at 1 meets nothing of it.
    pair = next(p for p in plain_nameplates(cfg, fixture)
                if any((r[f["make"]], r[f["model"]]) == p and not r[f["gvm"]] for r in fixture))
    text = file_text([segment_row(pair, "alpha-class", match_gvm_min="1")])
    cfg, con = rows_table(tmp_path, workspace, text, fixture)
    got = classes_by_vehicle(cfg, con)
    for r in fixture:
        if (r[f["make"]], r[f["model"]]) == pair:
            assert got[r[f["object_id"]]] == ("alpha-class" if r[f["gvm"]] else None)


def test_two_rows_a_vehicle_could_meet_stop_the_build_before_any_vehicle_is_read(tmp_path, workspace):
    fixture = load_rows()
    cfg = make_cfg(workspace)
    pair = plain_nameplates(cfg, fixture)[0]
    text = file_text([segment_row(pair, "alpha-class", match_vehicle_year_max="2020"), segment_row(pair, "beta-class", match_vehicle_year_min="2020")])
    with pytest.raises(GuardrailError, match="some vehicle could meet both"):
        rows_table(tmp_path, workspace, text, fixture)


@pytest.mark.parametrize("change, said", [
    ({"match_vehicle_year_min": "twenty"}, "is not a whole number"),
    ({"match_vehicle_year_min": "2021", "match_vehicle_year_max": "2019"}, "is after"),
    ({"match_gvm_min": "3500", "match_gvm_max": "2000"}, "is after"),
    ({"class": ""}, "every row needs"),
    ({"make": "NO SUCH MAKE"}, "is not a make in"),
])
def test_a_row_the_build_cannot_apply_stops_it_and_says_which(tmp_path, workspace, change, said):
    fixture = load_rows()
    cfg = make_cfg(workspace)
    pair = plain_nameplates(cfg, fixture)[0]
    row = segment_row(pair, "alpha-class")
    row = [change.get(h, v) for h, v in zip(HEADER, row)]
    with pytest.raises(GuardrailError, match=said):
        rows_table(tmp_path, workspace, file_text([row]), fixture)


def test_the_live_file_is_one_the_build_accepts(tmp_path, workspace):
    live = config.load()
    con = duckdb.connect()
    reference.model_class_tables(con, live)
    rows, entries = len(reference.read(live.reference(live.pipeline["model_classes"]["file"]))), con.execute("SELECT count(*) FROM ref_model_class").fetchone()[0]
    assert entries >= rows > 0
