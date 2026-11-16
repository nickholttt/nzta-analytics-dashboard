"""scripts/unmatched_hybrids.py, the maintainer's list of the hybrids that lower a dataset's coverage (D-112, the playbook
check-monthly-run). Run as a maintainer would, in a process of its own, on the fixture register saved as a pull."""

from __future__ import annotations

import gzip
import json
import re
import subprocess
import sys

import pytest

from pipeline import build, config, supplied

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages

SCRIPT = config.ROOT / "scripts" / "unmatched_hybrids.py"
DATASET = "registrations_surviving"


def run_script(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, "-I", str(SCRIPT), *args], cwd=config.ROOT, capture_output=True, text=True, encoding="utf-8")


@pytest.fixture
def pull(tmp_path):
    """The fixture register as the Action saves a pull: source.json and gzipped pages."""
    rows = load_rows()
    pages = tmp_path / "pull" / "pages"
    pages.mkdir(parents=True)
    write_pages(tmp_path / "plain", rows)
    for page in sorted((tmp_path / "plain").glob("*.json")):
        (pages / f"{page.stem}.json.gz").write_bytes(gzip.compress(page.read_bytes()))
    (tmp_path / "pull" / "source.json").write_text(json.dumps(source_for(rows)), encoding="utf-8")
    return tmp_path / "pull", rows


def test_it_reports_the_figure_the_build_publishes_and_lists_what_counts_against_it(pull, tmp_path, workspace):
    folder, rows = pull
    manifest = build.build(make_cfg(workspace), source_for(rows), write_pages(tmp_path / "again", rows), None, NOW, publish=False)
    block = manifest["datasets"][DATASET]["mild_hybrid_identification_coverage"]
    done = run_script(DATASET, str(folder), "--top", "100")
    assert done.returncode == 0, done.stderr
    first = done.stdout.splitlines()[0]
    trailing = block["trailing"]
    assert first.startswith(f"{DATASET}, ") and f"{trailing['source_hybrids']:,} hybrids" in first
    assert f"identified mild {trailing['identified_mild']:,}" in first and f"unknown {trailing['unknown']:,}" in first
    # The same figure at high confidence only as the manifest's, and the same answer on publishing the split.
    figure = re.search(r"= ([\d.]+)%; the split is (published|withheld)", done.stdout)
    assert figure, done.stdout
    assert round(float(figure.group(1)), 2) == round(trailing["coverage_high_confidence_only"] * 100, 2)
    assert (figure.group(2) == "published") is block["mild_split_published"]
    # What it lists adds up to the total it states, and is some of the window's hybrids.
    listed = [int(n.replace(",", "")) for n in re.findall(r"^\s*([\d,]+)  \S", done.stdout, flags=re.M)]
    assert sum(listed) == int(re.search(r"\(([\d,]+) in all", done.stdout).group(1).replace(",", ""))
    assert 0 < sum(listed) <= trailing["source_hybrids"]


def test_it_writes_nothing_in_the_repository(pull):
    folder, _ = pull
    before = sorted(p.as_posix() for p in config.ROOT.joinpath("data").rglob("*") if p.is_file())
    assert run_script(DATASET, str(folder)).returncode == 0
    assert sorted(p.as_posix() for p in config.ROOT.joinpath("data").rglob("*") if p.is_file()) == before


def test_it_says_what_is_missing_rather_than_failing_with_a_traceback(pull):
    folder, _ = pull
    no_pull = run_script(DATASET)
    assert no_pull.returncode != 0 and "needs the saved pull folder" in no_pull.stderr and "Traceback" not in no_pull.stderr
    unknown = run_script("not_a_dataset", str(folder))
    assert unknown.returncode != 0 and "is not a dataset in config/pipeline.json" in unknown.stderr
    p = config.load().pipeline
    series = [d for d, c in p["datasets"].items() if c.get("source") and p["supplied"][c["source"]]["kind"] == supplied.SERIES]
    assert series, "the check proves nothing without a series dataset"
    done = run_script(series[0])
    assert done.returncode != 0 and "has no vehicles to classify" in done.stderr
