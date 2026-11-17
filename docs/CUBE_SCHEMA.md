# Cube Schema

The contract between the pipeline and the site, locked by a golden-file
test (`pipeline/tests/test_golden.py`). The browser reads only these
artifacts.

## Why precompute

Two kinds of artefact, both computed at build time:

- **Slices** answer the preset charts: one dimension (or a configured pair)
  by month, small enough for a first paint on a phone.
- **The fact table** answers any question a visitor builds (D-058): counts
  by month and every configured dimension at once, so any combination of
  values, filters and periods is a sum over its rows. It holds counts, never
  a vehicle row, and the browser aggregates it without a query engine (the
site's code, `src/lib/data.ts`; nothing in the pipeline shows it).

No count of dimensions is fixed in this document or anywhere else; see
*Live dimensions*.

## Artifacts

```
/public/data/
  manifest.json                         # provenance, freshness, live dimensions, data-quality counts
  cube/
    {dataset}/{dimension}.parquet       # 1-D slices: one file per live dimension
  events.json                           # verified events only
  pairs/
    {dataset}/{dim_a}__{dim_b}.parquet  # 2-D slices: only the pairs config/pipeline.json names
  facts/
    {dataset}/{column}.parquet          # the fact table, one column per file: month, each dimension, n
  presets/
    {preset_id}.json                    # later build step: fully resolved, for first paint
  reference/
    brand_registry.json                 # later build step: for the methodology panel
```

Build step 1 emits `manifest.json`, `cube/registrations_surviving/`,
`pairs/registrations_surviving/`, `facts/registrations_surviving/` and
`events.json`.

When the supplied store for `registrations_flow` is present (*Supplied sources*), the build also emits
`cube/registrations_flow/`, `facts/registrations_flow/` and its block in `manifest.json`; it configures
no pairs. With the same store it emits `cube/registrations_flow_wider/`, `facts/registrations_flow_wider/` and
its block: the same dataset on a wider scope of vehicle types (D-113, *The wider scope*, below). When the store
for `registrations_cars_long_run` is present, the build emits
`cube/registrations_cars_long_run/` (one slice for each of its two dimensions) and its block in
`manifest.json`, and no pair slices and no fact table (*A source of kind `series`*).

Pipeline state lives outside `/public/data` and is committed to the repo:

- `data/snapshots/YYYY-MM.parquet`: a small aggregate of every snapshot,
  never raw rows. The input to true flow and cohort survival.
- `data/state/last_good.json`: the last successful run's change key, row
  counts, per-month counts, live dimensions and moving cutoff. Every
  guardrail that compares against "the previous run" reads this file.
  `mild_split` keeps, for each built dataset that has a mild hybrid coverage
  block, `published` (whether the split was published) and
  `trailing_high_confidence_coverage` (the figure it was judged on, or null
  when the window held no hybrid). A state written before it existed has no
  `mild_split`, and so does a dataset first built since: the build compares
  nothing and records it.

The whole snapshot, one row per vehicle, is kept as well, but not here and
not as part of this contract: it goes to a private store
(`docs/DATA_SOURCES.md`, the register archive). Nothing published reads it.

## Live dimensions

The dimension set is whatever has complete reference data, not a fixed
list. A dimension is live for a dataset in a run when all of these hold:

1. It applies to the dataset (no `applies_to` in `dimensions.json`, or the
   dataset is listed).
2. Every reference file its `derive` block needs exists.
3. Its unmapped rate on in-scope rows is at or below `max_unmapped_rate`
   in `config/pipeline.json`.

`manifest.json` lists the live dimensions per dataset, and the site reads
that list rather than assuming any dimension exists. A dimension may go
live in any run. A dimension that was live in the last good run and fails
rule 2 or 3 aborts the run: dimensions never silently drop out.

## Slice schema

| column | type | notes |
|---|---|---|
| `month` | date | first day of the month of first NZ registration |
| `dim_value` | string | the dimension value, or a reserved token |
| `n` | int32 | count |
| `denominator` | int32 | dataset total for that month, repeated |
| `fc_sum` | double, null | sum of valid combined fuel consumption (L/100km) over fuel-eligible rows, rounded to 3 decimals; null when `fc_n` is 0 |
| `fc_n` | int32 | fuel-eligible rows with a valid fuel-consumption value |
| `fc_eligible_n` | int32 | rows whose powertrain has a combustion engine: the coverage denominator |

Rows are sorted by `month`, then `dim_value`. A month with no rows in the
dataset is absent, never a row of zeros.

For each month a slice's `n` sums to its `denominator`, the dataset's total for the month: every vehicle has one value of
the dimension (`test_golden.py` checks it on the golden build). The one exception is a dataset built from a published
series (*A source of kind `series`*): where the dimension's values add up to more than the total and the config allows it
for that month, the values are carried as published and `n` sums to more than `denominator`. The manifest names those
months under `exceeds_total`. **A reader of the cube must read `exceeds_total` before treating a slice's sum as the
month's total.**

Derive `share`, `yoy`, `rolling_12m`, mean fuel consumption
(`fc_sum / fc_n`) and fuel-consumption coverage (`fc_n / fc_eligible_n`)
in the browser. Do not precompute them — it triples file size and makes the
suppression thresholds impossible to change without a rebuild.

### Reserved tokens

| token | meaning |
|---|---|
| `__UNDEFINED__` | Not recorded: the source value is empty or listed in `sentinels.csv`. For a dataset built from a published series it also means vehicles the published breakdown does not account for: every vehicle of a month before the breakdown starts, or the difference where its values fall short of the total. |
| `__UNMAPPED__` | Recorded, but no reference row matches it (a make absent from `brand_registry.csv`). |
| `__OTHER__` | Recorded and mapped, but collapsed by a cardinality cap (a model beyond the cap). |

"Not recorded" and "no brand match" are different facts and never share a
token. Banded dimensions use their own `unknown` band from
`dimensions.json` instead, and the manifest counts each cause separately. The files are not changed for it: the site reads
that band as `__UNDEFINED__` when it loads a slice, a pair or a column of the fact table (`src/lib/data.ts`, D-122), so on the
page it is "Not recorded" and is treated as the reserved value is everywhere.

### Fuel consumption

`FC_COMBINED` is stored as text. A row is fuel-eligible when its powertrain
has `has_combustion_engine = true` in `powertrain_map.csv`; rows without an
engine never enter the coverage denominator, so electrification cannot
suppress the series. A value is valid when it parses as a number inside the
range in `config/pipeline.json` (above 0, at most 60 L/100km). Parse
failures and out-of-range values are excluded from `fc_sum` and `fc_n` and
counted separately in the manifest, as are values found on rows with no
engine.

### Model dimension

`dim_value` is `MAKE|MODEL` after brand aliases and `model_registry.csv`
overrides. The `cap` values (config: 300) with the most in-scope volume
over the **trailing 12 months** keep their value; everything else becomes
`__OTHER__`. The manifest records the cap, its basis, and the share of
trailing and all-time volume the kept values cover.

**Ties at the cap.** The values are ranked by their trailing vehicles, largest
first, and where several have the same count the one whose `MAKE|MODEL` key
sorts first in byte order ranks first. Byte order is DuckDB's default string
order, which compares the UTF-8 bytes and not a locale's alphabet: a space and
most punctuation, then digits, upper case, lower case, and the separator `|`
after them, so `K1|X` ranks before `K|X` and `KB|X` before `Ka|X` (a locale's
collation would reverse both).
The first `cap` keep their value, so a cap of 300 always names exactly 300
values when at least that many occur, and which of a tied pair is named never
depends on the order the rows arrive in. The rule is the code's
`ORDER BY count DESC, key`, written down and held by two tests
(`test_the_model_cap_keeps_the_key_that_sorts_first_when_models_tie_at_the_boundary`,
and `test_the_model_cap_breaks_a_tie_in_byte_order_not_in_a_locales_order`, whose
keys a locale orders differently and which fails if the default collation is
anything but binary).
Measured on the 2026-10 snapshot: `registrations_surviving` has no tie at rank
300 (75 vehicles, then 72 at rank 301). `registrations_flow` has one: two models
with 75 vehicles at ranks 300 and 301, of which the one that sorts first is
named and the other is in `__OTHER__`. Extending the cap to include every tied
model was weighed and not chosen: it would make the number of values depend on
the data, and the cap is a published number (D-108).

## Pair slices

Only generate `{dim_a}__{dim_b}` pairs that a preset or a plausible filter
actually needs. Generating every combination is wasteful and most are
never opened. Start with these and add on demand:

`powertrain__segment`, `powertrain__region`, `powertrain__import_status`,
`make__powertrain`, `owner_country__segment`, `built_in__make`,
`import_status__segment`, `import_status__age_at_registration_band`,
`powertrain__segment_group`, `import_status__vehicle_type`

Each dataset's `pairs` in `config/pipeline.json` lists the pairs a build
emits, as `[dim_a, dim_b]`; the list above is what may be added. Emitted
today: `import_status__age_at_registration_band`, which serves `used_imports`
and `nz_new` (`registrations_surviving` filtered by import status) by age
when first registered here, and `powertrain__segment_group`, which applies a
filter such as light passenger vehicles to the powertrain mix, and
`import_status__vehicle_type`, which reads the vehicles still registered under one of NZTA's
vehicle types as new or used (completeness by vehicle type and import status divides it by the
same split of `registrations_flow`, which the fact table gives). A pair is live in a run when both of its
dimensions are live, and `manifest.json` lists the live ones per dataset as
`live_pairs`, which the site reads rather than assuming a pair exists. A
pair whose dimension is not live waits, as the dimension does, and is listed
under `not_live_pairs` with a warning. An entry that is not two different
dimension ids, a pair listed twice in either order, or a dimension the
dataset cannot derive aborts the run.

### Pair slice schema

| column | type | notes |
|---|---|---|
| `month` | date | as in a 1-D slice |
| `a_value` | string | the value of `dim_a`, or a reserved token |
| `b_value` | string | the value of `dim_b`, or a reserved token |
| `n` | int32 | count |
| `denominator` | int32 | dataset total for that month, repeated: the same as in a 1-D slice |
| `fc_sum`, `fc_n`, `fc_eligible_n` | | as in a 1-D slice |

Rows are sorted by `month`, then `a_value`, then `b_value`. A pair carries
the same vehicles as its 1-D slices: summed over `b_value` it gives
`dim_a`'s slice, and summed over `a_value` it gives `dim_b`'s, row for row
in `n`, `denominator`, `fc_n` and `fc_eligible_n`. `fc_sum` is rounded per
row, so a sum of a pair's `fc_sum` matches the slice's only to within that
rounding. The denominator is the whole dataset's month, not the filtered
subset's, so a filtered share is computed in the browser: `n` over the sum
of `n` for the same `month` and filter value.

## Fact table

Each dataset's `facts` in `config/pipeline.json` lists the dimensions the
fact table carries. A build groups the dataset's vehicles by `month` and
every listed dimension that is live, counts them, and writes each column to
its own file: `facts/{dataset}/month.parquet`, one
`facts/{dataset}/{dimension}.parquet` per dimension, and
`facts/{dataset}/n.parquet`. Every file holds the same rows in the same
order, so row *i* of each file is one row of the table. The host answers a
range request with the whole file (Cloudflare Pages, from its documentation
as read for D-058; nothing is deployed, so this is not observed), so one
file per column is what lets a question download only the columns it names.

| column | file | type | notes |
|---|---|---|---|
| `month` | `month.parquet` | date | as in a 1-D slice |
| `{dimension}` | `{dimension}.parquet` | string | the value, or a reserved token, exactly as in that dimension's slice |
| `n` | `n.parquet` | int32 | vehicles with this month and these values |

Rows are unique on `month` and the dimension values, and sorted by `month`,
then each dimension in the order configured. Summed over every dimension
but one, the table gives that dimension's 1-D slice, row for row in `n`;
summed over all of them it gives the dataset's month totals, the slices'
`denominator`. The table carries no fuel consumption. A share is computed in
the browser: `n` over the sum of `n` for the same month and filter.

`vehicle_type` (NZTA's own vehicle type, under the labels in
`vehicle_scope.csv`) is a column of the register-shaped datasets' tables (`trade_group`, the passenger or commercial
group, is a column of `registrations_flow_wider`'s alone).
`registrations_flow` has no `segment`, so the column is the only way to ask
true registrations by vehicle type together with a brand or a powertrain. On
`registrations_surviving` it adds no rows: on the 2026-10 pull the table is
641,618 rows with and without it, and 1,726,119 bytes grow to 1,768,391
(+2.4%, the column's own file being 42,272). On `registrations_flow` the
table grows from 129,103 rows and 345,774 bytes to 131,260 rows (+1.7%) and
358,930 bytes (+3.8%). The dimension has two values on each dataset, and it
is not live for `registrations_cars_long_run`, which carries no register
field (*Supplied sources*).

`nz_assembled` (NZTA's flag for a vehicle assembled or built in New Zealand or imported built up,
under the labels in `nz_assembled_map.csv`; D-116) is a column of `registrations_surviving`'s table and has a
slice of its own. The dashboard export and the Stats NZ table carry no such field, so the dimension is not live for the
three other datasets (`not_live`: "the source does not carry NZ_ASSEMBLED"), and none of their files changes. NZTA's
`UNKNOWN` is a sentinel (`sentinels.csv`, under this field only), so it reads `__UNDEFINED__`, as NULL does; a raw
value the map does not hold reads `__UNMAPPED__` and counts against the dimension's unmapped guard (below).

`nzta_class` (NZTA's vehicle equipment standard class, shown as NZTA's label for it with the code in brackets, under the
labels in `class_map.csv`; D-116, D-121) is the same in every respect: a column of `registrations_surviving`'s table and a
slice, not live for the three other datasets. A blank class is the only form of not recorded, and `sentinels.csv` lists none
for it, because the code `NA` is a class code (NZTA's label for it is "Light goods vehicle"). `class_map.csv` holds the 27
classes of the table the maintainer supplied from NZTA's vehicle classes page on 2026-11-17 (each with its description,
page address and date) and `OTH`, a value the register holds that the page does not define, whose label is its code. It
holds every code on the whole register, not only those of the types in scope, and seven that the register did not carry at
the 2026-10 snapshot, so a class NZTA defines reads as its label the day it first appears; a code the table does not hold
still reads `__UNMAPPED__` and counts against the guard.

`seats_band` (the number of seats NZTA records, in the bands of `dimensions.json`; D-116) is the same again, but a band
and not a lookup: it has no reference file and no unmapped value, so it is not in `abort_on_unmapped`. Its guard is the
band edge: a count from 1 to 60 lands in its band, and anything else lands in the `unknown` band. A zero is a form of
not recorded (`sentinels.csv`, under `NUMBER_OF_SEATS`), so it is NULL when banded; the manifest counts the two causes apart
(`counts.bands.seats_band`: `source_sentinel` the zeros, `out_of_bands` the counts above 60). On the 2026-10 pull they are
8,408 and 207, of 4,520,304 vehicles. Seats are not recorded for many vehicles first registered from early 1994 to late
1995, so `unknown` is large in those months; the dimension's `public_note` says so. No mean or median is built.

A list that is empty or not distinct dimension ids, or names a dimension the
dataset cannot derive (or `month`, `n` or `rid`), aborts the run. A listed dimension
that is not live this run is left out of the table, with a warning, and listed
in the manifest's `facts.not_live`; if none is live, the table holds the month
totals alone.

The table carries nothing about a vehicle's owner. `region` is where the
owner lives, and it is left out of `facts` (D-078; the user's rule for owner
fields allows them in a slice or a pair only, D-096): with it, two in three of the table's rows counted a single vehicle
(64.8% on the 2026-10 pull), each with the owner's region beside the model
and the month. The `region` slice is not affected, and a question that only
breaks down by region is still answered from it. Putting `region` back would
need the user to change that rule first; it is then a one-word change to
`facts`, and a contract change shown to the user.

The table's total is checked against the vehicles themselves: the counts are
read back from the written `n.parquet` and must equal the dataset's vehicles
counted before the dimension lookups are joined on, or the run aborts. A
dimension lookup that matched a vehicle twice, or lost one, is caught here.
The lookups joined on before that count (scope, import status, brand, the
model and hybrid exceptions, engine) each abort on a key defined twice or on
two rows that match the same vehicle (Aborts, below).

## manifest.json

```json
{
  "contract_version": 1,
  "generated_at": "2026-09-11T04:12:00Z",
  "latest_snapshot": "2026-08-31",
  "source": {
    "id": "mvr_feature_service",
    "item_id": "7b4df667d5014f1a93e6050b31d18407",
    "discovery": "search",
    "service_name": "MVR_Mar26",
    "service_url": "https://services.arcgis.com/.../FeatureServer/0",
    "data_last_edit": "2026-09-03T00:34:54Z",
    "fetched_at": "2026-09-11T04:01:00Z",
    "row_count": 5905376,
    "rows_pulled": 5905376,
    "in_scope_row_count": 4787000,
    "change_key": { "row_count": 5905376, "snapshot": "2026-08-31", "stats_sha256": "..." },
    "changed": true
  },
  "datasets": {
    "registrations_surviving": {
      "definition": "Vehicles first registered in month M that are still registered as at the snapshot date.",
      "rows": 4503000,
      "months": 1195,
      "latest_month": "2026-08",
      "live_dimensions": ["powertrain", "make", "..."],
      "not_live": { "imported_from": "does not apply to this dataset" },
      "live_pairs": ["import_status__age_at_registration_band"],
      "not_live_pairs": {},
      "facts": { "rows": 643414, "dimensions": ["powertrain", "make", "..."], "not_live": {} },
      "unmapped_rates": { "make": 0.0062, "powertrain": 0.0 },
      "unmapped_guard": {
        "make": {
          "whole_run": { "rows": 4616861, "unmapped": 34735, "rate": 0.007524, "abort_above": 0.02, "headroom_rows": 57602 },
          "trailing": { "window_months": 12, "rows": 234372, "unmapped": 218, "rate": 0.00093,
                        "warn_above": 0.005, "abort_above": 0.02, "headroom_rows": 4469 }
        },
        "powertrain": { "whole_run": { "...": "same shape" }, "trailing": { "...": "same shape" } }
      },
      "mild_hybrid_identification_coverage": {
        "all_time": { "source_hybrids": 451499, "identified_mild": 57475, "identified_full": 382241, "unknown": 11783,
                      "coverage_stated_confidence": 0.8299, "coverage_high_confidence_only": 0.6279,
                      "mild_share_of_source_hybrids": 0.1273,
                      "identified_mild_by_confidence": { "high": 43017, "medium": 13988, "low": 0, "code_default": 470 } },
        "trailing": { "window_months": 12, "coverage_stated_confidence": 0.8411, "coverage_high_confidence_only": 0.7948,
                      "...": "same shape" },
        "complete_at_coverage": 0.95,
        "warn_below_trailing_high_confidence_coverage": 0.7,
        "publish_split_at_trailing_high_confidence_coverage": 0.7,
        "mild_split_published": true,
        "label": "Mild hybrid (identified)",
        "classification_disagrees_with_powertrain": 0
      },
      "coverage_trailing": { "window_months": 12, "fuel_consumption": 0.91, "dimensions": { "region": 0.998 } },
      "counts": {
        "no_registration_month": 172,
        "registration_after_snapshot": 0,
        "bands": {
          "age_at_registration_band": { "source_missing": 0, "source_sentinel": 0, "negative": 3800, "out_of_bands": 0 }
        },
        "fuel_consumption": { "parse_failures": 0, "out_of_range": 83, "on_no_engine": 0 },
        "alternative_fuel_differs": 5542
      },
      "model_cap": {
        "model": { "cap": 300, "basis": "trailing_12_months", "coverage_trailing": 0.95, "coverage_all_time": 0.80 }
      }
    }
  },
  "moving_cutoff_vehicle_year": 2012,
  "moving_cutoff_age": 14,
  "used_import_age_trailing": {
    "window_months": 12, "rows": 91000, "median": 10, "mode": 11,
    "cluster": [9, 13], "share_cluster": 0.60, "shares": { "0": 0.003, "31+": 0.001 }
  },
  "snapshot_archive": { "path": "data/snapshots/2026-08.parquet", "status": "new" },
  "payload_bytes": 3158670,
  "warnings": []
}
```

Every dataset entry carries `latest_month`: the month the dataset's own snapshot ends at (the register's
snapshot month for a register dataset). A dataset built from a supplied source has the same keys plus
`supplied`: `{ "source": "nzta_dashboard", "months": { "first": "2021-01", "last": "2026-10", "count": 70 },
"taken": ["2026-11-14"], "replaced": [ <the ledger's replaced list> ] }`, where `taken` lists the distinct days
the files were taken. A supplied dataset with no store is `{ "definition": ..., "not_built": "<reason>" }`.

A dataset built from a source of kind `series` (`registrations_cars_long_run`) has `definition`, `rows` (the sum of
its months' totals), `months`, `latest_month`, `live_dimensions`, `not_live`, `live_pairs` (empty),
`not_live_pairs` (empty), `facts` (null) and these, where the register's datasets have the unmapped, coverage and
fuel counts:

- `undefined`: for each live dimension, `{ "months": n, "vehicles": n }`, the months that have vehicles
  recorded as `__UNDEFINED__` and how many vehicles. A month before a dimension's series exist is all of it;
  after, it is the difference between the dataset's total and the dimension's values.
- `exceeds_total`: for each live dimension, the months where the dimension's values add up to more than the total
  and the config allows it (`exceeds_total_allowed`); the values are carried as published and `n` in that month
  sums to one or more above `denominator`. Otherwise an empty list.
- `supplied`: the dashboard's keys (`source`, `months`, `taken`) and `revisions` in place of `replaced` (every
  accepted revision, with the changed figures), `exports` (for each export supplied: `taken`, `last_updated`, the
  export's own "Last updated" text, and `table_reference`) and `attribution`, the statement Stats NZ asks for
  (`supplied.<id>.attribution` in `config/pipeline.json`). Anything that shows this dataset's figures shows it.

`payload_bytes` is the size of every file the build writes to `/public/data`
except `manifest.json` itself: what the site can download. The golden test
compares it, so anything that changes it (a new slice, a DuckDB upgrade that
changes the Parquet layout) is a deliberate contract update. The golden
build reads a frozen events file, so adding an event to `events.csv` is not.

This drives the freshness badge and the provenance panel. Every count is
published even when zero: a count that disappears is itself a silent
change. In `bands`, `source_missing` counts rows whose source field is
empty, `source_sentinel` counts source values listed in `sentinels.csv`
(for vehicle year, a year of 0), `negative` counts a negative derived
value, and `out_of_bands` counts a value no band covers.

`unmapped_guard` publishes both bases of each guarded dimension's unmapped
check with its thresholds, and `headroom_rows`: how many more rows could go
unmapped before the run aborts. How close a run came is visible, not just
whether it passed.

**Which rows the rates count.** `unmapped_rates` and both bases of
`unmapped_guard` are measured on every in-scope row the build holds (the table
`dims`), not on the dataset's own rows: vehicles that are not fleet entries
(re-registrations; 114,478 on the register) and rows with no registration month
(172) are in them too, and the `trailing` basis drops only the rows outside the
window. The dataset's own
rate, the one the site states, counts the vehicles in the cube. On the 2026-10
snapshot `registrations_surviving` has 4,634,954 in-scope rows with 33,016
unmapped makes (0.7123%, `unmapped_rates.make` 0.007123) against 4,520,304
vehicles in the cube with 26,433 (0.58%); `registrations_flow` has 1,492,122
with 1,954 (0.1310%) against 1,483,403 in the cube with 1,753 (0.12%). The guard's rate is the
higher here and is the one that aborts; the cube's is the one the site states.
Neither is wrong, and the guard was left as it is (D-108).

`mild_hybrid_identification_coverage` says how much of the Mild hybrid
category is identified (definition in `METRICS.md`), with the label the
site must use for the category: *Mild hybrid (identified)* until the lower
of the two coverage figures reaches `complete_at_coverage`.
`mild_split_published` says whether the dataset divides its hybrids into Mild
hybrid and Hybrid at all: true when the trailing coverage at high confidence is
at or above `publish_split_at_trailing_high_confidence_coverage` (or the window
holds no hybrid to divide), false otherwise. The comparison is made on the whole
counts behind `coverage_high_confidence_only`, not on that figure rounded to four
decimals, so a figure that reads exactly the threshold can still be under it.
When false, every vehicle that would be Mild hybrid is counted as the value `undivided_powertrain` names in
`config/pipeline.json` (`Hybrid`) in that dataset's slice, pairs and fact table,
no other count moves, and the build adds a warning. The site must say so
instead of drawing a Mild hybrid line. It is judged for each dataset on its own
figure; the label rule above is unchanged.
`classification_disagrees_with_powertrain` counts vehicles whose final
powertrain contradicts their `mild_hybrid_models.csv` classification (a
full hybrid shown as Mild hybrid, or the reverse). Coverage is given at
stated confidence and at high confidence only, so how much it rests on
medium- and low-confidence classifications is visible, not buried. At high
confidence only a classification below the high level counts as none, `mild` or
`full` alike: both stay in the denominator as unidentified (`METRICS.md`, D-110).

## Source discovery, snapshot date and change key

**Discovery.** Each run searches the ArcGIS portal for the register item
(query in `config/pipeline.json`) rather than trusting a pinned id. Exactly
one match is used. If the search fails or finds nothing, the run falls back
to the configured item id, records `"discovery": "fallback"` and warns
loudly. More than one match: the most recently modified is used, with a
warning.

**Snapshot date.** There is no snapshot field. `latest_snapshot` is the
last day of the latest first-registration month in the table that holds a
month of registrations, and no later than the month before the fetch. A
month holds a month of registrations when it has at least 1% of the median
of the 12 months before it (`snapshot.min_share_of_trailing_median` in
`config/pipeline.json`; the lowest real month, April 2020, had 7%). So a
few rows dated after the register's own month never become a snapshot.
First registrations dated after the snapshot are counted, excluded and
warned about.

One case is not caught: a register that holds a substantial part of the
following month (1% of a normal month or more) and is edited again at any
time after its own month was built. Once the cap passes that following
month, the next run builds it as that month, and the real refresh is then
refused as a rebuild. None of the three snapshots built so far holds any
row dated after its month (`data/snapshots/`).

**Change key.** No file exists to hash, so the key is the composite of the
total row count, the snapshot date, and the sha256 of one canonical
grouped-statistics response: row counts by first-registration year,
first-registration month, import status and vehicle type, sorted and
serialised as canonical JSON. If the row count and the digest equal the
last good run's, the source is unchanged and the build is skipped: nothing
is pulled, nothing is published, the run succeeds. The snapshot date is
left out of that comparison: its cap moves on the first of each month
while the register does not.

**Each month is built once.** If the source changes again after its
snapshot month was built, the run says so on its summary page and builds
nothing. Only a run started by hand with `force` rebuilds a month, so a
later edit by NZTA never replaces what the first build published.

## Supplied sources

A dataset may be built from a file a maintainer supplies by hand instead of from the register. The
source is named in `supplied` in `config/pipeline.json`; its first user is `nzta_dashboard`, NZTA's
registrations dashboard (`docs/DATA_SOURCES.md` §D, D-084; the definition is D-087). Nothing fetches it and the Action never
runs `python -m pipeline supply`. Each source names its `kind` in `config/pipeline.json`, which says how its store
is laid out and how its datasets are built: `counted_rows` (the dashboard) or `series` (a published table of monthly
series, below).

**The store**, `data/supplied/<id>/`, committed to the repository (the user, 2026-11-16, D-097) so that GitHub's
builds read the same two files as a local build, and nothing else is kept there:

- `registrations.parquet`: one row per month and combination of the public fields. Columns, in order:
  `month` (DATE, the first day), the fields named in `supplied.<id>.fields` under their logical names,
  the fields in `extra_fields` (`vehicle_status`), and `vehicles` (INTEGER). Rows are summed over the
  columns in `private_columns` (for the dashboard, the three owner columns), which are asserted present
  in the file and then dropped, so no owner field is in the store or in any output. When the source names an
  `outside_scope` rule (`supplied.<id>.outside_scope`: a dataset, the fields to blank and a vehicle-scope column
  that widens it), a row whose (vehicle type, import status) is known to the scope files and counted neither by
  that dataset nor by a vehicle type the column marks has those fields
  stored as NULL (not recorded), and the rows that become identical are summed. Sorted, and written
  with the Parquet options of the cube (ZSTD), so the same input gives the same bytes.
- `ledger.json`: `source`, the source's terms as `supplied.<id>` in `config/pipeline.json` states them when the ledger is
  written (`publisher`, `licence`, `attribution`, `origin`), so the file carries its own; `outside_scope`, when the
  rule above applies, the dataset, the fields blanked, the widening column and its types, every value the scope files
  knew and the (vehicle type, import status) pairs whose fields are kept, so the build can tell which models the store blanked and refuse it only if one of them is read now (below); `store_sha256`, the SHA-256 of `registrations.parquet` as written with it; `files`, for
  each file supplied (keyed by its SHA-256) the file's name (name only), the day it was taken, and
  `totals_checked`, the dashboard totals it was checked against (period to vehicles), or null when
  `--totals` was not given; `months`, for each month the hash of the file it came from, the day it was
  taken, and its rows and vehicles in the store; and `replaced`, one entry for each month a later file
  restated, with the old and new vehicles, rows, taken dates, hashes and file names. A month is never
  replaced without an entry. Both files are written under temporary names and the ledger is renamed
  last; the hash is the backstop if a run is interrupted between the two renames.

`supply` aborts, writing nothing, on any of: a header that is not the configured columns, a count that
is not a whole number above zero, a numeric field that does not parse, two rows with the same key, a
month that does not parse or a gap between months, `--taken` before the last month ends, a total in
`--totals` that differs from the file's sum, a month already in the store that differs and is not named
in `--replace`, or a new month that would leave a gap in the store. Without `--totals` it runs and
prints a warning.

**The build.** A dataset in `config/pipeline.json` whose `datasets` entry has `"source": "<id>"` is built
from the store, after the register's datasets, through the same `normalise`, `derive`, `metrics` and
`outputs` code (`registrations_flow` is the first). The store is checked against its ledger (months, rows
and vehicles per month equal, no gap between its first and last month), then `raw` is made in the
register's shape: one row per vehicle (each store row repeated `vehicles` times), the register's column
names, NULL for a field the source does not carry, and the registration year and month from `month`.
Sentinels, scope, brand aliases, the model registry, the hybrid classification, the model cap and the
unmapped guards then apply exactly as to the register. `registrations_flow` takes `require`
`in_scope` and `fleet_entry`, as `registrations_surviving` does: the dashboard's RE-REG and SCRATCH
rows are in the store and are not fleet entries.

**The dataset's own latest month.** A supplied dataset's snapshot month is the last month in its store,
not the register's. It sets the dataset filter, the trailing window, the model cap and the latest-month
checks. Older than the register's: a warning naming the missing month(s). Newer: the run aborts (the
register is the clock).

**Dimensions the source lacks.** A dimension whose derive block reads a field the source does not carry
is not live for the dataset, with the reason `the source does not carry <FIELD>` in `not_live`. This is
decided from the derive block and the source's field list (`derive.applicable`), never from a list of
dimension ids. For the dashboard these are the dimensions that need the gross vehicle mass, the engine
size and the district. Fuel consumption is all missing: `fc_n` is 0 and `fc_sum` is null in every row.
`vehicle_status` is kept in the store only; it is not a dimension.

**The wider scope** (`registrations_flow_wider`, D-113). A second dataset reads the same store through the same
code and differs from `registrations_flow` in one thing: which vehicle types it counts. `scope.vehicle.also` in
`config/pipeline.json` names each wider scope as a flag of `rows` (here `in_trade_scope`) and the column of
`vehicle_scope.csv` it reads (`trade_scope`); a dataset's `require` names exactly one scope flag, which decides the
rows of its table `dims`, its hybrid coverage and its guards (a `require` naming none or two aborts the build).
`registrations_flow_wider` takes `require` `in_trade_scope` and `fleet_entry`. Its facts are `registrations_flow`'s
and `trade_group`, the dimension that sorts each counted type into the groups `vehicle_scope.csv`'s `trade_group`
column gives (a lookup, as `vehicle_type` is; it applies to this dataset only, so no file of another dataset
changes). No pairs, as for `registrations_flow`. Adding it changes no byte of any other dataset's files and no
figure of its manifest entry (tested). The store keeps the model for the types the wider scope counts
(`supplied.nzta_dashboard.outside_scope.also_kept_column`), and the build refuses a store whose ledger trimmed the
model of a (type, status) pair any dataset reading it counts, not only the dataset the trim names.

Measured on the 2026-10 pull (2026-11-17): `registrations_flow_wider` is 1,506,467 vehicles over 70 months (23,064
more than `registrations_flow`: buses 10,997, motor caravans 11,541 and special purpose vehicles 526). Its slices are
140,695 bytes and its fact table 136,452 rows and 386,878 bytes, 527,573 bytes in all; without the fact table the
dataset would add 140,695 bytes. The whole cube's payload goes from 3,753,258 to 4,281,132 bytes (+14.1%) against the
8,000,000 byte budget. Build can only ask a dataset that has a fact table, so it carries one.

### A source of kind `series`

Stats NZ's long-run table of motor vehicles registered by type is the second supplied source (`statsnz_tpt`,
`docs/DATA_SOURCES.md` section C, D-065). It supplies published series, not counted rows, so its store is
laid out differently; the checks around the store are the same code (`pipeline/supplied.py`).
`python -m pipeline supply statsnz_tpt <export.csv> [--taken YYYY-MM-DD] [--accept-revisions]` checks one export
of the table and fetches nothing. The table's title, footer, month format and header live in
`supplied.statsnz_tpt` in `config/pipeline.json`, the meaning of each of its 26 columns in
`data/reference/statsnz_series.csv`; no `.py` file names one.

