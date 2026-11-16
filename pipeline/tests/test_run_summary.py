"""What the Monthly build's summary page says about the warnings of a build that ran (D-112).

No warning names a domain value here: the groups come from config, and a warning is made of the text a group looks for.
The warnings the build really writes are checked against the groups in test_guardrails.py, where those builds are made.
"""

from __future__ import annotations

import json

import pytest

from pipeline import __main__ as cli, config, fetch, guardrails
from pipeline import build as build_step

from .conftest import make_cfg
from .test_run import AUGUST, FakeClient, at


@pytest.fixture
def cfg(tmp_path, workspace):
    return make_cfg(workspace, raw=tmp_path / "raw")


def groups(cfg) -> list[dict]:
    return cfg.pipeline["run_summary"]["warning_order"]


def manifest_with(warnings: list[str]) -> dict:
    return {
        "latest_snapshot": "2026-10-31",
        "source": {"rows_pulled": 1234},
        "datasets": {"d": {"rows": 5, "months": 2, "latest_month": "2026-10", "live_dimensions": ["x"], "not_live": {}}},
        "moving_cutoff_vehicle_year": 2000,
        "moving_cutoff_age": 26,
        "used_import_age_trailing": {"window_months": 12, "rows": 0},
        "warnings": warnings,
    }


def sample(cfg) -> tuple[str, str, str, str]:
    """Two warnings no group claims and one of each group, in the order a build could raise them: plain, guard, plain, flip."""
    first, second = (g["contains"] for g in groups(cfg))
    return "plain one", f"d: {second}, 3 rows away", "plain two", f"d: {first}; a figure quoted before no longer matches"


def test_the_groups_are_well_formed(cfg):
    found = groups(cfg)
    assert len(found) >= 2
    for g in found:
        assert set(g) == {"label", "contains"} and all(isinstance(v, str) and v.strip() for v in g.values()), g
    assert len({g["label"] for g in found}) == len(found) and len({g["contains"] for g in found}) == len(found)


def test_what_rewrites_history_comes_first_then_a_guard_near_its_limit_then_the_rest_each_in_the_order_raised(cfg):
    plain_one, guard, plain_two, flip = sample(cfg)
    ordered = fetch.order_warnings(cfg, [plain_one, guard, plain_two, flip])
    assert [w for _, w in ordered] == [flip, guard, plain_one, plain_two]
    assert [label for label, _ in ordered] == [groups(cfg)[0]["label"], groups(cfg)[1]["label"], None, None]
    # Two in one group keep the order they were raised in.
    assert [w for _, w in fetch.order_warnings(cfg, [flip + " b", guard, flip + " a"])] == [flip + " b", flip + " a", guard]
    assert fetch.order_warnings(cfg, []) == []


def test_a_warning_no_group_claims_is_listed_last_and_never_dropped(cfg):
    odd = "a wording the groups do not know"
    ordered = fetch.order_warnings(cfg, [odd, sample(cfg)[3]])
    assert [w for _, w in ordered][-1] == odd and len(ordered) == 2


def test_the_summary_lists_the_warnings_in_order_with_the_count_and_ends_with_a_blank_line(cfg):
    plain_one, guard, plain_two, flip = sample(cfg)
    text = fetch.warnings_markdown(cfg, manifest_with([plain_one, guard, plain_two, flip]))
    lines = text.split("\n")
    assert lines[0] == "### Warnings in the 2026-10 build (4)" and lines[1] == ""
    assert lines[2:6] == [f"- **{groups(cfg)[0]['label']}.** {flip}", f"- **{groups(cfg)[1]['label']}.** {guard}",
                          f"- {plain_one}", f"- {plain_two}"]
    assert lines[6] == "" and lines[7].startswith("Worst first: ") and groups(cfg)[0]["label"].lower() in lines[7]
    # A paragraph written to the page after this would otherwise be read as part of the last item.
    assert text.endswith("\n\n") and not text.endswith("\n\n\n")


def test_one_warning_has_a_count_of_one_and_no_note_on_the_order(cfg):
    text = fetch.warnings_markdown(cfg, manifest_with(["only one"]))
    assert text == "### Warnings in the 2026-10 build (1)\n\n- only one\n\n"


def test_a_build_with_no_warning_says_so_in_one_line(cfg):
    assert fetch.warnings_markdown(cfg, manifest_with([])) == "No warnings in the 2026-10 build.\n\n"


