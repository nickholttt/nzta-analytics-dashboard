# Data Sources

All NZTA registration data used here is released under **CC BY 4.0**.
Attribution is required in the site footer and in every CSV export.

## A. ArcGIS Feature Service — Motor Vehicle Register (primary)

Point-in-time snapshot of all vehicles currently registered in NZ, updated
monthly and accurate to the end of the previous month. NZTA has
algorithmically cleaned make and model errors.

- **Find the item by searching the portal on every run** (query in
  `config/pipeline.json`); never trust a pinned ID. The item is currently
  `7b4df667d5014f1a93e6050b31d18407`, kept only as a fallback that warns
  loudly. NZTA has republished the register under new items before, and
  the service name is not a date: `MVR_Mar26` held August 2026 data.
- The service exposes a single **table**, not a layer. Resolve its URL
  from the item, then read `.../FeatureServer/0?f=json` for the live field
  list. **Do not hardcode field names from this doc**: they are bound in
  `config/pipeline.json` and asserted against
  `pipeline/expected_schema.json` on every run.
- There is no snapshot-date field. The snapshot is the latest
  first-registration month in the table, capped at the month before the
  fetch.
- Supports `where`, `groupByFieldsForStatistics` + `outStatistics`, and
  `resultType=standard` pages of 32,000 rows. Change detection uses one
  grouped-statistics query. The build pulls rows, only the bound fields,
  in OBJECTID ranges (about 185 requests), because most dimensions need
  several fields from the same row (make with model, segment from three
  fields, fuel consumption stored as text): a grouped query over them would
  be as large as the rows.
- **Refresh timing.** The register refreshes early in the month, on no
  fixed day: the 2026-08 snapshot was last edited on 3 September 2026,
  2026-09 on 6 October and 2026-10 on 9 November. So the workflow asks
  every day (06:17 UTC) and builds within a day of a refresh landing. Two
  rules go with a daily run:
  - **Each month is built once.** If NZTA edits the register again after
    its snapshot month was built, the run reports the change on its
    summary page and builds nothing. Rebuilding a month takes a run
    started by hand with `force`. This keeps the first observation of
    every month.
  - **A missed month fails the run.** From the 15th (UTC;
    `schedule.missed_month_alarm_day` in `config/pipeline.json`), a run
    that builds nothing fails, every day, while the month before is still
    not built, and names it. A skipped run is green, so without this a
    month NZTA never published would pass unseen.

## B. Azure Blob CSVs — full fleet (for the stock cube)

- Container: `nztaopendata.blob.core.windows.net/motorvehicleregister/`
- Split into one CSV per vehicle year from 1990; pre-1990 in a single zip
- A cleaned version and a raw ungroomed version exist. **Use the cleaned
  version.** NZTA only recommends the raw one for specialist use.
- The all-years file takes roughly 20 minutes to download and exceeds
  Excel's row limit. Stream it into DuckDB, never load it in memory.

## C. Stats NZ Transport (TPT) time series — backfill and cross-check

Monthly aggregates of vehicles currently licensed by type and new /
ex-overseas vehicles registered by type, derived from NZTA administrative
data. Small, long history. This is the source of the long-run totals
of true monthly first registrations (build step 1b), including vehicles
since scrapped, which the register snapshot cannot give: cars from 1961.
The name `registrations_flow` now belongs to the dataset built from
NZTA's dashboard (§D, D-084, D-087); the dataset built from this series
is named `registrations_cars_long_run` and counts cars only. Also an
independent sanity check on our own totals.

**Read on Infoshare on 2026-11-13** (`infoshare.stats.govt.nz`, Browse >
Industry sectors > Transport - TPT). Six tables: registrations and vehicles
licensed, each monthly, quarterly and annual.