- `data/supplied/statsnz_tpt/series.parquet` (committed, D-097): one row for each month and series that has a
  figure. Columns, in order: `month` (DATE, the first day), `series_id` (the reference file's id),
  `value` (INTEGER). A figure that Stats NZ marks `..` (not available) has no row. Sorted by month, then
  series, in the cube's Parquet options, so the same input gives the same bytes.
- `ledger.json`, beside it: `source`, as for the first kind; `store_sha256`, the SHA-256 of `series.parquet` as written with it; `files`, for
  each export supplied (keyed by its SHA-256) the file's name, the day it was taken, the export's "Last
  updated" text, its table reference, its first and last month and count of months, and what the arithmetic
  check found (for each total: the months checked, and the months before the check applies where it
  differs, with the difference); `months`, for each month the hash of the file it came from, the day it was
  taken, and the number of figures (`rows`) and their `sum` in the store; and `revisions`, one entry for
  each month a later export revised, with the old and new file's name, hash, taken day and "Last updated"
  text, and every changed figure (`series_id`, `old`, `new`; null where there was no figure). Both files are
  written under temporary names and the ledger is renamed last, as for the dashboard.

`supply` aborts, writing nothing, on any of: a title or header that is not the configured one (the message
says what is missing, what is not expected, or that the order differs); a line with the wrong number of
fields; a month that does not parse, is repeated, comes out of order or leaves a gap; a line straight after the last month
row that is not the footer's first line (`footer.first_line` in the config: a blank line or a mistyped month in the middle of
the data ends the month rows early, and every month after it would be dropped), or any later line that has the table's
field count or begins like a month; a figure that is not a
whole number (no sign, comma or decimal point, and not above the 32-bit range) or `..`; a `..` after a series
has started; a missing or different table reference; no "Last updated" line; `--taken` before the last month
ends; a total that differs from the sum of its parts in any month from `arithmetic_from` (config; the
parts are `total_of` in the reference file, and a month is checked when the total and every part have a
figure); a reference file that contradicts itself; a store that disagrees with its ledger (a month's figures
or sum, a gap, a different hash, only one of its two files); a new month that would leave a gap in the store;
or **a figure in a month already in the store that differs from the export**. The last is a revision. The
command lists every changed figure, with its old and new value, and refuses unless `--accept-revisions`
is given; then it replaces the month and records the revision in the ledger. Disagreements of a total with its
parts before `arithmetic_from` are warnings, recorded in the ledger (the export of 2026-11-14 has 11 of them in 7
distinct months, all before 1998: the cars total against its seven bands in 2 months, 1975-07 and 1976-05; the
commercial total excluding buses against its ten bands in 5, 1977-02, 1978-07, 1981-03, 1996-04 and 1997-08; the
commercial total including buses against the total excluding buses plus the two bus bands in 4, 1977-02, 1978-07,
1996-04 and 1997-08). `--month`, `--totals` and `--replace` are
refused for this kind, and `--accept-revisions` for the dashboard.

