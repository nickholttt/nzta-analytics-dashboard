"""The register archive: which fields it takes, what the file holds, and when it refuses to be written.

The file holds one row per vehicle and goes to a private store, so the tests that matter are the ones that keep the
chassis and engine numbers out of it, keep the VIN prefix and the postcode out of everything the build reads, and stop
it being written from a register the build did not read.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import duckdb
import pytest

from pipeline import archive
from pipeline.errors import GuardrailError

from .conftest import load_rows, make_cfg, source_for, write_pages
from .test_run import AUGUST, FakeClient, at, built_state

WORKFLOW = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "monthly-build.yml"

@pytest.fixture
def cfg(tmp_path, workspace):
    return make_cfg(workspace, raw=tmp_path / "raw")


def expected_schema(cfg) -> dict:
    return json.loads(cfg.path("expected_schema").read_text(encoding="utf-8"))


def pulled(cfg, rows: list[dict]) -> dict:
    return dict(source_for(rows), out_fields=archive.fields(cfg, expected_schema(cfg)))


def read(path: Path) -> tuple[list[str], list[tuple]]:
    con = duckdb.connect()
    cursor = con.execute(f"SELECT * FROM read_parquet('{path.as_posix()}')")
    return [c[0] for c in cursor.description], cursor.fetchall()


def test_the_chassis_and_engine_numbers_are_never_asked_for(cfg):
    names = archive.fields(cfg, expected_schema(cfg))
    # D-076: the chassis and engine numbers stay out entirely. Named here so that an edit to the config list cannot
    # quietly let one through.
    assert not {"CHASSIS7", "ENGINE_NUMBER"} & set(names)
    # The VIN prefix and the postcode are kept, in the private file only (D-076, superseding D-066 item 9).
    assert {"VIN11", "POSTCODE"} <= set(names)
    every = [f["name"] for f in expected_schema(cfg)["fields"]]
    assert sorted(names) == sorted(set(every) - set(cfg.pipeline["register_archive"]["never_pulled"]))
    assert names[0] == cfg.source_field("object_id")
    assert set(cfg.pipeline["fields"].values()) <= set(names), "the archive must hold every field the build binds"


def test_the_vin_prefix_and_the_postcode_reach_nothing_the_build_reads(cfg):
    # Kept in the private archive only: the build's own pull, and so the cube and the committed aggregate, never
    # holds them. Binding either one is a decision, not an edit.
    assert not {"VIN11", "POSTCODE"} & set(cfg.pipeline["fields"].values())


def test_a_misspelt_never_pulled_field_aborts(cfg):
    cfg.pipeline["register_archive"]["never_pulled"] = ["ENGINE_NUMBERS"]
    with pytest.raises(GuardrailError, match="ENGINE_NUMBERS"):
        archive.fields(cfg, expected_schema(cfg))


def test_the_file_holds_every_row_as_recorded_without_the_row_id(tmp_path, cfg):
    rows = load_rows()
    out = tmp_path / "out" / "register.parquet"
    done = archive.write(cfg, write_pages(tmp_path / "pages", rows), expected_schema(cfg), pulled(cfg, rows), out)
    columns, records = read(out)
    object_id = cfg.source_field("object_id")
    assert done == {"snapshot": "2026-08", "rows": len(rows), "fields": len(columns), "bytes": out.stat().st_size}
    assert len(records) == len(rows) and object_id not in columns
    assert columns == [n for n in archive.fields(cfg, expected_schema(cfg)) if n != object_id]
    # Values as NZTA records them: nothing is normalised, so a sentinel the build would null is still there.
    text = cfg.source_field("fuel_consumption")
    assert sorted(str(r[columns.index(text)]) for r in records) == sorted(str(r[text]) for r in rows)
    metadata = dict(duckdb.connect().execute(
        f"SELECT decode(key), decode(value) FROM parquet_kv_metadata('{out.as_posix()}')").fetchall())
    assert metadata["snapshot"] == "2026-08-31" and metadata["rows"] == str(len(rows))
    assert metadata["attribution"] == cfg.pipeline["register_archive"]["attribution"]
    assert not (cfg.path("staging") / "archive").exists(), "the working copy of the rows must not be left behind"


def test_the_same_register_gives_the_same_rows_in_the_same_order(tmp_path, cfg):
    rows = load_rows()
    shuffled = rows[:]
    random.Random(7).shuffle(shuffled)
    first, second = tmp_path / "a.parquet", tmp_path / "b.parquet"
    archive.write(cfg, write_pages(tmp_path / "a", rows), expected_schema(cfg), pulled(cfg, rows), first)
    archive.write(cfg, write_pages(tmp_path / "b", shuffled), expected_schema(cfg), pulled(cfg, rows), second)
    assert read(first) == read(second)


def test_a_short_or_overlapping_pull_is_not_archived(tmp_path, cfg):
    rows = load_rows()
    short = dict(pulled(cfg, rows), row_count=len(rows) + 1)
    with pytest.raises(GuardrailError, match="rows pulled"):
        archive.write(cfg, write_pages(tmp_path / "a", rows), expected_schema(cfg), short, tmp_path / "a.parquet")
    twice = rows + [rows[0]]
    with pytest.raises(GuardrailError, match="repeat an OBJECTID"):
        archive.write(cfg, write_pages(tmp_path / "b", twice), expected_schema(cfg), pulled(cfg, twice), tmp_path / "b.parquet")
    assert not (tmp_path / "a.parquet").exists() and not (tmp_path / "b.parquet").exists()


def test_a_pull_that_did_not_take_every_field_is_not_archived(tmp_path, cfg):
    rows = load_rows()
    bound_only = dict(source_for(rows), out_fields=list(cfg.pipeline["fields"].values()))
    for source in (bound_only, source_for(rows)):
        with pytest.raises(GuardrailError, match="did not take every archive field"):
            archive.write(cfg, write_pages(tmp_path / "pages", rows), expected_schema(cfg), source, tmp_path / "x.parquet")


class Pulling(FakeClient):
    """A client whose pull saves the fixture rows, recording which fields were asked for."""

    asked: list[str] = []

    def pull_rows(self, layer_url, oid, out_fields, out_dir) -> int:
        Pulling.asked = list(out_fields)
        out_dir.mkdir(parents=True)
        return len(load_rows())


def test_the_live_archive_is_refused_once_the_register_has_moved_on(monkeypatch, tmp_path, cfg):
    built_state(cfg, AUGUST, at(2026, 9, 4))
    out = tmp_path / "register.parquet"
    monkeypatch.setattr(archive, "Client", lambda source_cfg: FakeClient(cfg, {**AUGUST, (2026, 9): 60}))
    with pytest.raises(GuardrailError, match="no longer is the one snapshot 2026-08 was built from"):
        archive.run(cfg, out, now=at(2026, 10, 7))
    monkeypatch.setattr(archive, "Client", lambda source_cfg: FakeClient(cfg, AUGUST))
    with pytest.raises(GuardrailError, match="asked to archive 2026-09 but the last good build is 2026-08"):
        archive.run(cfg, out, snapshot="2026-09", now=at(2026, 9, 5))
    cfg.path("state").unlink()
    with pytest.raises(GuardrailError, match="no last good build"):
        archive.run(cfg, out, now=at(2026, 9, 5))
    assert not out.exists()


def test_the_live_archive_pulls_the_archive_fields_for_the_month_that_was_built(monkeypatch, tmp_path, cfg):
    # Rows dated after the built month: by the first of the next month today's key names a later snapshot, and the
    # file must still be labelled with the month the build gave this register.
    counts = {**AUGUST, (2026, 9): 2}
    built_state(cfg, counts, at(2026, 9, 4))
    monkeypatch.setattr(archive, "Client", lambda source_cfg: Pulling(cfg, counts))
    seen = {}

    def fake_write(cfg_, pages, expected, source, out):
        seen.update(source=source, pages=pages)
        return {"snapshot": source["change_key"]["snapshot"][:7]}

    monkeypatch.setattr(archive, "write", fake_write)
    done = archive.run(cfg, tmp_path / "register.parquet", snapshot="2026-08", now=at(2026, 10, 1))
    assert done == {"snapshot": "2026-08"} and seen["source"]["change_key"]["snapshot"] == "2026-08-31"
    assert Pulling.asked == archive.fields(cfg, expected_schema(cfg)) == seen["source"]["out_fields"]
    assert "/archive/2026-08/" in seen["pages"]


def job(name: str) -> list[str]:
    lines = WORKFLOW.read_text(encoding="utf-8").splitlines()
    start = lines.index(f"  {name}:")
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("  ") and not lines[i].startswith("   ")
                and lines[i].strip() and not lines[i].strip().startswith("#")), len(lines))
    return lines[start:end]


def test_the_archive_token_is_read_only_by_the_archive_job_and_the_file_is_never_an_artifact():
    text = WORKFLOW.read_text(encoding="utf-8")
    archive_job = "\n".join(job("archive"))
    assert "    environment: archive" in job("archive")
    assert text.count("secrets.ARCHIVE_REPO_TOKEN") == archive_job.count("secrets.ARCHIVE_REPO_TOKEN") > 0
    assert "upload-artifact" not in archive_job
    assert "github.ref == 'refs/heads/main'" in next(line for line in job("archive") if line.startswith("    if:"))


def test_the_archive_job_refuses_a_repository_that_is_not_private_before_it_pulls():
    steps = [line.strip() for line in job("archive") if line.strip().startswith("- name:")]
    script = "\n".join(job("archive"))
    refusal = script.index('if [ "$private" != "true" ]; then')
    assert steps[0] == "- name: Can the archive be written, and is this month already there"
    assert refusal < script.index("- name: Checkout") < script.index("python -m pipeline archive")
    assert "exit 1" in script[refusal:script.index("tag=")]
