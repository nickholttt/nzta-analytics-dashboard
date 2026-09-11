# Vehicle Age and Model Introductions

Two related questions: *are people buying new or old?* and *when did each
model arrive?* Neither is answerable straight from an NZTA field. Both are
derivable. This doc specifies how.

---

## 1. The field trap

There is no model year in the Motor Vehicle Register.

| What you might assume | What the field actually is |
|---|---|
| `vehicle_year` = model year | Not model year. For NZ-new vehicles first registered from 2007 it is the **NZ registration year**. For used imports it is a calendar year from the vehicle's life overseas. Before 2007 it is a mix. See below. |
| `country_of_origin` = brand nationality | Where the vehicle was principally manufactured |
| `submodel` = a model variant you can group on | Free text |

### What the data shows

NZTA publishes two definitions. Its field description page says "year of
manufacture or model year – if unknown, year of first registration". Other
NZTA guidance says that from January 2007 it is the year of first
registration in NZ or overseas. Tested against the register (in-scope rows,
2026-08 snapshot), the second is right from 2007 onward.

**NZ-new from 2007: it is the registration year.** `vehicle_year` equals
the first NZ registration year on all but 504 of 2.21 million rows. Under a
manufacture-year reading, January registrations would include last year's
stock; under a model-year reading, late-year registrations would include
next year's models. Neither appears.

**It is not model year.** On NZ-new vehicles since 2015 whose VIN position
10 decodes to a model year one ahead of the registration year (103,566
rows), `vehicle_year` equals the registration year on 99.9% and the VIN
model year on 0.1%.

**Before 2007 it is a mix, in more than one regime.** These figures
describe vehicles still registered today, not everything registered then.

| First registered | NZ-new rows where `vehicle_year` ≠ registration year |
|---|---|
| 1990–1995 | 6–23%, a year earlier |
| 1996–2000 | under 0.1% |
| 2001–2006 | 0.5–2% a year earlier; plus a year *later* on 4.5% in 2005 and 1.3% in 2006 |
| 2007 onward | under 0.1% |

Across 1990–2006 the mismatches follow the calendar: 14% of January
registrations carry the previous year (manufacture-year behaviour) and 9%
of December registrations carry the next year (model-year behaviour).

**Used imports show no break at 2007.** Their age distribution is
continuous across the boundary. `vehicle_year` behaves as a calendar year
fixed by an event overseas: for Japanese used imports since 2015, mean age
at registration falls from 9.7 years for January registrations to 8.9 for
December ones, which is what a fixed overseas year plus a steady import
delay produces. Year granularity cannot separate manufacture year from
Japanese first-registration year, because for a domestic Japanese car they
are usually the same year. NZ's WoF rules take age from first registration
in Japan, and border eligibility cutoffs appear in the data as cliffs
between adjacent vehicle years (§3), so treat it as the year those rules
use.

### What follows

- For NZ-new vehicles, age at first NZ registration is **0 by
  construction** from 2007. It cannot show run-out or ex-demonstrator
  stock. It is correct, but carries no information for that channel.
- For used imports, `vehicle_year` is informative and AFNZR is the import
  age.
- The 2007 break marker is warranted, but only on series that include
  NZ-new vehicles, and it marks the last of several regime changes rather
  than the only one.

So do not build "registration year vs model year". Build this instead.

---

## 2. Age at First NZ Registration (AFNZR)

```
afnzr_months = months_between(registration_month, jan(vehicle_year))
afnzr_years  = registration_year - vehicle_year
```

- NZ-new: 0 from 2007, by construction (§1)
- Used import: the import age

For used imports this is the import age, the one age figure a registration
dataset measures well. Add it as a dimension (`age_at_registration_band`)
and as a derived measure (`median_import_age`).

It does not answer new-vs-old by itself. Because NZ-new age is 0 by
construction, any age figure taken across all registrations (a share aged
0–1, a median across both channels) moves only when the new/used mix
moves, which the `import_status` dimension already shows. **Every age
measure is scoped to used imports.**

### Bands

`0` · `1` · `2` · … · `19` · `20-24` · `25+` · `unknown`

Single years from 0 to 19. The moving cutoff and the odd-age bumps in §3
are each one vehicle year wide, and most arrivals sit at 9–13, so any
band wider than a year hides the finding. Never band coarsely here.