**The dataset.** `registrations_cars_long_run` (`datasets` in `config/pipeline.json`, grain flow, source
`statsnz_tpt`): cars and station wagons registered in New Zealand for the first time in month M, new and
ex-overseas, as Stats NZ publishes them from NZTA's records, January 1961 on. It is built straight from the
series, not through the register's vehicle-row path (`pipeline/series.py`, `outputs.write_series_slice`): the
month's vehicles are the series named by the dataset's `total`, and each dimension is a published breakdown of
that total, so its slice is the breakdown's figures.

- `car_origin` ("New or ex-overseas") has two values, labelled exactly as `import_status_map.csv` labels new and
  used imports so the site can set the dataset beside the survivors by import status. Used is the ex-overseas
  series. New is the cars total less the ex-overseas series (the total includes them). Which series feeds
  which value, and that new is a total less a series, is the dimension's `derive.values` in
  `config/dimensions.json`; the label of a value is read from the reference file it names.
- `car_engine_band` ("Engine size (Stats NZ bands)") has the seven engine-size bands, labelled as in
  `statsnz_series.csv`. The bands include the ex-overseas cars.
- The two dimensions apply to this dataset only (`applies_to`). No register dimension is live for it: each reads a
  register field, which a source of kind `series` does not carry, so each is not live with the reason `the source
  does not carry <FIELD>`, as for any source that lacks a field. They are published separately, so they cannot be crossed: there is no pair slice and no fact table, which would have to
  invent the joint distribution.
