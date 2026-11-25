"""The vehicles still registered count the wider scope: the five vehicle types the vehicle scope file marks `trade_scope` (D-157).

The expected counts are worked out here from the fixture rows and the reference files, not from the pipeline's own derivation.
No vehicle type, body, segment or label is written in this file (invariant 1): each is read from the scope file, the segment
map and config. The fixture holds no vehicle of the types the wider scope adds, so the test adds one of each, as the register
would, and builds the cube again.
"""

from __future__ import annotations

import copy
import json
from collections import Counter

import duckdb
import pytest

from pipeline import build, config, reference
from pipeline.contract import UNMAPPED

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages

SURVIVORS = "registrations_surviving"


def read_slice(path):
    return duckdb.connect().execute(f"SELECT dim_value, sum(n) FROM read_parquet('{path.as_posix()}') GROUP BY 1").fetchall()


def vehicle_scope(cfg):
    spec = cfg.pipeline["scope"]["vehicle"]
    return spec, {r[spec["key"]]: r for r in reference.read(cfg.reference(spec["file"]))}


def added_types(cfg) -> list[str]:
    """The types the wider scope counts that the default scope does not."""
    spec, rows = vehicle_scope(cfg)
    wider = next(iter(spec["also"].values()))
    true = cfg.pipeline["boolean_true"]
    return sorted(k for k, r in rows.items() if r[wider] == true and r[spec["in_scope"]] != true)


def segment_derive(cfg) -> dict:
    return next(x for x in cfg.dimensions["dimensions"] if x["id"] == "segment")["derive"]


def body_rows(cfg, vehicle_type: str) -> list[dict]:
    d = segment_derive(cfg)
    type_col = list(d["keys"].values())[0]
    return [r for r in reference.read(cfg.reference(d["reference"])) if r[type_col] == vehicle_type]


def build_with(tmp_path, workspace, rows):
    cfg = make_cfg(workspace)
    manifest = build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    return cfg, manifest


@pytest.fixture(scope="module")
def both(tmp_path_factory):
    """The fixture cube, and the same cube with one vehicle of each added type for every body the segment map lists for it."""
    results = {}
    for name in ("plain", "added"):
        root = tmp_path_factory.mktemp(name)
        workspace = {"staging": root / "staging", "public": root / "public", "state": root / "state" / "last_good.json",
                     "snapshots": root / "snapshots", "supplied": root / "supplied"}
        rows = load_rows()
        extra: list[dict] = []
        if name == "added":
            cfg = make_cfg(workspace)
            f = cfg.pipeline["fields"]
            spec, scope_rows = vehicle_scope(cfg)
            statuses = {r[cfg.pipeline["scope"]["status"]["key"]]: r for r in reference.read(cfg.reference(cfg.pipeline["scope"]["status"]["file"]))}
            template = next(r for r in rows if r.get(f["vehicle_type"]) in scope_rows
                            and scope_rows[r[f["vehicle_type"]]][spec["in_scope"]] == cfg.pipeline["boolean_true"]
                            and statuses.get(r.get(f["import_status"]), {}).get(cfg.pipeline["scope"]["status"]["fleet_entry"]) == cfg.pipeline["boolean_true"])
            next_id = max(r[f["object_id"]] for r in rows) + 1
            body_col = list(segment_derive(cfg)["keys"].values())[1]
            for vehicle_type in added_types(cfg):
                for body in sorted({b[body_col] for b in body_rows(cfg, vehicle_type)}):
                    row = copy.deepcopy(template)
                    row.update({f["object_id"]: next_id, f["vehicle_type"]: vehicle_type, f["body_type"]: body})
                    extra.append(row)
                    next_id += 1
        cfg, manifest = build_with(root, workspace, rows + extra)
        results[name] = (cfg, manifest, workspace, extra)
    return results


def test_the_dataset_names_the_wider_scope_flag(both):
    cfg = both["plain"][0]
    wider = list(cfg.pipeline["scope"]["vehicle"]["also"])
    required = cfg.pipeline["datasets"][SURVIVORS]["require"]
    assert [flag for flag in required if flag in wider] == wider, "registrations_surviving must require the wider scope's flag"
    assert cfg.pipeline["scope"]["vehicle"]["in_scope"] not in required


