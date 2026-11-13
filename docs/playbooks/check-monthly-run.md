# Playbook: check the monthly run

The Action `Monthly build` (`.github/workflows/monthly-build.yml`) is tried **every day** at 06:17
UTC (18:17 NZST, 19:17 NZDT) since 2026-11-13 (D-064). Most days it skips. It builds each snapshot
month once, within a day of NZTA's refresh, and from the 15th it **fails** while the month before is
still not built. Checking it is read-only. Don't dispatch, re-run or push unless the user asks.

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
& $gh release list --repo $repo --limit 3            # once the release step is on main: cube-YYYY-MM
& $gh run list --repo $repo --workflow deploy.yml --limit 3   # once deploy.yml is on main
```

## What "green" means

Report all of these to the user:

1. The run was triggered by `schedule` (not `workflow_dispatch`) and concluded `success`.
2. Whether it **built** or **skipped**, and why: the run's summary page says. "Source unchanged" is
   the daily skip. "The source changed after snapshot YYYY-MM was built" means NZTA edited a month
   already built; it is not rebuilt without a forced run, which is the user's to start. A build shows
   the "Upload public data", "Show manifest" and "Commit snapshot aggregate and state" steps as run,
   and adds a `Snapshot YYYY-MM [skip ci]` commit on `main`.
3. The step summary line `Peak memory used: N MiB of M MiB` (from the "Resource report" step).
4. If it failed in "Check source; pull and build if it changed": which exit code. 2 = guardrail
   abort, 3 = source failure, 4 = DuckDB failure. In every case the last good build is unchanged.
   A guardrail abort that reads `[missed_month]` is the alarm: it names the month that is missing
   and fails every day until that month is built. Tell the user at once.

A build also shows:

5. "Publish the cube as a release" as run, and a release `cube-YYYY-MM` for the snapshot.
6. A `Deploy` run started by the build's `deploy` job. Its summary names the cube it built from and
   says whether it uploaded; until deploying is switched on it reads "Built but not uploaded".
7. The job `archive`: green, with the summary line "Archived snapshot YYYY-MM: ...", and a release
   `snapshot-YYYY-MM` in the private repository `nickholttt/nzta-register-archive`
   (`& $gh release list --repo nickholttt/nzta-register-archive --limit 3`). If it failed, its first
   step says why (a missing or refused token, or a repository that is not private). The month's
   build stands. Once the cause is fixed, and with the user's go-ahead, start the workflow with only
   `archive` ticked (`& $gh workflow run "Monthly build" --repo $repo --ref main -f archive=true`):
   it archives the last built snapshot while NZTA still holds it. A failed cube release also skips
   the archive job; the same run by hand recovers it.

If "Publish the cube as a release" failed, the snapshot and state are committed but the site keeps the
previous cube. With the user's go-ahead, a forced run on `main` (`& $gh workflow run "Monthly build"
--repo $repo --ref main -f force=true`) rebuilds the snapshot (the same one, unless NZTA has refreshed
the register since), commits its state again (for the same snapshot only `generated_at` changes, as in
the forced run of 11 September 2026) and publishes the release.

## Also each month: has step 1b's source appeared?

Stats NZ's monthly new and ex-overseas registrations are on Infoshare, which has no API
(`docs/DATA_SOURCES.md` §C; D-065 proposes using them from there). When they reach the Aotearoa Data
Explorer they can be fetched by API. The Explorer's catalogue needs no key. Git Bash, repository root:

```bash
curl -s "https://api.data.stats.govt.nz/rest/dataflow/STATSNZ/all/latest?format=sdmx-json" | .venv/Scripts/python.exe -I -c "import json,sys; flows=json.load(sys.stdin)['data']['dataflows']; hits=[f['id']+': '+f.get('name','') for f in flows if not f['id'].startswith('CEN') and any(w in f.get('name','').lower() for w in ('motor vehicle','vehicles registered','transport','tpt'))]; print(len(flows),'dataflows;', '; '.join(hits) or 'no transport series')"
```

It leaves out the census tables, which count motor vehicles per household. On 2026-11-13 it printed
`913 dataflows; no transport series` (911 on 2026-10-22). The address needs `?format=sdmx-json`: without
it the service answered in XML on 2026-11-13 and the command failed. Report the line; a hit means the
series can be fetched by API, so tell the user.

## Real example

```
completed  success  Monthly build  main  workflow_dispatch  34648180201  1m26s  2026-09-11T21:12:14Z
completed  success  Monthly build  main  workflow_dispatch  34646200411  5m0s   2026-09-11T20:49:05Z
```

- 34646200411 was forced. It built, and its cube was byte-identical to a local build of the same commit.
- 34648180201 was unforced. Tests passed and it skipped the build, because the source was unchanged.
  Its job `103423878794` finished in 1m18s.

Neither was a scheduled run. Scheduled runs on 8 October and 8 November 2026 were the gate (D-066).
