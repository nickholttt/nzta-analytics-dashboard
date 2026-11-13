# Playbook: run the checks

Run all three checks before any commit that touches `pipeline/`, `config/`, `data/reference/` or `src/`.
Run them from the repo root in Git Bash on Windows (on Linux or macOS, use `.venv/bin/` instead of
`.venv/Scripts/`).

## 1. Pipeline tests (golden contract, guardrails, invariant #1 scan, workflow)

```bash
.venv/Scripts/python.exe -m pytest pipeline/tests -q -p no:cacheprovider
```

- Same flags as CI (`.github/workflows/monthly-build.yml`).
- Expect `38 passed`. It takes about 3 minutes locally (170 s on 2026-09-13).
- The tests never read `src/` or `config/presets.json`. A UI-only change can't break them, but
  run them anyway if you're unsure what you touched.

## 2. Typecheck the site

```bash
npx -y -p typescript tsc --noEmit
```

- TypeScript is **not** a dependency in `package.json`, so a plain `npx tsc --noEmit` fails with
  "This is not the tsc command you are looking for". The `-p typescript` form downloads the
  current TypeScript into the npx cache. The version is not pinned.
- `astro build` strips types without checking them, so this is the only typecheck.
- Expect exit code 0 and no output.

## 3. Build the static site

```bash
npx astro build
```

- There is no `build` script in `package.json`; call Astro directly.
- Output goes to `dist/` (gitignored). Expect `1 page(s) built` and `Complete!`.

## Real example: 2026-09-13, ui/explore with uncommitted design work in the tree

| Check | Result |
|---|---|
| pytest | `38 passed in 169.78s` |
| tsc | exit 0 |
| astro build | `1 page(s) built in 978ms`, `Complete!` |

## If a check fails

- Record the failure, with its output summarised, under Blocked in `docs/STATE.md`.
- A `test_golden.py` failure means the cube contract changed. That is never fixed by regenerating
  the golden file without the user's approval. See `docs/playbooks/change-reference-data.md`.
