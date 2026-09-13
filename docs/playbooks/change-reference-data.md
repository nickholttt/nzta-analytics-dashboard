# Playbook: change a reference file (and the golden contract)

**Frozen until the 8 November 2026 run passes** (AGENTS.md hard rule 2). Don't start this without
the user's go-ahead. It covers `data/reference/*.csv`, `config/dimensions.json`,
`config/measures.json` and `config/pipeline.json`. Queued post-gate work is in `POST_GATE.md`.

## Rules

- **One reference file per commit.** The docs that describe it (`docs/*.md`, `README.md`,
  `CLAUDE.md` counts) change **in the same commit**.
- **Check against the data first.** Before changing a mapping or rewriting a field's meaning,
  measure it in the data and report counts for every edge case to the user. Never silently bucket.
  If the data contradicts the user's lean, say so.
- **No domain values in code.** If a change seems to need a brand, powertrain or country name in a
  `.py`/`.ts` file, stop: it belongs in a CSV or config.
- A change that alters what the pipeline emits changes `pipeline/tests/golden/contract.json`. That
  golden update goes in the same commit, deliberately, and the diff is shown to the user.

## Commands

```bash
# 1. Edit the one file, then run the full suite
.venv/Scripts/python.exe -m pytest pipeline/tests -q -p no:cacheprovider

# 2. Only if test_golden fails AND the change to the contract is intended:
UPDATE_GOLDEN=1 .venv/Scripts/python.exe -m pytest pipeline/tests/test_golden.py -q -p no:cacheprovider
git diff --stat pipeline/tests/golden/contract.json
git diff pipeline/tests/golden/contract.json          # show this to the user

# 3. Exercise the real build's guardrails on the saved pull (publishes nothing)
.venv/Scripts/python.exe -m pipeline build data/raw/2026-08/20260911T093818Z --dry-run

# 4. Commit explicit paths only
git add data/reference/<file>.csv docs/<doc>.md pipeline/tests/golden/contract.json
```

### Windows line endings on golden regeneration

`UPDATE_GOLDEN=1` writes `contract.json` with `Path.write_text`, which uses CRLF on Windows.
`.gitattributes` (`eol=lf`) normalises it on commit.

**Verified 2026-09-13:** in a throwaway worktree at `ba304d2` with no changes, `UPDATE_GOLDEN=1`
passed 3 tests in 14 s. `git status` then showed `M pipeline/tests/golden/contract.json`, with the
warning "CRLF will be replaced by LF", while `git diff --stat` was **empty**. So a modified flag on
its own means nothing. Only `git diff` content counts. The same CRLF issue is POST_GATE B2.

## Real example

`c5623ba brand_registry.csv: as_at records when each ownership fact was last verified`. Per its commit
message it added the `as_at` column (2026-09-12 for FUSO and HINO, blank for the other 101 rows),
made a non-ISO `as_at` abort the build, and gave `README.md` a Maintenance section saying so, all in
one commit. The ownership fact itself had landed separately in
`5258d20 brand_registry.csv: FUSO and HINO are owned by ARCHION since 1 April 2026`.
