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
   **A build's warnings are on the same summary page** (D-112): a heading "Warnings in the YYYY-MM
   build (N)" and a list, worst first, or the line "No warnings in the YYYY-MM build." Report the
   count and every warning in the first two groups (below) to the user; read the rest. See "A
   warning in the build" below.
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

A forced run replaces the cube release, and `Checks` runs the query service prototype's tests against
the newest release on every pull request. So after a forced run, start `Checks` on any open pull
request, or run `python -m pytest scripts/query_service_prototype -q` over the new cube: where the
code or the reference data changed since the last build, the totals pinned in
`scripts/query_service_prototype/cases.json` and the limits in its `settings.json` may no longer hold
(after the forced run of 17 November 2026 two tests failed until both were brought up to the new
cube, D-134). Measure a changed total again from the cube's fact table, not from the service.

## A warning in the build

A warning does not stop a build. The ones a person must act on are the first two groups, in the order
`config/pipeline.json` `run_summary.warning_order` gives them (the code and the tests are in
`pipeline/fetch.py` and `pipeline/tests/test_run_summary.py`):

1. **Rewrites published history**: a dataset's mild hybrid split flipped between published and
   withheld since the last good build (D-110). One build changes every month of that dataset's history
   of two powertrain values, in every slice, pair and fact table; no total moves.
2. **Close to stopping a later build**: an unmapped-value guard is above its warning level. It aborts
   above its abort level, and the warning says how many rows away that is.
3. Everything else, in the order the build raised it (a month that deviates from the median, a
   supplied source that lags the register, a dimension that is not live, the size budget).

Where the warnings are:

- **The run's summary page** on GitHub (Actions, `Monthly build`, the run): the list above. Written by
  the pipeline step itself, so it is there for a build and not for a run that skips. Not yet seen on a
  real run: the first monthly build after D-112 merges is the check, and the first thing to report if
  the page is empty is that it is.
- **The log** of the step "Check source; pull and build if it changed": every warning as
  `  WARNING: ...`, in the order raised. From the command line this is the way in, since the summary
  page is read in the browser: `gh run view <run-id> --log | grep "WARNING:"` (PowerShell:
  `... --log | Select-String "WARNING:"`). Checked on 2026-11-17: `gh run view <run-id>` lists the jobs,
  annotations and artifacts and does not show the summary page; `--log` prints the step's output with
  the job and step names in front of each line, and, in the "Show manifest" step, the manifest, whose
  `warnings` were `[]` on the build of 2026-11-14. No run so far has had a warning, so the
  `WARNING:` lines themselves are not yet seen in a real log.
- **`manifest.json`**, `warnings`: in the log's "Show manifest" step, in the cube release
  `cube-YYYY-MM`, and in `public/data/manifest.json` of a local build.
- **`/status`**, the internal status page, at its top: the manifest's warnings as written, with the
  snapshot and the time the cube was generated. Local only; the public build leaves it out.

An aborted build shows none of its warnings: the abort messages are the failure, and the manifest is
only staged. Fix the abort, and the next build shows them.

### A split flip

The warning names the dataset, the direction, the trailing coverage at high confidence in the last
good build and in this one, and the threshold (`publish_split_at_trailing_high_confidence_coverage`
in `config/pipeline.json`, 70%). The Monthly build still publishes. Tell the user at once, because
any figure they quoted from the earlier build no longer matches.

1. **Say what happened, from the warning and the state.** A flip to withheld: the figure fell under
   the threshold, so every vehicle that was Mild hybrid is Hybrid in that dataset. A flip to
   published: it reached the threshold. `data/state/last_good.json`, `mild_split`, holds what the last
   good build recorded for each dataset (committed by the bot; read it, never edit it). The
   committed state has no `mild_split` until the first build after D-110 has been committed (checked
   2026-11-17), and that build compares nothing: a flip in it is not announced.
2. **List what counts against the figure.** The file that decides it is
   `data/reference/mild_hybrid_models.csv`: one row per make and model, its type (`mild`, `full` or
   `unresolved`), its confidence and its basis. At high confidence only, a vehicle counts against the
   figure unless it is a `mild` call at high confidence, a `full` call at high confidence, or a hybrid
   code that maps to mild by itself (`docs/METRICS.md`). The script lists the rest by make and model
   for a dataset's trailing 12 months, from the repository root (it writes nothing):

   ```bash
   # true registrations: reads the committed store, no pull needed
   .venv/Scripts/python.exe -I scripts/unmatched_hybrids.py registrations_flow --top 25
   # the register: needs the saved pull of that snapshot (the pull is made only by the Action, or by the user's go-ahead)
   .venv/Scripts/python.exe -I scripts/unmatched_hybrids.py registrations_surviving data/raw/YYYY-MM/<timestamp> --top 25
   ```

   Its first lines are the figure the build computes (the same function) and how much room is left;
   each line below is a make and model with its count and its call: `[no row]` is a nameplate the file
   does not list, `[unresolved at low]`, `[full at medium]` and `[mild at medium]` are rows that exist
   but are not at high confidence. The register takes about 12 minutes (it reads the whole pull);
   a supplied dataset about 10 seconds.
3. **Decide what is yours to decide.** A nameplate with `no row` is a gap: a new model appeared, or
   the register and the dashboard spell it differently (the file is keyed on each dataset's own
   spelling, D-108). Adding it is a change to this one reference file, with a public source that
   settles its type, following `docs/playbooks/change-reference-data.md` (one file per commit, the
   docs in the same commit, a dry run on the saved pull, a golden change only if the cube changes).
   D-108 added a nameplate when it had 10 or more hybrids in the last 12 months on either dataset or
   100 or more all time, and a source settled its type. **Never classify a contested nameplate to
   raise coverage** (`docs/METRICS.md`): a row marked `unresolved` stays unresolved while sources
   disagree. Raising or lowering the threshold to make a flip go away is the user's decision, not a
   fix.
4. **Check the result** with `python -m pipeline build <saved pull> --dry-run` (publishes nothing,
   about 13 minutes) and read the coverage figures and warnings it prints.

What the script printed on the 2026-10 snapshot (2026-11-17, built from the saved pull and the
committed store, matching the manifest's figures): the register had 14,241 of 19,233 hybrids at high
confidence only (74.04%), room for 1,111 more unidentified hybrids before the split falls under
70%; true registrations 14,271 of 19,286 (74.00%), room for 1,101. Of the 5,015 vehicles counting
against true registrations' figure, 2,905 were `unresolved` at low confidence, 1,275 `full` at medium,
760 `mild` at medium and 75 had no row: the margin was mostly in rows that exist and are not at
high confidence, not in missing nameplates. After D-115's rows (the same day, the same inputs) the
register has 14,297 of 18,207 (78.52%), room for 2,217, and true registrations 14,327 of 18,257
(78.47%), room for 2,210 (the wider dataset reads the same as true registrations); of the 3,930
vehicles still counting against true registrations' figure, 2,513 are `unresolved` at low
confidence, 637 `full` at medium, 704 `mild` at medium and 76 have no row. After D-119's Subaru
rows (the same day, the same inputs) the register has 14,297 of 17,814 (80.26%), room for 2,610,
and true registrations 14,327 of 17,864 (80.20%), room for 2,603 (the wider dataset again the
same); of the 3,537 vehicles now counting against true registrations' figure, 1,253 are
`unresolved` at low confidence, 1,504 `full` at medium, 704 `mild` at medium and 76 have no row
(3,517 on the register: 1,246, 1,500, 700 and 71). Subaru's 393 `full` vehicles at high
confidence left the denominator; its 867 at medium (864 on the register) still count against it.

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