### Measures worth deriving

| Measure | Definition |
|---|---|
| Median import age | Median AFNZR across used imports in the month, 12-month rolling |
| Regional import age | Median import age by region, compared with the national median. Which regions buy the oldest second-hand vehicles. |
| Powertrain import age | Median import age by powertrain: whether used EVs arrive older or younger than used petrol cars |

---

## 3. What the used-import age distribution shows

Every figure here is observed: used imports in scope, still registered at
the 2026-08 snapshot, by year of first NZ registration.

### Imports arrive aged 9 to 13

New Zealand's used imports are far older on arrival than the "3 to 8
years" often quoted as the ideal import age. Since 2016 the median age at
first NZ registration has been 9 or 10, vehicles aged 9–13 have been
45–64% of arrivals every year, and the most common single age has been 9
or 11. Ages 3 and 4 are each 1–3% of arrivals. The distribution has aged
over time.

| First NZ registration | Median age | Aged 9–13 | Aged 20+ |
|---|---|---|---|
| 2010 | 7 | 29% | 3.3% |
| 2013 | 7 | 24% | 2.3% |
| 2016 | 9 | 61% | 2.4% |
| 2019 | 10 | 59% | 2.5% |
| 2022 | 9 | 46% | 3.3% |
| 2025 | 10 | 64% | 1.1% |
| 2026 (Jan–Aug) | 10 | 59% | 1.4% |

This is the age finding to lead with. It bears directly on how old the
fleet is, which a chart of NZ-new registrations cannot show.

### The moving cutoff

Border eligibility rules show up as a cliff between two adjacent vehicle
years. Since the Japanese emissions-code requirement for vehicles
border-inspected from 30 April 2024 (`events.csv:japan-emissions-code-2024`),
the oldest vehicle year arriving in volume, below 20 years old, has been
**2012**.

- Before the rule took effect, Japanese arrivals of vehicle year 2011 were
  a third to a quarter as many as vehicle year 2012 (a 3–5× step).
- In May–July 2024 the step narrowed to about 2×, as vehicle year 2011
  briefly rose to 5% of Japanese arrivals: vehicles inspected before the
  deadline and registered after it.
- From August 2024 the step widened every month, passed 10× in January
  2025, and exceeded 100× by mid-2026 (vehicle year 2012: 6.8% of July
  2026 Japanese arrivals; vehicle year 2011: 0.05%).

The closed band is fixed in vehicle year, so the cutoff's **vehicle year
stays at 2012 while its age rises by one each year**: 13 in 2025, 14 in
2026. On an age histogram over time the cliff migrates rightward. That is
the `age-distribution-moving-hole` preset. The pipeline detects the cutoff
every run and publishes `moving_cutoff_vehicle_year` and
`moving_cutoff_age`; the detection rule and its thresholds live in
`config/pipeline.json`. A changed vehicle year means the rule or the data
changed. So does an age that fails to rise when the snapshot year does.

An earlier cliff of the same kind sat at vehicle year 2004 for 2013–2019
registrations (2000 for 2011–2012), and none is detectable for 2020–2024.
No event explains it yet. Add one before annotating it.

If the reported exception for vehicles over 20 years old holds, the closed
band should shrink from its old end by one vehicle year a year. That is a
hypothesis and is not yet visible in the data.

### Above 20: a small bump, not a drop

In years with a cutoff in force, the ages just below 20 are almost empty
and ages 20–23 are slightly fuller. In 2016, ages 13–19 are each 0.1% of
arrivals or less while ages 20–22 are 0.3–0.5% each; in 2019, ages 16–19
are 0.0% and ages 20–22 are 0.2–0.5%. A reported exception for vehicles
over 20 years old is a candidate explanation, not a verified one.

### Odd-age bumps: a hypothesis only

Inside the 9–13 cluster, odd ages are often fuller than their even
neighbours. In 2019, ages 9 and 11 hold 14.4% and 15.8% of arrivals against
10.1% at 10 and 10.8% at 12; in 2025, age 11 holds 19.1% against 10.5% at
10 and 12.2% at 12. Japan's shaken inspection falls due three years after
first registration and every two years after that, so vehicles sold out of
Japan at inspection time would arrive at odd ages. Treat that as a
candidate explanation for these residual bumps and nothing more. It does
not explain why arrivals centre on 9–13, and no chart should say it does.

