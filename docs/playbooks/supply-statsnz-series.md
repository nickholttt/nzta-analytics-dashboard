# Playbook: supply Stats NZ's long-run table of registrations

Stats NZ published about two weeks after NZTA's service on the one month observed, so the series' newest month is usually a month behind the register's (an estimate) (the latest month in the 2026-11-14 export was September 2026, last
updated 19 October). Once a month, or when the user wants the newest month, the user exports the
table from Infoshare and a maintainer adds it to the store, which is committed to the repository (D-097) and read by
GitHub's builds. This is a hand step: the Action never runs it and nothing here fetches anything. Why the data
is kept this way is D-065; what the table is, and what each of its columns means, is `docs/DATA_SOURCES.md`
section C. The copy in the store now was fetched read-only by a script on 2026-11-14; the user's own export
replaces it the same way as any later one.

A store that ends before the register's month is normal here and is not a problem: the build warns, names the missing
months and publishes everything else. A store that ends after the register's month aborts the build; it cannot
happen with a table that is published after the register.

Infoshare is being replaced by Stats NZ's Aotearoa Data Explorer in 2027. When the table reaches it only
the export step changes.

## Steps (Git Bash, repository root)

1. Export the table by hand, as `docs/DATA_SOURCES.md` section C lists (Browse, Industry sectors, Transport -
   TPT, "New and Ex-Oseas Motor Vehicles Registered by Type (Monthly)", all 26 series, all times, "Comma delimited
   (.csv)", Go). The steps marked "inferred - confirm" there have not been confirmed in a browser: correct the
   doc the first time you follow them.
2. Put the file in the gitignored `data/raw/statsnz/<today's date>/`.
3. Run (the whole table is exported every time, from January 1961; `--taken` is the day you exported):

   ```
   .venv/Scripts/python.exe -m pipeline supply statsnz_tpt data/raw/statsnz/2026-12-02/<the export's file name> --taken 2026-12-02
   ```

   The browser's name for the file is probably `TPT052601_<date>_<time>_26.csv` (inferred - confirm).

4. Read the summary. "Months added: 2026-10" (or the new months) is the normal result, with every earlier
   month unchanged. "The export says it was last updated ..." should be a later date than last time. If the export ends before the store does, the summary says so and nothing is added. The
   three warnings about a total and its parts are expected and are recorded in the ledger: the cars total in 2
   months, the commercial total excluding buses in 5 and the one including buses in 4, all before 1998.

Nothing outside `data/supplied/statsnz_tpt/` is written, and nothing is written at all unless every check
passes.

5. Run `.venv/Scripts/python.exe -m pytest pipeline/tests/test_stores_in_repo.py -q -p no:cacheprovider`, then commit
   `data/supplied/statsnz_tpt/series.parquet` and `ledger.json` together in one commit, staged by name. The two
   belong to each other by a hash: one without the other makes every build abort. The raw export stays in `data/raw/`.

**Build with `--dry-run` afterwards**, as for the dashboard (`docs/playbooks/supply-dashboard-month.md`): a
local `python -m pipeline build <pull>` without `--dry-run` writes the dataset into `data/state/last_good.json`
and the register's archive into `data/snapshots/`, which only the Action may commit (hard rule 3). The dry run
writes only the gitignored `data/staging/`.

## Attribution

Stats NZ licenses the table under CC BY 4.0 and asks for its statement to be shown with anything that uses
it. The statement is `supplied.statsnz_tpt.attribution` in `config/pipeline.json`, and the build copies it into
the dataset's block in `manifest.json`. Do not retype it anywhere else.

## When it stops

Each message names the cause. What to do:

| Message says | Meaning | Do |
|---|---|---|
| the table's title is ... but config expects ... | This is another table, or Stats NZ renamed it. | Export the right table. If Stats NZ renamed it, change `title` in `supplied.statsnz_tpt` after checking it is the same table. |
| the table's header is not the configured columns | A series was added, dropped, renamed or reordered. The message says which. | Export all 26 series in Infoshare's order. If Stats NZ changed the table, update `data/reference/statsnz_series.csv` (header, series id, label, group, role, total_of) in its own commit, with `docs/DATA_SOURCES.md` section C. |
| line N has K fields | The file was cut short or edited. | Export again. Do not edit the file. |
| month(s) do not read as ... / more than once / oldest first / no row for YYYY-MM | A month is malformed, repeated, out of order or missing. | Export again with every month selected ("Time", Select all). |
| line N should be the footer's first line ... but is ... / line(s) ... come after the footer starts but look like rows | The month rows stop before the footer: a blank line or a mistyped month in the middle of the file, or a row after the footer begins. The months after it would be lost. | Export again. Do not edit the file. |
| figure(s) are not a whole number ... | A figure is signed, decimal, has a comma or is text. | Export again. Do not edit the file. |
| a series has a gap inside its range | A `..` appears after a series has begun. | Export again. If Stats NZ now withholds a figure, that needs a decision before the pipeline can use the series. |
| the file has no 'Table reference:' line / the table reference is ... | The footer is missing, or it names another table. | Export again; check the file was not cut short. |
| the file has no 'Last updated:' line | The export is cut short, or Stats NZ changed the footer. | Export again. If the footer changed, change `footer` in `supplied.statsnz_tpt`. |
| --taken is before YYYY-MM ends | The day given is before the last month finished. | Give the day the export was taken. |
| a total no longer equals its parts from YYYY-MM | A total differs from the sum of its parts in a month from `arithmetic_from` (1998-01). | Export again. If it persists, Stats NZ has changed the table: tell the lead before moving `arithmetic_from`. |
| N figure(s) in M month(s) already in the store differ from this file | The file differs from what was stored for those months (whether the publisher revises is not known). The message lists every changed figure with its old and new value. | Read the list. If the new file is right, run again with `--accept-revisions`; the change goes into the ledger. If you did not expect it, keep the old data and ask. |
| adding these months would leave the store with no rows for YYYY-MM | The file does not join the stored months. | Export the whole table (it always starts at 1961M01). |
| the store disagrees with its ledger, or is not the file this ledger was written with | A store file was edited, or a run was interrupted between writing the two files. | Restore both files together from git (`git restore --source=HEAD -- data/supplied/statsnz_tpt`, which discards any uncommitted change to the two files): it keeps the ledger's record of accepted revisions. Supplying the whole table again is the last resort, because it starts a new ledger with no `revisions` history. |
| the store has one of its two files | One of `series.parquet` and `ledger.json` is missing. | Restore it, or remove the other and supply again. |

A revision that you accept changes the dataset's figures for those months. The next build compares each
month's total with the last good build's and stops unless the ledger records an accepted revision from a file
taken since that build, so an accepted revision is the only way a past month moves.
