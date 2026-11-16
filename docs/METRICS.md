# Metric Definitions

Every figure on the site must trace to a definition here. Each chart's
"how is this calculated" disclosure renders straight from this file.

## Grain

Three grains, never mixed in one series without an explicit label.

- **Flow** — events in a month. True first registrations and ownership
  changes. Denominator: all events of the same dataset in the same month.
  Two sources, never mixed in one series: `registrations_flow`, from
  NZTA's registrations dashboard, with make and model, from January 2021
  (below); and `registrations_cars_long_run`, from Stats NZ's monthly
  series, cars only, from January 1961 (below).
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
`in_scope` in `import_status_map.csv`. (`vehicle_scope.csv` also has a `trade_scope` column: the types the
trade's total of new vehicles counts, which adds buses, motor caravans and special purpose vehicles to the two
in scope, D-105 and D-106. No dataset is built on it yet.) Datasets that measure entry to the
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

## Set beside published figures (measured 2026-11-16, D-105)

No figure is adjusted to match another source. This section records how far
true registrations (`registrations_flow`) sit from figures published
elsewhere, and what is known about why. Our figures were recomputed on
2026-11-16 from the dashboard counts (the export of 14 November 2026). The
MIA's October 2026 figures were read from its own page that day. Its earlier
figures are as quoted in AutoTalk's reports of MIA releases (autotalk.co.nz,
read that day): an indirect source, and the MIA restates months.

**New vehicles, by month and year.** "Default scope" is passenger cars and
vans plus goods vans, utes and trucks. "Plus three types" adds buses, motor
caravans and special purpose vehicles.

| Period | Published | Ours, default scope | Ours, plus three types |
|---|---|---|---|
| March 2021 | 15,498 | 15,042 (-2.9%) | 15,301 (-1.3%) |
| August 2022 | 14,690 | 14,353 (-2.3%) | 14,568 (-0.8%) |
| June 2023 | 23,560 | 23,182 (-1.6%) | 23,399 (-0.7%) |
| June 2024 | 9,423 | 9,171 (-2.7%) | 9,379 (-0.5%) |
| October 2024 | 12,568 (the sum of AutoTalk's passenger and commercial figures; its page was not re-read) | 12,082 (-3.9%) | 12,515 (-0.4%) |
| October 2025 | 14,218 (as restated) | 13,777 (-3.1%) | 14,191 (-0.2%) |
| March 2026 | 14,908 | 14,617 (-2.0%) | 14,872 (-0.2%) |
| October 2026 | 15,118 | 14,904 (-1.4%) | 15,109 (-0.06%) |
| 2021 | 165,287 | 161,198 (-2.5%) | 163,796 (-0.9%) |
| 2024 | 128,776 | 124,887 (-3.0%) | 128,392 (-0.3%) |
| 2025 | 137,853 | 134,435 (-2.5%) | 137,604 (-0.2%) |

**October 2026 by the MIA's segments.** Light passenger including SUVs:
11,833 against our 11,824 new passenger cars and vans. Light commercial 2,805
plus heavy commercial 480 is 3,285; our new goods vehicles are 3,080, and
with 71 buses, 129 motor caravans and 5 special purpose vehicles, 3,285. We
cannot split light from heavy commercial on this dataset (the export has no
gross vehicle mass), nor SUVs from cars.

**Used imports** (passenger cars and vans; published by AutoTalk from NZTA's
data): 2021, 121,884 against our 119,996 (-1.5%); 2022, 110,757 against
109,606 (-1.0%); October 2026, 8,285 against 8,285.

**Against Stats NZ's cars** (`registrations_cars_long_run`): our passenger
cars and vans, new and used, are 98.75% of Stats NZ's count for 2021, 98.98%
for 2022, 99.25% for 2023, 99.50% for 2024, 99.72% for 2025 and 99.79% for
January to September 2026.

What is established, and what is not:

- **Scope.** The three extra types account for most of the gap against the
  MIA's total in every month compared, and in October 2026 for all of the
  commercial gap. No definition of the MIA's was read: what is established
  is that the counts meet once the three types are added. Motorcycles are in
  neither total.
- **Older months sit lower.** Against the MIA, AutoTalk and Stats NZ alike,
  the gap that scope does not explain is 0.4% or less for 2025 and 2026,
  up to 0.5% for 2024, and about 1% for 2021 and 2022. Published figures
  are as first reported or as restated; ours are as the dashboard holds them
  at the latest export, and NZTA says past months can change (above). Month
  by month from 2021, the gap against Stats NZ moves with the share of a
  month's vehicles marked `INACTIVE` (correlation 0.95 over the 69 months to
  September 2026; both also grow with a month's age, so this shows no
  cause). What the missing vehicles are is **not established**.