- **"New and Ex-Oseas Motor Vehicles Registered by Type (Monthly)"**
  (Stats NZ's spelling): file `TPT052601`, table reference `TPT001AA`,
  January 1961 to September 2026, last updated 19 October 2026, footnote
  "Source: NZ Transport Agency". 26 series: cars and station wagons in
  seven engine-size bands and in total, cars previously registered
  overseas, motorcycles, power cycles, tractors, commercial vehicles in ten
  gross-mass bands, buses and coaches in two, and two commercial totals.
  - "New Cars and Station Wagons Total" **includes** the ex-overseas cars,
    and so do the seven engine-size bands (August 2026: they sum to the
    total, 17,297). New cars are the total less "New Cars/Stat'n Wags Prev
    Reg'd Ovrseas".
  - Only the cars total goes back to January 1961. The new and ex-overseas
    split exists **for cars only**, from July 1975. Commercial vehicles
    and motorcycles are not split, and trailers are not in the table.
  - For cars it agrees with the register, which is its own source. August
    2026: 9,138 new and 8,159 ex-overseas cars, against 9,136 `NEW` and
    8,156 `USED` passenger cars/vans in our 2026-08 snapshot. Its
    commercial and motorcycle classes are not yet lined up with NZTA's
    vehicle types (August 2026: 474 "New Motor Cycles" against 452 `NEW`
    motorcycles).
  - It publishes a month about two weeks after NZTA's service has it, on
    the one month observed: September 2026 was in the service by 6 October
    and in the series on 19 October. On 2026-11-13 its latest month was
    September, while the service held October. So the series' newest month is
    usually a month behind the register's (an estimate from that one month).
- **"Motor Vehicles Currently Licensed by Type (Monthly)"**: file
  `TPT053001`, January 1988 to September 2026.
- **Export**: on screen, Excel, CSV, or a saved "Table Query" that the
  "Export direct" page re-runs. A table's address changes with every
  session, so there is no stable download link and no API.
- **Licence**: CC BY 4.0 (`stats.govt.nz/about-us/copyright/`, page updated
  3 May 2021). For adapted content Stats NZ asks for: "This work is based
  on/includes Stats NZ's data which are licensed by Stats NZ for reuse
  under the Creative Commons Attribution 4.0 International licence."
- **Infoshare is being replaced.** Stats NZ plans to move its time series
  to the Aotearoa Data Explorer in 2027, and Infoshare stays the official
  source until then (`stats.govt.nz/tools/we-are-changing-our-data-tools`).
  The Explorer's catalogue (`api.data.stats.govt.nz/rest/dataflow/STATSNZ/all/latest`)
  held 913 dataflows on 2026-11-13 and none is a transport series. Its data
  queries need a subscription key (`portal.apis.stats.govt.nz`).

**What each column means is data**, in `data/reference/statsnz_series.csv`
(a supplied source of kind `series`, `docs/CUBE_SCHEMA.md`). One row for each
of the table's 26 column headers, in the order the table has them: `header`
(verbatim, as Infoshare writes it, including its spelling), `series_id` (the
name everything else uses), `label` (the words a visitor sees), `group` (cars,
motorcycles, power cycles, tractors, commercial, buses), `role`, `total_of`
and `notes`. `role` is `total` where the column is the sum of other columns
(`total_of` lists them, separated by `|`), `subset` where it is already
counted inside another column (the cars previously registered overseas, in the
cars total), and `part` otherwise, which covers a component of a total and a
series that stands alone (motorcycles, power cycles, tractors). Three columns
are totals: the cars total (of the seven engine-size bands), the commercial
total excluding buses (of the ten gross-mass bands) and the commercial total
including buses (of the total excluding buses and the two bus bands). The
headers, the notes and these relations were checked against the 2026-11-14
export.

The user chose on 2026-10-22 to wait for the Data Explorer, and on
2026-11-13 to use the Infoshare series now (`docs/brief/MASTER_BRIEF.md`
§7). D-065 says how, and the user accepted it that day by its option 2
(D-066): the user exports the series from Infoshare by hand each month.
The monthly check
still looks for the series in the Explorer (`docs/playbooks/check-monthly-run.md`).

**How an export is supplied.** From the repository root:

```
.venv/Scripts/python.exe -m pipeline supply statsnz_tpt <export.csv> [--taken YYYY-MM-DD] [--accept-revisions]
```

The file is the CSV Infoshare writes for the table, exported by hand as below. Its name is probably
`TPT052601_<date>_<time>_26.csv` (inferred - confirm: the saved export on file is named `TPT052601.csv`, and was
fetched by a script, so the name Infoshare gives a browser download has not been seen). The command fetches nothing and the Action never runs it. It aborts, writing nothing, unless:

- the title and the 26 column headers are exactly the configured ones (`supplied.statsnz_tpt` in
  `config/pipeline.json` and `data/reference/statsnz_series.csv`), in that order;
- the months parse (`1961M01`), run oldest first, have no gap and none is repeated;
- the month rows run unbroken into the footer: the line after the last month row is the footer's first line
  (`Table information:`), and no later line has the table's 27 fields or begins like a month. A blank line or a
  mistyped month in the middle of the file would otherwise end the rows early and drop every month after it;
- every figure is a whole number or `..`, and a `..` appears only before a series' first month;
- the footer says the table reference is `TPT001AA` and has a "Last updated" line;
- each total equals the sum of its parts in every month from `arithmetic_from` (1998-01 in the config;
  the file of 2026-11-14 has 11 disagreements in 7 distinct months, all earlier: the cars total in 2 months, the
  commercial total excluding buses in 5 and the one including buses in 4. Earlier ones are only warnings);
- a month already in the store gives the same figures. If a figure differs, the command lists
  every changed figure and stops; `--accept-revisions` replaces the month and records the change in the ledger
  (D-065 did not check whether Stats NZ revises: this is how the first revision will be seen);
- the months added join the stored months without a gap.

The store is `data/supplied/statsnz_tpt/`, committed to this repository like the dashboard's (the user, 2026-11-16,
D-097): `series.parquet`, a row for
each month and series that has a figure, and `ledger.json` (`docs/CUBE_SCHEMA.md`, *A source of kind
`series`*). It holds all 26 series. Only the cars total, the cars
previously registered overseas and the seven engine-size bands are built into a dataset,
`registrations_cars_long_run`; commercial vehicles, buses, motorcycles, power cycles and tractors stay in the
store, because Stats NZ's classes are not lined up with NZTA's vehicle types (D-065). Anything that shows
the dataset shows Stats NZ's attribution statement, which the build copies from
`supplied.statsnz_tpt.attribution` into the dataset's block of `manifest.json`. The step-by-step is `docs/playbooks/supply-statsnz-series.md`.

