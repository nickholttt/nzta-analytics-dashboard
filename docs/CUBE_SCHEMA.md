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
  reconciliation.json                   # our figures beside figures other organisations publish (D-149)
  pairs/
    {dataset}/{dim_a}__{dim_b}.parquet  # 2-D slices: only the pairs config/pipeline.json names
  facts/
    {dataset}/{column}.parquet          # the fact table, one column per file: month, each dimension, n
    {dataset}/narrow/{id}/{column}.parquet  # a narrow fact table, for a field the wide one leaves out (D-144)
  associations/
    {dataset}.json                      # how strongly each pair of the fact table's dimensions moves together (D-136)
  presets/
    {preset_id}.json                    # later build step: fully resolved, for first paint
  reference/
    brand_registry.json                 # later build step: for the methodology panel
```

Build step 1 emits `manifest.json`, `cube/registrations_surviving/`,
`pairs/registrations_surviving/`, `facts/registrations_surviving/`,
`associations/registrations_surviving.json`, `events.json` and `reconciliation.json` (one file for the cube, whatever the
datasets built; *reconciliation.json*, below). Every dataset that has a fact table gets an
associations file beside it (*Associations*, below). The same build also emits the stock `fleet` (*Stock datasets*):
`cube/fleet/vehicle_usage.parquet`, `cube/fleet/vehicle_type.parquet`, `pairs/fleet/vehicle_usage__vehicle_type.parquet`
and its block in `manifest.json`, and no fact table, so no associations file.

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
  `stock_totals` keeps, for each stock dataset (*Stock datasets*), the snapshot and the number of
  vehicles it counted, apart from `month_counts`. `mild_split` keeps, for each built dataset that has a mild hybrid coverage
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
month's total.** The other exception is a slice of a dimension that describes the owner, below: its hidden cells have no
`n`, so the `n` that are there sum to less than the `denominator`.

### Slices of owner dimensions: small cells (D-127)

A dimension that reads a field the data map puts in an owner group (`owner_groups` in `config/data_map.json`: today the
owner's region, from the register's district, in `registrations_surviving`, and how the register records the vehicle's usage
now, in the stock `fleet`) is published under the user's rule
for owner fields (D-096, D-120). The rule, its numbers (`owner_rule` in the same file) and the dimensions it holds are
data, not code; the manifest's `small_cells` block, below, says which slices it held and what it hid. A *cell* is one
value of the dimension in one month.

1. **First rule.** A cell counting fewer than `minimum` (10) vehicles is hidden. Its row stays, so the value is still
   listed for the month, but `n` is null, and so are `fc_sum`, `fc_n` and `fc_eligible_n`, which bound `n`. The
   `denominator`, the month's total, stays: every slice publishes it.
2. **Second rule.** In a month with at least one hidden cell, the smallest visible cell is hidden too (a tie goes to the
   value that sorts first, in byte order), and again, until at least `minimum_hidden_cells` (2) cells are hidden, they
   together count at least `minimum_hidden_vehicles` (10), and they hold more vehicles than there are of them (else each
   would be exactly one). A month's total less its visible cells is then a sum of two or more cells that is itself at
   least that many. That does not hide every cell's count from someone who knows the rule (limits, below). A cell hidden
   by the second rule is not told apart in the file from one hidden by the first.
3. **A month in which no cell would stay visible** has no row per value. It has one row, `dim_value` =
   `__NOT_BROKEN_DOWN__`, with `n` and `denominator` both the month's total and the fuel columns null. This is a month
   whose cells are all under the minimum (a month with a total under the minimum, or a single small cell, are cases of
   it), or in which the second rule has to hide the last visible cell. It is decided after both rules have run: a month with
   every cell hidden would show which values had vehicles, and a count of hidden cells as large as the vehicles they hold
   (ten values of one vehicle each) would give every cell away exactly. Nothing about any value of the dimension can be
   derived for that month. A month with a single cell of `minimum` or more is shown as counted: nothing is hidden.

What holds, then, in a month that has hidden cells (and the build aborts unless it does): at least two cells are hidden, at
least one cell stays visible, the hidden cells together count at least `minimum_hidden_vehicles` and more than the number of
them, and each hidden cell is between 1 and the smallest visible count. A null `n` means hidden, never zero (a month with no
vehicles is absent from the slice, as everywhere); the cell may be under the minimum, or may be the one the second rule hid,
which can hold many more than the minimum. The build reads each such slice back from the written file and aborts, publishing
nothing, unless in every month: no visible `n` is under the minimum (a row with no `dim_value` included); and either no cell
is hidden and the visible counts add up to the `denominator`, or at least `minimum_hidden_cells` cells are hidden, at least
one row is visible, and the `denominator` less the visible counts is at least `minimum_hidden_vehicles` and larger than the
number of hidden cells, or the month is one reserved row whose `n` is the `denominator`; and no hidden or reserved row
carries a fuel figure. A slice that a protected pair stands on carries none on any row (*Pairs with an owner dimension*). A pair with such a dimension is held to its own rule (*Pairs with an owner dimension*, below), and
neither the fact table nor the committed snapshot aggregate holds an owner field (D-078, D-096).

Limits, stated and not solved (D-127). The project's owner accepts these knowingly:

- A cell that falls under the minimum in one snapshot and was over it in the neighbouring one is bounded by the
  neighbour, since each snapshot restates its months. The release `cube-2026-10` was published before the rule and still
  holds the slice unhidden.
- Which cells are hidden is visible, not which of them are small: a hidden row names its value.
- Someone who knows the rule knows the second rule hides at most one cell of `minimum` or more, the smallest visible one.
  The month's total less its visible counts is the sum of its hidden cells. In a month with two hidden cells that
  together hold 19 or more, one is therefore small and the other is the cell the second rule hid, which holds at least
  the minimum and no more than the smallest visible count, so the pair of values can be narrowed. (Two hidden cells
  holding 18 or fewer may both be small.) In principle a pair can be pinned exactly: a hidden sum of 19 beside a smallest
  visible count of 10 can only be 9 and 10, though not which cell holds which. On the 2026-10 pull (D-127) no month
  does: 279 months have exactly two hidden cells; of the 166 that hold 19 or more, none pins the smaller cell to one
  value, 2 narrow it to two values, 8 to five values or fewer, and 140 learn nothing; the other 113 never narrow to
  one pair.
- When the extra hidden cell is a large region whose count can be guessed from its neighbouring months, the small cell is
  known to within the error of that guess.
- The fuel columns of a month's hidden cells, summed together, can be worked out from another slice's month total less
  the visible region rows. That is about the group of hidden cells, not any one cell.

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
| `__NOT_BROKEN_DOWN__` | Only in a slice of an owner dimension, or a pair with one: the month is not broken down by this dimension, because under the small-cell rule no cell of it would stay visible (above, and *Pairs with an owner dimension*). The row's `n` is the month's total. In a pair it is the value of both columns. |

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
emits, as `[dim_a, dim_b]`; the list above is what may be added. A pair with a dimension that reads an
owner field is written under the rule for a table of two fields (*Pairs with an owner dimension*, below,
D-135), and the data map's test still holds it to the outputs the owner's rule allows (`published_exceptions`
in `config/data_map.json`). Emitted
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

## Pairs with an owner dimension (D-135)

A pair slice in which one or both dimensions read an owner field (the data map's `owner_groups`, as for a slice above) is
held to the user's rule for a table of two fields (D-096, D-120). The table is published with both one-field slices, so the
total of every *line* is public: a line is one value of a dimension with all its cells in the pair (a row for the first
dimension, a column for the second), and its total is that value's count in the dimension's slice. A hidden cell is therefore
what its line's total leaves after the visible cells, and the rule has to protect it against both of its lines at once. It is
data, not code: the numbers are `owner_rule.minimum_count` and `owner_rule.pair_rule` in `config/data_map.json`
(`minimum_hidden_cells_per_line` 2, `minimum_hidden_vehicles_per_line` 10, tested not to fall below the floors of the rule for
a slice), and which pairs it holds is read from the data map as for a slice. The manifest's `small_cell_pairs` block, below,
says which pairs it held and what it hid. A *cell* is one value of each dimension in one period (a month).

In each period, in this order:

1. **First rule.** A cell counting fewer than `minimum` (10) vehicles is hidden: its row stays, with `n` null, and the
   `denominator`, the period's total, stays. The three fuel columns are null on **every** row of a protected pair, not only on
   a hidden one, and on **every** row of both one-field slices it stands on (below): a fuel-eligible count is at most the
   count of its cell, so a visible cell's `fc_eligible_n` is a lower bound on the count of every cell in its line; a
   slice's `fc_eligible_n` per value is an upper bound on the cells of that value's line, and a line that is wholly
   fuel-eligible caps each of its cells by the other line's eligible total. The audit below knows none of these, so none is
   published (the first was measured to narrow the first real table, D-135), and a protected pair carries counts alone.
2. **A value hidden in its one-field slice.** If a dimension's slice hides a value in the period, every cell on that value's
   line is hidden in the pair too, since the line's total is not public. If either slice is not broken down in the period (it
   is one reserved row), neither is the pair (4, below).
3. **Line rule.** Until nothing changes: every line whose total is public and that holds a hidden cell must hold at least
   `minimum_hidden_cells_per_line` hidden cells, which together count at least `minimum_hidden_vehicles_per_line` and more
   vehicles than there are of them (else each is exactly one). Where a line does not, the line's smallest visible cell is
   hidden, preferring a cell whose other line already holds a hidden cell (that closes a rectangle of hidden cells and hides
   least), then the smaller count, then the cell that sorts first (the first dimension's value, then the second's, in byte
   order). One cell is hidden at a time and the lines are looked at in a fixed order (rows, then columns, each in value order),
   so the same table always gives the same result whatever order its rows arrive in. A line whose value was hidden by (2) is
   exempt: its total is not public.
4. **A period that cannot be protected** is not broken down: it has one row, with `__NOT_BROKEN_DOWN__` in both `a_value` and
   `b_value`, and `n` and `denominator` both the period's total, the fuel columns null. That is a period in which a line
   cannot meet the line rule (it has no visible cell left to hide), in which a line with hidden cells would keep no visible
   cell, in which every cell would be hidden, in which the audit (below) finds a hidden cell pinned to one value, or in which
   either one-field slice is not broken down. Which cells had vehicles is not shown for it.

**The one-field slices of a protected pair carry no fuel figure.** In a dataset with a protected pair, the slice of each of
the pair's two dimensions (the owner dimension's, and the other's, which reads no owner field) is written with `fc_sum`,
`fc_n` and `fc_eligible_n` null on every row, hidden or visible. Which slices is decided from `pairs` in
`config/pipeline.json` and the data map's protection (`pair_slice_dimensions` in `pipeline/build.py`); no dataset or
dimension id is in code. Today that is both slices of the stock `fleet`. A one-field slice of an owner dimension that no
pair stands on keeps the fuel columns of its visible cells (*Slices of owner dimensions*). Leaving the fuel columns off costs a figure
nothing asked for: no measure in `config/measures.json` is a fuel measure.

**The audit.** For every hidden cell, the build works out the smallest and largest count that every public line total, the
period's total and every visible cell leave it, with each hidden cell holding at least one vehicle. The values the totals
allow are the integer flows of a small transportation problem, and the range for one cell is an interval; its ends are found
exactly by testing whether a given value is possible with a maximum-flow computation (`pair_cells.bounds`). Where some
values of a dimension are hidden in its slice, their lines share one known sum, the period's total less the lines that are
public, and the audit uses that. A period in which any hidden cell's smallest and largest are the same value, or in which
no values fit the totals, is not broken down (4, above), and the build aborts if a written pair still holds one. A search of
random tables found that the counts of (3) can hold while one cell is pinned (a table of four rows and four columns with
nine hidden cells; `pipeline/tests/test_pair_cells.py` keeps it), so the counts alone do not give the guarantee and the audit
is part of the rule.

What holds in a period that has hidden cells (and the build aborts unless it does): no visible `n` is under the minimum; every
line whose total is public and that holds a hidden cell holds at least `minimum_hidden_cells_per_line` of them, which together
count at least `minimum_hidden_vehicles_per_line` and more than the number of them, and keeps a visible cell; every cell on a
line hidden in its slice is hidden; and, for every hidden cell, the public totals leave at least two values. The build reads
each such pair back from the written file and from the written one-field slices, and aborts, publishing nothing, unless in
every period those hold, a period either slice does not break down is one reserved row, the visible counts of a line with no
hidden cell add up to the line's total in its slice, every value in the pair is a value of its slice, the `denominator` is the
same on every row and is the slice's, no row of the pair or of either one-field slice carries a fuel figure, and the file's
periods, hidden rows and reserved rows equal what the writer meant to write. Summed over `b_value`, a protected pair no longer gives `dim_a`'s slice, since hidden
cells have no `n`.

Limits, stated and not solved (D-135). The project's owner accepts these knowingly:

- Which cells are hidden is visible, not which of them are small: a hidden row names its two values, and a cell the line rule
  hid can hold many more than the minimum.
- The audit counts the values that this table's own public totals leave a cell. It does not combine tables: two pairs of the
  same owner dimension with different second dimensions, the one-field slices, and the same table in the neighbouring snapshot
  are each published, and a reader who combines them can know more than any one table shows. Nothing in the build compares
  them.
- The audit refuses only a hidden cell pinned to one value. A cell the totals narrow to a few values is published. On the
  2026-10 register the narrowest of the four hidden cells of the fleet's pair has a spread of 15 (largest less smallest: 16
  possible values), and the four are narrowed to 1 to 16, 93 to 108, 1 to 16 and 12 to 27.
- The manifest's counts narrow the ranges a little more. `cells_hidden_first_rule`, `cells_hidden_by_slice` and
  `cells_hidden_second_rule` say how many hidden cells each step hid, so a block with `cells_hidden_first_rule: 1` says that
  exactly one hidden cell is under 10 and the others are not known to be. The audit does not use them. The other figures
  there (`vehicles_in_hidden_cells`) are the sum of the hidden cells, which the totals already give.
- A range wide enough to pass the audit can still be narrow in practice: the manifest gives, for each protected pair,
  `narrowest_range`, the smallest spread (largest less smallest) that any hidden cell has in any period, so how close the
  closest cell comes is visible. A spread of 0 never publishes.
- The audit runs once per period when the pair is written and again when it is read back, and its cost grows with the hidden
  cells of a period; a pair with many periods and many hidden cells in each is slower to build.

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
page address and date) and `OTH`, a value the register holds that the supplied table does not list, whose label is its code. It
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

`power_band` (the power NZTA records in kilowatts, in the bands of `dimensions.json`; D-128) is a band again, and a column of
`registrations_surviving`'s table with a slice of its own; the other three datasets carry no power, so it is not live for them
(`not_live`: "the source does not carry POWER_RATING") and none of their files changes. Its guard is the band edge, 5 to 900: a
value inside it lands in its band and anything else lands in `unknown`. A zero is the form of not recorded
(`sentinels.csv`, under `POWER_RATING`), so it is NULL when banded; the manifest counts the causes apart
(`counts.bands.power_band`: `source_sentinel` the zeros, `out_of_bands` the values below 5 or above 900, `source_missing` the
blanks). On the 2026-10 pull they are 1,988,072, 192 and 0, of 4,520,304 vehicles. NZTA records power for vehicles sold new
here only, and the pipeline does not look at the import status: the 141 used imports with a power keep it, and the other
1,787,993 are in `unknown`. The dimension's `public_note` says so, and from which month power is well
recorded. No mean or median is built.

`transmission` (the kind of gearbox NZTA records, in four groups under the names in the `group` column of
`transmission_map.csv`; D-128) is a lookup again, with a group for a label, so many of NZTA's 28 values share one published
value. It is a column of `registrations_surviving`'s table and has a slice of its own; the other three datasets carry no
gearbox, so it is not live for them (`not_live`: "the source does not carry TRANSMISSION_TYPE") and none of their files
changes. A blank is the only form of not recorded, and `sentinels.csv` lists none for the field. A raw value the file does not
hold reads `__UNMAPPED__` and counts against the dimension's unmapped guard (below). NZTA records the gearbox for vehicles
sold new here only, and the pipeline does not look at the import status: the 116 used imports with a gearbox keep it, and the
other 1,788,018 read `__UNDEFINED__`. `public_note` says so, and from which month the gearbox is well recorded.

`colour` (NZTA's main colour for the vehicle, in NZTA's own words, published as the register holds them; no reference file) is a
slice of `registrations_surviving` and not a column of its fact table. A column of the wide table was measured at 1,324,975
bytes, +75% of it, and made an existing brand-by-powertrain question 40% heavier (D-116 item 6), so it is kept out of the wide
table. A blank is the only form of not recorded (`__UNDEFINED__`); `sentinels.csv` lists none, because the 14 values the 2026-10
pull holds are all colours. The dimension is not in `abort_on_unmapped`: a colour NZTA adds is a new value, not an unmapped one.
The other register-shaped datasets read a source that carries no colour, so it is not live for them (`not_live`: "the source
does not carry BASIC_COLOUR"), and none of their files changes.

`powertrain_group` (the powertrain in five groups, under the names in the `powertrain_group_label` column of
`powertrain_map.csv`; D-124) is a column of the table of every dataset whose `facts` list the powertrain (the three that
have a fact table), and has a slice of each. It is read from the same final motive power as the powertrain, and the file
gives every powertrain value one group, so a group is a function of the powertrain: the table gains no row, and no vehicle
sits in a group other than its powertrain's. The mild split does not move it (the two values it moves a vehicle between are
in one group), so it is published on a dataset that withholds the split. It is not live for `registrations_cars_long_run`
(`not_live`: "the source does not carry MOTIVE_POWER"). A motive power the file does not hold reads `__UNMAPPED__` here as
it does for the powertrain, and the dimension is in `abort_on_unmapped` beside it. Measured on a dry run of 2026-11-17 on
the 2026-10 pull against the build of the branch before it: the table's rows are unchanged (755,586 on
`registrations_surviving`, 131,260 on `registrations_flow`, 136,452 on `registrations_flow_wider`); the files added are
18,829 bytes (slice) and 6,115 (column) on the first, 2,920 and 1,851 on the second, 2,920 and 1,864 on the third; the
payload is 4,877,607 bytes before and 4,912,106 after (+34,499), 61.4% of the 8,000,000 byte budget. Every other file is
byte-identical; the manifest gains the dimension's entries.

A list that is empty or not distinct dimension ids, or names a dimension the
dataset cannot derive (or `month`, `n` or `rid`), aborts the run. A listed dimension
that is not live this run is left out of the table, with a warning, and listed
in the manifest's `facts.not_live`; if none is live, the table holds the month
totals alone.

The table carries nothing about a vehicle's owner. `region` is where the
owner lives, and it is left out of `facts` (D-078; the user's rule for owner
fields allows them in a slice or a pair only, D-096): with it, two in three of the table's rows counted a single vehicle
(64.8% on the 2026-10 pull), each with the owner's region beside the model
and the month. The `region` slice is not affected by that (it takes the small-cell rule, above), and a question that only
breaks down by region is still answered from it. The build holds to this: a dataset whose `facts` names a dimension that
reads an owner field (worked out from `config/data_map.json`, as for the slices) aborts before anything is read or written
(*Guardrails*, below), and so does a table of the dataset's `narrow_facts`. Putting `region` back would need the user to change that rule first, and the guard with it; it is then
a contract change shown to the user.

The table's total is checked against the vehicles themselves: the counts are
read back from the written `n.parquet` and must equal the dataset's vehicles
counted before the dimension lookups are joined on, or the run aborts. A
dimension lookup that matched a vehicle twice, or lost one, is caught here.
The lookups joined on before that count (scope, import status, brand, the
model and hybrid exceptions, engine) each abort on a key defined twice or on
two rows that match the same vehicle (Aborts, below).

### Narrow fact tables (D-144)

A field that would make every question heavier as a column of the wide table goes in a second, narrower one. A column of the
wide table splits its rows, so every question reads more rows (`colour` was measured at 1,324,975 bytes, +75% of the table, and
made an existing question 40% heavier, D-116 item 6). A dataset's `narrow_facts` in `config/pipeline.json` lists the tables, each
`{ "id": ..., "dimensions": [...] }`, and a build writes each to `facts/{dataset}/narrow/{id}/`: `month.parquet`, one
`{dimension}.parquet` per live dimension and `n.parquet`, with the wide table's types, one column per file, rows unique on
`month` and the dimension values, sorted by `month` and then each dimension in the order configured, and every file holding the
same rows in the same order. Summed over every dimension but one it gives that dimension's 1-D slice, and summed over all of them
the dataset's month totals, as the wide table does. A question that names a dimension of the narrow table, and nothing outside it,
is answered from it. A field only the wide table has cannot be crossed with one only the narrow table has: neither table holds
both. The site does not read narrow tables yet.

The manifest lists each in the dataset's `facts` block, under `narrow`, by id: `{ "rows": n, "dimensions": [...], "not_live": {} }`.
A dataset that configures none has no `narrow` key and no `narrow/` folder, so its files and manifest are as they were.

The same checks as the wide table apply to each, under the list's own name in the message (`narrow_facts 'id'`): a list that is empty or
not distinct dimension ids, a dimension the dataset cannot derive, or a name the table reserves (`month`, `n`, `rid`) aborts; a
dimension not live this run is left out, with a warning, and listed under `not_live`; the counts are read back from the written
`n.parquet` and must equal the dataset's vehicles, or the run aborts. A table needs the dataset's `facts` (the wide table), a table's
id is lower case letters, digits and underscores, and an id listed twice aborts. A dimension that reads an owner field is
refused, exactly as for `facts` (above): the build aborts before anything is written.

`narrow_facts` of `registrations_surviving` holds one table, `colour`, of the dimensions `colour`, `make` and `powertrain_group`
(D-144). Measured on the saved 2026-10 pull (4,520,304 vehicles), by writing each set with the build's own code:

| dimensions | rows | bytes |
|---|---|---|
| `colour` | 13,111 | 34,438 |
| `colour`, `make` | 195,877 | 294,287 |
| `colour`, `make`, `vehicle_type` | 238,971 | 368,985 |
| `colour`, `make`, `powertrain_group` (chosen) | 224,388 | 353,976 |
| `colour`, `make`, `import_status` | 259,377 | 395,915 |
| `colour`, `make`, `powertrain` | 278,443 | 441,723 |
| `colour`, `make`, `vehicle_type`, `import_status` | 309,915 | 483,990 |

## Associations

Each dataset that has a fact table has one more file, `associations/{dataset}.json`: how strongly each pair of the fact
table's dimensions moves together (the data map's "moves together with", `docs/DATA_MAP.md`; D-136). It is one file for each
dataset, written in that dataset's build beside its slices, and not one for the cube, so a question about a dataset
downloads that dataset's file alone, as it downloads that dataset's columns of the fact table. A dataset with no fact table
(`registrations_cars_long_run`) has none and its manifest entry says `associations: null`.

**Where the counts come from.** A pair's table is the fact table's counts summed over every dimension but the two: the
dataset's vehicles grouped by month and the two values. No vehicle row is needed, and the browser could rebuild any figure
from the published fact table (a test does, from the published files, by a longer route than the pipeline's).

**The measure** is the bias-corrected Cramér's V of Bergsma (2013), from 0 (no association) to 1 (one decides the other). For a
table of N vehicles with r rows and c columns: phi2 = chi2 / N, with chi2 Pearson's; phi2c = max(0, phi2 - (r - 1)(c - 1) / (N - 1));
r~ = r - (r - 1)^2 / (N - 1) and c~ = c - (c - 1)^2 / (N - 1); V = sqrt(phi2c / min(r~ - 1, c~ - 1)). The test file holds it to
two tables worked by hand: [[30, 10], [10, 30]] gives the square root of 25/104, 0.4903; [[6, 2, 2], [2, 6, 2]] gives the
square root of 1/10. It says how far knowing one value tells the other and nothing about why. V is rounded to
`associations.decimals` (4) places in `config/pipeline.json`; it is null where it is not defined (a side with one value,
fewer than two vehicles, or min(r~, c~) not above 1), and the pair keeps its counts.

**Which vehicles count.** Those with both values recorded. Left out of a pair: the reserved `__UNDEFINED__` (not recorded),
`__UNMAPPED__` and `__OTHER__` (the model dimension's lump of nameplates beyond its cap, which is many values and not one), and a
banded dimension's `unknown` band (`dimensions.json`). So `vehicles` can be below the dataset's. A band that means something
(the engine band for no engine) counts. `values_a` and `values_b` are the distinct values among the vehicles counted.

**Windows.** `all` is the whole dataset, from its first month with vehicles to its latest month; `trailing` is the
`trailing_window_months` (12) months of first registration ending at the latest month, the same window as the unmapped guard.

**What is marked.** A pair that is not a finding carries `relation`, a list (empty for a finding) of entries `{ "kind", "basis" }`:

- `rolls_up`: the data map says one dimension rolls up to the other (`relations.rolls_up_to` of `config/data_map.json`), directly or
  through other dimensions (a model under its make under its parent group). A dimension stands for a map field when it has
  the field's bound name or is a lookup, a copy or a banding of that field alone, the rule the site's `src/lib/nesting.ts`
  uses; `basis` is the map's `holds_on`.
- `true_by_definition`: the pair is in `moves_together.true_by_definition`, matched on a dimension's id or on a register
  field its derive block names, in either order; `basis` is the entry's (`by_construction` or `by_definition_inferred`).
  A dimension derived from several fields answers to each of them, so a pair that the map lists for one of its fields is
  marked for the dimension too.
- `same_field`: both dimensions are derived from the same register field (a field and what is derived from it); `basis` is null.

Nothing here names a dimension or a field; the marks are read from the two config files and the dimensions.

**Owner fields.** A dimension that reads an owner field (`pipeline/privacy.py`, from the data map) is in no pair, even if it is
listed in `facts`: it is left out of `dimensions` and named in the manifest entry's `left_out`. None is in a fact table today
(D-078, D-096), and a test lists one to hold this.

**Faults.** The build reads the file back, and aborts on a V outside 0 to 1, or on a pair missing, written twice or not of
the dataset's dimensions. A pair on few vehicles is not a fault: its count is written so a reader can judge it.

```json
{
  "dataset": "registrations_surviving",
  "measure": "cramers_v_bias_corrected",
  "decimals": 4,
  "windows": { "all": { "from": "1912-01", "to": "2026-10" }, "trailing": { "from": "2025-11", "to": "2026-10" } },
  "dimensions": ["age_at_registration_band", "built_in", "engine_size_band", "..."],
  "pairs": [
    {
      "a": "age_at_registration_band",
      "b": "import_status",
      "all": { "v": 0.9864, "vehicles": 4516548, "values_a": 22, "values_b": 2 },
      "trailing": { "v": 0.9971, "vehicles": 240656, "values_a": 22, "values_b": 2 },
      "relation": [ { "kind": "true_by_definition", "basis": "by_construction" } ]
    }
  ]
}
```

Dimensions are listed in id order and each pair once, `a` before `b` in that order, sorted by `a` then `b`, so n dimensions
give n(n-1)/2 pairs. The file is written with `\n` (LF) line endings and counts towards `payload_bytes`.

The manifest entry is `associations`: `{ "file": "associations/{dataset}.json", "dimensions": 19, "pairs": 171,
"not_findings": 16, "left_out": {} }`, where `not_findings` counts the pairs that carry a `relation`.

**Measured** on a dry run of 2026-11-18 on the saved pull of the 2026-10 snapshot (exit 0, 702.6 s in all), before the data
map recorded that the make rolls up to heritage country and that a manufacturer group has one owner country (D-136's
follow-up). Under the config as it now stands the marked pairs are 16, 10 and 11 (counted from config with
`association.relations`, not rebuilt), and each file is a few hundred bytes larger than the table says:

| dataset | dimensions | pairs | marked | bytes | gzipped |
|---|---|---|---|---|---|
| `registrations_surviving` | 19 | 171 | 13 | 58,988 | 4,700 |
| `registrations_flow` | 11 | 55 | 7 | 19,579 | 1,791 |
| `registrations_flow_wider` | 12 | 66 | 8 | 23,318 | 1,965 |

The three files are 101,885 bytes, 1.9% of the payload of 5,312,692 bytes (66.4% of the 8,000,000 byte budget). The step took
26.0 s for the three datasets (21.5, 1.7 and 2.8 s), timed inside the build; an earlier run of the same measure took 26.2 s and
wrote the same V for every pair. No whole-dataset V is null; two trailing-window V of `registrations_surviving` are (the
NZ-assembled flag has one value among the 144,827 and 144,829 vehicles that record a power or a gearbox in the window). The
fewest vehicles any pair of `registrations_surviving` rests on is 140,149 (the model with the power band, in the trailing
window).

## reconciliation.json (D-149)

Every build sets some of its own figures beside figures other organisations publish, and writes the result beside the
manifest. The point is that a gap is caught before a visitor sees it, and that the gaps are shown, not hidden. What is
compared is data and nothing in the code names it: `data/reference/published_figures.csv` has one row for each published
figure (the source, the month, the measure as the source defines it, the figure, the question to put to our own files as a
dataset and a set of dimension filters, a tolerance and a note on any known difference), and
`data/reference/published_sources.csv` one row for each organisation (`docs/DATA_SOURCES.md`, section F, has both files'
columns and the filter encoding). Scope is carried by the dataset: the default scope and the trade's wider scope are two
datasets, so a row says which total it is set against by its dataset and filters, and there is no scope column.

**What is checked is what is published.** After every dataset is staged and before the build is promoted, each row is
answered from the staged files a visitor's browser would read, not from an internal table: from the dataset's fact table
(summed over the rows that match the filters and the month), or, for a dataset with no fact table or a single filter on a
dimension the fact table does not carry, from the dimension's one-field slice; a row with no filter on a dataset with no fact
table is the month's `denominator`, which every slice repeats. The fact table's row count read back must be the manifest's.
Both files are read and checked at the start of the build, before the register is read.

**A row is a fault, and the build aborts naming the row (file, line, source, month, measure), when** the header is not exactly
the columns; a cell is malformed (a month not `YYYY-MM`, a figure that is not a whole number above zero, an address that is
not `https://`, a date that is not `YYYY-MM-DD`, a tolerance above `reconciliation.max_tolerance_pct`); a source is not in
`published_sources.csv`; the dataset is not one of `config/pipeline.json`; a filter names a dimension the dataset cannot
derive, one that is not live in this build, or two dimensions that no one published table holds together (the second is found from
the `facts` lists of `config/pipeline.json` before the register is read, and checked again against the staged files); or two rows have
the same source, month, measure and filters. What the configuration can prove wrong aborts. What depends on which values this
month's files happen to hold does not: a filter value that the published files do not hold (the model dimension keeps only the
largest models of the trailing year, so a model that was large in an old month can be gone from a later build) makes the row
`not_compared`, with `reason_kind` `value_not_held`, never a zero and never an abort.

