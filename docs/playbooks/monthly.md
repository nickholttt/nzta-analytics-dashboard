# Playbook: the month, start to finish

Follow it once a month, top to bottom. Nothing is public yet (the site is not deployed), so no step makes the site public.
Merging a pull request does publish its files, because the repository is public. A "session" is a Claude Code session on
your computer; paste the quoted text into it. Every minute below is an estimate. None has been timed, because no month has
been run from this list.

## The month at a glance

| # | Task | Who | Your time | Done when |
|---|---|---|---|---|
| 1 | Export the month from NZTA's dashboard | you | 5 min | a file and a total in `data/raw/nzta-dashboard/YYYY-MM/` |
| 2 | Add that month to the store | session, you say "merge N" | 2 min | the pull request is merged and its `Checks` are green |
| 3 | Stats NZ's long-run table (optional) | you, then a session | 5 min if done | the same, for `data/supplied/statsnz_tpt/` |
| 4 | Build the month, once, when NZTA refreshes the register | the computer, by itself | 0 | a `Snapshot YYYY-MM [skip ci]` commit on `main` |
| 5 | Keep the whole register for the month | the computer, by itself | 0 | a release `snapshot-YYYY-MM` in the private archive |
| 6 | Keep the cube; build the site; do not upload it | the computer, by itself | 0 | a release `cube-YYYY-MM`; `Deploy` says "Built but not uploaded" |
| 7 | Check the build | session | 2 min | its plain-words report: built, warnings, archive, release |
| 8 | Add the month's published figures | session and a reviewer, you say "merge N" | 3 min | the pull request is merged |
| 9 | Bring the hand-written pages up to date | session, you say "merge N" | 2 min | the pull request is merged |
| 10 | Add an event, only if something happened | session | 1 min if done | the pull request is merged |
| 11 | Notes for the next session | session, on `/wrap` | 1 min | `docs/STATE.md` and `docs/CHECKPOINT.md` are current |

Your part: 5 + 2 + 2 + 3 + 2 + 1 = **15 minutes**, counting steps 1, 2, 7, 8, 9 and 11. Steps 3 and 10 add about 6 when they
apply. Step 1 is the largest and the least certain. Waiting is not counted: the store's pull request takes about five minutes
to check, the figures' dry run 12 to 16 minutes, and a reviewer one round.

## 1. Export the month (you; before the register refreshes, about the 1st to the 3rd)

NZTA updates the dashboard at the start of each month. It blocks automated readers, so the file comes from you (or from a
session working in your own browser, `docs/DATA_SOURCES.md` section D). Order matters: a month stored before the register's
build is published with it. One stored after waits for the next month's build (step 2).

1. In the dashboard, tick the twelve dimensions of the earlier exports (list in `docs/playbooks/supply-dashboard-month.md`
   step 1), filter to the new month and export. Write down the total the dashboard shows.
2. Save the file in `data/raw/nzta-dashboard/YYYY-MM/`, and make `totals.csv` beside it: line one `period,vehicles`, line two
   `YYYY-MM,<the total>`. This folder is never committed: the file holds owner columns.

You will see a file with a `Vehicles` column. If the dashboard has no new month yet, wait a day; do not export the old one.

**December 2026 only:** this is the retake. You give a session `DASHBOARD_EXPORT_METHOD.md` (not in the repository yet) and it
retakes the whole history with "GVM group" and "CC grouping - vehicle", replacing the store (`docs/CHECKPOINT.md`, D). The
playbook's "Replacing the whole history" has the steps; budget more than 15 minutes.

## 2. Add the month to the store (session; PUBLIC once merged)

Paste:

> /start. The dashboard export for YYYY-MM is in data/raw/nzta-dashboard/YYYY-MM/ and its total is in totals.csv. Follow
> docs/playbooks/supply-dashboard-month.md: add the month to the store, run the store tests, check with `--dry-run` only,
> never `pipeline run`, and open a pull request. Tell me its number.

You will see "Months added: YYYY-MM", the store tests passing, and a pull request holding exactly two files,
`data/supplied/nzta_dashboard/registrations.parquet` and `ledger.json`. When `Checks` are green, say "merge N". A merge needs
your word naming the pull request (`AGENTS.md` hard rule 7). While work order 3 (`docs/brief/WORK_ORDER.md`) stands, you can
paste its section 5 "continue" message instead, and the session merges green pull requests itself.

If it stops, the session reads the table "When it stops" in the playbook and tells you in one line; do not edit the file.
If the register's build has already landed, the month is published a month late unless a forced run is started. That one
forced run needs no asking (`AGENTS.md` hard rule 7, D-120). The session then also reruns `Checks` on any open pull request
(`docs/playbooks/check-monthly-run.md`).

## 3. Stats NZ's table (optional, you, then a session)

Stats NZ's newest month trails the register's by a month or more, so the build warns and publishes the rest. It is never a
failure. Export the whole table, 26 series, from Infoshare (clicks: `docs/DATA_SOURCES.md` section C; some are marked
"inferred - confirm", so fix that doc the first time) into `data/raw/statsnz/<today>/`. Paste:

> /start. Stats NZ's export is in data/raw/statsnz/<today>/. Follow docs/playbooks/supply-statsnz-series.md and open a pull
> request.

You will see "Months added" and the new months. Stats NZ has no API yet; step 7 checks each month whether one has appeared.

## 4. The build (the computer; no action)

`.github/workflows/monthly-build.yml`, job `build`, runs every day at 06:17 UTC (18:17 NZST, 19:17 NZDT), though GitHub may
start it hours late (D-064). It builds each month once, within a day of NZTA's refresh (the 3rd, 6th and 9th in the three months seen). It runs the
tests, builds the cube, and the accuracy guard sets every figure beside the published ones. A bot commits
`Snapshot YYYY-MM [skip ci]`. From the 15th, a run that built nothing **fails every day** while last month is unbuilt. If a
build fails, the last good build stays. You would know by a red run and, if your GitHub notifications are on, an email
(inferred - confirm). Step 7 reads it either way.

## 5. The archive (the computer; no action)

Job `archive` in the same workflow keeps the whole register for the month, one row per vehicle, as one file in the private
repository `nzta-register-archive` (release `snapshot-YYYY-MM`). It fails, naming the cause, if its token has expired (about
November 2027, D-069) or the repository is not private. The month's build still stands. Fixing it is yours: a new token in the
environment `archive`, then a session starts the workflow with `archive` ticked, on your go-ahead.

## 6. The cube release and the deploy (the computer; no action)

The step "Publish the cube as a release" makes `cube-YYYY-MM`. Job `deploy` then starts `deploy.yml`, which builds the public
site from the newest cube and stops: "Built but not uploaded: deploying is not switched on". The upload happens only once
`CLOUDFLARE_PAGES_PROJECT` is set (`docs/playbooks/go-public.md`). After that, **each built month goes PUBLIC by itself.**

## 7. Check the build (session)

Paste (one session for steps 7 to 11):

> /start. The monthly build for YYYY-MM should have landed. Check it with docs/playbooks/check-monthly-run.md, read-only.
> Tell me in plain words: built or skipped, the warnings, the archive and the cube release. Then do the next steps of
> docs/playbooks/monthly.md (8 to 10) as separate pull requests, and list anything I must copy in by hand.

You will see a report. The three things to act on, by the playbook: a mild-hybrid split that flipped, which changes figures you
may have quoted; `[missed_month]`; and a failed archive. The same session reads whether a Stats NZ series has reached the Data
Explorer (the curl check at the foot of `check-monthly-run.md`). It runs nothing that changes the build.

## 8. The month's published figures (session, reviewer; PUBLIC once merged)

`docs/playbooks/add-published-figures.md`. The session reads each figure from the source's own page that day, never from
memory. For the MIA it uses only public releases (D-151). A figure it cannot read gets no row, and the month stays a gap; it
lists what you could copy in. The pull request is high risk: one independent reviewer, one round. The session reads
`reconciliation.json` from a dry run and reports each row as pass, warn or not compared. A warning is a real gap; it is
reported, not quieted. You say "merge N".

Not confirmed: the dry run needs a saved pull of the new month. The Action does not keep one, and a local one needs your
go-ahead for `pipeline run` (inferred - confirm). Without it the rows are first compared by the next month's build.

## 9. The hand-written pages (session)

The comparison tables on Differences are drawn from the build's own file. The sentences around them, `/method` and
`/caveats` are hand-written and fall behind each month (`docs/STATE.md`, known issue 5). The session updates them to the new
month, takes screenshots at 390 and 1280 px, and opens a pull request. You say "merge N".

## 10. Events (session, only if something happened)

If a policy or macro event happened that visitors should see marked, say it in one sentence. The session follows
`docs/playbooks/add-event.md`. The measurement-or-demand choice it makes is the important one; it will tell you.

## 11. Notes

Type `/wrap`. The session updates `docs/STATE.md` and `docs/CHECKPOINT.md` and ends. This is once per session, not per pull
request.

## December 2026 only: the usage-column check (D-134)

After November's archive file exists, a session matches October's and November's files, privately, to settle whether the
dashboard's "Vehicle usage" is as at first registration or as today. It reports; nothing is published. No script for it is in the
repository (inferred - confirm), so the session writes one outside it. Say: "Do D-134 item 3 and report."

## Not yet automated

- **The dashboard export and Stats NZ's table**: by hand, because both block or lack an API.
- **Figures as first observed**, and later changes shown as revisions on `/status`: planned (additions item 5). When December's
  export lands, a session compares it with the 14 November export, month by month, and reports.
- **A classification review queue** you approve in one batch, and a coverage figure on `/status`: planned (item 8).
- **A latest-month section on the home page** and brand and model pages: planned (items 9 and 10).
- **Market type** is defined and tested, not built. Your order of 25 November to make the two dashboard datasets one "New registrations" dataset is not done.
- **Range-extended electric vehicles** as their own value, and **used imports** from the importers' association: planned (items 11, 12).
- **The deploy to Cloudflare Pages**: not started. The name, address, About gaps and the Cloudflare clicks are yours.
- **The Differences page's MIA section and `restated_from`** are filled by hand; nothing checks the earlier figure.
- **The archive token** expires about November 2027 and is renewed by you.