def test_a_warning_cannot_break_the_list(cfg):
    text = fetch.warnings_markdown(cfg, manifest_with(["first line\nsecond <b>line</b> & more"]))
    assert "- first line second &lt;b&gt;line&lt;/b&gt; &amp; more\n" in text and text.count("\n- ") == 1


def test_a_summary_with_a_path_gets_the_list_after_what_was_there_and_stderr_is_as_before(cfg, tmp_path, capsys):
    page = tmp_path / "page.md"
    page.write_text("Earlier line.\n", encoding="utf-8")
    warnings = list(sample(cfg))
    fetch.print_summary(cfg, manifest_with(warnings), str(page))
    shown = capsys.readouterr()
    assert shown.err.splitlines() == [f"  WARNING: {w}" for w in warnings], "stderr keeps the order raised"
    assert shown.out.startswith("Built snapshot 2026-10-31 from 1,234 rows.")
    written = page.read_text(encoding="utf-8")
    assert written.startswith("Earlier line.\n### Warnings in the 2026-10 build (4)\n") and "\r" not in written
    fetch.print_summary(cfg, manifest_with([]), str(page))
    assert page.read_text(encoding="utf-8").endswith("No warnings in the 2026-10 build.\n\n")


def test_no_summary_page_means_nothing_is_written_and_nothing_fails(cfg, tmp_path, capsys, monkeypatch):
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    monkeypatch.chdir(elsewhere)
    fetch.print_summary(cfg, manifest_with(["w"]))
    fetch.print_summary(cfg, manifest_with(["w"]), "")
    assert list(elsewhere.iterdir()) == [], "no file appears"
    assert capsys.readouterr().err == "  WARNING: w\n  WARNING: w\n"


def test_a_page_that_cannot_be_written_says_so_on_stderr_and_does_not_fail_the_build(cfg, tmp_path, capsys):
    # A folder cannot be opened for appending: an OSError on every platform. The build is done and published by now.
    fetch.print_summary(cfg, manifest_with(["w"]), str(tmp_path))
    err = capsys.readouterr().err
    assert "  WARNING: w\n" in err and "could not be written to the run's summary page" in err


def test_a_run_that_builds_writes_its_warnings_to_the_page_it_was_given(cfg, tmp_path, monkeypatch):
    output, page = tmp_path / "output", tmp_path / "page.md"
    output.write_text("", encoding="utf-8")
    page.write_text("", encoding="utf-8")
    flip = sample(cfg)[3]
    monkeypatch.setattr(fetch, "Client", lambda source_cfg: FakeClient(cfg, AUGUST))
    monkeypatch.setattr(fetch, "pull", lambda *args: "pages")
    monkeypatch.setattr(build_step, "build", lambda *args, **kwargs: manifest_with(["plain", flip]))
    assert fetch.run(cfg, github_output=str(output), now=at(2026, 9, 4), github_summary=str(page)) == 0
    assert page.read_text(encoding="utf-8").splitlines()[:4] == [
        "### Warnings in the 2026-10 build (2)", "", f"- **{groups(cfg)[0]['label']}.** {flip}", "- plain"]
    assert "built=true" in output.read_text(encoding="utf-8")


@pytest.mark.parametrize("variable", [True, False])
def test_a_build_by_hand_writes_to_the_page_only_where_the_runner_sets_one(cfg, tmp_path, monkeypatch, variable):
    pull = tmp_path / "pull"
    pull.mkdir()
    (pull / "source.json").write_text(json.dumps({"row_count": 0}), encoding="utf-8")
    page = tmp_path / "page.md"
    monkeypatch.setattr(config, "load", lambda: cfg)
    monkeypatch.setattr(build_step, "build", lambda *args, **kwargs: manifest_with(["w"]))
    if variable:
        monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(page))
    else:
        monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    assert cli.main(["build", str(pull), "--dry-run"]) == 0
    assert page.exists() is variable
    if variable:
        assert page.read_text(encoding="utf-8") == "### Warnings in the 2026-10 build (1)\n\n- w\n\n"


def test_the_warnings_a_flip_writes_in_both_directions_fall_in_the_first_group(cfg):
    record = lambda published: {"published": published, "trailing_high_confidence_coverage": 0.5}
    previous = {"mild_split": {"a": record(True), "b": record(False)}}
    found = guardrails.split_flips(cfg, {"a": record(False), "b": record(True)}, previous)
    assert len(found) == 2
    assert [label for label, _ in fetch.order_warnings(cfg, found)] == [groups(cfg)[0]["label"]] * 2
