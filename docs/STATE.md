# State

Last updated by claude on 2026-11-14

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction is the user's standing work order,
`docs/brief/WORK_ORDER.md` (D-082), over `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - `main` is the merge of #52, on `dd134ed` (the merge of #51). The last build is the forced
    run 43374803222 (snapshot 2026-10; 5,926,990 rows); its cube is the release `cube-2026-10`,
    which has no fact table.
  - **The build is tried every day** at 06:17 UTC (D-064, D-070). The first daily run is due on
    14 November 2026; GitHub had not started it by 06:47 UTC that day.
  - **The fact table is on `main`** (#41, D-078), without the owner's region. The next build
    writes it.
  - **The archive job** keeps each built month's whole register in the private repository
    `nickholttt/nzta-register-archive`: one release, `snapshot-2026-10`, two files, read back
    on 2026-11-14 (39,298,142 and 55,125,916 bytes; the second holds `VIN11` and `POSTCODE`).
  - `Checks` tests every pull request into `main`.
- **The site's code is on `main`**, with three new public pages since #49: `/about` (a draft
  with six gaps for the user), `/feedback` (with a corrections log, empty) and `/differences`.
  `Deploy` builds the public site from the newest cube release and uploads nothing: run
  43567634682 (after #51) built it with the changed install and its upload job was skipped.
  **Nothing is deployed**: the variable `CLOUDFLARE_PAGES_PROJECT` is unset (checked
  2026-11-14). The site is seen locally (`npm run dev`, 127.0.0.1:4321).
- **`registrations_flow` is defined, not built** (#50, D-087): true first registrations from
  the user's exports of NZTA's dashboard, January 2021 on (`docs/METRICS.md`).
- **Six sub-agent definitions** in `.claude/agents/`, each naming its model, with a test
  (D-085). A definition written in a session may not load until the next: until then a spawn
  names its model by hand.
- **Six shapes are allowed** (D-083): `matrix` is approved and has no renderer yet.
- **Events**: 54 rows, 50 verified; four are unverified on purpose. Don't guess dates.

## Current step

**Work order 1.** Package A is done but for the forced run of October. B's pipeline half, E's
write-up and G are being built. One report at the end; a blocked item is parked in CHECKPOINT
and the next package goes on (D-082).

## In progress (all claude; nothing by gemini)

Unpushed work sits in git worktrees in the session's scratch folder and in a second checkout
beside this folder: `git worktree list` shows them. Each branch is a local branch of this
repository; none is on GitHub yet.

| Branch | What | State when this was written |
|---|---|---|
| `claude/registrations-flow` | Package B, pipeline half: `python -m pipeline supply`, a local store, the dataset built through the register's own code (plan: `data/staging/work-order/spec-B-pipeline.md`) | A sonnet worker is mid-way: five commits |
| `claude/data-map` | Package E: `docs/DATA_MAP.md` in full, `config/data_map.json`, schema tests | An opus worker is mid-way: two commits |
| `claude/query-service` | Package G: `docs/QUERY_SERVICE.md`, a local prototype, measurements, a proposal | An opus worker is mid-way, in the second checkout: two commits |

- **The profile of every register field** is in gitignored `data/staging/profiles/2026-10/`
  (`REPORT.md` and 48 CSV files): the evidence for the data map.
- **The plan for package C** is `data/staging/work-order/spec-C-statsnz.md` (gitignored).

## Branches and pull requests (checked 2026-11-14)

- Merged this session: #47, #48, #49, #50, #51 and #52. **No pull request is open.**
- `ui/explore` is deleted on GitHub (all of it was in `main`; no history rewritten). The local
  branch of that name remains and is far behind.

## Raw files on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields. Pulled by hand (D-066).
- `data/raw/nzta-dashboard/`: the user's exports of NZTA's registrations dashboard (D-084).
  - `history/nzta-first-registrations-2021-01_to_2026-10.csv`: 70 months, 991,274 rows,
    1,883,786 vehicles, 133,320,124 bytes.
  - `2021-01/nzta-first-registrations-2021-01.csv`: 17,221 rows, 30,011 vehicles.
  - `2026-10/`: the first hand export (a spreadsheet), NZTA's page as HTML, screenshots (D-075).
- `data/raw/statsnz/2026-11-14/TPT052601.csv`: Stats NZ's monthly series, January 1961 to
  September 2026, 26 series, 95,024 bytes. Fetched read-only from Infoshare for building and
  testing (the work order §2); the user's own hand export replaces it (D-065).
- **No local file holds `VIN11` or `POSTCODE`.** The archive's 35-field file is read into a
  scratch folder for a check and deleted after.
- **Copies:** a backup folder on the project's own disk holds both register pulls (SHA-256
  checked 2026-11-13) and both dashboard CSV files (checked 2026-11-14). The user's Downloads
  folder still holds two more copies of the history file; they are the user's to delete.

## Known issues

1. First load at phone width is slow: `/` first chart 6.1 s, all six 13.4 s; `/build` 5.4 s
   (local production build, throttled, 2026-10-22). Not measured since. Package D measures it
   again and makes the cheapest fix.
2. "Area Outside Region" (Stats NZ's name for the Chatham Islands) reaches visitors as is.
3. On a filtered powertrain chart the mild hybrid coverage note states the whole dataset's
   coverage, not the filtered vehicles'.
4. **The released cube, `cube-2026-10`, has no fact table**, so the public build's Build page
   offers no conditions. A forced run of October or December's refresh ends this.
5. Commits before #47 still hold paths from the user's computer (D-081); history stays as is.
6. **Half of the fact table's rows count one vehicle** (50.2% of rows, 7.1% of vehicles, on the
   2026-10 dry run). Whether a minimum count is wanted is for the Stage 2 privacy review.
7. `/method`, `/caveats` and `/differences` are hand-written; the first two state figures and
   fall a month behind at each refresh until the narrative engine (package H; D-086).
8. In Build a model's name shows as its two parts joined by `|` everywhere but the ranking; a
   share by model draws 300 lines; `/build/` skips a heading level; no dark theme (D-089).
9. The public build still ships the status page's script chunk, unlinked, holding no data.

## Where docs and code disagree (noted, not changed)

- CLAUDE.md and AGENTS.md say six shapes; five have renderers, and `src/lib/resolve.ts` still
  says "all five". The `matrix` renderer is package F.
- `docs/brief/MASTER_BRIEF.md` still calls `matrix` proposed, says Plot draws "all five
  shapes", and keeps the cap of five waiting pull requests. The work order wins (its §5); the
  brief is updated with the final report (its §6).
- `config/dimensions.json` still describes `registrations_flow` as planned from Stats NZ's
  series. `docs/METRICS.md` and CLAUDE.md say it is the dashboard's dataset (D-087);
  `claude/registrations-flow` changes the config.
- An event marker can appear on a chart whose filter excludes the vehicles the event is about
  (`docs/EVENTS_LAYER.md`, D-089). No chart shows a wrong marker today.
- D-058 says the register has "no owner data": corrected by D-078, and D-058 is not edited.
- D-061 stopped chosen values being ranked and D-062 allows it: the code follows D-061 until
  package F.
- NZTA's page says an inactive vehicle is one "registered and registration cancelled in the
  same month". The counts say `INACTIVE` behaves as since removed (`docs/METRICS.md`, D-087).
- `docs/DATA_MAP.md` on `main` is the first pass plus the dashboard's fields. The profile
  contradicts it in places (body type does not roll up to vehicle type; "100% filled" counts
  `UNKNOWN`); `claude/data-map` rewrites it.

## Blocked or waiting on the user

Nothing stops the work. Parked for the final report (CHECKPOINT, questions).

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). On
2026-11-14: the pipeline tests, 111 passed locally in 604 s on what became #51, and they pass
in `Checks` in about 90 s; `tsc --noEmit` exit 0 and `astro build`, 10 pages, on what became
#52; the brand and model rankings, share and count by model, the map and a bad link, headless
at 320 to 1280 px.

- `python -m pipeline archive --snapshot YYYY-MM` pulls NZTA's live register (about 186
  requests) and writes nothing committed.
- NZTA's website and its registrations dashboard block automated readers. Don't work around
  it: the dashboard is read only from files the user supplies. NZTA's open data service and
  Stats NZ's Infoshare both answer.
- Headless screenshots: `playwright-core` 1.64.1 in a scratch folder, `executablePath` set to
  `chrome-headless-shell.exe` in `chromium_headless_shell-1248\chrome-headless-shell-win64`
  under `%LOCALAPPDATA%\ms-playwright`. Serve a build with `npx astro preview --port N` and
  stop it with `npx astro preview stop`. The Build page's question is in the address bar:
  `/build/?build.measure=share&build.by=make`; a condition is
  `&build.where.<dimension>=<value>`. The ranking is a toggle on the chart ("12-month
  ranking"), not part of the address.
- In Git Bash, prefix commands whose arguments start with `/` with `MSYS_NO_PATHCONV=1`, and
  write any script that holds quotes, backticks or backslashes to a file first.
- A sub-agent that needs its own copy of the repository gets a worktree made by hand
  (`git worktree add`); Claude Code's own isolated worktree failed to start in this folder.
  A worktree has no `.venv` or `node_modules`: give it this folder's Python by its full path,
  and use the second checkout (it has `node_modules`) for a second site worker.
- Before a merge: wait for the `Checks` run on the pull request's newest commit, in a command
  of its own, and only then merge. #50 was merged about a minute before its last check had
  finished (it then passed). If Claude Code's permission check refuses a merge into `main`,
  say so and do not work around it (hard rule 7).