**Each row ends as one of four statuses.**

| status | meaning |
|---|---|
| `pass` | ours is within the row's `tolerance_pct` of theirs (a gap of exactly the tolerance is inside) |
| `warn` | past the tolerance. The build adds one warning line for each source, not one for each row |
| `fail` | past the hard bound, and one of the rows that stop the build (below) |
| `not_compared` | `reason_kind` and `reason` say why: `month_not_held` (our data for the dataset starts later or ends earlier, as for the newest month before its export is supplied), `dataset_not_built` (a supplied store is absent), `value_not_held` (a filter value that this build's published files do not hold; the reason names the dimension and the value), `hidden_cell` (the answer rests on a cell the small-cell rule hides, so ours is not published) or `no_published_table`. Never dropped, never a pass, and never counted towards the hard limit |

The gap is ours less theirs, so a positive gap is ours above theirs, and `gap_pct` is the gap as a percentage of theirs,
rounded to `reconciliation.pct_decimals` places. A row with `not_compared` has `ours`, `gap` and `gap_pct` null.

**The hard limit** stops the build (a guardrail abort, exit 2, the last good build stays) when the same month is far from ours
in several separate counts, which means our data is wrong, not theirs. The numbers are `reconciliation.hard_limit` in
`config/pipeline.json`; the values here are the ones it holds today.

1. A row is past the **hard bound** when its gap is more than `max(tolerance_multiple x the row's own tolerance, floor_pct)`
   of theirs: 2 times the tolerance, and never under 2%, so a tolerance of a tenth of a percent cannot turn a few vehicles
   into a breach.
2. A source is judged for a month **by vehicles, not rows**. The weight of a compared row is its published figure. The source
   **breaches on the low side** (ours below theirs) when its rows past the hard bound with ours below theirs hold at least
   `source_vehicle_share` (one half) of the weight of all its compared rows for that month, and **on the high side** likewise.
   A row past the bound on the other side does not cancel it. A total and its parts both count: the share is of what the source
   published, not a count of vehicles.
3. The build stops when, in one month, at least `min_sources` (2) sources that are **independent** (the `independent` column of
   `published_sources.csv`: a source that counts separately from the data our datasets are built from) breach on the same side,
   and they are more than half of the independent sources that have any compared row that month: two of two, two of three,
   three of four. The rows past the hard bound of those sources are marked `fail`, and one abort line per month and side names
   each source, how many of its figures are past the bound, its share of what it published, and the largest gap.

It does not stop on: one source restating its history, whatever its gaps (one source is never enough); a month with compared
rows from fewer than two independent sources, however far they are from ours, because there is nothing to agree with; a source
that cannot be read this month (it has no rows, so it is not one of the sources that have anything to say); two of four sources;
sources that disagree with ours on opposite sides, or in different months; a gap exactly on the bound; a source of which less
than half of what it published is past the bound; a source that is a copy of our own export (`independent` false: compared and
shown, never counted); a month or a dataset we do not hold, a value we do not hold, or a hidden cell (all `not_compared`).
`pipeline/tests/test_reconcile.py` has a test for each.

What size of error stops a build. On the 336 rows committed on 2026-11-23, measured through the real functions (`test_reconcile.py`, "live rows", and the review of 2026-11-23):

- Starting from figures equal to each source's: an error that moves every one of our figures by 2.1%, either way, stops the build in each of the 22 months (2.0% only where rounding tips it, 1.5% in none).
- Starting from the October 2026 build's own figures, which sit up to 0.7% under the sources': 2.1% lower stops it in every month; higher, 2.5% stops 21 of the 22 months and 2.8% all of them.
- 3%, 5% and 6%, either way, stop it in every month, and in one month alone whether three sources have rows there or two.
- 5% of the passenger vehicles, new and used alike, counted as commercial stops it in all 22 months, on the low side.
- **What it does not stop.** The same fault among new vehicles only, at 5%, 10% and 20%: the new passenger figure is under half of what vstat and the MIA publish for a month, so only Stats NZ breaches. It warns on 71 rows and the build goes on. A fault confined to one kind of figure is a warning to read, not a stop.
- A source restating its history 10% higher or lower, in every month, never stops a build.

```json
{
  "latest_snapshot": "2026-10-31",
  "sources": {
    "source_a": { "name": "Source A", "home_url": "https://a.example", "independent": true,
                  "definition": "What the source says it counts.", "definition_date_read": "2026-11-20" }
  },
  "summary": {
    "rows": 2,
    "by_status": { "pass": 1, "warn": 0, "fail": 0, "not_compared": 1 },
    "by_source": { "source_a": { "rows": 2, "pass": 1, "warn": 0, "fail": 0, "not_compared": 1 } },
    "months": { "first": "2026-09", "last": "2026-11" },
    "thresholds": { "max_tolerance_pct": 20, "hard_limit_tolerance_multiple": 2, "hard_limit_floor_pct": 2,
                    "hard_limit_min_sources": 2, "hard_limit_source_vehicle_share": 0.5 }
  },
  "rows": [
    { "source": "source_a", "month": "2026-09", "measure_as_published": "Measure as the source words it",
      "dataset": "registrations_flow", "filters": { "import_status": ["a value"] },
      "ours": 1040, "theirs": 1020, "gap": 20, "gap_pct": 1.9608, "tolerance_pct": 2.0, "hard_bound_pct": 4.0,
      "known_difference": null, "status": "pass", "reason_kind": null, "reason": null,
      "source_url": "https://a.example/page", "date_read": "2026-11-20" },
    { "source": "source_a", "month": "2026-11", "measure_as_published": "Measure as the source words it",
      "dataset": "registrations_flow", "filters": {}, "ours": null, "theirs": 1100, "gap": null, "gap_pct": null,
      "tolerance_pct": 2.0, "hard_bound_pct": 4.0, "known_difference": null, "status": "not_compared",
      "reason_kind": "month_not_held", "reason": "Our registrations_flow data holds 2021-01 to 2026-10 in this build, so 2026-11 is outside it and is not compared.",
      "source_url": "https://a.example/page", "date_read": "2026-11-20" }
  ]
}
```

(The values are made up, to show the shape.) Rows are sorted by month, then source, measure and filters, so the file does not
depend on the order of the CSV; `sources` holds every source of `published_sources.csv` in file order, so a page can state a
definition without knowing a source by name; `summary.by_source` lists every source, with zeros for one that has no rows. The
file has no time in it: the same cube and the same two reference files always write the same bytes. It is written with `\n`
line endings and counts towards `payload_bytes`. With no rows in `published_figures.csv` the file is the same shape with
`rows: []`, null months and all counts zero. The manifest's `reconciliation` entry is `{ "file", "rows", "by_status", "months" }`,
the same four figures, so a page that only needs the headline need not fetch the file.

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
      "small_cells": {
        "region": { "minimum": 10, "minimum_hidden_cells": 2, "minimum_hidden_vehicles": 10, "months": 790,
                    "cells_hidden_first_rule": 3000, "cells_hidden_second_rule": 200, "vehicles_in_hidden_cells": 9000,
                    "months_not_broken_down": 20, "vehicles_in_months_not_broken_down": 60 }
      },
      "facts": { "rows": 643414, "dimensions": ["powertrain", "make", "..."], "not_live": {} },
      "associations": { "file": "associations/registrations_surviving.json", "dimensions": 19, "pairs": 171, "not_findings": 16, "left_out": {} },
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
  "reconciliation": { "file": "reconciliation.json", "rows": 0,
                      "by_status": { "pass": 0, "warn": 0, "fail": 0, "not_compared": 0 },
                      "months": { "first": null, "last": null } },
  "payload_bytes": 3158670,
  "warnings": []
}
```

`small_cell_pairs` is on a dataset only when one of its pairs is held to the rule for a table of two fields (*Pairs with an owner
dimension*). It holds one entry for each such pair, keyed by the pair's file name (`{dim_a}__{dim_b}`), so a reader tells a protected
pair from a plain one by finding its name there. The entry has `minimum`, `minimum_hidden_cells` and `minimum_hidden_vehicles` (the
rule: the minimum count and the pair rule's two per-line numbers); `months` (periods in the pair); `cells_hidden_first_rule` (rows with
a null `n` that the first rule hid), `cells_hidden_by_slice` (those hidden because their value is hidden in its one-field slice) and
`cells_hidden_second_rule` (those the line rule hid), each hidden cell counted once, in that order; `vehicles_in_hidden_cells` (what
they held); `months_not_broken_down` and `vehicles_in_months_not_broken_down` (periods that are one reserved row, and their vehicles);
and `narrowest_range` (the smallest spread the audit left any hidden cell in any period, null when no cell is hidden). The read-back
check compares the file's periods, hidden rows and reserved rows with these figures.

`small_cells` is on each dataset built from vehicle rows (the register's, and a supplied source's that counts vehicles); a
dataset of a source of kind `series` has none. It holds one entry for each live dimension that reads an
owner field, and is `{}` when there is none. The entry's figures are what the written file holds, so the site and the method
page can state them from data: `minimum`, `minimum_hidden_cells` and `minimum_hidden_vehicles` (the rule, from
`owner_rule`); `months` (months in the slice); `cells_hidden_first_rule` and `cells_hidden_second_rule` (rows with a null `n`,
by the rule that hid them); `vehicles_in_hidden_cells` (what those rows held, which is also each such month's total less its
visible cells, summed); `months_not_broken_down` and `vehicles_in_months_not_broken_down` (months that are one reserved
row, and their vehicles). The figures in the example above are placeholders for the shape. The read-back check compares the
file's months, hidden rows and reserved rows with these figures.

Every dataset entry carries `latest_month`: the month the dataset's own snapshot ends at (the register's
snapshot month for a register dataset). A dataset built from a supplied source has the same keys plus
`supplied`: `{ "source": "nzta_dashboard", "months": { "first": "2021-01", "last": "2026-10", "count": 70 },
"taken": ["2026-11-14"], "replaced": [ <the ledger's replaced list> ] }`, where `taken` lists the distinct days
the files were taken. A supplied dataset with no store is `{ "definition": ..., "not_built": "<reason>" }`.

A dataset built from a source of kind `series` (`registrations_cars_long_run`) has `definition`, `rows` (the sum of
its months' totals), `months`, `latest_month`, `live_dimensions`, `not_live`, `live_pairs` (empty),
`not_live_pairs` (empty), `facts` (null), `associations` (null) and these, where the register's datasets have the unmapped, coverage and
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

## Stock datasets (D-135)

Every other dataset counts first registrations: its months are months of first registration, and a vehicle is counted in the
month it was first registered. A *stock* counts the other thing: every vehicle in the register at the snapshot, as at the
snapshot date, whatever its type, its import status or the date it was first registered. It is marked `"stock": true` in its
entry in `config/pipeline.json`. It has one period, the snapshot's month, and its files carry no vehicle's own month or year
of first registration, as a column or as a value. It exists for fields that describe the vehicle as it is now (the data map's
`stock_only`, below), which a count by month of first registration would misread as what the vehicle was when it arrived.

How a stock passes through the build:

- **Scope and period.** A stock names no scope flag (`require` is empty): `dims` holds every row of the register, and each
  row's period is the snapshot's month. The code that groups counts by period then gives one period, and the manifest says
  `months` 1 and `latest_month` the snapshot's. `rows` is the register's whole row count.
- **Dimensions.** A stock lists the dimensions it is offered (`dimensions`), and only those are built for it; every other
  dimension is `not_live` for it with the reason. It is also given `not_by`, a list of fields of `config/pipeline.json`
  (today the year and the month of first registration): the build aborts, before it reads anything, if a dimension it is
  offered reads one of them.
- **Fields that describe the vehicle now.** `config/data_map.json` marks such a field `stock_only: true`. A dimension that
  reads one is built for a stock dataset and for no other, from the data map and not from the dimension's name: its
  `applies_to` must name only stock datasets (the build aborts if it names none, or any that is not a stock), no other
  dataset may list it in `dimensions`, `pairs` or `facts` (the build aborts), and even if `applies_to` were widened,
  `derive.applicable` leaves it `not_live` in every dataset that is not a stock.
- **No mild hybrid split.** A stock has no `mild_hybrid_identification_coverage` block: that figure is judged on the months of
  first registration of the hybrids in a window.
- **Counts that describe months of first registration.** `counts.no_registration_month` and
  `counts.registration_after_snapshot` are 0 by construction for a stock, whose period is not read from the vehicle. The
  `trailing` basis of an unmapped-value guard is the whole fleet, since every row is in the one period.
- **The state and the comparison with the last good build.** `data/state/last_good.json` keeps a stock's total apart from
  the series of months in `month_counts`, because the check that a populous month has not been emptied reads months, and a
  stock's one month changes every build. It keeps `stock_totals.<dataset>`: `{ "snapshot": "2026-10-31", "vehicles": n }`. A
  later build aborts if the stock's vehicles moved by more than `guardrails.max_stock_change` (2%, as the in-scope row count)
  since the last good build. A dataset the last good build does not hold (its first build, or a state written before
  `stock_totals` existed, or a record not in this shape) is not compared: the build warns, saying so, and the next build is
  compared with this one's total.
- **What the build reads back.** The stock's vehicles are the register's rows (an abort if they differ), its counts have the
  one period (an abort if they have another), and every slice and pair file of it has the contract's columns and one month, the
  snapshot's (an abort otherwise).

**The dataset `fleet`** ("Vehicles registered today", D-135) is the one stock today: every vehicle in the register at the
snapshot, of every vehicle type and every import status, counted as at the snapshot date (`docs/METRICS.md`). It is offered
two dimensions and no others: `vehicle_usage`, labelled "Current use" (the register's usage value through
`data/reference/vehicle_usage_map.csv`), and `vehicle_type` (the type NZTA registers the vehicle under, every type rather than
the two of the default scope). Its files are `cube/fleet/vehicle_usage.parquet`, written under the small-cell rule and read back
(*Slices of owner dimensions*); `cube/fleet/vehicle_type.parquet`, which reads no owner field and is written as counted, but for the fuel columns;
and `pairs/fleet/vehicle_usage__vehicle_type.parquet`, written under the rule for a table of two fields (*Pairs with an owner
dimension*). Both slices carry no fuel figure on any row, since the pair stands on them (*Pairs with an owner dimension*). It has
no fact table. Its manifest block has `small_cells` for the usage and `small_cell_pairs` for the pair, no
mild hybrid block, and `facts: null`. `month` in every file is the snapshot's month, the first day, and nothing in any file says
when a vehicle was first registered. A period that cannot be broken down is one reserved row (in the pair, with the reserved
value in both columns), as everywhere. The usage field is recorded for every vehicle and has no form of not recorded; the build
shows `__UNDEFINED__` if a blank ever appears, and aborts on a raw value the reference file does not hold (the unmapped guard,
`abort_on_unmapped`).

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

- A stock dataset's vehicles differ from the last good run's by more than `guardrails.max_stock_change` (2%); a stock
  dataset counts a different number of vehicles than the register holds rows, has more than the one period, or has a slice
  or pair file with a column other than the contract's or a month other than the snapshot's (*Stock datasets*).
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
- Unmapped `nz_assembled`, `nzta_class`, `transmission` or `powertrain_group` above 2% of in-scope rows, on the same two bases (every dimension in
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

Stock datasets, found before anything is read (*Stock datasets*):

- A stock dataset names a source, a non-empty `require`, no `dimensions` list, a pair of a dimension it is not offered, a
  `not_by` that names a field `config/pipeline.json` does not have, or a dimension that reads a field in `not_by`.
- A dimension that reads a field the data map marks `stock_only` has no `applies_to`, names a dataset that is not a stock in it,
  or is listed in the `dimensions`, `pairs` or `facts` of a dataset that is not a stock.

Fact tables, found before anything is read:

- A dataset's `facts` names a dimension that reads an owner field (the data map's owner groups and `derive_reads`, worked out by
  `pipeline/privacy.py`; D-096, D-078). The message names the dataset, the dimension and the owner field, and says to remove the
  dimension from that dataset's `facts`. A data map the build cannot read aborts the same check.
- The same, for a dimension a dataset's `narrow_facts` table lists (*Narrow fact tables*): the message names the table and says to
  remove the dimension from it.

Pairs:

- A dataset's `pairs` in `config/pipeline.json` holds an entry that is not
  two different dimension ids, lists a pair twice in either order, names
  a dimension the dataset cannot derive, or names a dimension whose id
  contains `__` (the separator in a pair file's name).

- A pair with a dimension that reads an owner field, read back from the written file against the written one-field slices,
  breaks the rule for a table of two fields in any period (a visible count under the minimum; a line with fewer than
  `minimum_hidden_cells_per_line` hidden cells or with hidden cells holding too few vehicles or no more than there are of them;
  a line with hidden cells and no visible cell; a value hidden in its slice that has a visible cell; visible counts that do not
  add up to their line's total; a value that is not in its slice; a period either slice does not break down that is not one
  reserved row; a total that is not the slices'; a fuel figure on any row of the pair or of either one-field slice; a hidden
  cell the totals pin to one value, or totals that leave no values), or its periods, hidden rows or reserved rows differ from what the writer meant to write
  (*Pairs with an owner dimension* above).

Owner fields (D-127):

- A slice of a dimension that reads an owner field, read back from the written file, breaks the small-cell rule in any month
  (a visible count under the minimum; too few hidden cells, or hidden cells holding too few vehicles; hidden cells and no visible
  cell in a month; hidden cells holding no more vehicles than there are of them; a reserved row that is not alone or not the
  month's total; a fuel figure on a hidden row; visible counts that do not add up), or its months, hidden rows
  or reserved rows differ from what the writer meant to write.
- `config/data_map.json` is missing, cannot be read the way the build needs, or holds a rule too weak to protect a cell
  (`minimum_count` under 2, fewer than two hidden cells, or fewer hidden vehicles than the minimum, in `second_rule` or in
  `pair_rule`).

Fact table:

- A dataset's `facts` is not a non-empty list of distinct dimension ids, or names a
  dimension the dataset cannot derive.
- The table's counts, read back from `n.parquet`, do not total the dataset's
  vehicles as counted before the dimension lookups are joined on.
- A dataset has `narrow_facts` and no `facts`; `narrow_facts` is not a list of tables; a table has no id, an id that is not lower
  case letters, digits and underscores, or an id another table of the dataset has; a table's `dimensions` is empty, not distinct
  dimension ids, names a dimension the dataset cannot derive or a name the table reserves; a table's counts do not total the
  dataset's vehicles. These are found when the tables are written, after the source is read, like the wide table's.

Published figures (`reconciliation.json`, above):

- `published_figures.csv` or `published_sources.csv` is missing, has a header that is not exactly its columns, has a row that
  breaks a rule above, repeats a figure, names a source or dataset that does not exist, or asks a question the staged files
  cannot answer (a dimension not live, two dimensions no one table holds). The abort names the file, the line, the source, the
  month and the measure. A filter value the files do not hold is not an abort: the row is `not_compared` (`value_not_held`).
- The hard limit: in one month, at least `min_sources` independent sources, and more than half of those compared that month, each
  have at least `source_vehicle_share` of what they published in rows past the hard bound on the same side.

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

- Unmapped make, powertrain, `powertrain_group`, `nz_assembled`, `nzta_class` or `transmission` over the trailing 12 months is above 0.5% of
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
  written without it. It is listed under `facts.not_live`; one listed in a `narrow_facts` table likewise, under
  `facts.narrow.{id}.not_live`.
- `data/snapshots/YYYY-MM.parquet` already exists with different content.
  The first observation is kept.
- The payload exceeds the size budget.
- A supplied dataset was not built because its store is absent.
- A source has figures past their tolerance (`reconciliation: <name>: <k> of <m> compared figures are past their tolerance, in
  <months>; the largest gap is <pct> (<month>)`), one line for each source however many rows. A source has figures that name a
  value the published files do not hold (`reconciliation: <name>: <k> figures name a value the published files do not hold, in
  <months>, so they were not compared`), one line for each source. When every figure of a source does so, or more than half of
  all the figures, one more line says that a label in a reference file may have been renamed (a renamed status or vehicle
  type turns every row that names it into this, and it is a warning, not an abort). Or published figures exist and none could be compared.
- A supplied store ends before the register's snapshot month: the export is missing the months after it.
- A dataset of a source of kind `series` has a dimension whose reference file is missing and was not live
  before: it stays out, and the warning names the file.
- A stock dataset is not in the last good state (its first build, or a state written before `stock_totals` existed): it is not
  compared, and the next build compares with this one's total.
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

With `power_band` and `transmission` (D-128), measured on dry runs of 2026-11-17 on the 2026-10 pull, each against the run before
it, the first against a run of the same code without either: the table is 755,586 rows in 2,284,749 bytes over 19 files; with
`power_band` 776,745 rows (+21,159) in 2,416,943 bytes (+132,194, of which the new file is 100,654 and the 19 files already there
grow by 31,540 because rows split); with `transmission` too 799,057 rows (+22,312) in 2,530,064 bytes (+113,121, the new file
93,637) over 21 files. Together +43,471 rows and +245,315 bytes (+10.7%). The two new 1-D slices are 33,511 and 27,867 bytes. The
whole payload is 5,218,968 bytes (was 4,912,275, +306,693 or +6.2%; +165,705 for the power, +140,988 for the gearbox), 65.2% of
the 8,000,000 byte budget. Mapped back, with the two new columns summed out, the table's 755,586 rows are the same rows as before.
The other 75 files, which are every other slice and pair of this dataset and every file of the other three datasets, are
byte-identical; the 19 fact-table files that were there and the manifest differ.

With `colour` as a slice and a narrow table (D-144), measured on a dry run of 2026-11-18 on the 2026-10 pull (exit 0, 111 staged
files): the `colour` slice is 87,187 bytes, and the narrow table `colour` is 224,388 rows in 353,976 bytes over five files (`n`
179,514, `make` 123,997, `powertrain_group` 23,349, `colour` 16,917, `month` 10,199). The wide table is as it was: 799,057 rows in
2,530,064 bytes over 21 files. The whole payload is 5,759,161 bytes, 72.0% of the 8,000,000 byte budget; 441,163 of those are the
slice and the table together, so without them it would be 5,317,998 (arithmetic, not a separate build). Against the release
`cube-2026-10` (99 files), 98 files are byte-identical and `manifest.json` differs; the files only in the dry run are the associations
files, the fleet's three files, the `colour` slice and the five files of the narrow table, of which only those six are this change.
