# Playbook: supply a month from NZTA's registrations dashboard

Once a month, after NZTA has updated the dashboard (at the start of the month), the user exports the
new month and a maintainer adds it to the local store. This is a hand step: the Action never runs it
and nothing here fetches anything. Why the data is kept this way is D-075.

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
| the store disagrees with its ledger | Someone edited a store file by hand. | Restore both files together, or remove `data/supplied/nzta_dashboard/` and supply the history again. |

The warning "the totals were not checked against the dashboard" means `--totals` was left out. The month
is still added; add the figure next time.
