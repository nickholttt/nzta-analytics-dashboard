"""Every Claude Code sub-agent definition names its model (CLAUDE.md, Sub-agents; D-062, D-082).

A definition with no `model:` line, or with `model: inherit`, runs on whatever model the lead happens to
be on. The user chose the model for each kind of work, so the choice has to be written down: this test
fails when a definition leaves it out.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

AGENTS = Path(__file__).resolve().parent.parent.parent / ".claude" / "agents"

# Claude Code's model aliases. A full model id is also accepted.
MODEL_ALIASES = {"haiku", "sonnet", "opus", "fable"}
MODEL_ID = re.compile(r"^claude-[a-z0-9][a-z0-9.-]*$")
EFFORTS = {"low", "medium", "high", "xhigh", "max"}
NOT_A_MODEL = {"", "inherit"}


def frontmatter(path: Path) -> dict[str, str]:
    """The `key: value` lines between the file's opening and closing `---`."""
    lines = path.read_text(encoding="utf-8").splitlines()
    assert lines and lines[0].strip() == "---", f"{path.name}: no frontmatter"
    assert "---" in [line.strip() for line in lines[1:]], f"{path.name}: frontmatter is not closed"
    fields: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            break
        key, separator, value = line.partition(":")
        assert separator, f"{path.name}: frontmatter line without a colon: {line!r}"
        fields[key.strip()] = value.strip().strip("\"'")
    return fields


def definitions() -> list[Path]:
    return sorted(AGENTS.glob("*.md"))


def test_definitions_exist():
    assert definitions(), "no sub-agent definition in .claude/agents/"


@pytest.mark.parametrize("path", definitions(), ids=lambda p: p.name)
def test_definition_names_its_model(path: Path):
    fields = frontmatter(path)
    assert fields.get("name") == path.stem, f"{path.name}: `name:` must match the file name"
    assert fields.get("description"), f"{path.name}: no `description:`"
    model = fields.get("model", "").lower()
    assert model not in NOT_A_MODEL, f"{path.name}: `model:` is missing or `inherit`; name a model"
    assert model in MODEL_ALIASES or MODEL_ID.match(model), f"{path.name}: `model: {model}` is not a model alias or id"
    if "effort" in fields:
        assert fields["effort"] in EFFORTS, f"{path.name}: `effort: {fields['effort']}` is not one of {sorted(EFFORTS)}"


@pytest.mark.parametrize(
    "text, message",
    [
        ("---\nname: x\ndescription: d\n---\n", "missing or `inherit`"),
        ("---\nname: x\ndescription: d\nmodel: inherit\n---\n", "missing or `inherit`"),
        ("---\nname: x\ndescription: d\nmodel:\n---\n", "missing or `inherit`"),
        ("---\nname: x\ndescription: d\nmodel: best\n---\n", "not a model alias or id"),
        ("---\nname: x\ndescription: d\nmodel: opus\neffort: extreme\n---\n", "is not one of"),
    ],
)
def test_the_check_refuses_a_bad_definition(tmp_path: Path, text: str, message: str):
    path = tmp_path / "x.md"
    path.write_text(text, encoding="utf-8", newline="\n")
    with pytest.raises(AssertionError, match=message):
        test_definition_names_its_model(path)
