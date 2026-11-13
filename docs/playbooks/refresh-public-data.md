# Playbook: refresh public/data for the local UI

The local UI reads `public/data/` (gitignored). It's refreshed from a **dry-run** rebuild of a saved pull,
never from `python -m pipeline run`: a real run rewrites the committed `data/state/` and
`data/snapshots/`, which only the monthly Action may do.

`public/data` contents are **outside the `ui/explore` boundary** (D-020). Ask the user before
replacing them.

## Commands (Git Bash, repo root)

```bash
ls data/raw/*/                         # saved pulls: data/raw/YYYY-MM/<timestamp>/{source.json,pages/}

# 1. Rebuild into data/staging/build; publishes nothing. About 7 minutes, 12 DuckDB threads locally.
.venv/Scripts/python.exe -m pipeline build data/raw/2026-08/20260911T093818Z --dry-run

# 2. Confirm committed state was not touched (must print nothing)
git status --short data/state data/snapshots

# 3. See what would change
diff -rq data/staging/build/cube public/data/cube
cmp data/staging/build/events.json public/data/events.json

# 4. Only with the user's go-ahead: swap, keeping the previous copy
rm -rf public/data.previous && mv public/data public/data.previous && cp -r data/staging/build public/data
```

Step 4 was **not run** on 2026-09-13, because steps 1–3 showed nothing to change. The
`public/data.previous/` name comes from `.gitignore`; that earlier refreshes used exactly this swap is
inferred — confirm.

## Exit codes

0 built, 2 guardrail abort, 3 source failure, 4 DuckDB failure. On any non-zero exit the last good
build is unchanged. Report the printed message to the user; don't loosen a threshold to get past it.

## Real example: 2026-09-13

```
exit 0 in 397s
Built snapshot 2026-08-31 from 5,905,376 rows.
  registrations_surviving: 4,502,964 rows over 1195 months; live: powertrain, make, parent_group, owner_country, heritage_country, built_in, segment, import_status, region, vehicle_year_band, engine_size_band, age_at_registration_band, model
    not live: {'imported_from': 'does not apply to this dataset'}
  moving cutoff: vehicle year 2012, age 14
  used-import age (trailing 12 months): median 10, mode 11, 59.4% aged 9-13
```

`cube/` and `events.json` were identical to `public/data`. `manifest.json` differed only in
`generated_at`. `data/state` and `data/snapshots` were clean.
