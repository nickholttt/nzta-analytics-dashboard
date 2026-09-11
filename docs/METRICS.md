# Metric Definitions

Every figure on the site must trace to a definition here. Each chart's
"how is this calculated" disclosure renders straight from this file.

## Grain

Three grains, never mixed in one series without an explicit label.

- **Flow** — events in a month. True first registrations
  (`registrations_flow`, from the Stats NZ TPT series) and ownership
  changes. Denominator: all events of the same dataset in the same month.
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

## Core measures

| Measure | Definition |
|---|---|
| Count | Number of vehicles matching the filters in the period. |
| Share | Count ÷ count of all vehicles in the same dataset and month. Suppressed when the denominator is under 200. |
| Change on a year ago | (this month − same month last year) ÷ same month last year. Suppressed when the base is under 50. |
| 12-month running total | Sum of the trailing 12 months inclusive of the current month. |

**Share changes are always expressed in percentage points.** 10% to 15% is
+5pp. Enforce in the formatter, not per chart.

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

**Per capita** — registrations per 1,000 residents, using Stats NZ
subnational population estimates. Population is a separate reference file
with its own vintage; label the estimate year on the chart.

## Estimation rules

- Never interpolate a missing month. Render a gap.
- Never extrapolate beyond the latest snapshot.
- Suppress rather than round to zero.
- Any figure the user could mistake for official must carry the basis note:
  *"Registrations recorded by NZTA. Not the same as vehicle sales."*