- **Re-registrations are not the whole of it.** Adding every
  re-registration would overshoot the MIA's 2021 total by about 1,800
  vehicles (3,275 on the wider scope). Whether some of them are counted by
  the MIA or Stats NZ is not established. Dropping `INACTIVE` vehicles would
  widen the gap.
- **Likely, not established:** AutoTalk's 2025 total of battery electric
  vehicles is 7,706 against our 7,483; with the three extra types ours is
  7,686, 203 of them buses. Its plug-in hybrids are 6,885 against our 7,052;
  ours without 190 range-extended electric vehicles is 6,862.
- **Not explained:** one used-import figure for October 2025 published on
  the month's last day (7,381 against our 6,999).
- **Not compared:** the Ministry of Transport's fleet statistics and the
  MIA's brand and model lists could not be read (the first refuses automated
  readers, the second is for members). AutoTalk's top ten brands and models
  for October 2026 equal ours in rank and count.

## Long-run car registrations: `registrations_cars_long_run`

*Cars and station wagons registered in New Zealand for the first time in
month M, new and ex-overseas, as Stats NZ publishes them from NZTA's
records.* Render that sentence on every chart that uses this dataset,
with Stats NZ's statement beside NZTA's attribution: "This work is based
on/includes Stats NZ's data which are licensed by Stats NZ for reuse
under the Creative Commons Attribution 4.0 International licence."
Source and method: `docs/DATA_SOURCES.md` §C (D-065, D-094). Measured on
2026-11-15 from the series as exported on 14 November 2026.

- **What it counts.** Stats NZ's count of cars and station wagons first
  registered each month, vehicles since scrapped included: 9,050,400 over
  789 months, January 1961 to September 2026. It is Stats NZ's class,
  "cars and station wagons", not NZTA's "passenger car/van": the two
  were checked against each other for 2026 only (D-065).
- **New or ex-overseas, from July 1975.** Stats NZ's cars total includes
  the cars registered overseas before. New cars are the total less the
  ex-overseas series. The split starts in July 1975; for the 174 months
  before it (971,960 cars) the month's cars are "not recorded" on that
  breakdown, never guessed. The two values carry the names "new or used"
  uses on the other datasets, so they can be set side by side.
- **Engine size, in Stats NZ's seven bands, from July 1975.** Not the
  site's own engine-size bands. In two months the published bands do not
  add up to the published total: May 1976, one car short, which is shown
  as "not recorded"; and July 1975, one car over, where the bands are
  shown as published and the manifest names the month.
- **It runs behind the register.** On the one month observed, Stats NZ
  published about two weeks after NZTA's service had it, so the series'
  newest month is usually a month behind the register's (an estimate).
  The build says which month is missing and never fills it.
- **Revisions.** Whether Stats NZ revises past months is not known. A
  later export that changes a past month is refused unless the change is
  accepted deliberately, and then it is recorded.
- **Cars only.** The series also counts commercial vehicles, buses,
  motorcycles and tractors. They are kept and not built into a dataset:
  Stats NZ's classes are not lined up with NZTA's vehicle types (D-065).
- **No fact table.** Origin and engine size are published separately, so
  no figure exists for the two crossed, and none is invented.
- **Never on a chart with survivors.** Cars still registered as a share
  of this count, new and ex-overseas, from July 1975, is a chart of its
  own (Derived measures, below).
