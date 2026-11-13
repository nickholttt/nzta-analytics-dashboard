# Stage 1 report: your Stage 0 answers, and item 1

Written by claude on 2026-11-13 for the user. It covers what was done on your ten answers to
`docs/brief/STAGE_0_REPORT.md` (the brief's Stage 1 item 0) and Stage 1 item 1: a five-line summary
of each open pull request, in merge order, five at a time. Nothing was merged. Items 2 to 8 of
Stage 1 are not started.

Everything here was read or run on 2026-11-13 unless it says otherwise. A reviewer (a sub-agent
on opus that had not seen my reasoning) checked this report, D-066, D-067 and AGENTS.md hard rule 2
against the pull requests, the run, the hand pull and GitHub's documentation. It confirmed the
figures and found 19 points; the real ones are corrected here, chiefly the merge steps (check the
base before merging), the wording of hard rule 2, and five summaries that misstated a detail.

## 1. Your ten answers, and what happened

| # | Your answer | Done |
|---|---|---|
| 1 | Dispatch one unforced run on `main`, and check it | Done. Green, built October (§2) |
| 2 | The gate has passed once that run is green; the freeze lifts | Recorded (D-066). AGENTS.md hard rule 2 rewritten |
| 3 | D-063 accepted, a private repository's releases | Recorded. Your setup steps are §4. Not built yet |
| 4 | Pull October by hand | Done (§3) |
| 5 | Copy the August and October raw pulls to a backed-up folder | **Not done: the folder was left as `<YOUR BACKED-UP FOLDER>`.** The commands are in §3, ready for a path |
| 6 | D-064 accepted, option 3 with both rules | Recorded. Not built yet |
| 7 | D-065 accepted, a hand export each month | Recorded. Not built yet |
| 8 | Read NZTA's registrations dashboard from one export | What to export is §5 |
| 9 | `POSTCODE`: never published, not pulled, not archived | Recorded in `docs/DATA_MAP.md` and D-066 |
| 10 | Accept CLAUDE.md's three untagged changes | Recorded (D-066) |

Also done as you asked: `docs/brief/MASTER_BRIEF.md` replaced with your file in its own commit
(`8364e8f`; checked identical to your file before `incoming/` was deleted).

## 2. The October run

| | |
|---|---|
| Run | [43367551467](https://github.com/nickholttt/nzta-analytics-dashboard/actions/runs/43367551467), `main` at `e3246bb` |
| Triggered by | `workflow_dispatch`, unforced, started by claude on your instruction at 04:45 UTC |
| Result | success, every step |
| Built or skipped | **Built** snapshot 2026-10-31 from 5,926,990 rows |
| Committed | `a5fb60c Snapshot 2026-10 [skip ci]` on `main`: `data/snapshots/2026-10.parquet` (532,151 bytes) and `data/state/last_good.json` |
| Tests | 38 passed in 49 s |
| Warnings | none |
| Peak memory | 2,431 MiB of 15,982 MiB; 291 s from checkout |
| Cube | artifact `public-data-2026-10`, 1.2 MB, expires 2027-02-11. No release: the release step is in #35 |

The dataset has 4,520,304 rows over 1,197 months, with the same 13 live dimensions as September.

## 3. The October hand pull

One read-only pull of NZTA's live service, by a scratch script that uses the pipeline's own client
and writes only under gitignored `data/raw/`.

| | |
|---|---|
| Folder | `data\raw\2026-10\20261113T045017Z` (`pages\` and `source.json`) |
| Snapshot | 2026-10-31; NZTA's last edit 2026-11-09 09:50 UTC. Its change key is the one the run committed to `data/state/last_good.json`, so both read the same register |
| Rows | 5,926,990 in 186 pages |
| Fields | 36 of the 40: every field but `VIN11`, `CHASSIS7`, `ENGINE_NUMBER` and `POSTCODE`. `OBJECTID` is included, as in every pull, because the pipeline pages by it |
| Size | 348,353,175 bytes (the August pull at 17 fields is 177 MB) |
| Checked | Every page re-read after the pull: the rows add up to the service's count, all 36 fields are present, and none of the four left-out fields appears (looked for in the first 50 rows and the last row of each page) |

It is on one disk, like the August pull. Once you name a backed-up folder, these copy both and lose
nothing (PowerShell, from the repo folder; replace `D:\nzta-archive` with your folder). I have not
run them.

```powershell
New-Item -ItemType Directory -Force "D:\nzta-archive\raw"
Copy-Item -Recurse "data\raw\2026-08" "D:\nzta-archive\raw\2026-08"
Copy-Item -Recurse "data\raw\2026-10" "D:\nzta-archive\raw\2026-10"
```

November needs the same hand pull after NZTA's December refresh, unless D-063 is on `main` by then.

## 4. Setting up the private archive (D-063, D-067)

Six steps, all **production**: there is no staging for any of this. The field and button names are
GitHub's as I know them; I could not see the pages in this session. If a label differs, the value to
enter is the same.

1. **Create the private repository** (production). Open `https://github.com/new`.
   - Owner: `nickholttt`. Repository name: `nzta-register-archive`.
   - Description: `Monthly snapshots of NZTA's Motor Vehicle Register, one file a month. Private: one row per vehicle.`
   - Choose **Private**.
   - Tick **Add a README file**. A release needs one commit to attach to, and an empty repository
     has none.
   - No .gitignore, no licence. Click **Create repository**.
2. **Create the token** (production). Open `https://github.com/settings/personal-access-tokens/new`
   (a fine-grained token).
   - Token name: `nzta-archive-write`.
   - Expiration: **Custom**, 12 November 2027. The archive step will be built to fail and say so
     when the token has expired; you then make a new one.
   - Resource owner: `nickholttt`.
   - Repository access: **Only select repositories**, then pick `nzta-register-archive` and nothing
     else.
   - Permissions, Repository permissions: **Contents: Read and write**. If GitHub adds Metadata:
     Read-only by itself, leave it. Leave everything else at No access.
   - Click **Generate token** and copy it. It is shown once. Do not paste it to me, into a file or
     into a chat.
3. **Store the token where the monthly run can read it** (production). Do 3a **or** 3b, not both.
   - **3a, recommended: an environment that only `main` can use.**
     1. Open `https://github.com/nickholttt/nzta-analytics-dashboard/settings/environments/new`.
        Name: `archive`. Click **Configure environment**.
     2. Under **Deployment branches and tags**, choose **Selected branches and tags**, click
        **Add deployment branch or tag rule**, enter `main`, click **Add rule**.
     3. Under **Environment secrets**, add a secret. Name: `ARCHIVE_REPO_TOKEN`. Value: paste
        the token. Click **Add secret**.
   - **3b: a repository secret.** Open
     `https://github.com/nickholttt/nzta-analytics-dashboard/settings/secrets/actions/new`. Name:
     `ARCHIVE_REPO_TOKEN`. Secret: paste the token. Click **Add secret**.
   - Why 3a: under 3b, a workflow on any branch of this repository can read the token, so a
     mistaken or hostile branch could write to the archive. Under 3a only a run on `main` can. It
     is the same choice as CHECKPOINT question 2 for the Cloudflare secrets, and I recommend the
     same answer for both.
4. **Put a reminder in your calendar** for early November 2027: the token expires on the 12th.
5. **Tell me "3a" or "3b".** I build D-063's step to match. I can see that a secret of that name
   exists; nobody can read its value back.
6. **Nothing else.** The run creates each month's release itself. The first file appears with the
   first monthly build after D-063 is merged.

A release can be deleted by hand and keeps no history, so a second copy somewhere you back up is
still yours to keep (D-063).

## 5. What to export from NZTA's registrations dashboard

I cannot read `nzta.govt.nz` (it answers automated readers with a block page), so I have not seen
the dashboard. These steps say what I need, not which buttons to press. The page, from NZTA's open
data listing:

`https://www.nzta.govt.nz/vehicles/how-the-motor-vehicle-register-affects-you/motor-vehicle-registrations-dashboard-and-open-data/`

I recommend October 2026, exported before **1 December**. October is the month now held at every
field (§3), so it is the month an export can be compared with. NZTA's listing says the dashboard
shows "the most recent calendar month", and vstat and StatsHub had October from it on 1 November,
so I expect it to move on to November on 1 December. That is an inference: nobody here has seen it.

1. Open the page in your browser. Change no filter.
2. Take one screenshot of the whole dashboard as it opens, so I can see its filters and column
   names.
3. Note which month it says it shows. If it has a month or date picker, note the earliest and the
   latest month it offers, and leave it on October 2026.
4. Export the table of vehicles at the finest level it offers: every row, every column, no filter.
   - CSV if offered, otherwise Excel.
   - If it asks "summarised" or "underlying" data, choose underlying.
   - If it says the export was cut off at a row limit, keep the file and tell me the message.
5. If the page also links a file to download (CSV or Excel) beside the dashboard, download that too.
6. Select all the text on the page and paste it into a text file named `page-text.txt`: what the
   data counts, when it updates, and its licence or terms.
7. Save everything, with the files' own names, in the repo folder under
   `data\raw\nzta-dashboard\2026-10\`.
   `data\raw\` is ignored by git, so nothing there can be committed.
8. Tell me it is there.

What I do with it (Stage 1 item 6): read its fields, its history and its terms, compare its October
counts with the register as first observed, and propose whether it becomes a source.
`docs/DATA_SOURCES.md` §D ("never build a dependency on it") stands until you decide.

## 6. The open pull requests, in merge order, five at a time

**Twenty are open.** Two branches still have no pull request and come into the order where shown:
`claude/question-builder` and `claude/fact-table`. I have not opened them, to keep to the summaries
you asked for.

**The order.** The pipeline stack goes first, into `main`: it is exactly five, its checks are green,
and the daily run (D-064) and the archive (D-063) are built on top of it and are wanted on `main`
before NZTA's December refresh. Then the site stack into `ui/explore`, bottom to top. Then
`ui/explore` into `main`.

**Checked for all of them:** every pull request reads as mergeable on GitHub. Each stack is a
straight line (each branch contains the one before). A test merge of the top of the site stack with
the top of the pipeline stack has no conflict. The pipeline tests do not read the committed state,
so October's commit on `main` does not disturb them.

**How to merge each one.** The same for all twenty:

1. **Check the base first.** The line under the title must read "into `main`" (batch 1) or "into
   `ui/explore`" (batches 2 to 4). If it names a `claude/` branch, do not merge yet: click **Edit**
   beside the title, pick the right base from the drop-down, and click **Change base**. A pull
   request merged into the wrong base lands on a dead branch and still shows as merged.
2. Read **Files changed**.
3. Click the arrow on the green button and choose **Create a merge commit**, then merge. Not
   "Squash" and not "Rebase": the next pull request is built on this one's commits, and either would
   make it show conflicts. (The repository allows all three.)
4. Click **Delete branch**. GitHub's documentation says it then points the next pull request at
   `main` (or `ui/explore`) by itself. That has not been seen in this repository, where #1 to #16
   were merged from the command line, and another page of the same documentation says the button
   is not shown while an open pull request uses the branch. If there is no button, change the next
   pull request's base by hand (step 1), then delete the branch.
5. Keep to the order. None of this loses work: a merge can be reverted, and a deleted branch can be
   restored from its pull request's page.

Each summary is five lines: what it does; the decisions in it that are yours to confirm; what to
look at; what could go wrong; what happens after it merges.

Words used below:

- **The cube** is the set of small files of counts the pipeline publishes and the site reads.
- **The golden contract** is a saved copy of what a small test build must produce. A change to it
  means the published files change shape, so each one is deliberate and shown to you.
- **A slice** is the cube's file for one breakdown. **A pair slice** crosses two breakdowns, so a
  chart of one can be narrowed by the other.
- **The denominator** is what a share is a share of.
- **High cardinality** means a breakdown with many values, such as brand. Those can be ranked.

### Batch 1: the pipeline stack, into `main` (#26, #27, #28, #29, #35)

**[#26](https://github.com/nickholttt/nzta-analytics-dashboard/pull/26) Tests on every pull request** (1 file, +37)
1. Does: adds `.github/workflows/checks.yml`, which runs the pipeline's tests on every pull request, set up as the monthly build is. Read-only: it never pulls from NZTA and never commits.
2. Decisions: D-048, tests only. The site is not built in CI yet.
3. Look at: the one file. The green "Checks" run on this pull request is the workflow testing itself.
4. Could go wrong: little. A test broken on `main` would turn every later pull request red until fixed. Each check took 1m03s to 1m35s on these five.
5. After: #27 points at `main`. Pull requests into `ui/explore` get no check until `ui/explore` holds this file.

**[#27](https://github.com/nickholttt/nzta-analytics-dashboard/pull/27) The first pair slice: import status by age when first registered** (8 files, +604 −16; 414 of the lines are the golden contract)
1. Does: the cube gains one file that crosses two dimensions, so the site can draw used imports, or NZ-new vehicles, by age when first registered.
2. Decisions: D-047. One schema for every pair; the denominator is the whole month, as in a plain slice; pairs are listed in `config/pipeline.json`; a misconfigured pair aborts the run.
3. Look at: the golden diff (the manifest gains `live_pairs` and `not_live_pairs`, one new `pairs` section, every existing slice identical) and the pair section of `docs/CUBE_SCHEMA.md`.
4. Could go wrong: it changes the published cube, and has run only as a dry run on the August pull. Its first live run is the next monthly build; if the pair fails its checks there, the run aborts and October's build stands. The cube grew by about 92 KB in the dry run.
5. After: nothing shows on the site until a build carries it and #31 is merged.

**[#28](https://github.com/nickholttt/nzta-analytics-dashboard/pull/28) Vehicle class as a dimension, with a powertrain pair** (4 files, +666 −4; 643 golden)
1. Does: `segment_group` ("Vehicle class") becomes a dimension, and the cube gains powertrain by vehicle class, so the powertrain chart can show light passenger vehicles only, as its title asks.
2. Decisions: none new. It follows POST_GATE A3 as written, with the same `segment_map.csv` match as `segment`.
3. Look at: the new entry in `config/dimensions.json`, and the golden diff (one new slice of 24 rows, one new pair of 35 rows, the rest unchanged).
4. Could go wrong: one more live dimension for the coverage and unmapped guards to watch, so one more thing that can abort a run. In the August dry run both new files passed (25,640 and 57,147 bytes).
5. After: once a build carries #27 and #28, `used-import-age` and `powertrain-mix` are switched to live (STATE known issue 5).

**[#29](https://github.com/nickholttt/nzta-analytics-dashboard/pull/29) Build fixes B1 to B3, event checks, three config fixes** (15 files, +224 −75, five commits)
1. Does: five commits. (1) B1 to B3: the pull is timed in the log, JSON is written the same on every platform, and the golden test compares the cube's size against a frozen events file. (2) A comment in `config/measures.json` gets D-033's figures. (3) `kgm-rename` becomes a measurement event and one event title is shortened. (4) Every listed value in `events.csv`, and a 60-character title limit, are checked. (5) Manufacturer group can be ranked.
2. Decisions: D-049 (the renaming is measurement), D-050 (manufacturer group is high cardinality), D-051 (adding an event stays a one-row change, not a contract change).
3. Look at: commit by commit. The two changed rows in `data/reference/events.csv`, `pipeline/events.py`, and `POST_GATE.md` losing its Part B.
4. Could go wrong: the stricter event checks abort a monthly run if a future `events.csv` row holds a value outside `docs/EVENTS_LAYER.md`'s tables or a title over 60 characters, or if those tables are reworded so they stop parsing. That is by design, but it is new. It also changes `monthly-build.yml` (3 lines), so the next run is that change's first.
5. After: once this and the site stack are both headed for `main`, a comment in `config/presets.json` is wrong (STATE known issue 4). I correct it in a commit on the site stack before `ui/explore` goes into `main`.

**[#35](https://github.com/nickholttt/nzta-analytics-dashboard/pull/35) Keep each cube as a release, and the deploy workflow** (4 files, +1,619; 1,451 are a lockfile; five commits)
1. Does: each built monthly run keeps its cube as a release `cube-<snapshot>` that never expires; a new `deploy.yml` builds the public site from the newest cube and uploads it to Cloudflare Pages; the upload tool (wrangler 4.148.0) is pinned by its own lockfile.
2. Decisions: D-056 (your choice of option C; the details are mine) and D-057 (the release follows the state commit and runs on `main` only; the deploy uploads from `main` only).
3. Look at: the 21 lines added to `monthly-build.yml`, and `deploy.yml`'s triggers and its "main only" conditions.
4. Could go wrong: the release step and the upload cannot be tested before the merge. If the release step fails, the snapshot is already committed and the site keeps the previous cube; the playbook has the recovery. `deploy.yml` runs as soon as this merges and after every monthly build: it stops before building until `ui/explore` reaches `main`, and builds without uploading until the Cloudflare secrets exist.
5. After: the deploy run that this merge starts stops before building. October has no cube release (it was built before this), so the first deploy that does build, once `ui/explore` is in `main`, takes the newest release if a later month has made one, and otherwise the `public-data-2026-10` artifact, which expires on 2027-02-11. `claude/fact-table`, D-064 and D-063 go on top of this.

### Batch 2: the site stack, into `ui/explore` (#17, #18, #19, #20, #21)

No check runs on these: the test workflow (#26) is not on these branches.

To look at a screen yourself, in a terminal at the repo folder: `git switch claude/public-explore`
(the branch named on the pull request) puts that branch's files in the folder; then `npm run dev`
and open `http://127.0.0.1:4321`. `git switch claude/next-stage-brief` brings you back. Switching
loses nothing, and git refuses to switch if you have unsaved changes it would overwrite. Or ask me
for screenshots of any screen named below, at phone and desktop width.

**[#17](https://github.com/nickholttt/nzta-analytics-dashboard/pull/17) STATE and CHECKPOINT after #1 to #16** (2 files, +33 −90)
1. Does: docs only. The two notes files as they stood on 21 October.
2. Decisions: none.
3. Look at: nothing to check. Every later pull request rewrites both files, and #36's versions are the current ones.
4. Could go wrong: nothing. It is the bottom of the stack, so it merges first.
5. After: #18 points at `ui/explore`.

**[#18](https://github.com/nickholttt/nzta-analytics-dashboard/pull/18) Explore shows visitors only charts that draw; diagnostics move to `/status`** (12 files, +235 −127)
1. Does: `/` becomes the visitor's page: six charts, no badges or internal words. Everything diagnostic moves to an internal `/status` page.
2. Decisions: D-041. The scope and timing were yours; how is mine: one panel with a public and an internal mode; four charts that cannot draw are hidden; AGENTS.md hard rule 8 gains its exception for the visitor site.
3. Look at: `/` and `/status` at phone and desktop width.
4. Could go wrong: old links to `/#triage` lead nowhere (nothing is deployed, so none exist outside this machine). The rule 8 exception is a hard-rule change you approved on 21 October; this is where it lands.
5. After: #19.

**[#19](https://github.com/nickholttt/nzta-analytics-dashboard/pull/19) One row of time options per chart, and plain wording** (10 files, +215 −124)
1. Does: each chart gets one time row ("3 years · 5 years · 10 years · Since … · All records") in place of two "All time" buttons, and visitor wording for the definitions and notes.
2. Decisions: D-042. The visitor wording lives in a `public_copy` block in `config/presets.json`, because `config/dimensions.json` was frozen.
3. Look at: on `/`, the owner-country chart's time row with "All records", and the powertrain chart's notes.
4. Could go wrong: `public_copy` is in the wrong file for the long run. Moving it into `config/dimensions.json` is queued (CHECKPOINT item 7) and can now be done.
5. After: #20.

**[#20](https://github.com/nickholttt/nzta-analytics-dashboard/pull/20) Frozen-path work may be built on branches before the gate (D-043)** (4 files, +36 −6)
1. Does: docs only. The exception to AGENTS.md hard rule 2 that let the pipeline stack be built before the gate.
2. Decisions: D-043, your rule, my terms.
3. Look at: nothing to check. The freeze is now lifted, and #36 replaces rule 2's text.
4. Could go wrong: nothing. It is history, kept so the record of why the stack exists is on the branch.
5. After: #21.

**[#21](https://github.com/nickholttt/nzta-analytics-dashboard/pull/21) The Build page: a sentence a visitor completes** (11 files, +433 −26)
1. Does: adds `/build`, where a visitor completes "Show [the share of vehicles] by [breakdown]" and gets one chart, with the choice kept in the address bar.
2. Decisions: D-044. Most of it is superseded: the question builder on `claude/question-builder` (D-058 to D-061) replaces the sentence, and offers counts and models, which D-044 withheld.
3. Look at: lightly. What survives is the page, its place in the navigation, the address-bar form and the visitor notes; the sentence component itself is deleted at the top of the stack.
4. Could go wrong: reviewing it closely is wasted effort. It has to merge because everything above is built on it.
5. After: #22.

### Batch 3: the site stack, continued (#22, #23, #24, #25, #30)

**[#22](https://github.com/nickholttt/nzta-analytics-dashboard/pull/22) A 12-month ranking on the Build page** (10 files, +155 −62)
1. Does: where the breakdown is brand, the time row offers "12-month ranking": a ranked bar chart with each brand's move, and a table.
2. Decisions: D-045. Shape is still inferred, never chosen; Explore's `brand-share` gets no ranking; on a share the bars show share only.
3. Look at: `/build?build.by=make&build.period=latest_year`, then "All time" and back. It also changes one line of CLAUDE.md's stack section.
4. Could go wrong: D-061 later stopped hand-picked values being ranked, and D-062 allows it again. The code follows D-061 until Stage 2.
5. After: #23.

**[#23](https://github.com/nickholttt/nzta-analytics-dashboard/pull/23) "Not recorded" and "No reference match" keep their own line** (5 files, +79 −26)
1. Does: on a chart that names only the largest values, the two reserved values get their own grey line instead of being folded into "All other".
2. Decisions: D-046. It supersedes D-044's fold. Reserved lines use the same grey as values beyond the eight palette colours. Country where built is capped at 10 again.
3. Look at: `/?brand-share.period=all`, and `/build?build.by=built_in&build.range=all`, where "Not recorded" is near 100% before 1986.
4. Could go wrong: "All other" figures change on capped charts (manufacturer group: 11.7% to 11.6% over 12 months), which is the point, but a figure someone noted before will differ.
5. After: #24.

**[#24](https://github.com/nickholttt/nzta-analytics-dashboard/pull/24) The queue for a first prototype** (2 files, +35 −4)
1. Does: docs only. Four queue items agreed on 22 October. Items 7 (#30) and 10 (#33) are built. Item 8 has its workflow (#35) but nothing is deployed. Item 9 has its accessibility pass and playbook (#32) but no visitor sessions.
2. Decisions: none.
3. Look at: nothing to check. #36's CHECKPOINT replaces it.
4. Could go wrong: nothing.
5. After: #25.

**[#25](https://github.com/nickholttt/nzta-analytics-dashboard/pull/25) D-047 to D-051, and why step 1b had no source** (2 files, +127)
1. Does: docs only. The five decision records for the pipeline stack, which live here because `main` has no `docs/DECISIONS.md`.
2. Decisions: D-047 to D-051, each also listed on its own pipeline pull request in batch 1.
3. Look at: the five records, if you did not read them with batch 1.
4. Could go wrong: its note that step 1b has no source is out of date: D-065 (accepted) takes the Stats NZ series from Infoshare by hand export. #36 carries the correction.
5. After: #30.

**[#30](https://github.com/nickholttt/nzta-analytics-dashboard/pull/30) "Change this chart" on Explore, and one hover readout** (10 files, +243 −38)
1. Does: an Explore chart that Build can draw exactly gets a "Change this chart" link into Build, and every chart type shows the same readout on hover ("39.8% · 2,282 of 5,732 vehicles").
2. Decisions: D-052. The link appears only where Build draws the same chart (five of six); it carries the time range; one helper words every readout.
3. Look at: on `/`, follow "Change this chart" from two charts, and hover a line and a bar.
4. Could go wrong: the powertrain chart has no link, because Build cannot yet ask for light passenger vehicles only (D-052). D-060 ties that to #28; whether it also needs the fact table in a build is not checked. The readout was not tested on a touch screen.
5. After: #31.

### Batch 4: the site stack, to its top (#31, #32, #33, #34, then #36)

**[#31](https://github.com/nickholttt/nzta-analytics-dashboard/pull/31) The site reads pair slices** (8 files, +269 −62, nine commits)
1. Does: the site's half of #27 and #28: a chart can be narrowed by one dimension (used imports only; light passenger only) once a build carries the pair files. Against today's cube Explore looks the same.
2. Decisions: D-053 (a view is narrowed by one dimension, where its rows load; `used-import-age` measures share, not count) and two from D-057 (a narrowed chart says so in a plain line, not a warning; the age note says longer spans count survivors). A review fix makes a view with no rows say "Nothing to draw".
3. Look at: `/build?build.by=age_at_registration_band` (the note's last sentence) and `/status`.
4. Could go wrong: the narrowed charts themselves cannot be seen until a monthly build carries #27 and #28; they were checked against a dry-run cube only. One fix (a slow load drawing under a later view) has no test.
5. After: #32.

**[#32](https://github.com/nickholttt/nzta-analytics-dashboard/pull/32) Charts named for screen readers, and tables of figures** (10 files, +174 −20)
1. Does: each chart is one named image to a screen reader; trend and distribution charts end with "The figures behind this chart"; scrolling tables take keyboard focus; and a playbook for testing with visitors.
2. Decisions: D-057. The figures are behind a disclosure, built when opened, because a visible table would put up to 1,195 rows under one chart.
3. Look at: `/#concentration`, open "The figures behind this chart"; `docs/playbooks/visitor-test.md`, since you run those sessions.
4. Could go wrong: it was checked with axe-core in headless Chromium only. No screen reader and no other browser was used.
5. After: #33.

**[#33](https://github.com/nickholttt/nzta-analytics-dashboard/pull/33) The map, the fifth shape** (12 files, +383 −14, fifteen commits)
1. Does: the Build page can draw "the share of vehicles by owner's region" as a map of 16 regions with a table beneath, from Stats NZ's region outlines.
2. Decisions: D-054 and D-057. The map is on Build only; it measures share, not vehicles per resident; the Chatham Islands are in the table, not on the map; a new top-level `scripts/` folder holds the script that refreshes the outlines.
3. Look at: `/build?build.by=region` at desktop and phone width. It also adds lines for `scripts/` and `public/geo/` to AGENTS.md, CLAUDE.md and the README.
4. Could go wrong: the region is the owner's current address, not where the vehicle was sold (the note says so). "Area Outside Region" reaches visitors as Stats NZ names it (STATE known issue 2). Each region's readout is a browser tooltip, which does not show on touch screens.
5. After: #34.

**[#34](https://github.com/nickholttt/nzta-analytics-dashboard/pull/34) The public build, a not-found page, the deploy decisions** (11 files, +350 −217, twelve commits)
1. Does: the site can be built without its internal pages (`/status`, `/sense-check`) for the public, and gains a not-found page. D-055 to D-057 are recorded here.
2. Decisions: D-056 (yours: deploy by option C, without the internal pages) and D-057 (the not-found page; what the independent review changed across #30 to #35).
3. Look at: D-055 to D-057 in `docs/DECISIONS.md`; and the public build's footer and `/status`, by the commands in the pull request.
4. Could go wrong: that Cloudflare Pages answers an unknown address with this page and a 404 rests on its documentation until the first deploy.
5. After: `claude/question-builder` needs its pull request here, into `ui/explore`, before #36 can merge. I open it once this has merged, unless you want it sooner.

**[#36](https://github.com/nickholttt/nzta-analytics-dashboard/pull/36) The brief, D-062 to D-067, Stage 0 and this report** (docs only)
1. Does: files your brief and CLAUDE.md, the Stage 0 report and this one, the data map's first pass, and D-062 to D-067. It rewrites AGENTS.md hard rule 2 now that the freeze is lifted.
2. Decisions: D-062 and D-066 are yours. D-067 (the archive's names) is mine and unreviewed.
3. Look at: AGENTS.md hard rule 2; D-066, to check I recorded your answers as you meant them; `docs/DATA_MAP.md`, which is unapproved.
4. Could go wrong: it targets `claude/question-builder`, so it cannot merge until that branch has. Until it does, `ui/explore`'s AGENTS.md still says the freeze holds. `main` has no AGENTS.md until `ui/explore` merges into it, and its `POST_GATE.md` still describes the freeze.
5. After: the notes on `ui/explore` are current.

### After the twenty

Four more pull requests are coming. They are not one queue: the first two each wait on a
different stack, and the last is wanted soonest.

- **D-064 (the daily run), then D-063 (the archive)**, into `main`, straight after batch 1. I
  build them next, on your word (CHECKPOINT items 2 and 3). They are the ones wanted on `main`
  before NZTA's December refresh.
- **`claude/fact-table`** into `main`, after #35 (8 files, +2,914 −14, most of it the golden
  contract): the fact table the question builder reads. Until a build carries it, the builder
  answers only questions with no chosen values or conditions (D-060).
- **`claude/question-builder`** into `ui/explore`, between #34 and #36 (15 files, +1,275 −166): the
  question builder that replaces the sentence (D-058 to D-061).
- **`ui/explore` into `main`**, last. Before it, a commit on the site stack corrects
  `config/presets.json`'s `$ranking_period_comment`.

I open the fact table's and the question builder's pull requests when the one below each has
merged, unless you want them sooner.

## 7. What I did outside the repo, and what I changed in it

- **On GitHub:** started one Monthly build run on `main` (43367551467), as you instructed. The
  workflow's bot then committed `a5fb60c` to `main`. I merged nothing and pushed only
  `claude/next-stage-brief`.
- **Asked of NZTA's service, read-only:** the change-detection query twice, and one pull of all
  5,926,990 rows at 36 fields (186 page requests). NZTA's open data account was listed once to find
  the dashboard's address.
- **On this computer:** `data\raw\2026-10\` written (gitignored). `incoming\` deleted after its one
  file was committed.
- **In the repo, on `claude/next-stage-brief`:** the brief (its own commit); AGENTS.md hard rule 2
  and the three other lines that named the freeze or the gate (the `main` and `ui/explore` branch
  lines, and where the pipeline branches stand);
  D-066 and D-067; `docs/DATA_MAP.md` (`POSTCODE`); `docs/DATA_SOURCES.md` §A and §D; this report;
  STATE and CHECKPOINT.
- **Scratch files** (the pull script, the saved pull request descriptions) are in claude's scratch
  folder for that session, outside the repo, and can be deleted.