---

## 4. Model introduction dates: derive, never curate

A hand-maintained registry of every nameplate's launch date across ~90
brands is hundreds of rows that go stale immediately. It fails design
invariant #4 in `CLAUDE.md` (no per-month human curation). Derive it.

### Derivation

For each `(make, model)`:

```
nz_new_launch     = first month where count(import_status = 'NZ New')     >= 5
used_first_seen   = first month where count(import_status = 'Used Import') >= 5
nameplate_retired = last  month where count(any) >= 5, if >= 12 months ago
```

The threshold of 5 filters parallel imports, one-offs and typos. Tune it
against a nameplate you can verify by hand before trusting it.

### The measure this unlocks: pipeline lag

```
pipeline_lag = used_first_seen - nz_new_launch
```

How many years after a model goes on sale new here does it start arriving
as a used import. Untested: do not describe an expected lag until it has
been measured. Compare lag across brands and segments: a short lag means
the model is being cycled out of Japan fast; a long one means it's being
held.

Nobody publishes this. It is computable from data you already have.

### Generation changes

Harder, and not worth hand-curating either. Detect **candidates**
automatically within a nameplate:

- step change in mean fuel consumption
- step change in mean power (kW) — note this is only recorded for NZ-new
- churn in the MVMA/MIA model code — also only recorded for NZ-new
- a gap of 3+ months in NZ-new registrations followed by resumption
  (the changeover pause)

Flag candidates, then hand-confirm **only the top ~50 nameplates by
volume**. Everything else stays a candidate and is not rendered.

The run-out spike before a changeover is itself a consumer-behaviour
finding worth charting.

### `model_registry.csv` is for exceptions only

Overrides where derivation is known to fail: renames (a nameplate that
changed name without changing generation), badge-engineered twins,
nameplates that returned after a long absence, and sub-brands the register
records as models (`make_promotion`: MODEL = ORA under MAKE = GWM becomes
make ORA). Keep it under 50 rows. If it grows past that, the derivation
needs fixing, not the registry.

What the pipeline applies today: `alias` and `rename` map a recorded model
name to `model_canonical`; `make_promotion` moves the vehicle to the make
in `override_value` before any brand attribute is looked up.
`badge_twin`, `distinct_nameplate` and `retired` only matter to launch and
retirement detection above, and are not applied yet.

---

## 5. Caveats to render on any age chart

- **NZ-new before 2007.** `vehicle_year` mixes manufacture year, model
  year and registration year for NZ-new vehicles first registered before
  2007 (§1). Render a break marker at January 2007 on any age series that
  includes NZ-new vehicles; do not let a trend line cross it unannotated.
  A used-imports-only age chart needs no marker: that channel has no
  discontinuity.
- **NZ-new age is zero by construction** from 2007, which is why every age
  measure is scoped to used imports (§2). Never publish an age figure that
  combines both channels.
- **Year granularity.** `vehicle_year` is a year, not a date, so AFNZR has
  up to ±1 year of error, and mean age drifts by almost a year across the
  calendar (January registrations look older than December ones). Compare
  like months or use 12-month rolling figures. Do not report a median to
  one decimal.
- **Edge cases go to `unknown`, and each is counted.** A missing
  `vehicle_year`, a `vehicle_year` of 0 and a negative AFNZR each fall to
  the `unknown` band, and each count is published separately in the
  manifest. "Zero" here means a `vehicle_year` of 0; an *age* of 0 is the
  `0` band. At the 2026-08 snapshot, in scope: no missing or zero
  `vehicle_year`; 3,800 negative ages (3,197 of them NZ-new vehicles
  registered in 2005–2006, 504 NZ-new since 2007, 13 used imports). A
  further 172 in-scope rows have no first-registration month at all; they
  cannot be placed in any month, are excluded from monthly slices, and are
  counted in the manifest too.
- **Survivors, not registrations.** Every figure describes vehicles still
  registered at the snapshot. Older cohorts are thinned by scrappage, which
  need not be age-neutral.
- Age at registration is not age of the vehicle when purchased second-hand
  domestically. It only describes vehicles entering the fleet.
- An ownership change is not a purchase of a *new* vehicle. Keep the two
  datasets separate on any chart making a new-vs-old claim.
