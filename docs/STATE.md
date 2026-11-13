# State

Last updated by claude on 2026-11-13

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction and order of work are in `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - **The pipeline stack is on `main`** (2026-11-13, merged by claude under D-068, merge commits):
    #26 `c946f5b`, #27 `31e6389`, #28 `31acd3c`, #29 `a0690f7`, #35 `a8df1ce`.
  - **Forced run 43374803222** (`main` at `a8df1ce`): green. 55 tests passed; 5,926,990 rows
    pulled in 56.8 s; built snapshot 2026-10, no warnings; peak memory 2,491 MiB of 15,983 MiB;
    346 s. Fourteen live dimensions (`segment_group` is new), two pair slices. The bot committed
    `912cada Snapshot 2026-10 [skip ci]`: only `data/state/last_good.json` changed
    (`generated_at`, `segment_group` now live). `data/snapshots/2026-10.parquet` is unchanged.
  - **The first cube release exists:** `cube-2026-10`, on `912cada`, one file
    `public-data.tar.gz` (1,393,784 bytes), holding both pair files and the `segment_group` slice.
  - `Checks` runs the pipeline tests on pull requests whose branch holds `checks.yml` (#26).
    `Deploy` ran twice and stopped before building both times: `main` has no `src/lib/site.ts`.
  - The schedule is still the 8th of each month. The daily run is accepted (D-064) and not built.
    NZTA's refresh has come on 3 September, 6 October and 9 November.
  - Cube artifacts: `public-data-2026-08` (expires 2026-12-10), `-09` (2027-01-06), two `-10`.
- **Nothing is deployed.** The site is a local reference UI (`npm run dev`, 127.0.0.1:4321).
- **The archive's home exists, empty:** the private repository `nickholttt/nzta-register-archive`
  (one README commit) and, here, the environment `archive`, limited to `main`, with no secret.
- **Events**: 54 rows, 50 verified. Four are unverified on purpose (Honda and Mercedes-Benz agency
  starts, the semiconductor window, the weak yen). Don't guess dates to clear them.

## Current step

**Stage 1 of the master brief**, stopped to report after the pipeline stack merged and the forced
run was checked. The user's standing permissions are D-068; its one forced run is used. Next:
D-064, then D-063, and screenshots of the site stack for the user (CHECKPOINT).

## In progress

- `claude/next-stage-brief` (claude, #36): docs only; now also D-068 and the amended AGENTS.md and
  brief lines. Pushed; nothing uncommitted. Nothing else is in progress by either agent.

## Branches and pull requests (checked 2026-11-13)

- `main`: origin `912cada`; local matches. The five merged pipeline branches are deleted.
- `ui/explore`: origin `3c10716`, PRs #1–#16 merged on 2026-10-21. Nothing merged since.
- **15 open pull requests**, the site stack, each into the one before, the first into
  `ui/explore`: #17 to #25 and #30 to #34 (branch names and five lines on each:
  `docs/brief/STAGE_1_REPORT.md` §6); and #36 `next-stage-brief` into `claude/question-builder`.
  No check runs on them: `checks.yml` is not on those branches.
- **Built, pushed, no pull request yet:**
  - `claude/question-builder` (`06d727e`, on `claude/deploy-proposal`): the question builder
    (D-058 to D-061). It goes between #34 and #36.
  - `claude/fact-table` (`92d451d`, worktree `../nzta-fact-table`): the fact table. Its base is
    now in `main`, so its pull request can open into `main`. Merging it is not in D-068.

## Raw pulls on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields, 177 MB.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields (every field but `VIN11`,
  `CHASSIS7`, `ENGINE_NUMBER`, `POSTCODE`), 348 MB. Pulled by hand (D-066).
- **Second copy:** `F:\nzta-data-backup` holds both, 373 files, each identical by SHA-256
  (checked 2026-11-13). It is on the project's own physical disk. Nothing is on D:, E:, G: or
  OneDrive.
- No pull of September exists anywhere.

## Known issues

1. First load at phone width is slow. Local production build, 390px, 150 ms latency, 1.6 Mbps,
   CPU slowed four times, cold cache, median of three (2026-10-22): `/` first chart 6.1 s, all six
   13.4 s, 776 KB; `/build` 5.4 s, 486 KB. Not measured on a deployed site.
2. "Area Outside Region" (Stats NZ's name for the Chatham Islands) reaches visitors as is, in the
   map's table. A visitor name needs a value-label setting in config.
3. On a filtered powertrain chart the mild hybrid coverage note states the whole dataset's
   coverage, not the filtered vehicles'.
4. Once `ui/explore` meets `main`, `config/presets.json` `$ranking_period_comment` is wrong
   (D-050). Correct it on the site stack before that merge.
5. `used-import-age` (blocked) and `powertrain-mix` (invalid) can now draw: the `cube-2026-10`
   release carries #27 and #28. Flip them to live on the site stack. Until then, by the #28
   reviewer's reading of `resolve.ts` (not rendered), `powertrain-mix` shows a
   status-disagreement notice against the new cube.
6. On `main` until `ui/explore` merges: `METRICS.md` has the old representativeness-guard
   figures; #29's `config/measures.json` comment has D-033's; and the decision records for the
   code now on `main` (D-047 to D-051, D-056, D-057) are only on the site stack.
7. The public build still ships the status page's script chunk, unlinked and holding no data.
8. The monthly run has no retry and no alarm: a refresh that lands after it is missed silently.
   D-064 fixes it and is not built.
9. The committed archive keeps five dimensions. D-063 fixes it and is not built. Until it is on
   `main`, a month is kept at every field only by a hand pull (allowed for November, D-068).
10. `deploy.yml` starts after every successful monthly build, and a skip is a success. Under a
    daily run that is a deploy every day. Settle it when D-064 is built.
11. **The reviewers' follow-ups from the stack, none blocking** (2026-11-13; their claims, not
    all re-tested):
    - `deploy.yml` reads the Cloudflare secrets as repository secrets, and uploads in the same
      job as the site's `npm ci`. Before any secret is added, the upload moves to a job of its
      own that names an environment limited to `main` (D-068, answer 2).
    - A failed release upload could leave a release with no file, or a draft (inferred).
      `deploy.yml` skips such a release; recovery is a forced run on `main`.
    - Smaller: `persist-credentials: false` in `checks.yml`; `pipeline/events.py` blames the CSV
      when an enum row in `docs/EVENTS_LAYER.md` parses to no values; `docs/METRICS.md` does not
      say the share guards apply to a pair slice's filtered base; `write_pairs` accepts a
      dimension id containing `__` (none has one).

## Where docs and code disagree (noted, not changed)

- **The freeze and who merges.** AGENTS.md (hard rules 2 and 7) is current on this branch only.
  `ui/explore` keeps the old rules until #36 merges; `main` has no AGENTS.md until `ui/explore`
  merges into it. Still describing the freeze: `README.md`, `POST_GATE.md`, the playbooks
  `change-reference-data`, `add-event`, `change-preset`, `check-monthly-run` and `session-handoff`,
  and the skills `add-event`, `change-reference-data` and `check-monthly-run`. AGENTS.md is the
  rule; the rest is queued for correction.
- AGENTS.md hard rule 8's exception still reads "local dev build only until the 8 November 2026
  gate passes". The gate has passed; deploying is Stage 1 item 2, on the user's word.
- The brief's §4 says October is unbuilt and the freeze undecided. Both are settled (D-066). Its
  Stage 1 items cite CHECKPOINT item numbers that have since moved.
- CLAUDE.md lists `docs/DATA_MAP.md` as planned. A first pass exists, marked as unapproved.
- D-061 stopped chosen values being ranked; D-062 allows it. The code still follows D-061.

## Blocked or waiting on the user

- **The archive token**: the user creates it and stores it as the secret `ARCHIVE_REPO_TOKEN` in
  the environment `archive`. claude walks through it one step at a time; the token is never
  pasted into a chat. D-063 can be built without it but not run.
- **NZTA's registrations dashboard**: one export of October, before 1 December (the Stage 1
  report §5), walked through one step at a time.
- **A copy of the backup off the project's disk** (CHECKPOINT question 1); **"go" for the site
  stack**, after the screenshots; `ui/explore` into `main`, asked first.
- Also waiting: visitor tests; the brief's §12; two NZTA pages an automated reader cannot open
  (the Stage 0 report §6). Older: what `shaken-clock` in D-020 refers to; which Gemini client.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Checked on
2026-11-13 on `main`'s tree: the pipeline tests, 54 passed and 1 skipped locally (the skip needs
Bash; 437 s with other test runs on the machine), 55 passed in 73 s on GitHub; and
`pipeline build data/raw/2026-10/20261113T045017Z --dry-run`, exit 0 in 538 s, the same totals as
the live run. The site commands were not re-run on 2026-11-13.

- `data/staging/work.duckdb` holds the staged build of the saved August pull. Open it read-only.
- To profile a field, the October pull holds 36 of the 40. For the live register, ask NZTA's
  service with count queries (`pipeline/arcgis.py`'s client, from a scratch script).
- NZTA's website (`nzta.govt.nz`) answers automated readers with a block page. Don't work around
  it. Its open data account (`arcgis.com`, owner `Open.Data_NZTA`) and Infoshare both answer.
- Headless checks use `playwright-core` 1.64.1 and `axe-core` 4.10.3 from a scratch folder, with
  `executablePath` set to Chromium headless shell 1248 under `%LOCALAPPDATA%\ms-playwright`. Wait
  until every chart panel has drawn before auditing.
- In Git Bash, prefix commands whose arguments start with `/` or hold `ref:path` with
  `MSYS_NO_PATHCONV=1`, and never leave a bare `python -` in a command: it waits for input.
- To merge a stacked pull request: point it at its final base (`gh pr edit N --base main`), close
  and reopen it so `Checks` runs against that base, wait for green, then `gh pr merge N --merge`.
  GitHub reports `mergeable` as `UNKNOWN` for a few seconds after the base moves; wait for it.
