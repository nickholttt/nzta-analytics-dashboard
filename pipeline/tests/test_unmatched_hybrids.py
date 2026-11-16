"""scripts/unmatched_hybrids.py, the maintainer's list of the hybrids that lower a dataset's coverage (D-112, the playbook
check-monthly-run). Run as a maintainer would, in a process of its own, on the fixture register saved as a pull."""

from __future__ import annotations

import gzip
import json
import re
import runpy
import subprocess
import sys

import pytest

from pipeline import build, config, reference, supplied

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages

SCRIPT = config.ROOT / "scripts" / "unmatched_hybrids.py"
DATASET = "registrations_surviving"


def run_script(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, "-I", str(SCRIPT), *args], cwd=config.ROOT, capture_output=True, text=True, encoding="utf-8")


def save_pull(folder, rows):
    """`rows` saved as the Action saves a pull: source.json and gzipped pages."""
    pages = folder / "pull" / "pages"
    pages.mkdir(parents=True)
    write_pages(folder / "plain", rows)
    for page in sorted((folder / "plain").glob("*.json")):
        (pages / f"{page.stem}.json.gz").write_bytes(gzip.compress(page.read_bytes()))
    (folder / "pull" / "source.json").write_text(json.dumps(source_for(rows)), encoding="utf-8")
    return folder / "pull"


@pytest.fixture
def pull(tmp_path):
    rows = load_rows()
    return save_pull(tmp_path, rows), rows


def test_it_reports_the_figure_the_build_publishes_and_lists_exactly_what_the_figure_leaves_out(pull, tmp_path, workspace):
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
    figure = re.search(r"at high confidence only: ([\d,]+) of ([\d,]+) = ([\d.]+)%; the split is (published|withheld)", done.stdout)
    assert figure, done.stdout
    numerator, denominator = (int(figure.group(i).replace(",", "")) for i in (1, 2))
    assert round(float(figure.group(3)), 2) == round(trailing["coverage_high_confidence_only"] * 100, 2)
    assert (figure.group(4) == "published") is block["mild_split_published"]
    # What it lists is the pipeline's own count of what the figure leaves out: the denominator less the numerator, at high
    # confidence, for this fixture. Both are read back from what the script printed.
    listed = [int(n.replace(",", "")) for n in re.findall(r"^\s*([\d,]+)  \S", done.stdout, flags=re.M)]
    stated = int(re.search(r"\(([\d,]+) in all", done.stdout).group(1).replace(",", ""))
    assert sum(listed) == stated == denominator - numerator > 0


def test_a_window_with_no_hybrid_says_so_and_does_not_divide_by_zero(tmp_path):
    cfg = config.load()
    codes = reference.hybrid_keys(cfg)["source_hybrid"]
    column = cfg.pipeline["fields"][cfg.pipeline["engine"]["field"]]
    rows = [r for r in load_rows() if r[column] not in codes]
    assert rows and len(rows) < len(load_rows()), "the fixture must hold hybrids for this to prove anything"
    done = run_script(DATASET, str(save_pull(tmp_path, rows)))
    assert done.returncode == 0 and "Traceback" not in done.stderr, done.stderr
    assert "no hybrid in the window that could be mild" in done.stdout and "the split is published" in done.stdout


def test_it_writes_nothing_in_the_repository(pull):
    folder, _ = pull
    before = sorted(p.as_posix() for p in config.ROOT.joinpath("data").rglob("*") if p.is_file())
    assert run_script(DATASET, str(folder)).returncode == 0
    assert sorted(p.as_posix() for p in config.ROOT.joinpath("data").rglob("*") if p.is_file()) == before


def test_it_says_what_is_missing_rather_than_failing_with_a_traceback(pull, tmp_path):
    folder, _ = pull
    no_pull = run_script(DATASET)
    assert no_pull.returncode != 0 and "needs the saved pull folder" in no_pull.stderr and "Traceback" not in no_pull.stderr
    unknown = run_script("not_a_dataset", str(folder))
    assert unknown.returncode != 0 and "is not a dataset in config/pipeline.json" in unknown.stderr
    not_a_pull = run_script(DATASET, str(tmp_path))
    assert not_a_pull.returncode != 0 and "has no source.json" in not_a_pull.stderr and "Traceback" not in not_a_pull.stderr
    (tmp_path / "empty").mkdir()
    (tmp_path / "empty" / "source.json").write_text((folder / "source.json").read_text(encoding="utf-8"), encoding="utf-8")
    no_pages = run_script(DATASET, str(tmp_path / "empty"))
    assert no_pages.returncode != 0 and "the data could not be read" in no_pages.stderr and "Traceback" not in no_pages.stderr
    p = config.load().pipeline
    series = [d for d, c in p["datasets"].items() if c.get("source") and p["supplied"][c["source"]]["kind"] == supplied.SERIES]
    assert series, "the check proves nothing without a series dataset"
    done = run_script(series[0])
    assert done.returncode != 0 and "has no vehicles to classify" in done.stderr


@pytest.mark.parametrize("answer, said", [("absent", "it is absent"), ("refused", "the store disagrees with its ledger")])
def test_a_supplied_store_that_cannot_be_read_is_a_message_and_a_failure_not_an_assertion(monkeypatch, answer, said):
    p = config.load().pipeline
    dataset = next(d for d, c in p["datasets"].items() if c.get("source") and p["supplied"][c["source"]]["kind"] != supplied.SERIES)

    def unreadable(con, cfg, source_id, aborts, warnings=None):
        if answer == "refused":
            aborts.append(said)
        return None

    monkeypatch.setattr(supplied, "load_store", unreadable)
    monkeypatch.setattr(sys, "argv", [str(SCRIPT), dataset])
    with pytest.raises(SystemExit) as stopped:
        runpy.run_path(str(SCRIPT), run_name="__main__")
    assert isinstance(stopped.value.code, str) and "cannot be read" in stopped.value.code and said in stopped.value.code
