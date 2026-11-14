# Metric Definitions

Every figure on the site must trace to a definition here. Each chart's
"how is this calculated" disclosure renders straight from this file.

## Grain

Three grains, never mixed in one series without an explicit label.

- **Flow** — events in a month. True first registrations and ownership
  changes. Denominator: all events of the same dataset in the same month.
  Two sources, never mixed in one series: `registrations_flow`, from
  NZTA's registrations dashboard, with make and model, from January 2021
  (below); and Stats NZ's monthly series, totals by vehicle class from
  1961 (`docs/DATA_SOURCES.md` §C; not yet built).
- **Survivors** — `registrations_surviving`: *vehicles first registered in
  month M that are still registered as at the snapshot date.* Render that
  sentence on every chart that uses this dataset or its subsets (`nz_new`,
  `used_imports`). Denominator: all surviving vehicles first registered in
  the same month. Recent months are close to complete; older months shrink
  with every snapshot as vehicles are scrapped. **Never put a survivors
  series and a flow series on the same chart.**
- **Stock** — vehicles registered at month end. Denominator: all vehicles
  in the fleet at that month end.

## Scope

Every dataset counts **in-scope rows only**. A row is in scope when its
vehicle type is `in_scope` in `vehicle_scope.csv` (today: passenger cars
and vans, and goods vans, utes and trucks) and its import status is
`in_scope` in `import_status_map.csv`. Datasets that measure entry to the
fleet also require `counts_as_fleet_entry`. Every guardrail rate (unmapped
makes, unmapped powertrains, row-count movement) is measured on in-scope
rows. The unmapped make and powertrain rates are measured on two bases, and
both must pass: every in-scope row, and in-scope rows first registered in
the trailing 12 months. Out-of-scope rows stay in the archived snapshot aggregates with their
scope flag; they never reach the cube.

## True registrations: `registrations_flow`

*Vehicles first registered in New Zealand in month M, as NZTA's
registrations dashboard held them at its latest monthly update before
the export was taken, including vehicles since removed from the
register.* Render that sentence on every chart that uses this dataset.
Source and method: `docs/DATA_SOURCES.md` §D (D-084). The figures below
were measured on 2026-11-14, from the export taken that day, against
the register as at 31 October 2026 (D-087). NZTA says the dashboard is
"a snapshot of the data at the end of every month", updated at the
start of each month: the export shows that update, not the day it was
taken.

- **What it counts.** Every vehicle of an in-scope type (Scope, above)
  whose import status counts as entry to the fleet: new and used imports.
  The same rule as `registrations_surviving`, so the two can be set side
  by side. January 2021 to October 2026: 1,483,403 vehicles, against
  1,434,392 survivors of the same months in the register.
- **What the history adds.** Over the 70 months and every vehicle type
  and status the dashboard holds 1,883,786 vehicles and the register
  1,801,451: 82,335 more (4.4%). Of those, 80,852 are marked `INACTIVE`
  (since removed, below); the rest are vehicles the dashboard counts as
  still registered and the register does not hold for those months,
  mostly re-registrations. Share no longer in the register, by import
  status: re-registered 14.9%; scratch-built 11.5%; used imports 6.4%;
  new 2.6%. Of the two the dataset counts, used imports lose more.
