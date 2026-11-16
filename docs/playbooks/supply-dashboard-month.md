# Playbook: supply a month from NZTA's registrations dashboard

Once a month, after NZTA has updated the dashboard (at the start of the month), the user exports the
new month and a maintainer adds it to the store, which is committed to the repository (D-097): GitHub's
builds read it. This is a hand step: the Action never runs it and nothing here fetches anything. Why the
data is kept this way is D-084; why the store is committed is D-097.

**When to do it.** As soon as the dashboard has the month, ideally before NZTA refreshes the register. The Monthly
build runs only when the register's snapshot month moves on, and builds each month once (`fetch.plan`). A store
month committed before that build is simply waiting when it runs, and is published with it. A month committed
after the register's build has landed is not published until the next month's build, one month late (a forced
run, which is asked for each time, would publish it sooner). A store that is a month or two behind the register
is never a failure: the build warns, names the missing months and publishes everything else. The one stop is a
store whose last month is after the register's snapshot month (the register is the clock, D-092): it can be
reached only by a forced run, a first run with no last good state, or a register refresh older than the store.

## Steps (Git Bash, repository root)

1. In the dashboard, tick the same twelve dimensions as the earlier exports (body type, country of
   origin, import status, make, model, motive power, owner type, territorial authority, vehicle status,
   vehicle type, vehicle usage, vehicle year), filter to the one new month, and export. Write down the
   total the dashboard shows for that month.
2. Put the file in the gitignored `data/raw/nzta-dashboard/YYYY-MM/`, and the figure in a two-line CSV:

   ```
   period,vehicles
   2026-11,29000
   ```

3. Run (the month is the one in the file; `--taken` is the day you exported):

   ```
   .venv/Scripts/python.exe -m pipeline supply nzta_dashboard data/raw/nzta-dashboard/2026-11/nzta-first-registrations-2026-11.csv --month 2026-11 --taken 2026-12-02 --totals data/raw/nzta-dashboard/2026-11/totals.csv
   ```

   A file that has a `Registration month` column (the history form) needs no `--month`.
4. Read the summary. "Months added: 2026-11" is the normal result. Check that the vehicles for the year
   look right.

Nothing outside `data/supplied/nzta_dashboard/` is written, and nothing is written at all unless every
check passes.

5. Run the tests that cover the store (`.venv/Scripts/python.exe -m pytest pipeline/tests/test_stores_in_repo.py -q -p no:cacheprovider`),
   then commit `data/supplied/nzta_dashboard/registrations.parquet` and `ledger.json` **together, in one commit**
   (stage them by name). The two files belong to each other by a hash: one without the other makes every build
   abort, and the same test fails on the pull request. The raw export, with its owner columns, is never
   committed: it stays in `data/raw/`.

**Build with `--dry-run` afterwards.** A local `python -m pipeline build <pull>` without `--dry-run` writes
`registrations_flow` into `data/state/last_good.json` and the register's archive into `data/snapshots/`. Never
commit those (only the Action does; hard rule 3): the guardrails of the next GitHub build compare with the
Action's own last build, not with a local one. After supplying a month, build with `--dry-run`.

**What the store keeps.** The dashboard's model field is free text for some vehicle types (trailers and
caravans). `supply` keeps a model where the vehicle type is in the default scope or `trade_scope` in
`vehicle_scope.csv` and the import status is one `registrations_flow` counts; for every other row it stores the
model as not recorded and sums the rows that become identical. Every other field of the row, and so every
vehicle type's counts, stays. Which rows those are comes from `supplied.nzta_dashboard.outside_scope` and the
scope files the build reads, and the ledger records the scope the store was written under. If that scope
later widens (a vehicle type or import status that was blanked becomes counted, or gains `trade_scope`), the build
and `supply` refuse the store and say so: supply the whole history again from the raw exports, as below.

## Replacing the whole history

When the export changes (for example the history is retaken with more groupings, or NZTA restates a great many
months), the new file replaces the old one. Do it in one commit:

1. Change `supplied.nzta_dashboard` in `config/pipeline.json` to the new columns (`extra_fields`, or `fields`
   with the dimension that reads them), and the data map if a column is new.
2. Remove both store files (`git rm data/supplied/nzta_dashboard/registrations.parquet data/supplied/nzta_dashboard/ledger.json`).
   `supply` refuses a file with other columns, or a store written under another scope, over the old store and says
   so, writing nothing. Keep the raw exports (in `data/raw/`): a widened scope needs them again.
3. Supply the whole new history in one go, with `--totals` for every year and `--taken` for the day it was exported.
4. Run the tests above and a `--dry-run` build. Commit the config, the two new store files and the docs together.

The build compares each month's total with the last good build's and aborts if any moved by more than
`max_month_change` (2%). The dry run in step 4 shows it, once `data/state/last_good.json` holds the dataset (after
the first GitHub build that has the store). A fresh ledger has no `replaced` entries, so a month the new export
restates by more than that stops the build and cannot be excused on a rebuilt store. That case has no route today:
stop and tell the lead (read from the code, not tried on real data).

## When it stops

Each message names the cause. What to do:

| Message says | Meaning | Do |
|---|---|---|
| the header is not the configured columns | A column is missing, extra or repeated. A missing owner column is refused too: it is checked and then dropped. | Export the same dimensions as before. If NZTA changed the report, change `supplied` in `config/pipeline.json` first. |
| `--month` is required / refused | A file without a month column needs `--month`; a file with one must not have it. | Add or drop the flag. |
| Vehicles must be a whole number above zero | A blank, zero, negative or fractional count. | Export again. Do not edit the file. |
| combinations of the key columns appear in more than one row | Two exports were joined, or the export repeated rows. | Export again. |
| values that do not read as a month | A month text is not like `Jan 2021`. | Check the file. If NZTA changed the format, change `supplied.nzta_dashboard.month.format`. |
| the file has no rows for YYYY-MM, between its first and last month | A month inside the file is missing. | Export every month in the range. |
| --taken is before YYYY-MM ends | The day given is before the month finished. | Give the day the export was taken. |
| the file does not match the dashboard's own totals | The file's sum differs from the figure you wrote down. | The export may be incomplete. Export again. |
| N month(s) already in the store differ from this file | The dashboard restated a past month. The message shows the old and new totals. | If the new file is right, run again with `--replace YYYY-MM` for each month. The change goes into the ledger. If you did not expect it, keep the old data and ask. |
| adding these months would leave the store with no rows for YYYY-MM | The new month is not the one after the store's last month. | Supply the missing month first. |
| the store disagrees with its ledger, or is not the file this ledger was written with | A store file was edited, or a run was interrupted between writing the two files. | Restore both files together from git (`git restore --source=HEAD -- data/supplied/nzta_dashboard`, which discards any uncommitted change to the two files): it keeps the ledger's record of replaced months. Supplying the history again from the raw exports is the last resort, because it starts a new ledger with no `replaced` history. |
| the store was written when ... counted ... pairs / the ledger does not say what the store was trimmed to | The scope files or the dataset's requirements changed since the store was written, so its months were trimmed under another scope. | Supply the whole history again from the raw exports (Replacing the whole history). Do not edit the ledger. |

The warning "the totals were not checked against the dashboard" means `--totals` was left out. The month
is still added; add the figure next time.