- Slices use the standard schema (`month`, `dim_value`, `n`, `denominator`, then the fuel columns as for a
  dataset with no fuel data: `fc_sum` null, both counts 0). `denominator` is the month's total. A value of 0 has
  no row.
- **Not recorded.** In a month where none of a dimension's series has a figure (to 1975-06 for both dimensions)
  the month's vehicles carry `__UNDEFINED__`, never a guess. Where the dimension's values add up to less than the
  total, the difference is `__UNDEFINED__` (one vehicle in 1976-05 for the bands). Where they add up to more, the
  build aborts, unless the month is in the dimension's `exceeds_total_allowed` (1975-07, one vehicle over, for the
  bands), in which case the values are carried as published and the month is noted in the manifest. A month where
  some of a dimension's series have a figure and others do not aborts.
- The other 21 series of the table (commercial vehicles, buses, motorcycles, power cycles, tractors) stay in the
  store and are not built into a dataset: Stats NZ's classes are not lined up with NZTA's vehicle types (D-065).
- The dataset's latest month is the store's. Stats NZ published about two weeks after NZTA's service on the one month observed, so the series' newest month is usually a month behind the register's (an estimate). A warning names the missing
  months, and the store is never newer than the register's.
- The state keeps, for each month of a supplied dataset, the SHA-256 of the file the month came from
  (`supplied_files.<dataset>`). A recorded replacement or revision excuses a changed month total if its file
  was taken on or after the last good build's day, or if it is the file the ledger now cites for that month and
  the state's `supplied_files` entry is a different file (an export taken before a build and committed after it).