- **Re-registrations are in the source and not in the dataset.** The
  dashboard includes "a subset of reregistered vehicles" (NZTA's words):
  55,135 vehicles with import status `RE-REG`, and 11,064 `SCRATCH`.
  Neither status counts as entry to the fleet (`import_status_map.csv`),
  so neither is counted here, as neither is in `registrations_surviving`.
  The dashboard holds more re-registered vehicles than the register does
  for the same months (1,918 more among those still registered); where
  the register files them is not known.
- **`Vehicle Status`.** `ACTIVE` behaves as "still on the register" and
  `INACTIVE` as "since removed", as at the dashboard's update. This is
  read from the counts, not taken from NZTA's page, which describes
  inactive vehicles as "registered and registration cancelled in the same
  month". The `ACTIVE` vehicles match the register's survivors in count:
  1,802,934 against 1,801,451 over the 70 months (0.08% apart), and
  between 8 fewer and 65 more in any one month (at most 0.23%). The
  `INACTIVE` share rises with age, from none in the newest month to 9.9%
  for January 2021. The two sources carry no vehicle key, so this is
  agreement of counts, not of vehicles one by one. The dataset counts
  both statuses.
- **Past months can change.** NZTA says vehicles "may be added to or
  removed from the dataset" and a registration month "may be updated".
  Each month here is that month as the export held it. The build must
  carry each export's date in the manifest, and must let a later export
  replace a month only by a deliberate, recorded step
  (`docs/CUBE_SCHEMA.md`, when the dataset is built).
- **The month** is the dashboard's registration month. NZTA's page calls
  it the date of first ownership, which "may differ from" the first
  registration in New Zealand; in count it agrees with the register's
  month of first NZ registration as the `ACTIVE` figures above show.
- **What it cannot break down by.** NZTA's own vehicle type and body
  type are in the export, so passenger vehicles and goods vehicles can
  be told apart. The site's finer `segment` and `segment_group`
  dimensions (cars, utes, vans, trucks; light and heavy) cannot be
  derived: they need gross vehicle mass for the goods vehicles, about
  18% of the in-scope vehicles, and the export has none. It has no
  engine size or fuel consumption either. The owner's district, owner
  type and vehicle usage are in the export and are not published (the
  work order §3).
- **Model names differ from the register's for some nameplates.** The
  dashboard's model is NZTA's cleaned name and splits some nameplates
  the register does not (the two largest since January 2025 are
  `COROLLA CROSS` and `LANDCRUISER PRADO`, which the register holds as
  `COROLLA` and `LANDCRUISER`). Since January 2025, 98.2% of the
  dashboard's vehicles carry a make and model that appear, spelled the
  same, in the register. A model's count here and its survivors in the
  register are therefore not always the same set of vehicles:
  completeness (below) is not shown by model.
- **Never on a chart with survivors.**

## Core measures

| Measure | Definition |
|---|---|
| Count | Number of vehicles matching the filters in the period. |
| Share | Count ÷ count of all vehicles in the same dataset and month. Suppressed by both guards below; the representativeness guard applies to monthly shares only, not 12-month ones. |
| Change on a year ago | (this month − same month last year) ÷ same month last year. Suppressed when the base is under 50. |
| 12-month running total | Sum of the trailing 12 months inclusive of the current month. |

**Share changes are always expressed in percentage points.** 10% to 15% is
+5pp. Enforce in the formatter, not per chart.

### Two suppression guards

A share is suppressed when **either** guard trips. They look similar and
they are not redundant. Anyone tempted to collapse them into one should
read this section first.

**The precision floor — denominator under 200.** Below this the month has
too few vehicles for a percentage to mean anything, and each further
vehicle moves the figure visibly. It is also what covers the sparse early
history: 493 of the 1,195 months in `registrations_surviving` sit under
200, all of them before 1990 (the latest is February 1970).

**The representativeness floor — denominator under a third of the median
of the 12 months before it.** A month can clear the precision floor
comfortably and still describe a different population from the months
either side of it.

The reference case is April 2020, NZ's level-4 lockdown, and it is the
only month in the whole series that collapses this way while clearing
200. Its denominator was 1,542 against a trailing median of 22,108, down
93%. Hyundai Motor Group shows 16.9% in that month against 5.9% over the
12 months before; its monthly share across the 12 months either side
ranges from 4.2% to 9.4%.

**That 16.9% is not noise, and this is the point of the second guard.**
At n = 261 of 1,542 the binomial standard error is 0.95pp, so the reading
sits about eleven standard errors above normal. Precision was never the
problem. The problem is that the ~7% of registrations that happened under
a level-4 lockdown were not a small random sample of a normal month:

| | April 2020 | 12 months before | 12 months after |
|---|---|---|---|
| NZ New | 63.6% | 54.3% | 55.1% |
| Trucks | 6.8% | 2.5% | 2.5% |
| Vans | 6.2% | 4.5% | 4.3% |

Baselines are each window's combined share (vehicles of that kind over all
vehicles), the 12 months before being the guard's own window. More trucks,
more vans, more NZ-new: not the mix of a normal month. Every percentage in
that month is precisely measured and describes a population no reader is
asking about. A precision guard cannot see this, because there is nothing
imprecise about it; only a guard that compares the month against its own
recent history can.

The fraction is not finely tuned. Among the 702 months that clear the
precision floor (every one has the full 12 months before it), every
threshold from 0.2 to 0.5 selects only April 2020, so the choice is
insensitive. In those months the next-lowest ratio after April 2020's
0.07 is 0.55 (November 1985), and the 1st percentile is 0.67, so 0.33
sits well clear of ordinary seasonal variation. Across all months, sparse
early ones included, the guard on its own trips more often (12 months at
0.33) and the 1st percentile is 0.29, but every one of those months is
under 200, so the precision floor already suppresses it. Both figures live in
`config/measures.json` and are applied in the browser, so neither needs a
rebuild to change.

Figures in this section were measured on the cube at the 2026-08-31
snapshot. They are survivors counts, so they drift slightly as vehicles
leave the register.

## Derived measures

**Top-5 share** — combined share of the five largest values of a dimension
in that month. Membership is recomputed monthly, so the line reflects
concentration rather than the fortunes of a fixed five.

**Median import age** — median of (first NZ registration year − vehicle
year) across **used imports only**, over the trailing 12 months. Whole
years; never a decimal. NZ-new vehicles are excluded: their age at
registration is 0 by construction from 2007 (MODEL_AND_AGE.md §1), so
including them would restate the new/used mix rather than measure age.