- **On the site (D-098).** Explore draws the monthly count of cars as a
  line from the first month, with Stats NZ's statement beside NZTA's
  basis note, and the split into new and ex-overseas as one line each.
  Months before the split starts are left blank, marked by a grey band
  and named in a sentence, never drawn as zero. The site reads each
  dimension's `exceeds_total` from the manifest and says each month it
  lists (none for new or ex-overseas; July 1975 for the engine bands),
  with the parts as published and the total unadjusted. Where a cube
  has no entry for the dataset, the group says so in place of the
  charts.

## Core measures

| Measure | Definition |
|---|---|
| Count | Number of vehicles matching the filters in the period. |
| Share | Count ÷ count of all vehicles in the same dataset and month **that the view counts**. With no condition that is every vehicle of the dataset in the month. With a condition (a chart's own filter, or a condition on Build) it is the vehicles the condition keeps, and the page says so: "Only vehicles where ... are counted". A share inside a condition is therefore a share of the narrowed set, never of the whole month. Greyed or suppressed by the two guards below, place by place as "What a tripped guard does" says; the representativeness guard applies to monthly shares only, not to 12-month ones. |
| Change on a year ago | (this month − same month last year) ÷ same month last year. Withheld (the page says the earlier month has too few vehicles) when the earlier count is under 50, and not given when the earlier month is not in the data. |
| 12-month running total | Sum of the trailing 12 months inclusive of the current month. A window missing any of its months has no total: the line breaks. |

**The last 12 months and the 12 months before** are counted back from each
dataset's own newest month (`latest_month` in the manifest), not from the
snapshot or the calendar. The last 12 months are that month and the 11 before
it; the 12 months before are the 12 months ending 12 months before that
newest month. A dataset whose newest month is earlier than the register's (the
Stats NZ series) has windows that end earlier. A ranking that ends in another
month counts back from that month in the same way, and its year before is the
same months a year earlier.

**Share changes are always expressed in percentage points.** 10% to 15% is
+5pp. Enforce in the formatter, not per chart.

### Ranking and ties (D-107)

A ranking orders the values of one dimension by their count in one window: a single month, or the 12 months ending in a
month. Reserved values take no place: every value the cube writes between double underscores (not recorded, no reference
match, beyond the cap, and any other the cube reserves). A value with no vehicles in the window is not ranked.

- **Equal counts share a rank**, the rank of the first of them: 1, 2, 2, 4 (the usual competition ranking). The next rank
  after a tie skips the places the tie used.
- **Equal counts are listed in alphabetical order of the name a reader sees** (for a model, the make and model as words).
  Two values that show the same name are ordered by their raw key. The order never depends on the order the data arrives in.
- **A move** is the rank a year before minus the rank now, both shared ranks. Entries tied now move together unless they were
  not tied then.
- **The rank a year before** is the rank in the same months a year earlier, ranked by the same rule.
- **Whether there is a year-before comparison** is decided by the dataset's own months, not by which months a narrowed view
  has rows for. The earlier window must lie wholly inside the months the dataset covers: from its first month (the start of
  its supplied file, or otherwise the earliest month in which it has vehicles, read from the data the view loads) to its
  newest. Every month after the first, with or without rows, is inside the dataset. If it does not, the
  ranking has no rank a year before, no move, no change in share and no change on a year ago, and says so; none of the four
  is shown. If it does, all four are shown, and a month in which a condition keeps no vehicles, which has no rows, counts as a
  month of zero vehicles. An entry with no vehicles in the earlier window has no rank then and reads as new; its change on a
  year ago is withheld where the earlier count is under the measure's floor, as for any entry. Where the earlier window
  holds no vehicles at all in what is counted, no entry has a share then (a share of no vehicles has no value), so no change
  in share is shown for any entry; where it holds some, an entry absent then had a share of zero.
- **A list cut at a number of places** (the top 10, 15 or 25, or a chart that names its largest values) is cut after the
  sorting above, so a tie that straddles the cut shows the alphabetically first of the tied entries. A sentence under the
  table says how many more entries share the last rank shown, when there are any.
