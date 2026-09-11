"""The workflow's commit step, run exactly as written in monthly-build.yml, commits and pushes a new snapshot aggregate.

The cohort-survival dataset depends on every month's aggregate reaching the repository, and a live run has only ever
committed unchanged state. This runs the step's script in a throwaway repository with a local bare remote.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

WORKFLOW = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "monthly-build.yml"
STEP = "Commit snapshot aggregate and state"
SNAPSHOT_EXPRESSION = "${{ steps.pipeline.outputs.snapshot }}"
BASH = shutil.which("bash")

# On Windows only Git Bash runs the script the way the Linux runner does.
pytestmark = pytest.mark.skipif(BASH is None or shutil.which("git") is None or (os.name == "nt" and "Git" not in BASH),
                                reason="needs git and a POSIX bash")


def step_script(name: str) -> str:
    lines = WORKFLOW.read_text(encoding="utf-8").splitlines()
    start = next(i for i, line in enumerate(lines) if line.strip() == f"- name: {name}")
    run = next(i for i in range(start, len(lines)) if lines[i].strip() == "run: |")
    indent = len(lines[run + 1]) - len(lines[run + 1].lstrip())
    body = []
    for line in lines[run + 1:]:
        if line.strip() and len(line) - len(line.lstrip()) < indent:
            break
        body.append(line[indent:])
    return "\n".join(body) + "\n"


def test_commit_step_pushes_a_new_snapshot_aggregate_and_skips_when_nothing_changed(tmp_path):
    config = tmp_path / "gitconfig"
    config.write_text("", encoding="utf-8")
    env = {**os.environ, "GIT_CONFIG_GLOBAL": str(config), "GIT_CONFIG_NOSYSTEM": "1", "GIT_TERMINAL_PROMPT": "0"}
    remote, work = tmp_path / "remote.git", tmp_path / "work"

    def git(*args: str, cwd: Path = work) -> str:
        return subprocess.run(["git", *args], cwd=cwd, env=env, check=True, capture_output=True, text=True).stdout

    def run_step(script: str) -> subprocess.CompletedProcess:
        return subprocess.run([BASH, "--noprofile", "--norc", "-eo", "pipefail", "-c", script],
                              cwd=work, env=env, capture_output=True, text=True)

    git("init", "--bare", str(remote), cwd=tmp_path)
    git("clone", str(remote), str(work), cwd=tmp_path)
    (work / "data" / "snapshots").mkdir(parents=True)
    (work / "data" / "state").mkdir()
    (work / "data" / "snapshots" / "2026-08.parquet").write_bytes(b"first month")
    (work / "data" / "state" / "last_good.json").write_text('{"latest_snapshot": "2026-08-31"}\n', encoding="utf-8")
    git("add", "-A")
    git("-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "commit", "-q", "-m", "initial")
    git("push", "-q", "-u", "origin", "HEAD")
    branch = git("rev-parse", "--abbrev-ref", "HEAD").strip()

    script = step_script(STEP)
    assert SNAPSHOT_EXPRESSION in script and "git push" in script
    script = script.replace(SNAPSHOT_EXPRESSION, "2026-09")

    # What a built run leaves behind: a new month's aggregate and rewritten state.
    (work / "data" / "snapshots" / "2026-09.parquet").write_bytes(b"second month")
    (work / "data" / "state" / "last_good.json").write_text('{"latest_snapshot": "2026-09-30"}\n', encoding="utf-8")
    first = run_step(script)
    assert first.returncode == 0, first.stderr
    pushed = git("log", "-1", "--name-status", "--format=%s", branch, cwd=remote)
    assert pushed.splitlines()[0] == "Snapshot 2026-09 [skip ci]"
    assert "A\tdata/snapshots/2026-09.parquet" in pushed
    assert "M\tdata/state/last_good.json" in pushed
    assert git("show", f"{branch}:data/snapshots/2026-08.parquet", cwd=remote) == "first month"

    commits = git("rev-list", "--count", branch, cwd=remote)
    second = run_step(script)
    assert second.returncode == 0, second.stderr
    assert "Nothing new to commit." in second.stdout
    assert git("rev-list", "--count", branch, cwd=remote) == commits
