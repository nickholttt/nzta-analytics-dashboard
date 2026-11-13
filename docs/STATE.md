# State

Last updated by claude on 2026-11-13

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction and order of work are in `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - `main` is `d50bfc6`: the pipeline stack, then #37 (`693ecf3`), #39 (`b507d53`) and #38, merged
    on the user's word (D-073). The last build is the forced run 43374803222 (snapshot 2026-10;
    5,926,990 rows; peak memory 2,491 MiB of 15,983 MiB; 346 s); its cube is `cube-2026-10`.
  - **The build is tried every day** at 06:17 UTC (D-064, D-070). It builds each month once; a
    change to a month already built is reported and not built; from the 15th a run that builds
    nothing fails while the month before is missing. The first daily run is 14 November 2026.
    NZTA's refresh has come on 3 September, 6 October and 9 November.
  - **An archive job** keeps each built month's whole register in the private repository (D-063,
    D-071). **October is archived:** run 43383948013 (started by hand, `archive` only) pulled
    5,926,990 rows in 98 s and wrote 35 fields, 39,298,142 bytes; the job took 441 s and peaked
    at 4,619 MiB of 15,983 MiB. The run before it, 43382023139, failed at its first step as
    built to: the token could not see the repository until the user added it.
  - `Checks` tests every pull request; `Deploy` stops before building (no `src/lib/site.ts`).
- **Nothing is deployed.** The site is a local reference UI (`npm run dev`, 127.0.0.1:4321).
- **The archive:** the private repository `nickholttt/nzta-register-archive` holds one release,
  `snapshot-2026-10`, with `mvr-2026-10.parquet`. Here, the environment `archive`, limited to
  `main`, holds the secret `ARCHIVE_REPO_TOKEN` (the user's; expires 13 November 2027).
- **The environment `production`** exists, limited to `main`, with no secret. `deploy.yml`'s
  upload job names it and stays off until the variable `CLOUDFLARE_PAGES_PROJECT` is set (D-072).
- **Events**: 54 rows, 50 verified. Four are unverified on purpose (Honda and Mercedes-Benz agency
  starts, the semiconductor window, the weak yen). Don't guess dates to clear them.

## Current step

**Stage 1 of the master brief.** D-064, D-063 and the deploy environment are on `main`, and
October is archived. The site stack and the fixes the screenshots called for (#40) are in
`ui/explore`. The user's export from NZTA's dashboard is read and a proposal is written (D-075).
Next: the user's decisions (CHECKPOINT), then its queue.

## In progress

- `claude/next-stage-brief` (claude, #36, this folder): docs only. Pushed; nothing uncommitted.
- Nothing else is in progress by either agent. `../nzta-screens` is a detached checkout of
  `ui/explore` (`e5dfc70`) with `node_modules`, the 2026-10 cube in `public/data/` and a built
  `dist/`, for more screenshots.

## Branches and pull requests (checked 2026-11-13)

- `main`: origin `d50bfc6`; local matches.
- `ui/explore`: origin `e5dfc70`: PRs #1–#16 (2026-10-21), the site stack, #17 to #25 and #30
  to #34, and #40, the fixes the screenshots called for (D-074), all on 2026-11-13.
- **1 open pull request:** #36 `next-stage-brief` into `claude/question-builder`.
- The merged branches are deleted here and on GitHub: `daily-run`, `register-archive`,
  `deploy-environment`, `site-words` and the fourteen of the site stack.
- **Built, pushed, no pull request yet:**
  - `claude/question-builder` (`06d727e`, on the old `claude/deploy-proposal`): the question
    builder (D-058 to D-061). Its pull request opens into `ui/explore`; #36 sits on it.
  - `claude/fact-table` (`92d451d`, worktree `../nzta-fact-table`). Its pull request opens into
    `main`; claude may merge it under D-068's rule (D-069).

## Raw pulls on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields, 177 MB.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields (every field but `VIN11`,
  `CHASSIS7`, `ENGINE_NUMBER`, `POSTCODE`), 348 MB. Pulled by hand (D-066).
- **Copies:** `F:\nzta-data-backup` holds both, each file identical by SHA-256 (checked
  2026-11-13), on the project's own disk. The user has also copied them to a separate OneDrive
  (the user's word, D-069; not checked by claude). No pull of September exists anywhere.
- `data/raw/nzta-dashboard/2026-10/`: the user's hand export from NZTA's dashboard (D-075): one
  spreadsheet of October 2026 at twelve dimensions (6,509 rows, 28,896 vehicles), NZTA's page as
  HTML, and four screenshots. On this disk only.

## Known issues

1. First load at phone width is slow: `/` first chart 6.1 s, all six 13.4 s; `/build` 5.4 s (local
   production build, throttled, median of three, 2026-10-22). Not measured on a deployed site.
2. "Area Outside Region" (Stats NZ's name for the Chatham Islands) reaches visitors as is, in the
   map's table. A visitor name needs a value-label setting in config.
3. On a filtered powertrain chart the mild hybrid coverage note states the whole dataset's
   coverage, not the filtered vehicles'.
4. Once `ui/explore` meets `main`, `config/presets.json` `$ranking_period_comment` is wrong
   (D-050). Correct it in `ui/explore` before that merge.
5. `used-import-age` (blocked) and `powertrain-mix` (invalid) can now draw against `cube-2026-10`.
   Flip them to live in `ui/explore`.
6. On `main` until `ui/explore` merges: `METRICS.md` has the old representativeness-guard
   figures; #29's `config/measures.json` comment has D-033's; and the decision records for the
   code now on `main` (D-047 to D-051, D-056, D-057) are only in `ui/explore`.
7. The public build still ships the status page's script chunk, unlinked and holding no data.
8. The archive leaves out `VIN11` and `POSTCODE` (D-066 item 9). The user asked in the session
   whether to use them; nothing is changed until the user decides (CHECKPOINT question 1). NZTA
   replaces October early in December, so October with those fields needs deciding before then.
9. `/method` and `/caveats` state figures by hand. They were recomputed for October (#40) and are
   a month behind again after each refresh, until the narrative engine (D-062).
10. Seen in the screenshots and not fixed: the map's legend label "0%" hangs outside the chart
    box; "Is the market getting more crowded?" shows a dense grey band before 1970; there is no
    dark theme (the screenshot helper's reading).
11. The reviewers' follow-ups that are not done, none blocking, are listed in CHECKPOINT item 8.

## Where docs and code disagree (noted, not changed)

- **The freeze and who merges.** AGENTS.md (hard rules 2 and 7) is current on this branch only.
  `ui/explore` keeps the old rules until #36 merges; `main` has no AGENTS.md until `ui/explore`
  merges into it. Still describing the freeze: `README.md`, `POST_GATE.md`, four playbooks
  (`change-reference-data`, `add-event`, `change-preset`, `session-handoff`) and two skills.
- `main`'s own CLAUDE.md still says "monthly cron"; this branch's is corrected.
- AGENTS.md hard rule 8's exception still reads "local dev build only until the 8 November 2026
  gate passes". The gate has passed; deploying is Stage 1 item 2, on the user's word.
- The brief's §4 says October is unbuilt and the freeze undecided: both are settled (D-066).
  CLAUDE.md lists `docs/DATA_MAP.md` as planned: a first pass exists, unapproved. D-061 stopped
  chosen values being ranked and D-062 allows it: the code follows D-061. D-067 gives the
  token's expiry as 12 November 2027: it is the 13th (D-069).

## Blocked or waiting on the user

- **The user's decisions** (CHECKPOINT questions): whether `VIN11` and `POSTCODE` may be kept and
  used; whether the dashboard becomes a source (D-075), starting with one test export.
- **`ui/explore` into `main`**: asked first. The question builder and the fact table come before
  the site is public (CHECKPOINT).
- Also waiting: visitor tests; the brief's §12; two NZTA pages an automated reader cannot open
  (the Stage 0 report §6). Older: what `shaken-clock` in D-020 refers to; which Gemini client.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Checked on
2026-11-13: the pipeline tests on the branches now in `main`, green on GitHub in 1m02s to 1m48s
(74 passed locally on `claude/daily-run`, 278 s); `python -m pipeline archive --from-pull
data/raw/2026-10/20261113T045017Z --out <file>`, 524 s, 39.3 MB; the public site build in
`../nzta-screens` (7 pages, 5 left after the two internal pages go) and `tsc --noEmit`.

- `data/staging/work.duckdb` holds the staged build of the saved August pull. Open it read-only.
- To profile a field, the October pull holds 36 of the 40. For the live register, ask NZTA's
  service with count queries (`pipeline/arcgis.py`'s client, from a scratch script).
- NZTA's website (`nzta.govt.nz`) answers automated readers with a block page. Don't work around
  it. Its open data account (`arcgis.com`, owner `Open.Data_NZTA`) and Infoshare both answer. Its
  registrations dashboard (`qap.nzta.govt.nz`) is read only from the user's hand exports.
- Headless screenshots: `playwright-core` 1.64.1 from a scratch folder, `executablePath` set to
  Chromium headless shell 1248 under `%LOCALAPPDATA%\ms-playwright`; wait until every chart has
  drawn. The map and ranking are on `/build` (`?build.by=region`; `?build.by=make&build.period=latest_year`).
- In Git Bash, prefix commands whose arguments start with `/` or hold `ref:path` with
  `MSYS_NO_PATHCONV=1`; never leave a bare `python -` in a command; and write any script that
  holds a backslash to a file first: a heredoc in the Bash tool loses them.
- To merge a stacked pull request: point it at its final base (`gh pr edit N --base main`), close
  and reopen it so `Checks` runs against that base, wait for green, then `gh pr merge N --merge`.
- Claude Code's permission check refuses a merge into `main` unless the user has said so in the
  session's own messages. If it refuses, say so; do not work around it.
