# Metric Definitions

Every figure on the site must trace to a definition here. Each chart's
"how is this calculated" disclosure renders straight from this file.

## Grain

Two grains, never mixed in one series without an explicit label.

- **Flow** — events in a month. First registrations, used imports,
  ownership changes. Denominator: all events of the same dataset in the
  same month.
- **Stock** — vehicles registered at month end. Denominator: all vehicles
  in the fleet at that month end.

## Scope

Every dataset counts **in-scope rows only**. A row is in scope when its
vehicle type is `in_scope` in `vehicle_scope.csv` (today: passenger cars
and vans, and goods vans, utes and trucks) and its import status is
`in_scope` in `import_status_map.csv`. Datasets that measure entry to the
fleet also require `counts_as_fleet_entry`. Every guardrail rate (unmapped
makes, unmapped powertrains, row-count movement) is measured on in-scope
rows. Out-of-scope rows stay in the archived snapshot aggregates with their
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

**Mean CO2** — volume-weighted mean of the CO2 field across first
registrations in the month, excluding nulls. Report coverage (% of rows
with a value) alongside; do not publish months with under 70% coverage.

**Mean fleet age** — (snapshot year − vehicle year), volume-weighted, across
the fleet. Report median alongside the mean; the distribution has a long
tail and the mean alone misleads.

**Cohort survival** — of vehicles first registered in year C, the share
still present in the fleet snapshot N years later. Computed by joining
consecutive monthly snapshots on vehicle identity. Vehicles that leave and
return count as present. Publish the censoring rule.

**Per capita** — registrations per 1,000 residents, using Stats NZ
subnational population estimates. Population is a separate reference file
with its own vintage; label the estimate year on the chart.

## Estimation rules

- Never interpolate a missing month. Render a gap.
- Never extrapolate beyond the latest snapshot.
- Suppress rather than round to zero.
- Any figure the user could mistake for official must carry the basis note:
  *"Registrations recorded by NZTA. Not the same as vehicle sales."*
