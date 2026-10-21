# Playbook: check the monthly run

The Action `Monthly build` (`.github/workflows/monthly-build.yml`) runs at 06:17 UTC on the 8th
of each month (18:17 NZST, 19:17 NZDT). The gate runs are **8 October 2026** and **8 November 2026**.
Checking them is read-only. Don't dispatch, re-run or push unless the user asks.

`gh` is at `C:\Program Files\GitHub CLI\gh.exe` and is **not on the Git Bash PATH**. Never use the Git
Credential Manager token instead.

## Commands (PowerShell)

```powershell
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$repo = "nickholttt/nzta-analytics-dashboard"
& $gh run list --repo $repo --limit 6          # status, trigger (schedule vs workflow_dispatch), run id
& $gh run view <run-id> --repo $repo           # job summary
& $gh run view --job=<job-id> --repo $repo     # one job's steps
git fetch origin; git log --oneline origin/main -5   # did the bot commit "Snapshot YYYY-MM [skip ci]"?
```

## What "green" means

Report all of these to the user:

1. The run was triggered by `schedule` (not `workflow_dispatch`) and concluded `success`.
2. Whether it **built** or **skipped**. A skip means the change key matched the last good run, and
   it is not a failure. A build shows the "Upload public data", "Show manifest" and "Commit snapshot
   aggregate and state" steps as run, and adds a `Snapshot YYYY-MM [skip ci]` commit on `main`.
3. The step summary line `Peak memory used: N MiB of M MiB` (from the "Resource report" step).
4. If it failed: which exit code. 2 = guardrail abort, 3 = source failure, 4 = DuckDB failure. In
   every case the last good build is unchanged.

## Also each month: has step 1b's source appeared?

Step 1b (`registrations_flow`) waits until Stats NZ publishes its monthly new and ex-overseas
registrations in the Aotearoa Data Explorer (the user's choice on 2026-10-22; `docs/DATA_SOURCES.md`
§C). The Explorer's catalogue needs no key. Git Bash, repository root:

```bash
curl -s "https://api.data.stats.govt.nz/rest/dataflow/STATSNZ/all/latest" | .venv/Scripts/python.exe -I -c "import json,sys; d=json.load(sys.stdin)['references']; flows=[v for k,v in d.items() if 'Dataflow' in k]; hits=[v['id']+': '+v.get('name','') for v in flows if not v['id'].startswith('CEN') and any(w in v.get('name','').lower() for w in ('motor vehicle','vehicles registered','transport','tpt'))]; print(len(flows),'dataflows;', '; '.join(hits) or 'no transport series')"
```

It leaves out the census tables, which count motor vehicles per household. On 2026-10-22 it printed
`911 dataflows; no transport series`. Report the line; a hit means step 1b can be planned, so tell
the user.

## Real example

```
completed  success  Monthly build  main  workflow_dispatch  34648180201  1m26s  2026-09-11T21:12:14Z
completed  success  Monthly build  main  workflow_dispatch  34646200411  5m0s   2026-09-11T20:49:05Z
```

- 34646200411 was forced. It built, and its cube was byte-identical to a local build of the same commit.
- 34648180201 was unforced. Tests passed and it skipped the build, because the source was unchanged.
  Its job `103423878794` finished in 1m18s.

Neither was a scheduled run. The first scheduled run is 8 October 2026.
