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
between adjacent vehicle years (2025 registrations: 12.4% aged 13, 0.5%
aged 14), so treat it as the year those rules use.

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

- NZ-new: ≈ 0
- Used import: the import age

This single derived column answers the new-vs-old question cleanly, and it
is the one measure where the flow grain beats every alternative. Add it as
a dimension (`age_at_registration_band`) and as a derived measure
(`median_import_age`).

### Bands

`0` · `1` · `2` · `3` · `4` · `5` · `6-7` · `8-9` · `10-12` · `13-15`
· `16-19` · `20+` · `unknown`

Single years to 5 and 20+ as its own band, because that's where the
structure lives (see §3). Never band coarsely here — coarse banding
destroys the finding.

### Measures worth deriving

| Measure | Definition |
|---|---|
| Median import age | Median AFNZR across used imports in the month, 12-month rolling |
| Genuinely-new share | Share of first registrations with AFNZR ≤ 1 |
| Freshness | Median AFNZR across **all** first registrations |
| Regional freshness gap | Median AFNZR by region, compared with the national median |
| Powertrain age gap | Median AFNZR by powertrain — used EVs arriving older than used petrol is a real and separate story |

---

## 3. Why the age distribution has structure (and what to look for)

The used import age histogram is not smooth, and the reasons are
mechanical. If your chart is a smooth curve, your derivation is wrong.

**The shaken clock.** Japan's mandatory inspection falls due 3 years after
first registration, then every 2 years. Renewal is expensive enough that
many owners sell rather than pay, which is exactly why Japan's export
market is so large — the inspection rotates cars out of the domestic fleet
at predictable ages. Japan's weight tax also steps up at 13 years and again
at 18. **Expect peaks at 3, 5, 7, 9, 11 and 13 years.**

**The NZ buying window.** Importers target roughly 3–8 years old.
Expect the mass of the distribution to sit there.

**The 20-year cliff.** Vehicles over 20 years face additional compliance
under the Older Vehicles rule. Expect a sharp drop at 20, then a small tail
of enthusiast imports beyond it.

**The moving hole.** From 30 April 2024 the required Japanese emissions
code effectively closed the channel for a band of roughly 2006–2012
vehicles (see `events.csv:japan-emissions-code-2024`). That band is fixed
in *vehicle year* but its *age* increases every year. So on an
age-distribution-over-time chart it renders as a gap that **migrates
rightward** — a hole moving through the histogram year by year. This is
probably the single most striking chart available from this dataset and
nothing public shows it. Build it.

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
as a used import. Driven by the shaken clock, so expect a mode around 3–5
years. Compare lag across brands and segments: a short lag means the model
is being cycled out of Japan fast; a long one means it's being held.

Nobody publishes this. It is computable from data you already have.

### Generation changes

Harder, and not worth hand-curating either. Detect **candidates**
automatically within a nameplate:

- step change in mean CO2 or mean fuel consumption
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
changed name without changing generation), badge-engineered twins, and
nameplates that returned after a long absence. Keep it under 50 rows. If
it grows past that, the derivation needs fixing, not the registry.

---

## 5. One field worth testing before you rely on it

`VIN first 11` is in the register. Under the North American VIN standard,
position 10 encodes model year. Many manufacturers apply it globally, but
**JDM domestic vehicles generally use chassis codes rather than 17-character
VINs**, so this will not work for the used import channel — which is
precisely the channel where you'd most want a true model year.

Test it on the NZ-new subset only. If position 10 decodes cleanly there,
you get a genuine model year for NZ-new vehicles and can compute a real
model-year-vs-registration-year figure for that subset. Do not assume it
works; verify against a nameplate with a known generation change, and if
coverage is under 90% of NZ-new rows, drop the idea and stay with AFNZR.

---

## 6. Caveats to render on any age chart

- **NZ-new before 2007.** `vehicle_year` mixes manufacture year, model
  year and registration year for NZ-new vehicles first registered before
  2007 (§1). Render a break marker at January 2007 on any age series that
  includes NZ-new vehicles; do not let a trend line cross it unannotated.
  A used-imports-only age chart needs no marker: that channel has no
  discontinuity.
- **NZ-new age is zero by construction** from 2007. A genuinely-new share
  or freshness figure that combines both channels moves only because the
  NZ-new/used mix moves, never because NZ-new vehicles arrived older. Say
  so wherever the two are combined.
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