- **Top-5 share** is the combined count of the five largest values over the month's denominator (the narrowed set's, under a condition). Which of several tied
  values is the fifth cannot change that sum; it can change which names the readout lists, and those follow the same order.
- Where the site orders something by size without showing a rank (a chart's lines and their colours, the key under it, the
  order of labels at the end of the lines, the map's table, the names the top-5 readout lists), equal counts are ordered
  alphabetically by the name shown, with the raw key last. These are orders, not ranks: no rank is shown and a tie is not
  marked. On a chart that keeps only its largest values, a tie at the cut takes the alphabetically first value.

### Two suppression guards

A share is greyed or suppressed (below) when **either** guard trips. They
look similar and they are not redundant. Anyone tempted to collapse them into
one should read this section first. The site greys a figure rather than
dropping or zeroing it: the first version of the charts did so on 2026-09-12
(D-014, commit d788e41: "the share guard greys months under 200 vehicles
rather than dropping or zeroing them"), the guards themselves are D-015, and
D-031 put the same words on `/method` ("Greyed, not zeroed").

Both guards test the share's own denominator. On a plain slice that is the
dataset's whole month. A pair slice carries the same whole-month
denominator on every row (D-047), so a view narrowed through a pair, such as
the powertrain mix of light passenger vehicles only, takes its denominator
as the sum of `n` over the kept values of the other dimension, month by
month, and both guards are tested on that filtered base. The precision floor
is then the filtered month's vehicles under 200, and the representativeness
floor is the filtered month against the median of the filtered base over the
12 months before it. A filtered chart can therefore suppress a month the
unfiltered chart draws.

### What a tripped guard does

Two different things happen, and the words keep them apart. A figure is
**greyed** when it is still drawn or printed, in grey and with the reason. A
figure is **suppressed** when the word "suppressed" is printed in its place.
Nothing is ever drawn or printed as zero because a guard tripped. This is what
the code does, place by place; where it differs from the decisions above it is
listed in the decision record D-107.

| Place | Precision floor (under the minimum vehicles) | Representativeness floor |
|---|---|---|
| A share over time, month by month, or as a share of the last 12 months: the line, and the top-5 share line | The month is **greyed**. The coloured line is not drawn through it. A thin grey line carries the figure and a shaded band marks a run of greyed months. The test is on the denominator behind the drawn figure: the month's own, or the 12 months' total for a 12-month share. | Tested on the month's own denominator, for **monthly** shares only. A 12-month share is not tested. Greyed in the same way. |
| The reading shown on hover over a point, on any chart | The figure and the vehicles behind it are printed, then "Greyed: fewer than N vehicles behind this figure". | The figure and vehicles, then "Greyed: far fewer vehicles than the months before, so it may not describe a normal month". If both trip, the precision reason is the one given. |
| The table of figures under the top-5 share line | Every month with a figure is listed with its share and its vehicles, and a Note column carries the grey reason. The figure is **printed**. | The same. |
| The key under a chart of shares over time (the last 12 months, and the change on the 12 months before) | The 12-month share is **suppressed** if that window's vehicles are under the floor. The change is suppressed if either window is. | Not tested: a window is not a month. |
| A bar chart by band, and the map (a share over one period) | Tested on the whole period's vehicles. If under the floor, every bar or region is **greyed**, the hover reading carries the reason, the line above the chart says "greyed: under N", and the table of figures prints the share as **suppressed** (the count is printed). | Not tested. |
| A ranking | **Neither guard is applied.** A ranking's shares, its change in share and its moves are always printed, whatever the base. | Not applied. |
| An answer sentence, or the reading on a count | These are counts, not shares, and carry neither guard. The change on a year ago is the only withheld figure: under 50 vehicles in the earlier month it is not given and the sentence says there are too few vehicles to compare with. | None. |
| A count, or a 12-month running total | A count carries no share guard. | None. |

A condition (a chart's own filter, or a Build condition) changes what the
denominator is, not what the guards do: both are tested on the narrowed set, as
the first paragraph of this section says. A filtered chart can therefore grey a
month the unfiltered chart draws.

**The precision floor — denominator under 200.** Below this the month has
too few vehicles for a percentage to mean anything, and each further
vehicle moves the figure visibly. It is also what covers the sparse early
history: 493 of the 1,195 months in `registrations_surviving` sit under
200, all of them before 1990 (the latest is February 1970).

**The representativeness floor — denominator under a third of the median
of the 12 months before it.** A month can clear the precision floor
comfortably and still describe a different population from the months
either side of it. The median is of the 12 calendar months immediately before
the month. If any of those 12 months is not in the data, or the month is one
of a dataset's first 12, there is nothing to compare against and the guard
does not fire; it never fires by default. It does not fire either when that
median is zero.

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
The headline charts use the trailing figures. A dataset publishes the
mild hybrid split only while its own trailing coverage at high confidence
is at or above `publish_split_at_trailing_high_confidence_coverage` in
`config/pipeline.json` (70%). The comparison is made on the whole counts
behind the figure, not on the figure rounded to four decimals that the manifest
shows: 139,999 of 200,000 reads 0.7 and is under 70%, so it withholds. Under
it the dataset shows its mild hybrids as Hybrid, undivided, in every slice, pair and fact table, the manifest
says `mild_split_published: false` beside the figure, and the build adds a
warning; the other dataset is judged on its own figure. On the 2026-10
snapshot both are above it (79.3% and 79.2%, after the rows below), so both
publish the split. A figure below `warn_below_trailing_high_confidence_coverage` (70%, the
same today) is a build warning for a dataset that still publishes. A dataset
that crosses the threshold between one build and the next changes its whole
history of the two values at once, so that build adds a warning naming the
direction and both figures (`CUBE_SCHEMA.md`, Warnings; the margin on true
registrations is 14,271 of 18,011 hybrids at high confidence on 2026-10). All-time mild hybrid
history rests on the Honda IMA call and should be read that way. Subaru e-Boxer and XV Hybrid (about 5,700
vehicles) stay unresolved because sources disagree on them: never classify
a contested nameplate to raise coverage.

The file is keyed on the make and model as the dataset spells them, so a
nameplate the register and the dashboard spell differently needs a row for
each spelling. Measured on the 2026-10 snapshot, the hybrids that matched no
row were 177 of the register's 91,264 in the last 12 months and 4,832 of
true registrations' 91,614; 4,650 of those were Toyota's Corolla Cross,
which the dashboard names and the register records as COROLLA.
Seven rows were added for full hybrids (nine nameplates: Corolla Cross, Prius c
and v, Niro Plus, Staria and Staria Load, ES, H7 and X55), which moves no
powertrain line, and one for the Mercedes-Benz C 200 as mild, at medium
confidence. Trailing coverage, stated and at high confidence, went
from 83.0% and 78.9% to 83.5% and 79.3% on the register, and from 66.0%
and 62.7% to 83.5% and 79.2% on true registrations. All-time, from 80.4%
and 61.6% to 83.1% and 63.6%, and from 72.2% and 59.7% to 83.0% and 68.5%.
The nameplates still matching no row number six or fewer each over the last
12 months; the rows the file marks unresolved hold another 2,894 hybrids on
the register and 2,905 on true registrations over the same months.

**Named models** — the model dimension names the 300 models with the most
vehicles in the trailing 12 months and groups every other model as
`__OTHER__`, in every month (`CUBE_SCHEMA.md`, Model dimension). Where models
tie at the last place, the one whose `MAKE|MODEL` key sorts first in byte
order is named. On the 2026-10 snapshot that decided one place on
`registrations_flow` (two models with 75 vehicles) and none on
`registrations_surviving`. A model outside the 300 is not missing: its
vehicles are in `__OTHER__` and in every total.

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
vehicles); it is shown as it is, not capped. By vehicle type the
survivors come from the pair of new or used with NZTA's vehicle type,
and the registrations from the true-registrations fact table (D-095).
Measured on the 2026-10 snapshot for in-scope fleet entries, by year of
first registration: 2021 93.3%; 2022 95.1%; 2023 96.7%; 2024 97.8%;
2025 98.9%; 2026 99.8%. By type and new or used, for January 2021:
passenger new 97.8%, passenger used 85.5%, goods new 97.6%, goods used
94.7%; for June 2023: 98.7%, 94.7%, 98.7% and 97.6%.
Across every vehicle type and status, outside the dataset's scope, the
share steps up between October and November 2023 (95.7% to 97.3%),
most of it in trailers (91.1% to 98.3%); within the dataset's scope
those two months are 97.0% and 97.4%. The cause is not known and no
reason is given on the site. Not shown by model (above). On the site (D-098) there are two
charts: the total with new and used, and the four lines of vehicle type
crossed with new or used, with the total for orientation. The second
divides the survivors' pair slice by the true-registrations fact table;
a line's month is left out where fewer than the precision floor's
registrations are behind it.

**Cars still registered against Stats NZ's count** — before 2021 there
are no true registrations by vehicle, so for cars the survivors of
NZTA's passenger type, new and used, are set against Stats NZ's count
of cars registered that month, new and ex-overseas
(`registrations_cars_long_run`), from July 1975. It is a ratio of two
sources that name their classes differently (NZTA's "passenger
car/van", Stats NZ's "cars and station wagons"), compared with each
other for 2026 only: for August 2026 NZTA's true registrations of the
passenger type are 99.88% of Stats NZ's cars. So it is shown under its
own name, with that caveat in one line, and not called completeness.
Measured on the 2026-10 snapshot, survivors as a share of Stats NZ's
count, new then ex-overseas: March 1976, 3.9% and 0.3%; March 1990,
5.7% and 2.3%; March 2005, 49.8% and 15.9%; March 2015, 90.5% and
61.6%; August 2026, 99.8% and 99.6%. Never used to scale a figure.
(March 2005's used-import figure is 2,107 survivors over 13,211 cars,
15.949%; an earlier version of this section gave 16.0%, a rounding slip.)
On the site (D-098) it is drawn from July 1975, the first month the
denominator is split by new or ex-overseas, with a one-line caveat and a
link to `/method`; its total line is the survivors of the passenger type
over Stats NZ's whole count of cars. A month left out (under the
precision floor, collapsed against its own recent history, or not split)
breaks the line; a month standing alone between gaps is drawn as a dot.
The ex-overseas line reaches 27.8% in April 1986 (77 survivors over 277
cars counted by Stats NZ), well above its neighbours, and is high
through 1986 and 1987 and low again by 1989: it is drawn as it is. It is
not a survival rate: that feature does not look like cars surviving, and
a line can move with how each source classes a car.

**Per capita** — registrations per 1,000 residents, using Stats NZ
subnational population estimates. Population is a separate reference file
with its own vintage; label the estimate year on the chart.

## Values in edge cases

- **A goods vehicle with a gross mass of zero reads "Not recorded" on the
  segment dimension.** The register records 0 where the mass was not captured
  (`sentinels.csv`), which the pipeline treats as no value. The segment
  reference has ranges of mass for goods vehicles, so a goods vehicle of a body
  type that has them and no mass is "Not recorded", not "No reference match".
  Passenger vehicles ignore mass.
- **A model whose make has no match in the brand reference keeps the raw make
  in its key.** The model's key is the canonical make, a separator and the
  model; where there is no canonical make, the make as the register records it
  stands in its place. Such a model is therefore listed under the make as
  recorded, while the brand dimension shows "No reference match" for the same
  vehicle. A vehicle with no make or no model has the model "Not recorded".

## Estimation rules

- Never interpolate a missing month. Render a gap.
- Never extrapolate beyond the latest snapshot.
- Grey or suppress rather than round to zero: a figure under a guard is never
  drawn or printed as 0 (`What a tripped guard does`, above).
- Any figure the user could mistake for official must carry the basis note:
  *"Registrations recorded by NZTA. Not the same as vehicle sales."*