- The state keeps each month's total under `supplied_totals.<dataset>`. A month whose total differs from the last
  good build's at all (`max_month_change` is 0) aborts, unless the ledger records a revision of that month from a
  file taken on or after that build's day.

**Without the store** (a checkout that lacks it: a store is committed, so GitHub's runs have both, D-097) the build
succeeds, writes nothing for the dataset, adds a warning, and gives the manifest
`datasets.<id> = {"definition": ..., "not_built": "<reason>"}`. Anything that reads `datasets` must
check for `not_built` before reading the other keys.

## Guardrails — abort the run and keep the last good build

The build writes to a staging directory. It replaces `/public/data` and
commits new state only after every check passes. All failing checks are
reported together.

Source and schema:

- A column in `pipeline/expected_schema.json` is missing from the service,
  or its type has changed. New columns are a warning.
- The service does not resolve to exactly one table or layer.
- Rows pulled differ from the service's row count, or an OBJECTID repeats.
- A `VEHICLE_TYPE` or `IMPORT_STATUS` value is absent from
  `vehicle_scope.csv` or `import_status_map.csv`, so scope cannot be
  decided.
- A reference file is malformed: a key defined twice, overlapping ranges,
  or a `make_promotion` to a make that is not in `brand_registry.csv`.
- `model_registry.csv` has a row whose match columns (motive power, import
  status, vehicle type, vehicle year from and to) hold a value the reference
  files do not know, a year that is not digits, or a year from after its year
  to. It has match columns on a row that is not a `make_promotion` or
  `not_promoted` row. A `make_promotion` row names a make, or a target make,
  that is not in `brand_registry.csv`. A `make_promotion` row can move a
  vehicle that a `not_promoted` row with the same make and target forbids
  moving. A make and model key (a model or one of its aliases) is defined
  twice among the alias and promotion rows.
- `mild_hybrid_models.csv` has a row whose make is not in
  `brand_registry.csv`, with no models, with a type that is not one of mild,
  full or unresolved, or without a basis or a confidence from the configured
  levels. It has a match column with an unknown value, as above, or an
  override that is not a known motive power, or an override without a motive
  power to match. It classifies a nameplate mild when the powertrain it would
  get is not the mild one, or full when it is. Two rows can match the same
  vehicle of one make and model.

Volume:

- In-scope source rows differ from the last good run by more than 2%. The
  fleet grows slowly; a jump means the source changed.
- A month that had at least 1,000 rows in the last good run now has none,
  or the snapshot month itself has none. Sparse early months are exempt,
  because scrapping the last surviving vehicle legitimately empties them.

Freshness:

- `latest_snapshot` is older than the last good run's.
- `latest_snapshot` and the total row count are both unchanged but the
  change key differs. Only a forced run reaches this check: an unforced
  run does not rebuild a month.
- A month was missed. From the 15th of a month (UTC;
  `schedule.missed_month_alarm_day` in `config/pipeline.json`), a run that
  builds nothing fails if the last good run's `latest_snapshot` is older
  than the end of the month before, and names the missing month. It fails
  every day until that month is built. A run that builds is never stopped
  by this check, so an overdue month is still committed.

Mapping:

- Unmapped make above 2% of in-scope rows, on either of two bases: every
  in-scope row, or in-scope rows first registered in the trailing 12
  months. Both must pass.
- Unmapped powertrain above 2% of in-scope rows, on the same two bases.
- Unmapped `nz_assembled` or `nzta_class` above 2% of in-scope rows, on the same two bases (every dimension in
  `abort_on_unmapped` in `config/pipeline.json` is guarded so, D-116).
- A dimension that was live in the last good run exceeds its unmapped
  threshold or loses a reference file.

The two bases catch different failures. The whole run tolerates old makes
nobody will map: months before 1990 run 3–30% unmapped, and a per-month
guard would trip on them. But the whole run dilutes anything new: at the
2026-08 snapshot it had 57,602 rows of headroom, a quarter of a year's
registrations, so a new brand missing from `brand_registry.csv` could
reach that scale unnoticed. The trailing basis catches it.

Supplied sources:

- The store disagrees with its ledger (a month's rows or vehicles differ, a month is in one and not the
  other), has a gap between its first and last month, or has columns other than the configured ones, or
  has only one of its two files.
- The store's latest month is after the register's.
- The store file is not the one the ledger was written with (`store_sha256` differs), or a column named in
  `private_columns` is also mapped to a public field.
- The store blanked the model of a (vehicle type, import status) pair that the dataset counts now (the ledger's
  `outside_scope` against the one computed from `config/pipeline.json` and the scope files), or config no longer
  trims a field the ledger says was blanked, so the dataset would read a model the store does not hold. The message
  names the pairs and says to supply the history again from the raw exports. `supply` refuses the same store. A ledger
  that does not say what the store was trimmed to, or a config with no rule where the ledger records one, is refused too,
  because it cannot be judged. A pair the dataset stops counting, a vehicle type or import status the scope files gain
  (including one NZTA has not used before), and a field added to the rule leave the store correct but holding more than
  it needs: the build adds a warning to the manifest, and `supply` trims new months to the scope the ledger records, so
  every month in the store is trimmed alike. Nothing published changes.
- A month's own total in the store (every vehicle the ledger records for it, before any scope applies) differs
  from the last good build's by more than `supplied.<id>.max_month_change` (2%), and the ledger has no
  replacement of that month that the last good build explains (see the state's `supplied_files`, above). The totals are kept in
  the state as `supplied_totals.<dataset>`, so an edit to a scope file cannot trip this check.
- The store did not keep the model of a (vehicle type, import status) pair that another dataset reading it counts
  (`registrations_flow_wider` counts types `registrations_flow` does not), checked as the trim of the dataset the ledger
  names is. A `require` that names no scope flag or more than one aborts the build.
- A supplied dataset was built in the last good run and its store is now absent.
- A dimension of the `series` derive kind names no datasets in `applies_to`, or names one that does not read a source of
  kind `series`: it would be offered to datasets that cannot derive it. The build stops before it reads anything.
- For a dataset of a source of kind `series`: its `total` names a series the table does not have, or the total
  series lacks a figure in a month the store holds; a dimension names a series, or a reference row for a label,
  that does not exist (or whose label is not unique); a dimension's values add up to more than the total in a month
  not listed in `exceeds_total_allowed`, or one of its values would be below zero; some but not all of a
  dimension's series have a figure in a month; a dimension that was live in the last good run lacks a reference
  file; the latest month has no vehicles.

Pairs:

- A dataset's `pairs` in `config/pipeline.json` holds an entry that is not
  two different dimension ids, lists a pair twice in either order, names
  a dimension the dataset cannot derive, or names a dimension whose id
  contains `__` (the separator in a pair file's name).

Fact table:

- A dataset's `facts` is not a non-empty list of distinct dimension ids, or names a
  dimension the dataset cannot derive.
- The table's counts, read back from `n.parquet`, do not total the dataset's
  vehicles as counted before the dimension lookups are joined on.

Events:

- A verified event has a scope outside the enum in `EVENTS_LAYER.md`, a
  `scope_value` that does not resolve through the vocabulary its dimension
  produces, no `date_start`, or no `source_url`; or a value outside the
  enum for any other column the schema table calls an enum (`category`,
  `mechanism`, `expected_effect`, `confidence`), or a `title` longer than
  the table allows.
- The schema table in `EVENTS_LAYER.md` no longer reads as an enum for a
  column `config/pipeline.json` lists in `events.enum_columns` (or lists no
  values for it), or no longer states the title limit.

Failing loudly is the point. A dashboard that quietly serves wrong numbers
is worse than one that is visibly stale.

## Warnings — the build continues, recorded in `manifest.warnings`

- Unmapped make, powertrain, `nz_assembled` or `nzta_class` over the trailing 12 months is above 0.5% of
  in-scope rows: notice well before the 2% abort.
- A vehicle's final powertrain contradicts its `mild_hybrid_models.csv`
  classification.
- A dataset's mild hybrid split is published now and was withheld in the last
  good build, or the reverse (`mild_split` in the state). One build then
  rewrites the dataset's whole history of the two values, in every slice, pair
  and fact table, and no count moves; the warning names the dataset, the
  direction, the trailing coverage at high confidence in both builds and what
  changes. It is a warning and not an abort in both directions (D-110): a
  withheld split is the safe direction, and stopping the run would keep last
  month's split published while the build judges it unreliable, and would hold
  back the new month with it.
- Mild hybrid identification coverage over the trailing 12 months,
  counting high-confidence classifications only, is below 70%. A dataset below
  `publish_split_at_trailing_high_confidence_coverage` also withholds the mild
  hybrid split (`mild_split_published: false`); its warning says so.
- The latest month's count deviates more than 50% from the median of the
  12 months before it.
- Source discovery fell back to the pinned item id, or found more than one
  candidate.
- The source gained columns.
- Some first registrations are dated after the snapshot month. They are
  counted and excluded.
- The moving cutoff was not detected, or its vehicle year differs from the
  last good run's. Its age is snapshot year minus that vehicle year, so it
  rises every year by construction; a changed vehicle year is the signal.
- A dimension that was not live last run still exceeds its unmapped
  threshold, or lacks a reference file, and stays excluded.
- A configured pair waits because one of its dimensions is not live this
  run. It is listed under `not_live_pairs`.
- A dimension listed in `facts` is not live this run, so the fact table is
  written without it. It is listed under `facts.not_live`.
- `data/snapshots/YYYY-MM.parquet` already exists with different content.
  The first observation is kept.
- The payload exceeds the size budget.
- A supplied dataset was not built because its store is absent.
- A supplied store ends before the register's snapshot month: the export is missing the months after it.
- A dataset of a source of kind `series` has a dimension whose reference file is missing and was not live
  before: it stays out, and the warning names the file.
- There is no last good state (first run), so previous-run comparisons were
  skipped.

Where a maintainer sees them (D-112). The warnings stay plain text in the
manifest, in the order the build raised them. A build that ran also writes
them to the Monthly build's summary page (`GITHUB_STEP_SUMMARY`, through the
`--github-summary` the workflow already passes): a heading with the count and
a list, or one line when there are none, ordered by `run_summary.warning_order`
in `config/pipeline.json`. Each group there is a label and a phrase the
warnings of that kind contain: the first is the flip of a dataset's mild hybrid
split, which rewrites its whole history of two values, the second an unmapped
guard above its warning level, which stops a later build if it grows. A warning
no group claims follows, and a wording that stops matching moves a warning to
that end, not out of the list (the tests build each of these warnings and
check its group). Standard error prints every warning, in the order raised. A
build by hand writes the page only where `GITHUB_STEP_SUMMARY` is set, and a
page that cannot be written is a line on standard error, never a failed run.
The internal status page (`/status`) lists the same warnings, as the manifest
has them, with the snapshot and the time the cube was generated.

## Size budget

Whole `/public/data` payload target: **under 8 MB**. Preset JSON under
40 KB each so the first paint needs no Parquet fetch at all.

Measured on dry runs of 2026-11-13, without `region` in the fact table. The
2026-10 pull: the fact table is 641,618 rows in 1,726,119 bytes over its 14
files, the largest `n` (0.38 MB), `age_at_registration_band` (0.29 MB) and
`model` (0.28 MB); the whole payload is 3,149,458 bytes. A question about
brand groups over time reads `month`, `parent_group` and `n`: 0.48 MB. Half
of the table's rows (50.2%) count one vehicle, 7.1% of the vehicles. The
2026-08 pull, the snapshot of the manifest example above: 643,414 rows in
1,736,400 bytes. With `region` the 2026-10 table was 1,734,417 rows in
3,885,012 bytes.

With `nz_assembled`, `nzta_class` and `seats_band` (D-116), measured on a dry run of 2026-11-17 on the 2026-10 pull against
the dry run of the same day without them: the table is 755,586 rows (was 641,618) in 2,277,006 bytes (was 1,768,848,
+28.7%) over 18 files. The three new files are 12,134, 115,913 and 191,330 bytes, and the 15 files that were there grow
by 188,781 bytes together, because rows split. Added alone to the table, each adds rows: `nz_assembled` 1,800 (643,418),
`nzta_class` 26,304 (667,922), `seats_band` 87,953 (729,571); the three together 113,968. The three 1-D slices are
17,304, 35,876 and 33,269 bytes. The whole payload is 4,875,739 bytes (was 4,281,132, +594,607 or +13.9%), 60.9% of the
8,000,000 byte budget. 54.8% of the table's rows count one vehicle (was 50.2%), holding 9.2% of the vehicles (was 7.1%).
The other three datasets' files, and every 1-D slice and pair of this one that was there, are byte-identical.

With the class labels (D-121), measured on a dry run of 2026-11-17 on the same pull: the `nzta_class` slice is 36,221 bytes
(was 35,876) and its column in the table 117,458 (was 115,913), and three other columns of the table differ in size only
because rows sit in a different order (`n` 416,657 against 415,777, `model` 334,233 against 334,041, `seats_band` 190,236
against 191,330). Mapped back to the codes the table's 755,586 rows are the same rows. The payload is 4,877,607 bytes
(+1,868). The other 83 files are byte-identical.