**Mean fuel consumption** — mean combined fuel consumption (L/100km)
across vehicles with a combustion engine (`has_combustion_engine` in
`powertrain_map.csv`), excluding missing, unparseable and out-of-range
values (above 60 L/100km). Coverage is vehicles with a valid value ÷
vehicles with an engine; do not publish months with under 70% coverage.
Vehicles without an engine are outside both numerator and denominator, so
the figure describes vehicles that burn fuel and the chart says so; a
rising EV share neither drags it towards zero nor suppresses it. The
register has no CO2 field, and CO2 is never estimated from fuel
consumption: the conversion depends on the fuel and would be our
assumption presented as data.

**Mild hybrid identification coverage** — every vehicle NZTA records under
a hybrid code (`powertrain_group = Hybrid` in `powertrain_map.csv`) is
*identified mild* (a `mild` row in `mild_hybrid_models.csv`, or no row and a
code that maps to Mild hybrid), *identified full* (a `full` row), or
*unknown* (an `unresolved` row, or no row and a code that maps to Hybrid).
Coverage = identified mild ÷ (identified mild + unknown), over all months
and over the trailing 12 months. It is a lower bound on the share of mild
hybrids identified, because it counts every unknown hybrid as a missed mild
hybrid. Identified full hybrids are left out of the denominator: dividing by
every hybrid would measure the mild share of hybrids, not coverage, and the
manifest publishes that separately. While the lower of the two coverage
figures is under `complete_at_coverage` in `config/pipeline.json`, the Mild
hybrid category is labelled *Mild hybrid (identified)* and states its
coverage.

Coverage is published twice, so its dependence on judgement calls is
visible: at stated confidence (every classification row counts) and at high
confidence only (medium- and low-confidence `mild` rows count as unknown;
vehicles identified by the code mapping alone count at both levels). At the
2026-08 snapshot, all-time coverage is 83.0% at stated confidence but 62.8%
at high confidence only, because 13,808 Honda IMA hybrids are classified
at medium confidence. Over the trailing 12 months it is 84.1% and 79.5%.
The headline charts use the trailing figures, and both hold above 70%:
that is what makes the mild hybrid split publishable. All-time mild hybrid
history rests on the Honda IMA call and should be read that way. A trailing
high-confidence figure below `warn_below_trailing_high_confidence_coverage`
(70%) is a build warning. Subaru e-Boxer and XV Hybrid (about 5,700
vehicles) stay unresolved because sources disagree on them: never classify
a contested nameplate to raise coverage.

**Mean fleet age** — (snapshot year − vehicle year), volume-weighted, across
the fleet. Report median alongside the mean; the distribution has a long
tail and the mean alone misleads.

**Cohort survival** — of vehicles first registered in month or year C, the
share still registered at a later snapshot: survivors(C, t) ÷
survivors(C, t₀), where t₀ is the first snapshot in which the cohort was
observed. Computed from the archived `registrations_surviving` aggregates
in `data/snapshots/`, not by joining vehicles: the register carries no
stable vehicle identity, so a vehicle that leaves and returns cannot be
told apart from one that stayed. Scrappage in a period is the fall in a
cohort's survivors between consecutive snapshots. Survival relative to the
*original* registration count needs `registrations_flow` as the base.
Every survival figure states its base and its first observed snapshot.

**Completeness** — for a month, the survivors still on the register
(`registrations_surviving`) ÷ the vehicles registered in that month
(`registrations_flow`), in total, by import status (new, used) and by
NZTA's vehicle type for the types in scope, from January 2021. Both
sides are the datasets as built, so it covers the in-scope types only.
It says how much of what was registered the register can still show.
It is a figure and a chart of its own, placed beside a survivors chart
of older months; it is never drawn on that chart, and it is **never
used to scale a figure**: a brand or model count scaled up by it would
be an estimate presented as data (Estimation rules). A cell can pass
100% where the register holds a few more vehicles than the dashboard
(four in-scope cells of month, type and status do, the largest by 8
vehicles); it is shown as it is, not capped. Measured on the 2026-10
snapshot for in-scope fleet entries, by year of first registration:
2021 93.3%; 2022 95.1%; 2023 96.7%; 2024 97.8%; 2025 98.9%; 2026 99.8%.
Across every vehicle type and status, outside the dataset's scope, the
share steps up between October and November 2023 (95.7% to 97.3%),
most of it in trailers (91.1% to 98.3%); within the dataset's scope
those two months are 97.0% and 97.4%. The cause is not known and no
reason is given on the site. Not shown by model (above), and before
2021 only for cars, from Stats NZ's series, once that is built.

**Per capita** — registrations per 1,000 residents, using Stats NZ
subnational population estimates. Population is a separate reference file
with its own vintage; label the estimate year on the chart.

## Estimation rules

- Never interpolate a missing month. Render a gap.
- Never extrapolate beyond the latest snapshot.
- Suppress rather than round to zero.
- Any figure the user could mistake for official must carry the basis note:
  *"Registrations recorded by NZTA. Not the same as vehicle sales."*