**Where the committed store came from, and its terms.** The one file supplied so far is `TPT052601.csv`: the whole
table, fetched read-only from Infoshare by a script on 14 November 2026 (789 months, 1961-01 to 2026-09, "last
updated 19 October 2026 10:45am"); it was not a browser export. The user will replace it with their own export
later: run `supply` on it as for any month (the store is the whole table every time; unchanged months stay,
a revised figure is refused without `--accept-revisions` and recorded in the ledger when accepted). The ledger's
`files` entry has the file's SHA-256, name, the day it was taken and the "last updated" text. The committed
store and ledger were written from it by `supply` on 16 November 2026: the Parquet file has the same SHA-256 as the
store of 14 November, the ledger differs only by its `source` block. The licence is CC BY 4.0 (the statement in
`supplied.statsnz_tpt.attribution`, which the ledger's `source` block and the dataset's manifest block both carry).
Not checked: whether Stats NZ's terms say anything about scripted access to Infoshare (D-094), or whether the
committed copy of the whole table, including the 21 series no dataset uses, is within what the licence allows
beyond the attribution it asks for (read as CC BY 4.0, which allows reuse; not confirmed with Stats NZ).

**The hand export** (read from Infoshare's pages on 2026-11-14; the clicks were not confirmed in a browser,
so the steps marked "inferred - confirm" are to be checked the first time):

1. Open `https://infoshare.stats.govt.nz/` (the "Browse" tab).
2. Under "Subject categories", click **Industry sectors** (inferred - confirm).
3. Click **Transport - TPT**.
4. Click the table **New and Ex-Oseas Motor Vehicles Registered by Type (Monthly)**, not the
   "(Annual-Dec)" or "(Qrtly-Mar/Jun/Sep/Dec)" tables beside it.
5. Click **Select variables** (inferred - confirm).
6. In the first box ("New Motor Vehicles Registered by Type", Total: 26), click **Select all**.
7. In the "Time" box, click **Select all**.
8. At the bottom right, change "Table on screen" to **Comma delimited (.csv)**.
9. Click **Go** (inferred - confirm the button's caption).
10. The browser saves `TPT052601_<date>_<time>_26.csv` (inferred - confirm the name). Put it in `data/raw/statsnz/<today's date>/` and
    run the command.

## D. Registrations dashboard — a hand export, never automated

The source of true first registrations from January 2021 (the user,
2026-11-14, D-084, accepting D-075's option 3). vstat and StatsHub take
first registrations and buyer type from the same dashboard.

- **What it is.** A report builder, "First registration", at
  `qap.nzta.govt.nz`. It holds vehicles "with a date of first ownership
  within the past five years", is updated at the start of each month, and
  is "a snapshot of the data at the end of every month". Past months can
  change, and it includes "a subset of reregistered vehicles" (NZTA's
  page, read from the user's saved copy, D-075). Licence: CC BY 4.0.
- **How it is fetched.** Never by the pipeline and never by an agent
  working in this repository: `nzta.govt.nz` and the dashboard block
  automated readers, and that is not worked around. A Claude session in
  the user's own browser reads the dashboard's data engine and saves a
  CSV, which the user puts in gitignored `data/raw/nzta-dashboard/`:
  `<YYYY-MM>/` for one month, `history/` for the backfill. Each month the
  same export is taken for the newest month.
- **The file.** A long table: one row per combination, then a `Vehicles`
  count. The history file starts with `Registration month` (text such as
  "Jan 2021"). The twelve dimensions: `Body type`, `Country of origin`,
  `Import status`, `Make`, `Model`, `Motive power`, `Owner Type`,
  `Territorial authority`, `Vehicle Status`, `Vehicle type`,
  `Vehicle usage`, `Vehicle year`. `VIN - first 11` and
  `Physical post code` are not taken (D-076).
- **What is held** (measured 2026-11-14, D-084): January 2021 to
  October 2026, 70 months, 991,274 rows, 1,883,786 vehicles. It was taken
  on 14 November 2026 (the user's account). January 2021 is 30,011
  vehicles, of which 2,970 are marked `INACTIVE`. What `Vehicle Status`
  means is defined with the dataset (`docs/METRICS.md`, D-087).
- **The engine cuts an export off at 5,000,000 cells**, so the history
  was taken a year at a time and joined (the user's account).
- **Not published:** `Owner Type`, `Territorial authority` and
  `Vehicle usage` describe the owner. Under the user's rule (2026-11-16,
  D-096) they may be published only in a table of one or two fields with
  cells under 10 vehicles hidden, and not before the pipeline hides them.
- **How it reaches the cube.** A maintainer adds each file to the store
  with one command, below; the build reads the store and writes the
  dataset `registrations_flow` (`docs/CUBE_SCHEMA.md`, *Supplied
  sources*). The store is committed to this repository (the user,
  2026-11-16, D-097), so GitHub's runs build the dataset from the same
  files a local build reads. The raw exports, which carry the owner
  columns, stay in gitignored `data/raw/nzta-dashboard/`.
- **Where the committed store came from.** The one file supplied so far
  is the history export of 2021-01 to 2026-10, taken by the user on
  14 November 2026 and named `nzta-first-registrations-2021-01_to_2026-10.csv`
  (its SHA-256 is the key of the ledger's `files` entry, and the seven totals it
  was checked against are recorded there). The committed store and ledger
  were written from it by `supply` on 16 November 2026, with the model kept
  only where a dataset or the wider scope counts the vehicle (below): 306,771 rows,
  843,345 bytes of Parquet and a 20,199-byte ledger. The user means to retake the
  history with the vehicle's mass and engine-size groupings and replace the
  file; the steps for that are in the playbook, *Replacing the whole history*.
- **What the committed store keeps of the model.** The model is free
  text for some vehicle types (the model of a trailer or caravan is typed
  at registration and sometimes reads like a name). The store keeps a model
  where the vehicle type is in the default scope or marked `trade_scope` in
  `vehicle_scope.csv` (the types of the wider scope, with which our counts of new vehicles
  come within 0.06% of the published total for October 2026 and within 1.3% for the other periods compared,
  `docs/METRICS.md`, D-105 and D-106) and the import status is one `registrations_flow` counts. For every
  other row the model is stored as not recorded, and the rows that become
  identical are summed; every other field stays, so every vehicle type's counts
  remain askable. The rule is `supplied.nzta_dashboard.outside_scope` in
  `config/pipeline.json` (the dataset it follows, the fields it blanks and the
  scope-file column that widens it); the scope is read from the scope files the
  build reads, and the ledger's `outside_scope` block records the scope the store
  was written under. A scope that later counts a pair whose model the store
  blanked needs the whole history supplied again from the raw exports; one that
  narrows, or gains a value NZTA has not used before, only warns (D-108). In the committed store 2,758 distinct models
  remain, from 58,164 in the export.
- **Terms.** NZTA's page gives CC BY 4.0 (above). The ledger's `source`
  block carries the licence and the attribution statement
  (`supplied.nzta_dashboard` in `config/pipeline.json`), so the file states its
  terms wherever it is copied. The statement is this repository's wording
  of the licence's requirement, not NZTA's own text: not checked with NZTA.

Its address, from NZTA's open data listing:
`https://www.nzta.govt.nz/vehicles/how-the-motor-vehicle-register-affects-you/motor-vehicle-registrations-dashboard-and-open-data/`

**How a file is supplied.** Export the twelve dimensions of the earlier
files (the three owner columns included), then, from the repository root:

```
.venv/Scripts/python.exe -m pipeline supply nzta_dashboard <file.csv> [--month YYYY-MM] [--taken YYYY-MM-DD] [--totals <totals.csv>] [--replace YYYY-MM ...]
```

The file is the history form (with a `Registration month` column such as
`Jan 2021`) or the one-month form (without it, and `--month` names the
month). The command aborts, writing nothing, unless:

- the header is exactly the configured columns (`supplied.nzta_dashboard`
  in `config/pipeline.json`), the three owner columns among them;
- every count is a whole number above zero, every numeric field parses,
  and no two rows share all their key columns;
- every month text parses, and the months in the file have no gap;
- `--taken` (default: the file's modified date) is not before the last
  month in the file ends;
- when `--totals` is given (a CSV of `period,vehicles`, a period being
  `YYYY-MM` or `YYYY`), each period's total equals the file's sum. Without
  it the command runs and prints a warning that the totals were not
  checked;
- a month already in the store gives the same rows (reported unchanged), or
  is named in `--replace`, in which case the old and new totals, taken dates
  and file hashes are recorded in the ledger. The dashboard restates past
  months, so a changed month is never replaced silently;
- the months added join the stored months without a gap.

The three owner columns (`Owner Type`, `Territorial authority`,
`Vehicle usage`) are checked and dropped: no owner field is in the store or in
anything built from it. Nothing is built privately from them either: they are
used for one thing, to check that the export is the one expected (the header
and the uniqueness of its rows), and the counts are summed over them before
anything is written. A private build over the owner columns would need the
export itself, which stays on the maintainer's computer. The store is
`data/supplied/nzta_dashboard/`, committed (D-097): `registrations.parquet`,
counts by month and the public fields with `vehicle_status`, and `ledger.json`,
which records the source's terms and, for each month, the file's name, its
SHA-256, the day it was taken, and its rows and vehicles. A test
(`pipeline/tests/test_stores_in_repo.py`) fails if the data map's held columns
(read from `config/data_map.json`) appear in either file in any form. The
step-by-step is `docs/playbooks/supply-dashboard-month.md`.

## E. Motor Industry Association — reference only

Not open data. Do not scrape. The MIA's own page shows the latest month only,
as images: "New vehicle registrations", in total and for light passenger
(including SUVs), light commercial and heavy commercial (read 2026-11-16;
its statistics pages are for members). An earlier line here said the MIA
"counts vehicles delivered to buyers"; nothing read supports that, and its
page calls the figures registrations, in a table whose columns are headed
"Sales". Our numbers do not match theirs exactly and are never adjusted
to; how far apart they are, and what is known about why, was
measured on 2026-11-16 and is in `docs/METRICS.md`, "Set beside published
figures" (D-105).

---

## Field notes that will bite you

**Country of origin** is where the vehicle was *principally manufactured*.
NZTA's own guidance: a vehicle assembled in NZ from a Japanese CKD kit
records Japan. So a Thai-built Hilux records Thailand, not Japan. This
field is **not** brand nationality — that comes from `brand_registry.csv`.
Label them "Built in" and "Brand owned from" in the UI, never "origin".

**Country of previous registration** is only meaningful for used imports.

**Import status** has four values, not two: `NEW`, `USED`, `RE-REG` and
`SCRATCH`. Only `NEW` and `USED` are entries to the fleet. `RE-REG` is a
vehicle returning to the register (mostly trailers) and `SCRATCH` is
home-built. `import_status_map.csv` records how each is treated.

**Motive power** is the primary fuel, in NZTA's own spellings (`PLUGIN`,
not `PLUG-IN`). Two petrol hybrid codes are in concurrent use, not a
rename. The hybrid codes do not say whether a hybrid is mild or full.
`mild_hybrid_models.csv` classifies hybrid nameplates as mild, full or
unresolved, each with its basis (manufacturer specification, not verified
row by row) and a confidence. It applies only to vehicles NZTA records
under a hybrid code, keys on the make and model after brand aliases and
model overrides, and can narrow a row with the same match columns as
`model_registry.csv`. A row's `override_value` replaces the motive power
before the powertrain lookup: mild petrol hybrids move to
`PETROL MILD HYBRID`, and full hybrids recorded as `DIESEL HYBRID` (which
maps to Mild hybrid) move to a key that maps to Hybrid. The snapshot archive
keeps NZTA's code. Identification by nameplate is incomplete, so the
manifest publishes `mild_hybrid_identification_coverage` and the category is
labelled *Mild hybrid (identified)* until coverage is high (`METRICS.md`). A second fuel, where present, is in `ALTERNATIVE_MOTIVE_POWER`:
about 0.1% of in-scope rows, mostly petrol vehicles also running LPG or
CNG. The powertrain dimension uses the primary fuel only, so a dual-fuel
vehicle counts under its primary fuel. The pipeline reports how many rows
carry a different alternative fuel rather than dropping that fact.

**Make, model and submodel are all free text.** NZTA's field descriptions
mark MAKE and MODEL as free text. NZTA has cleaned them algorithmically,
but about 165,000 distinct MODEL strings remain across the register, and
22,666 distinct make-and-model pairs in scope. Sub-brands are sometimes
recorded as models (MODEL = ORA under MAKE = GWM); `model_registry.csv`
corrects the known cases. Never aggregate on submodel.

**Vehicle year** changed meaning in 2007, and the data confirms it. NZTA's
field description page says "year of manufacture or model year – if
unknown, year of first registration", which matches the pre-2007 records,
not later ones. For NZ-new vehicles first registered from 2007 it equals
the registration year on all but 504 of 2.2 million in-scope rows, and it
is not model year (checked against VIN model-year codes). For used imports
it is a year from the vehicle's life overseas, with no break at 2007.
Before 2007, NZ-new records mix manufacture year, model year and
registration year across several regimes. Any chart that includes NZ-new
vehicles and spans the boundary must render a visible break marker.
Details: `MODEL_AND_AGE.md` §1.

**Undefined values** are common. Some attributes are not captured at first
registration and are updated later, so an "undefined" bucket is legitimate
and must be shown, not silently dropped.

What counts as undefined is data, not code. `sentinels.csv` lists, per
field, the raw values that become `__UNDEFINED__`: blanks, `NOT KNOWN`, a
GVM of 0, and so on. `OTHER` is a real category, not a sentinel.
`CC_RATING` has no sentinel because 0 is meaningful for a vehicle with no
engine; engine size bands decide that from `has_combustion_engine` in
`powertrain_map.csv`.

**History is not frozen.** Vehicles are added and removed retrospectively
and a registration date can be updated after the fact. Prior months will
move between snapshots. Store every monthly snapshot and never overwrite;
restatement is a feature of the data, not a bug in the pipeline.

**The register only holds survivors.** The service exposes only the
current snapshot of vehicles still registered. A count by first-registration
month is therefore a count of survivors (`registrations_surviving`), not of
registrations: older months shrink with every snapshot as vehicles are
scrapped. Each run commits a small aggregate of the snapshot, never raw
rows, to `data/snapshots/YYYY-MM.parquet`. Differencing consecutive
snapshots gives new registrations and scrappage from our own observations,
and is the input to cohort survival.

**The register archive keeps the whole snapshot, outside git.** The
committed aggregate holds five dimensions; everything finer is gone once
NZTA refreshes. So after a month is built, a second job
(`archive` in `monthly-build.yml`, `pipeline/archive.py`) pulls the
register again and keeps it as one Parquet file, one row per vehicle:

- **Fields:** every field of `pipeline/expected_schema.json` except those
  in `register_archive.never_pulled` in `config/pipeline.json`:
  `CHASSIS7` and `ENGINE_NUMBER`, which are never asked for. The row id is
  pulled for paging and left out of the file. Values are as NZTA records
  them; nothing is normalised.
- **`VIN11` and `POSTCODE` are kept here and nowhere else** (D-076). The
  build's own pull does not take them, so neither reaches the cube, the
  committed aggregate or any published file. `VIN11` itself is never
  published; what is derived from it may be, once it has been checked
  against the data. Postcode figures are not published for now (the user,
  2026-11-16, D-096); if ever, only as area totals above a minimum count. NZTA records the
  postcode as a number, so one that starts with zero arrives without it:
  in the 2026-10 file 152 postcodes, holding 885,064 vehicles, are below
  1000.
- **A pull saved by hand** can be written to the same file with
  `pipeline archive --from-pull`, but only if it took every archive
  field. The pulls saved before D-076 did not take `VIN11` or `POSTCODE`
  and are refused.
- **October 2026 has two files**, because a month's file is never
  replaced: `mvr-2026-10.parquet` at 35 fields, written before D-076, and
  `mvr-2026-10-vin11-postcode.parquet`, the same register at 37 fields
  (5,926,990 rows, 55,125,916 bytes, pulled and uploaded by hand on
  2026-11-13). The two do not line up row for row: neither keeps a row
  id. Later months have one file at 37 fields.
- **Where:** a release `snapshot-YYYY-MM` holding `mvr-YYYY-MM.parquet`
  in a **private** repository, `nzta-register-archive`. The file holds
  vehicle rows with their owner's district and postcode and the first 11
  characters of the VIN, so it is never published,
  never committed here and never uploaded as an artifact of this public
  repository.
- **Only the register that was built.** The job goes ahead only while the
  live register has the row count and digest of the last good build. If
  NZTA has refreshed since, it fails and says the month can no longer be
  archived.
- **Never replaced.** If the month's file is already there the job stops
  without pulling.
- **When it fails** (an expired token is the likely cause; the job says
  so), the month's build and commit stand and the run is red. Fix the
  cause, then start the workflow by hand with `archive` ticked: it
  archives the last built snapshot. It builds nothing unless NZTA has
  refreshed since; then it builds the new month and archives that one,
  and the month whose archive failed is lost.
- The job refuses to upload unless the archive repository is private, and
  counts a month as archived only if its file finished uploading.
- A release keeps no history and can be deleted by hand. A second copy
  somewhere backed up is the maintainer's to keep.

**Region** is not a field. The register records `TLA`: the territorial
authority where the registered owner lives *as at the snapshot*, from their
most recent address. It is not where the vehicle is used, and not where the
owner lived when the vehicle was first registered. Region is derived through
`tla_region.csv`. Seven districts straddle regional boundaries; each is
assigned to the region holding most of its residents, and the `straddles`
column names the others. Rental and lease fleets distort this badly.

**Registration is not sale.** Repeat this on the Method page.