def test_every_type_and_body_the_wider_scope_adds_has_a_segment_map_row(both):
    cfg = both["plain"][0]
    for vehicle_type in added_types(cfg):
        assert body_rows(cfg, vehicle_type), f"{vehicle_type} is counted by the dataset and has no row in the segment map"


def test_the_dataset_counts_one_more_vehicle_for_each_added_one(both):
    (_, plain, _, _), (_, added, _, extra) = both["plain"], both["added"]
    assert extra, "the test added no vehicle"
    assert added["datasets"][SURVIVORS]["rows"] == plain["datasets"][SURVIVORS]["rows"] + len(extra)


def test_the_added_vehicles_are_counted_under_their_own_type_and_nothing_else_moves(both):
    (cfg, plain, wp, _), (_, added, wa, extra) = both["plain"], both["added"]
    spec = next(d for d in cfg.dimensions["dimensions"] if d["id"] == "vehicle_type")["derive"]
    labels = {r[spec["key"]]: r[spec["value"]] for r in reference.read(cfg.reference(spec["reference"]))}
    f = cfg.pipeline["fields"]
    before = dict(read_slice(wp["public"] / "cube" / SURVIVORS / "vehicle_type.parquet"))
    after = dict(read_slice(wa["public"] / "cube" / SURVIVORS / "vehicle_type.parquet"))
    want = Counter(labels[r[f["vehicle_type"]]] for r in extra)
    assert {k: after.get(k, 0) - before.get(k, 0) for k in set(after) | set(before)} == {**{k: 0 for k in before}, **want}


def test_an_added_vehicle_reads_the_segment_map_and_never_no_reference_match(both):
    (cfg, _, wp, _), (_, _, wa, extra) = both["plain"], both["added"]
    f = cfg.pipeline["fields"]
    for dim_id in ("segment", "segment_group"):
        d = next(x for x in cfg.dimensions["dimensions"] if x["id"] == dim_id)["derive"]
        type_key, body_key = list(d["keys"].values())
        mapped = {(r[type_key], r[body_key]): r[d["value"]] for r in reference.read(cfg.reference(d["reference"]))
                  if not r[d["range_min"]] and not r[d["range_max"]]}
        before = dict(read_slice(wp["public"] / "cube" / SURVIVORS / f"{dim_id}.parquet"))
        after = dict(read_slice(wa["public"] / "cube" / SURVIVORS / f"{dim_id}.parquet"))
        assert after.get(UNMAPPED, 0) == before.get(UNMAPPED, 0), f"{dim_id}: an added vehicle reads no reference match"
        want = Counter(mapped[(r[f["vehicle_type"]], r[f["body_type"]])] for r in extra)
        assert {k: after.get(k, 0) - before.get(k, 0) for k in set(after) | set(before)} == {**{k: 0 for k in before}, **want}, dim_id


def test_widening_the_dataset_leaves_the_default_scope_row_count_the_guardrails_compare_alone(both):
    """The guard that stops a build when the source's rows jump reads the default scope's rows; a deliberate widening of one
    dataset must not move it, or the first build after it would be stopped."""
    states = []
    for name in ("plain", "added"):
        workspace = both[name][2]
        states.append(json.loads(workspace["state"].read_text(encoding="utf-8")))
    assert states[0]["in_scope_row_count"] == states[1]["in_scope_row_count"]


def test_the_other_datasets_do_not_move(both):
    (_, plain, _, _), (_, added, _, _) = both["plain"], both["added"]
    for dataset, entry in plain["datasets"].items():
        # The stock counts every vehicle of the register, so an added vehicle is in it; the survivors are the dataset under test.
        if dataset == SURVIVORS or not isinstance(entry, dict) or both["plain"][0].pipeline["datasets"].get(dataset, {}).get("stock"):
            continue
        assert entry.get("rows") == added["datasets"][dataset].get("rows"), dataset
