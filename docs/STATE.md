# State

Last updated by claude on 2026-11-13

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction and order of work are in `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - `main` is `912cada`: the pipeline stack (#26 to #29, #35) and the bot's `Snapshot 2026-10`
    commit from the forced run 43374803222 (5,926,990 rows; peak memory 2,491 MiB of 15,983 MiB;
    346 s). Fourteen live dimensions, two pair slices. Its cube is the release `cube-2026-10`.
  - **The schedule on `main` is still the 8th of each month.** The daily run (D-064) is built and
    waits in #37. NZTA's refresh has come on 3 September, 6 October and 9 November.
  - `Checks` tests every pull request; `Deploy` stops before building (no `src/lib/site.ts`).
- **Nothing is deployed.** The site is a local reference UI (`npm run dev`, 127.0.0.1:4321).
- **The archive's home is ready, and empty:** the private repository
  `nickholttt/nzta-register-archive` (one README commit) and, here, the environment `archive`,
  limited to `main`, holding the secret `ARCHIVE_REPO_TOKEN` (stored by the user on 2026-11-13;
  the token expires 13 November 2027; whether it works is not known until the first archive run).
- **The environment `production` exists**, limited to `main`, with no secret (D-072). Nothing
  uses it until #39 is on `main`.
- **Events**: 54 rows, 50 verified. Four are unverified on purpose (Honda and Mercedes-Benz agency
  starts, the semiconductor window, the weak yen). Don't guess dates to clear them.

## Current step

**Stage 1 of the master brief**, stopped to report. D-064, D-063 and the deploy follow-up are built
and open as #37, #38 and #39; the screenshots of the site stack are taken. **Nothing was merged
this session:** Claude Code's permission check refused `gh pr merge 37` twice (it treats a merge
into `main` as unwanted, whatever D-068 says), and claude did not work around it. Next: the
user's word on the merges and on the site stack (CHECKPOINT).

## In progress

All claude's, all pushed, nothing uncommitted. Each has a worktree beside this folder.

- `claude/daily-run` (#37 into `main`, `../nzta-daily-run`): D-064. Check green on `10019e0`; the
  reviewer refused the first version, then agreed (D-070).
- `claude/register-archive` (#38, `../nzta-archive-build`): D-063, stacked on #37 at `7b9b229`.
- `claude/deploy-environment` (#39, `../nzta-deploy-env`): D-072, stacked on #37 at `7b9b229`.
- `claude/next-stage-brief` (#36, this folder): docs only; now D-069 to D-072 and AGENTS.md rule 7.
- `../nzta-screens`: a detached checkout of `claude/deploy-proposal` (`ca46e90`) with
  `node_modules`, the 2026-10 cube and a built `dist/`, kept for more screenshots.

## Branches and pull requests (checked 2026-11-13)

- `main`: origin `912cada`; local matches.
- `ui/explore`: origin `3c10716`, PRs #1–#16 merged on 2026-10-21. Nothing merged since.
- **18 open pull requests:**
  - #37, #38, #39: above. #38 and #39 are based on `claude/daily-run` so each shows only its own
    change; each is pointed at `main` once #37 is merged.
  - The site stack, each into the one before, the first into `ui/explore`: #17 to #25 and #30 to
    #34 (five lines on each: `docs/brief/STAGE_1_REPORT.md` §6). No check runs on them.
  - #36 `next-stage-brief` into `claude/question-builder`.
- **Built, pushed, no pull request yet:**
  - `claude/question-builder` (`06d727e`, on `claude/deploy-proposal`). It goes between #34 and #36.
  - `claude/fact-table` (`92d451d`, worktree `../nzta-fact-table`). Its pull request opens into
    `main`; claude may merge it under D-068's rule (D-069).

## Raw pulls on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields, 177 MB.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields (every field but `VIN11`,
  `CHASSIS7`, `ENGINE_NUMBER`, `POSTCODE`), 348 MB. Pulled by hand (D-066).
- **Copies:** `F:\nzta-data-backup` holds both, each file identical by SHA-256 (checked
  2026-11-13), on the project's own disk. The user has also copied them to a separate OneDrive
  (the user's word, D-069; not checked by claude). No pull of September exists anywhere.

## Known issues

1. First load at phone width is slow: `/` first chart 6.1 s, all six 13.4 s; `/build` 5.4 s (local
   production build, throttled, median of three, 2026-10-22). Not measured on a deployed site.
2. "Area Outside Region" (Stats NZ's name for the Chatham Islands) reaches visitors as is, in the
   map's table. A visitor name needs a value-label setting in config.
3. On a filtered powertrain chart the mild hybrid coverage note states the whole dataset's
   coverage, not the filtered vehicles'.
4. Once `ui/explore` meets `main`, `config/presets.json` `$ranking_period_comment` is wrong
   (D-050). Correct it on the site stack before that merge.
5. `used-import-age` (blocked) and `powertrain-mix` (invalid) can now draw against `cube-2026-10`.
   Flip them to live on the site stack.
6. On `main` until `ui/explore` merges: `METRICS.md` has the old representativeness-guard
   figures; #29's `config/measures.json` comment has D-033's; and the decision records for the
   code now on `main` (D-047 to D-051, D-056, D-057) are only on the site stack.
7. The public build still ships the status page's script chunk, unlinked and holding no data.
8. Until #37 is on `main`, the monthly run has no retry and no alarm: a refresh that lands after
   the 8th is missed silently, and a deploy would follow every successful run.
9. Until #38 is on `main`, a month is kept at every field only by a hand pull (allowed for
   November, D-068). October is held by NZTA until its December refresh.
10. **Seen in the screenshots of the site stack** (the screenshot helper's reading; claude looked
    at four of the fourteen images and they drew correctly):
    - `/method` says no live chart splits out mild hybrids, but the powertrain charts show a
      "Mild hybrid (identified)" line. `/method` and `/caveats` quote August 2026 figures by hand
      while the site shows October. `/caveats` shows "Decisions D-020 and D-024" and "build step
      1b" to visitors, and calls a chart label "Brand owned from" where the chart says "Country of
      the brand's owner".
    - Phone width, the ranking: the table's last two columns need a sideways scroll with no cue,
      and a blank gap sits between the bars and the table. The map's legend label "0%" hangs
      outside the chart box. There is no dark theme.
11. The reviewers' follow-ups that are not done, none blocking, are listed in CHECKPOINT item 9.

## Where docs and code disagree (noted, not changed)

- **The freeze and who merges.** AGENTS.md (hard rules 2 and 7) is current on this branch only.
  `ui/explore` keeps the old rules until #36 merges; `main` has no AGENTS.md until `ui/explore`
  merges into it. Still describing the freeze: `README.md`, `POST_GATE.md`, five playbooks and
  three skills. AGENTS.md is the rule; the rest is queued for correction.
- **Once #37 merges**, these describe the old schedule: AGENTS.md's architecture line ("cron
  06:17 UTC on the 8th") and its `deploy.yml` sentence, CLAUDE.md ("monthly cron", twice), the
  playbook and the skill `check-monthly-run`. Correct them in the commit that records the merge.
- AGENTS.md hard rule 8's exception still reads "local dev build only until the 8 November 2026
  gate passes". The gate has passed; deploying is Stage 1 item 2, on the user's word.
- The brief's §4 says October is unbuilt and the freeze undecided: both are settled (D-066).
  CLAUDE.md lists `docs/DATA_MAP.md` as planned: a first pass exists, unapproved. D-061 stopped
  chosen values being ranked and D-062 allows it: the code follows D-061. D-067 gives the
  token's expiry as 12 November 2027: it is the 13th (D-069).

## Blocked or waiting on the user

- **The merges of #37, then #38** (CHECKPOINT, Need you 1). Claude Code refused them.
- **"Go" for the site stack**, now that the screenshots exist; `ui/explore` into `main`, asked
  first. **Whether claude may merge #39** under the same rule.
- **NZTA's registrations dashboard**: one export of October, before 1 December (the Stage 1
  report §5), walked through one step at a time.
- Also waiting: visitor tests; the brief's §12; two NZTA pages an automated reader cannot open
  (the Stage 0 report §6). Older: what `shaken-clock` in D-020 refers to; which Gemini client.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Checked on
2026-11-13: the pipeline tests on `claude/daily-run`, 74 passed in 278 s locally and green on
GitHub in 1m10s; `python -m pipeline archive --from-pull data/raw/2026-10/20261113T045017Z --out
<file>` on `claude/register-archive`, 524 s. The site commands were run by the screenshot helper
in `../nzta-screens` (the public build: 7 pages, 5 left after the two internal pages go).

- `data/staging/work.duckdb` holds the staged build of the saved August pull. Open it read-only.
- To profile a field, the October pull holds 36 of the 40. For the live register, ask NZTA's
  service with count queries (`pipeline/arcgis.py`'s client, from a scratch script).
- NZTA's website (`nzta.govt.nz`) answers automated readers with a block page. Don't work around
  it. Its open data account (`arcgis.com`, owner `Open.Data_NZTA`) and Infoshare both answer.
- Headless screenshots: `playwright-core` 1.64.1 from a scratch folder, `executablePath` set to
  Chromium headless shell 1248 under `%LOCALAPPDATA%\ms-playwright`; wait until every chart has
  drawn. The map and ranking are on `/build` (`?build.by=region`; `?build.by=make&build.period=latest_year`).
- In Git Bash, prefix commands whose arguments start with `/` or hold `ref:path` with
  `MSYS_NO_PATHCONV=1`; never leave a bare `python -` in a command; and write any script that
  holds a backslash to a file first: a heredoc in the Bash tool loses them.
- To merge a stacked pull request: point it at its final base (`gh pr edit N --base main`), close
  and reopen it so `Checks` runs against that base, wait for green, then `gh pr merge N --merge`.
