# Metric Definitions

Every figure on the site must trace to a definition here. Each chart's
"how is this calculated" disclosure renders straight from this file.

## Grain

Three grains, never mixed in one series without an explicit label.

- **Flow** — events in a month. True first registrations and ownership
  changes. Denominator: all events of the same dataset in the same month.
  Two sources, never mixed in one series: `new_registrations`, from
  NZTA's registrations dashboard, with make and model, from January 2021
  (below); and `registrations_cars_long_run`, from Stats NZ's
  monthly series, cars only, from January 1961 (below).
- **Survivors** — `registrations_surviving`: *vehicles first registered in
  month M that are still registered as at the snapshot date.* Render that
  sentence on every chart that uses this dataset or its subsets (`nz_new`,
  `used_imports`). Denominator: all surviving vehicles first registered in
  the same month. Recent months are close to complete; older months shrink
  with every snapshot as vehicles are scrapped. **Never put a survivors
  series and a flow series on the same chart.**
- **Stock** — vehicles registered at month end. Denominator: all vehicles
  in the fleet at that month end. The dataset `fleet` (below, D-135) is the one built: the register as at its snapshot date,
  with one period.

## Scope

Every dataset counts **in-scope rows only**, and a dataset names which of two scopes it counts (D-113, D-157, D-158). A row is in a
scope when its vehicle type is marked in `vehicle_scope.csv` and its import status is `in_scope` in `import_status_map.csv`.
The **default scope** is the `in_scope` column: passenger cars and vans, and goods vans, utes and trucks.
The **trade scope** is the `trade_scope` column: those two and buses, motor caravans and special purpose vehicles (with
them added, our counts of new vehicles come within 0.06% of the published total for October 2026 and within 1.3% for the other
periods compared: the table under "Set beside published figures", D-105 and D-106). `registrations_surviving` (since D-157) and
`new_registrations` (since D-158) count the trade scope, because the published split into light and heavy commercial holds buses, motor
caravans and special purpose vehicles. The default scope is no longer a dataset: it is what a question narrowed to its two vehicle types
counts (the Registered as filter, the `vehicle_type` field), and the column stays because the guardrails' row-count check reads it. Datasets that measure entry to the
fleet also require `counts_as_fleet_entry`. The unmapped-value guardrail rates are measured on the rows of the dataset's own
scope (the table `dims`); the row-count movement check is measured on the default scope's rows (`in_scope`), whichever scope a
dataset counts, so a change of one dataset's scope does not move it (D-157). The unmapped make and powertrain rates are measured on two bases, and
both must pass: every in-scope row, and in-scope rows first registered in
the trailing 12 months. Out-of-scope rows stay in the archived snapshot aggregates with their
scope flag; they never reach the cube.

## New registrations: `new_registrations`

*New registrations* is one dataset (D-158, the owner's order of 2026-11-25): every vehicle first registered in a month, new and used, of the
five vehicle types of the trade scope, with vehicle type a filter. It replaces two datasets built from the same store, `registrations_flow`
(the default scope's two types, D-084) and `registrations_flow_wider` (the five types, D-106, D-113), which are retired: nothing writes their
ids, and an older link, a saved canvas or a Build link that names one opens as this dataset (`retired_datasets` in `config/dimensions.json`).
A link to `registrations_flow` opens narrowed to passenger cars and vans and goods vans, trucks and utes, the types that dataset counted, so it
draws the same figures; a link to `registrations_flow_wider` draws this dataset as it is. The visitor's name for it was "True registrations"
and "True registrations, wider scope". The measurements below were made while the two types were their own dataset and are kept as made, under
the old names where they say so; the pipeline test `test_new_registrations.py` holds that this dataset narrowed to the two types equals what the
narrower dataset counted, in every dimension and month of the test history, and D-158 holds it on the real pull.

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
  The same import-status rule and the same five vehicle types as `registrations_surviving` (since D-157), so the two can be set side
  by side in full. January 2021 to October 2026: 1,483,403 vehicles of the two types of the default scope (1,506,467 of the five),
  against 1,434,392 survivors of the same two types in the register.
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

### The five vehicle types, and passenger or commercial

*Vehicles first registered in New Zealand in month M, as NZTA's registrations
dashboard held them at its latest monthly update before the export was taken,
including vehicles since removed from the register, new and used, of five
vehicle types.* Render that sentence, or the visitor's wording
in `config/dimensions.json`, on every chart that uses this dataset (D-106,
D-113, D-158).

- **What it is.** One dataset, read from the committed store through the
  same code as the register, with the same rule for which import statuses
  count (new and used imports, not re-registrations or scratch-built
  vehicles). It counts the vehicle types `vehicle_scope.csv` marks in its
  `trade_scope` column: passenger cars and vans, goods vans, trucks and
  utes, buses, motor caravans and special purpose vehicles. The name says
  what it counts and claims nothing about any organisation's definition.
  D-105 found that, counted this way, new vehicles come within 0.06% of the
  Motor Industry Association's published total for October 2026 and within
  1.3% for the other periods compared (below); that is a measured comparison
  of counts, not a definition of the MIA's, which was not read.
- **New and used alike.** The dataset holds both statuses. A count of new
  vehicles is this dataset with `import_status` kept to `NZ New`; the
  dataset itself is not a count of new vehicles.
- **Narrowing to fewer types.** A source that counts fewer types is set beside this dataset with a
  `vehicle_type` condition (the published-figures rows of the passenger and goods totals do), and a visitor
  does the same with Registered as under Filters. Until D-158 the narrower scope was a dataset of its own; it
  answered "how many passenger and goods vehicles were registered", and its figures were never added to the
  wider dataset's, which counted the same vehicles twice. With one dataset there is nothing to add twice.
  **Never on a chart with survivors**, except the one ratio of the two, completeness (below), which divides the
  survivors by this dataset: both count the same five vehicle types. The exception is a flag on that measure
  (`ratio_of_clashing_datasets`, `config/measures.json`), not a list of datasets; any other chart or ratio that
  reads both is invalid.
- **Passenger or commercial.** Its extra dimension, `trade_group`, sorts the
  vehicles by NZTA's registered type: passenger cars and vans are
  `Passenger`; every other type it counts is `Commercial` (goods vehicles,
  buses, motor caravans, special purpose vehicles). It follows
  `vehicle_scope.csv`'s `trade_group` column. A ute registered as a
  passenger vehicle is a passenger vehicle here; light and heavy commercial
  cannot be told apart (the export has no gross vehicle mass).
- **Dimensions.** Every field the dashboard carries for the five types, and `trade_group`. `segment`, `segment_group`,
  `engine_size_band`, `region` and the vehicle-age band need fields the
  dashboard lacks and are not live.
- **Where it is on the site (D-118, D-158).** The canvas offers it as "New registrations" under
  Counting, with every field its fact table carries as a condition and `trade_group` ("passenger or commercial") as a
  breakdown. Explore's New registrations group draws it: the monthly count of new and used vehicles, the count and the
  share Passenger and Commercial take for new vehicles only (`import_status` = `NZ New`), the leading brands and models, the
  powertrain mix, and completeness. All count the five types; the figures that counted two are the same
  question narrowed to them.
- **Guards.** The store's months, rows and totals against its ledger, a month whose store
  total moved by more than 2% without a recorded replacement, an emptied
  month, the unmapped make and powertrain rates, the mild hybrid split judged on this dataset's own hybrids, and the
  model cap with its tie rule. A guard of another dataset reads its own rows
  and does not change when this one does. The last good state holds nothing under this name, so
  for the first build the dataset is compared with the records of `registrations_flow_wider`, which counted the same five types
  (`continues` in `config/pipeline.json`, D-158); later builds compare with its own.

### Coverage of the lookups on the added types (measured 2026-11-17, D-113)

Buses, motor caravans and special purpose vehicles bring makes the brand registry was not built for. Measured on the
committed dashboard counts as built for the 2026-10 snapshot, by the pipeline's own code, over the trailing 12 months
(2025-11 to 2026-10) and all time, new and used apart. "No reference match" is the reserved value for a recorded make
with no row in `brand_registry.csv`; it carries to the manufacturer group, the brand owner's country and the brand's
original country with it.

| Vehicles | Trailing 12 months, new | Trailing, used | All time, new | All time, used |
|---|---|---|---|---|
| Added types, before | 309 of 2,982 (10.36%) | 6 of 774 (0.78%) | 1,078 of 16,767 (6.43%) | 59 of 6,297 (0.94%) |
| Added types, after seven rows | 76 (2.55%) | 5 (0.65%) | 371 (2.21%) | 49 (0.78%) |
| The wider dataset, before | 504 of 150,122 (0.34%) | 96 of 95,066 (0.10%) | 2,052 of 868,898 (0.24%) | 838 of 637,569 (0.13%) |
| The wider dataset, after | 271 (0.18%) | 95 (0.10%) | 1,345 (0.15%) | 828 (0.13%) |
| The default scope (unchanged) | 195 of 147,140 (0.13%) | 90 of 94,292 (0.10%) | 974 of 852,131 (0.11%) | 779 of 631,272 (0.12%) |

The build's own guard counts every in-scope row the dataset holds, including re-registrations (the table `dims`, as for
`registrations_flow`): over the trailing 12 months 631 unmapped makes of 245,435 (0.26%) before the rows and 397
(0.16%) after, against `registrations_flow`'s 316 of 241,678 (0.13%); over all rows 3,094 of 1,515,274 (0.20%) before
and 2,376 (0.16%) after. The warning level is 0.5% and the abort level 2%, as for every dataset.

The makes with no row, on the added types alone, all time, before the rows, with their vehicles (31 makes, all
listed): CRRC 487, FACTORY BUILT 306, YUTONG 79, ZHONGTONG 58, LIEBHERR 52, BCI 27, ALEXANDER DENNIS 21, ELDDIS 15,
GROVE 14, TEREX 13, YANGTSE MOTOR GROUP 12, TADANO 8, KING LONG 6, MARCOPOLO 5, SANY 4, SHACMAN 4, TIDD 4, OSHKOSH 3,
CAMPERVAN 2, DAIMLER 2, GLOBAL BUS VENTURES 2, HIGER 2, KATO 2, WRIGHTBUS 2, DEMAG 1, PETERBUILT 1, SINOTRUK 1,
SUNLONG 1, VAUXHALL 1, WESTERN STAR 1, ZEMTEC 1.

- **What was added.** One row each for the seven makes that carry 10 or more vehicles of the added types all time, or
  4 or more in the trailing 12 months, and whose parent group and owner's country a public source settles: CRRC,
  YUTONG, ZHONGTONG, LIEBHERR, ALEXANDER DENNIS, ELDDIS and MARCOPOLO, each with its sources and the date read in its own row
  (`as_at`, `notes`). Four makes met the volume rule and were **left unmatched** because the sources read did not settle
  the parent group or the owner's country: BCI (27; no page names an owner), GROVE (14) and TEREX (13; the owner is
  settled but not where the brand began), YANGTSE MOTOR GROUP (12; no owner named). FACTORY BUILT (306) is a description,
  not a brand. The seven rows match 717 of the 1,137 unmatched vehicles of the added types, and no vehicle of
  `registrations_flow`: its files and manifest entry are unchanged by them. They do move two vehicles of
  `registrations_surviving`, which then held only passenger and goods vehicles (it counts the added types as well since D-157), of two of the makes: one first registered in
  December 2017 moves from no reference match to ELDDIS (Thor Industries, United States, United Kingdom), and one
  first registered in February 2013 to ALEXANDER DENNIS (NFI Group, Canada, United Kingdom). Its brand, manufacturer
  group, brand owner's country and brand's original country slices change in those two months and no other cell
  does; its guard's unmapped makes fall from 33,016 to 33,014 of the same 4,634,954 rows.
- **Powertrain.** Every motive power of the added types has a row in `powertrain_map.csv`; none is unmapped.
- **Hybrids.** The added types hold 33 vehicles recorded under a hybrid code all time and 1 in the trailing window. All
  but one have a row in `mild_hybrid_models.csv` (a Hino, model 500, has none). The wider dataset's trailing figures are
  the default scope's to the vehicle but one: 91,615 source hybrids against 91,614, identified at stated confidence
  91.88%, and at high confidence 14,327 of 17,864 (80.20%) under D-110's count, so its mild split is published (the
  level is 70%). 2,603 more unidentified hybrids in the window would withhold it, as for `registrations_flow`. All
  time the high-confidence figure is 46,158 of 67,888 (68.0%). (Measured again on 2026-11-17 with D-119's Subaru rows; with D-115's rows
  as corrected in review it was 85.31%, 14,327 of 18,257 (78.47%), room for 2,210, and 46,158 of 68,281 all time; D-113
  measured 83.45%, 14,271 of 19,286 and 46,102 of 71,434 before them.)
- **Anything else.** Vehicle age at registration (the band's unknown), model (not recorded) and powertrain show no rate on
  the added types unlike the default scope's; the country built in is not recorded for 7 of the 16,767 new vehicles
  of the added types all time, as for 7 of 852,131 in the default scope.
- **Which dimensions are live.** All eleven the dashboard can carry: powertrain, brand, manufacturer group, brand
  owner's country, brand's original country, country built in, registered as, passenger or commercial, new or used,
  age when first registered and model. A dimension is live when its unmapped rate over the dataset's rows is at most 2%
  (`max_unmapped_rate`); the largest is 0.16% (the brand's, and what rolls up from it). The eight that are not live:
  the car, ute, van and truck split (`segment`), vehicle class, region and engine size need fields the dashboard lacks (gross vehicle mass, district,
  engine size), as for `registrations_flow`; vehicle age on the snapshot date, imported from and the two Stats NZ
  dimensions apply to other datasets.

## Set beside published figures (measured 2026-11-16, D-105)

No figure is adjusted to match another source. This section records how far
new registrations (`new_registrations`, `registrations_flow` before D-158) sit from figures published
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

**The same figures from the built dataset (D-113).** The "plus three types" column above was computed from the
dashboard counts. The table below is read from the built `registrations_flow_wider` (its fact table, `import_status`
kept to `NZ New`, summed by month), on the 2026-10 snapshot's build. Every figure equals the column above to the vehicle.

| Period | Published | The built dataset, new vehicles | Difference |
|---|---|---|---|
| March 2021 | 15,498 | 15,301 | -197 (-1.3%) |
| August 2022 | 14,690 | 14,568 | -122 (-0.8%) |
| June 2023 | 23,560 | 23,399 | -161 (-0.7%) |
| June 2024 | 9,423 | 9,379 | -44 (-0.5%) |
| October 2024 | 12,568 | 12,515 | -53 (-0.4%) |
| October 2025 | 14,218 | 14,191 | -27 (-0.2%) |
| March 2026 | 14,908 | 14,872 | -36 (-0.2%) |
| October 2026 | 15,118 | 15,109 | -9 (-0.06%) |
| 2021 | 165,287 | 163,796 | -1,491 (-0.9%) |
| 2024 | 128,776 | 128,392 | -384 (-0.3%) |
| 2025 | 137,853 | 137,604 | -249 (-0.2%) |

October 2026, new vehicles by `trade_group`: Passenger 11,824 against the MIA's light passenger 11,833 (-9);
Commercial 3,285 against its light and heavy commercial 3,285 (2,805 plus 480). The dataset cannot split light
from heavy commercial. Its used imports in October 2026 are 8,726 of every counted type, 8,285 of them
passenger and 441 commercial; the 8,285 is the figure AutoTalk published for passenger cars and vans.

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
  is how close the counts come once the three types are added (the table
  above). Motorcycles are in neither total.
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
- **A second published source, compared on 2026-11-17 (the lead's check; D-118).**
  The Motor Trade Association's vstat site (vstat.mta.org.nz), which says it is
  built from NZTA data, shows for October 2026 the same count of new passenger
  cars and vans as true registrations here (11,824) and the same top ten new
  models. It shows one hybrid figure, where this site shows mild hybrids as a
  line of their own. Its hybrid figure for new passenger cars and vans in
  October 2026, 4,978, equals this site's hybrid line and mild hybrid line
  together (4,472 and 506, recomputed from the fact table on 2026-11-17). Only
  that vehicle type and month were compared. The comparison is of counts; no
  definition of the MTA's was read.
- **Hybrids as one group, beside published figures (D-124, read 2026-11-17).** On true
  registrations, new passenger cars and vans in October 2026 are 11,824, of which the
  group "Hybrid, full or mild" holds 4,978 (42.10%): 4,472 Hybrid and 506 Mild hybrid,
  recomputed from the fact table's column files outside the pipeline, the share being of
  all 11,824. Auto Trader New Zealand's list of October's top sellers (published
  1 November 2026, https://autotrader.co.nz/news/top-sellers-for-october-what-cars-are-kiwis-buying,
  which credits NZTA registration data) gives 11,824 new passenger registrations, "petrol
  hybrids" at 4,859 and 41.1%, and plug-in hybrids, counted separately, at 1,477 (this site:
  1,477). Ours is 119 higher. The page calls its figure "petrol hybrids" among new passenger
  vehicles; this site's group holds petrol and diesel hybrids, full and mild. Whether the
  page's figure includes mild or diesel hybrids is not stated, so the bases differ and the
  119 is not explained here. One measured fact, which does not establish the cause: of the
  506 Mild hybrid vehicles in that month's count, 119 are one diesel nameplate (Toyota Land
  Cruiser Prado), the same number as the difference. The Motor Industry Association's
  release for October, as reported by DRIVEN Car Guide on 4 November 2026
  (https://www.drivencarguide.co.nz/news/new-zealand-new-vehicle-sales-october-rentals-drive-sales-evs-up-194-year-on-year/),
  gives passenger registrations of 11,833, battery electric 1,481 (this site: 1,481) and
  plug-in hybrids 1,445 (this site: 1,477), and no hybrid total in the text read; the MIA's
  own page was not found, and the bases differ (scope; whether plug-ins sit in a hybrid
  figure; the figures are as a trade-press article reports them). Nothing here is adjusted
  to match.
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

## Vehicles registered today: `fleet` (D-135)

*Every vehicle on NZTA's Motor Vehicle Register at the snapshot date, of every vehicle type and every import status.*
Render that sentence on every chart that uses this dataset. It is a **stock**, counted as at the snapshot date, and not a
series of first registrations:

- It has **one period**, the snapshot's month. A new build counts the register again; it does not add a month. Its figure for
  a build is not comparable with another build's as a series, only as two stocks (the build compares a stock with the last
  good build's total, `docs/CUBE_SCHEMA.md`, *Stock datasets*).
- It counts **every row of the register**: trailers and caravans, motorcycles, mopeds, tractors, buses, machines and every
  other vehicle type, whatever its import status (including re-registrations and home-built vehicles), and the vehicles whose
  first registration month is not recorded. The datasets above count only the vehicle types and import statuses their scope
  names, and only vehicles with a month of first registration; this one is not a subset of them and they are not subsets of it.
- It is **never broken down by the month or year of first registration**, in any file. The fields it is built for describe the
  vehicle as it is now (the register records the latest value, not the value at first registration), and a count of them by the
  month a vehicle arrived would read as what the vehicle was then. The build refuses a dimension of this dataset that reads
  either field, and its files hold one month, the snapshot's (`not_by` in `config/pipeline.json`).
- Its dimensions are the ones `config/pipeline.json` lists for it: `vehicle_usage`, which reads the register's vehicle usage,
  labelled "Current use" (the register's own words for each value, `vehicle_usage_map.csv`), and `vehicle_type`, the type
  NZTA registers the vehicle under. The usage is an owner field (`config/data_map.json`, `VEHICLE_USAGE`), so its tables are
  published only under the small-cell rule and the rule for a table of two fields (`docs/CUBE_SCHEMA.md`). For rental the
  register's usage is shown to be the latest recorded, not the usage at first registration; for the other values this has not
  been tested (`docs/DATA_MAP.md`), so a figure by usage says what the register records now and no more.
- The denominator of a share is the whole fleet in the period. A share of a hidden cell is not computed (D-130).

## Core measures

| Measure | Definition |
|---|---|
| Count | Number of vehicles matching the filters in the period. |
| Share | Count ÷ count of all vehicles in the same dataset and month **that the view counts**. With no condition that is every vehicle of the dataset in the month. With a condition (a chart's own filter, or a condition on Build) it is the vehicles the condition keeps, and the page says so: "Only vehicles where ... are counted". A share inside a condition is therefore a share of the narrowed set, never of the whole month. A share of no vehicles has no value: it is blank, never 0% (see "Months in which nothing is counted", below). Greyed or suppressed by the two guards below, place by place as "What a tripped guard does" says; the representativeness guard applies to monthly shares only, not to 12-month ones. |
| Change on a year ago | (this month − same month last year) ÷ same month last year. Withheld (the page says the earlier month has too few vehicles) when the earlier count is under 50, and not given when the earlier month is not in the data. |
| 12-month running total | Sum of the trailing 12 months inclusive of the current month. A month inside the dataset's months in which nothing is counted reads zero ("Months in which nothing is counted", below). A window with a month outside them, or one the source does not record, has no total: the line breaks. |

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

### Months in which nothing is counted (D-109)

A view can keep no vehicles in a month: a chart's own filter, or a Build condition, that nothing in that month meets. Such a month
has **no rows** in what the page loads. Whether it is a month of zero vehicles or a month the data lacks depends on where it lies:

- **Inside the dataset's own months it is a month of zero vehicles**, never a missing month. The dataset's months run from its
  first month (the start of its supplied file, or otherwise the earliest month in which it has vehicles, read from the data the
  view loads: `datasetFirstMonth`, `loadFirstMonth`) to its newest (`latest_month` in the manifest). Every month after the first,
  with or without rows, is inside. Where the first month is not known, nothing is taken to be inside.
- **Outside them it is missing**: a month before the dataset's first month. A figure that needs it has no value.
- **A share of no vehicles has no value.** Where a whole window holds no vehicles in what is counted, the share is blank. It is
  never drawn or printed as 0%.

Every figure that sums a window over rows a condition can thin out reads that rule, and nothing else decides it. A window that
holds vehicles but fewer than the floor is still greyed by the precision floor, with the zero months in its total.

| Figure | Reads |
|---|---|
| A share over time drawn as a 12-month share (the line, its hover, and the peak that decides which lines take a colour) | Months with no rows inside the dataset count as zero in the window. Blank where the window reaches outside the dataset's months, or holds no vehicles. |
| The precision floor on that share | The window's vehicles, zero months included. A window under the floor, one that holds none included, is greyed; the figure is still drawn where there is one. |
| The representativeness floor on a monthly share, and the top-5 share's | The median of the 12 months before, with a month inside the dataset that has no rows as zero. It does not fire where one of the 12 is outside the dataset, or the median is zero. A month with no rows of its own has no share and no grey. |
| The last 12 months and the 12 months before, in the key under a share chart | Zero months inside the dataset are zero. A window that reaches outside the dataset's months has no figure and the key says so. |
| The year before, of a ranking | As "Ranking and ties", below: the earlier window must lie wholly inside the dataset's months. |
| A count's 12-month running total, and a count line | A month with no rows inside the dataset reads zero. A month outside it, or one the source does not record, is a gap, and a window with one has no total. |
| The change on a year ago for one month's count (the answer sentence and the hover) | Read from rows that have one row for each month (a total, or the fact table's rows with no breakdown), so a month with nothing is a zero there and a month before the dataset is absent: no change. Already as this rule says. |
| The combined share of the largest five | A monthly figure, not a window: a month with no vehicles has no share. Its representativeness floor reads the row above. |
| The default start of an all-time share chart | Found on the same 12-month shares, so a window reads as the first row says. |

A **monthly** share has no window. A month with no rows has no share (no vehicles), and is not greyed.

### Ranking and ties (D-107)

A ranking orders the values of one dimension by their count in one window: a single month, or the 12 months ending in a
month. Reserved values take no place: every value the cube writes between double underscores (not recorded, no reference
match, beyond the cap, and any other the cube reserves). A value with no vehicles in the window is not ranked.

- **A ranking of a dataset of one period shows every value it has** (D-139, D-142): it has no top-N control, and no line stands for the rest, since a line that held the rest would add hidden counts to shown ones. A ranking over time keeps the visitor's cut (top 10, 15 or 25).
- **Equal counts share a rank**, the rank of the first of them: 1, 2, 2, 4 (the usual competition ranking). The next rank
  after a tie skips the places the tie used.
- **Equal counts are listed in alphabetical order of the name a reader sees** (for a model, the make and model as words).
  Two values that show the same name are ordered by their raw key. The order never depends on the order the data arrives in.
- **A move** is the rank a year before minus the rank now, both shared ranks. Entries tied now move together unless they were
  not tied then.
- **The rank a year before** is the rank in the same months a year earlier, ranked by the same rule.
- **Whether there is a year-before comparison** is decided by the dataset's own months ("Months in which nothing is counted",
  above), not by which months a narrowed view has rows for. The earlier window must lie wholly inside them. If it does not, the
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

### A ranking and the precision floor (D-109)

A ranking prints shares and changes in share, so it reads the precision floor like any other share, and greys what it prints
where its base is too small. The floor is the share measure's own (`min_denominator` in `config/measures.json`, 200 vehicles), read
against the **total of the window the ranking ranks**, the same way as everywhere else a window is tested: a single month against
that month's vehicles, and the 12 months ending in a month against the 12 months' total. It is not multiplied by 12 for a
window of 12: the key under a share chart, a bar chart over a period and the map already test one window's total against the one
floor, and `/method` says the floor applies to the 12 months' total. The definitions settle this, so the reading that would
grey more (a floor of 12 times 200) is not taken.

- **The window ranked is under the floor.** Every share is greyed, and so is every change in share, since a change reads this
  window's share. The bars are grey where they show shares. One sentence says how many vehicles the ranking rests on and the
  floor.
- **Only the earlier window is under the floor** (it holds some vehicles, fewer than the floor). The shares stand; the changes in
  share are greyed, with a sentence of their own. An earlier window with no vehicles gives no change in share at all (a share of
  no vehicles has no value), so nothing is greyed there.
- **Nothing is hidden.** Ranks, moves, counts, shares and changes are printed as before; greying changes how they look and what
  the hover says, not whether they are there. A change on a year ago has its own guard (the measure's floor) and is unchanged.
- The floor is the share measure's whichever measure the chart counts, because the shares in a ranking's table are shares of a
  window whatever the bars show.

### A ranking of some values (D-111)

Two or more values on a long list (the same breakdowns the ranking of every value is offered for) can be ranked over one window, the
last 12 months or one month. It is the ranking above over fewer values, not a second one: the same function ranks them, with the same
ties, the same year before, the same zero for a month in which a condition keeps nothing, the same precision floor and the same reserved
values. The values are the visitor's own ("you picked") or the page's own starting values ("shown"): where a count is broken down and the
visitor has chosen no value, the page fills in the five that have the most vehicles in the last 12 months under the conditions, the dataset
and the breakdown, and looks again when any of those changes, until the visitor adds or removes one. The page's own values are not in the
address (a link with no `build.value` means them); the visitor's are. The page never says "you picked" of values it chose.

- **A rank is a place among those values**, not a place among every value. The page says so in a sentence above the chart ("Ranked among
  the N you picked" or "Ranked among the N shown, which the page chose as the largest in the last 12 months"), and the column is headed
  "Rank of N" (and "Rank of N a year before").
- **A share is a share of everything counted** under the conditions in the window, as everywhere else on the site (a share's denominator
  is the whole the conditions keep), not of the values ranked. So their shares add up to less than the whole, and the column is headed
  "Share of all counted" with a sentence that says what the total is and that the shares do not add up to the whole.
- **A value takes no place** where it has no vehicles in the window, or is a reserved value. Each is named under the leader, in the words
  that are true of it: no vehicles in the window; not recorded (the source records no value of the field for those vehicles); no match in
  the reference (the value is recorded but matches no entry). N still counts them.
- **The leader** is the value, or every value level at first place, with the most vehicles in the window; the sentence says the figure in the
  dataset's own words for what it counts (for example "first registered in the last 12 months that are still registered"). Where none of
  the values has a vehicle, one sentence says there is nothing to rank, in place of the chart and the table.
- **The full ranking is one step away**: one button ranks every value under the same conditions and window, and one takes the visitor back to
  the values. Both states are addresses (`build.view=league`, and `build.rank=all` as well). A ranking link that names a range a ranking
  cannot have (a span of years) is corrected to the window drawn, in the address, and a sentence says so.
- With one value there is nothing to rank, so the question stays lines (or the share mix).

### The file of figures (D-111)

Each chart's table of figures can be downloaded. The file is that table and no other: the same rows, columns and order, the same rounding
(a share to one decimal place, a change in share in percentage points to one, a change on a year ago as the page rounds it), written as
plain numbers (no thousands separator, a full stop for the decimal point, a minus sign), months as year-month. A figure the page greys is
written, with its reason in a last column; a figure the page withholds is a blank cell with its reason there, never a zero. Where the page
shows a dash for a reason it does not say elsewhere (not ranked a year earlier, no vehicles earlier to take a share from, too few vehicles to
compare), it says it in a line under the table, and the file says the same.

Above the table are lines that each start with "# " and are never quoted: the question as the page states it, what is counted, the period,
the dataset or datasets, the snapshot, the source note of each dataset that has one, the attribution of each dataset the figures are drawn
from (and no other: a file of a Stats NZ series carries Stats NZ's statement and nothing of NZTA's, and a chart that divides one dataset by
another carries both), the address that redraws the chart, how the figures are written, and one line that says which figures are greyed or
withheld and why, naming each column as the file does. A program that reads CSV skips these lines by setting its comment character to
"#"; a spreadsheet shows each in its first cell, and a line that holds a comma carries on into the cells to its right. The file has a byte
order mark and CRLF line endings. A text in the table that starts with `=`, `+`, `-` or `@` is written with an apostrophe in front so a
spreadsheet does not read it as a formula (a program that reads the file shows the apostrophe as part of the text). It is made in the browser
from the rows the chart already holds. The table of a mix chart is its last-12-months summary; the monthly figures behind a line chart are the
table behind the line chart.

### A grid of two fields (D-114)

Two fields crossed, neither of them time, looked at in one window (the last 12 months, or one month): one field down the side, one across the top,
a figure in each cell. Build asks it as a second breakdown (`build.by2`); two Explore questions are drawn as one. It is the `matrix` shape.
The code is `src/lib/matrix.ts`, tested without a browser in `tests/site/matrix.test.ts`.

- **What is counted.** Every vehicle the conditions keep, in the window's months, is in exactly one cell. The cells add up to the
  grid's total, and the last row and column are that total's parts: they are **always whole numbers of vehicles**, whatever the cells hold
  ("All" where the cells are vehicles, "Vehicles" where they are shares). The total of a grid is the total of the same question without
  its second breakdown.
- **What a cell holds** is the visitor's choice, in a row of four buttons headed "Each cell shows". It is **vehicles** where the question counts
  vehicles and **a share of all** where it asks for a share. The default is the least misleadable: a count has no base, and a share of all uses
  the site's one rule for a share's denominator (everything counted under the conditions in the window), so a grid of shares adds up to 100%.
  The other two extend that rule on purpose, and say so on the page and in the file:
  - **a share of its row** is a cell over the vehicles in its row, which is the share of a set the row's value narrows to (as a condition does,
    "Share", above); it answers "which segment does each brand sell most in?";
  - **a share of its column** is a cell over the vehicles in its column; it answers "which brand leads each segment?".
  The base of a share (the grid, a row or a column) is always in the table: the last column or row holds the vehicles each share is a share of.
  A preset may open on a row or column share (`cell_basis`, as the two Explore grids do); a visitor can change it, and it is in the address
  (`<id>.cells`).
- **Which values stand on a side.** The visitor's picks (up to the number of lines the side shows), or, with none, the values with the most
  vehicles in the window, ordered by their count with ties alphabetical by the name shown (the one rule, "Ranking and ties"). A side shows 10
  rows and 8 columns (`defaults.matrix` in `config/presets.json`). Every value not shown stands together in one line, **All other**, so the
  totals are the conditions' totals and nothing is left out; the page says how many values it holds ("one further ... value" for a count of one, "3 further ... values" for more). A tie at the cut shows the alphabetically
  first, and a sentence says how many more share the last count shown ("one not shown has as many ... and is counted in", or "2 not shown have as many ... and are counted in"). An ordered band (an age, an engine size) is never cut or ranked, picked
  or not: **every band from the first the data has under the conditions (in any month) to the last, in its own order, is a line**, the order
  being the one config gives the field's bands. So a band with no vehicles in the window, or one that the data never has but that lies between two
  that it does, is a line of zeros and not a gap (a gap in an ordered scale reads as a finding, and "with no value left out in between" would be
  untrue); a band before the first or after the last the data has is not a line. The first and the last are the first and last **real** band the data has: a band definition in config with no range (the flagged values
  "unknown" and "none", which mean not recorded or not applicable) is not a place on the scale, takes no part in setting its ends, and follows the
  bands as a reserved line does, so a few such vehicles do not pad a grid narrowed to low bands out to the last band. A value the order does not know follows the bands. Values picked on an ordered band are shown in the band's order, not by size. A value picked that has no vehicles in the window is a line of
  zeros. Where the largest combination (below) has a row or column the cut would put in All other, that value is shown as well, out of its
  place, and a sentence says so, so the answer can be found on the grid. This is done for **one** combination: where several are level, the
  first (by the order of the rows, then of the columns) is kept; any of the others whose row or column is not a line of its own is counted in a
  cell of All other, and the answer says how many ("One of these is counted in All other, not in a cell of its own"). Every level combination is
  still named, none is dropped, and none is claimed to be where it is not. The sentence that says a side shows "the N values with the most vehicles" counts only the values chosen by size, not the one kept out of its place, so it and the sentence about the kept value agree (the count is `Side.shown` in `src/lib/matrix.ts`).
- **Reserved values** are as in a ranking ("Ranking and ties"), with one difference of place. *Not recorded* and *no reference match* describe
  real vehicles, so each is a line of its own (italic, after the named values, in that order) when it has vehicles in the window or is picked;
  it takes no place and is never the largest combination. *Beyond the cap* is where a cap puts values, not a fact about any vehicle: it is never
  its own line and is always in All other, which says so. The reserved values that are not shown (not picked) are in All other too.
- **Guards.** A count has no floor. A share is read against the share measure's floor (200 vehicles, "A ranking and the precision floor")
  on **its own base**: the whole grid's total for a share of all, the row's for a share of its row, the column's for a share of its column. A
  share whose base is under the floor is **greyed**, not hidden: printed in slanted type on a hatched grey that is not on the scale
  (told apart by its type and its hatch, not by colour alone, and said in the legend), with its reason in the file and a screen reader's "Greyed". A share whose base holds no vehicles (a picked row with none) **has no value**: a dash on the page, a blank cell with its reason
  in the file, never 0%. A share whose base is a line total **hidden** by the small-cell rule (D-139) has no value either, and says so: its reason is that the total is hidden, never that the line holds no vehicles. On a table the pipeline writes, every cell on such a line is hidden too (`pipeline/pair_cells.py` rule 2), so the share sits on a hidden cell and reads as hidden; the hidden-total reason is a guard (D-142). A cell of no vehicles inside a base that holds some is **zero**, printed as 0 or 0.0%. A share that is more than
  nothing but prints as 0.0% is told from it in the figure itself: it is printed **<0.1%** (and written `<0.1` in the file, with a note), and
  is shaded in the lowest step. The reason for a less-than sign over a bare 0.0%: a zero and a tiny share are different facts, and the sign is
  how any table says so; the file cannot hold a number that is both, so it holds the sign.
- **One printed figure.** A share is printed once, to one decimal place (`pct`). The file's figure and the shade step are read from that
  printed figure, never from the unrounded share, so a cell cannot print 0.1%, be written 0.2 and be stepped as 0.2 (3 of 2,000, and 23 of 80,
  which prints 28.7%, were the cases that did).
- **Shade.** Six steps, from the design system's tokens (`--scale-N` in `src/styles/site.css`, each with the ink printed on it, held to 4.5 to 1
  by `tests/site/matrix-colour.test.ts`; the lowest is 5.25 to 1). A step is a fraction of the largest figure among the cells the grid shades
  (config `step_fractions`: 2%, 6%, 15%, 35%, 65% and 100%), so **one shade means one figure everywhere in the grid**, in a row or column share
  too: it is not set row by row. A cell of no vehicles, a greyed or valueless share, All other and the totals are not shaded. The legend gives
  each step a cell is drawn in, with its range in the cell's own unit (a grid greyed throughout has none); a figure is stepped as it is printed,
  so the legend and the grid agree. Every cell prints its
  figure, so colour is never the only way to read it.
- **The answer.** One sentence: the combination of two named values with the most vehicles in the window, with that count in the dataset's own
  words for what it counts; every combination level with it where there are several, followed, where some of those are counted in All other, by a sentence saying how many. It is worked out over **every named pair in the window**,
  whatever the cut, so it is true of the question and not of the lines shown. Where the visitor picked values on a side, it is the largest
  **among the values picked** and the sentence says so ("Among the brand values you picked, ..."), since the leader of the whole window may be a
  value they left out. It is the same fact whatever the cells show, so it is never a share of a thin row. Reserved values take no place in it, and a line of
  a reserved value can hold more vehicles than the largest cell, so the sentence says what it is: "The largest combination **of two named
  values** is ...", in each of its four forms, and is true beside such a line. It names no value or figure in the template, and says nothing about why.
- **The table of figures and the file** are the grid itself, with its last row and column, cell for cell (a wide grid is rows by columns as
  on the page). A column of shares is headed (%); the notes above the table say what a cell holds, how each side was chosen, what All other
  holds, what is greyed, what a less-than sign means, and that the last row and column are vehicles. A sentence that cannot be filled is
  dropped, not shown with a gap.
- **The fact table answers it** (`docs/CUBE_SCHEMA.md`, Fact table): two fields it carries, under any conditions it carries. A field it does not
  carry (the owner's region, the vehicle's age) cannot be crossed. Build offers no pair where each value of one sits under a single value of the
  other (a model under its brand, a brand under its group; `builder.cannot_cross`), since its empty cells would be empty by construction. Nor does it
  offer a pair the data map records as a roll-up (`relations.rolls_up_to` in `config/data_map.json`, through any number of steps, and for a dimension
  read from that field alone): NZTA's class code rolls up to the registered-as type, so the two are not crossed (`src/lib/nesting.ts`, D-122).

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
| A share over time, month by month, or as a share of the last 12 months: the line, and the top-5 share line | The month is **greyed**. The coloured line is not drawn through it. A thin grey line carries the figure and a shaded band marks a run of greyed months. The test is on the denominator behind the drawn figure: the month's own, or the 12 months' total for a 12-month share, a month with no vehicles in it counted as zero. | Tested on the month's own denominator, for **monthly** shares only. A 12-month share is not tested. Greyed in the same way. |
| The reading shown on hover over a point, on any chart | The figure and the vehicles behind it are printed, then "Greyed: fewer than N vehicles behind this figure". | The figure and vehicles, then "Greyed: far fewer vehicles than the months before, so it may not describe a normal month". If both trip, the precision reason is the one given. |
| The table of figures under the top-5 share line | Every month with a figure is listed with its share and its vehicles, and a Note column carries the grey reason. The figure is **printed**. | The same. |
| The key under a chart of shares over time (the last 12 months, and the change on the 12 months before) | The 12-month share is **suppressed** if that window's vehicles are under the floor. The change is suppressed if either window is. | Not tested: a window is not a month. |
| A bar chart by band, and the map (a share over one period) | Tested on the whole period's vehicles. If under the floor, every bar or region is **greyed**, the hover reading carries the reason, the line above the chart says "greyed: under N", and the table of figures prints the share as **suppressed** (the count is printed). | Not tested. |
| A ranking | The ranking's window holds fewer vehicles than the floor: every share and every change in share is **greyed** (printed, in grey, the bars grey when they show shares, the hover reading carrying the reason), with one sentence at the head of the chart saying how few vehicles it rests on. Where only the earlier window it is compared with is under the floor, the changes in share alone are greyed. No rank, move or figure is withheld. See "A ranking and the precision floor", below. | Not applied: a window is not a month. |
| An answer sentence, or the reading on a count | These are counts, not shares, and carry neither guard. The change on a year ago is the only withheld figure: under 50 vehicles in the earlier month it is not given and the sentence says there are too few vehicles to compare with. | None. |
| A count, or a 12-month running total | A count carries no share guard. | None. |

**A greyed figure and the vertical axis (D-109, review of #69).** The vertical axis of a share-over-time chart (the lines of a
share, the top-5 share line) is set by the points drawn in colour, the ones the guards do not grey. A greyed point can be far
higher than any of them (a month of a few vehicles in the register's early years, or a window with one vehicle of a small
group), and would otherwise stretch the axis until the lines that carry the chart are squeezed. Greyed points are drawn within
that frame and cut off at its edge; the hover and the table of figures still give a greyed figure in full, and the grey note says
a greyed figure above the scale is cut off. Where no point is drawn in colour (everything is greyed), the axis is set by what there
is. A count line carries no share guard, so nothing on it is greyed; the bar chart, the map and a ranking grey all their bars or
none, and so set their scale by all of them or, when greyed, by what there is.

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

**Mild or full: the line (D-119).** NZTA records a hybrid as hybrid and does not say which kind
(`docs/DATA_SOURCES.md`). `mild_hybrid_models.csv` draws the line with the test every authority
read that draws one uses: can the electric motor propel the vehicle on its own? A hybrid is *full*
when it can, however briefly or slowly, and *mild* when it cannot. What decides a row is what the
maker states about the motor, not the maker's label or which part is the main source of drive: a
system whose motor can move the car alone at low speed is full even when the engine does most of
the driving. The authorities, read on their own pages on 2026-11-17:

- US Department of Energy, Alternative Fuels Data Center, "Hybrid Electric Vehicles"
  (https://afdc.energy.gov/vehicles/electric-basics-hev): "Mild hybrids—also called micro
  hybrids—use a battery and electric motor to help power the vehicle"; "Mild hybrid systems cannot
  power the vehicle using electricity alone."; "Full hybrids have larger batteries and more
  powerful electric motors, which can power the vehicle for short distances and at low speeds."
- US Environmental Protection Agency, Automotive Trends Report highlights, updated 19 February 2026
  (https://www.epa.gov/automotive-trends/highlights-automotive-trends-report): hybrids include
  "'strong' hybrid systems (HEV) that can temporarily power the vehicle without engaging the
  engine" and "'mild' hybrid systems (MHEV) that cannot propel the vehicle on their own".
- SMMT (UK), "Types of electric vehicles", 25 July 2025
  (https://www.smmt.co.uk/article/types-of-electric-vehicles/): "Crucially, MHEVs cannot be driven
  on electricity alone."
- Australian Government, Green Vehicle Guide FAQ (https://greenvehicleguide.gov.au/pages/About/FAQ):
  "MHEVs use an internal combustion engine to propel the vehicle, but may have a small electric
  motor"; "If the electric motor can propel the vehicle, these vehicles will appear on the Green
  Vehicle Guide as a plugless hybrid".

European Union type-approval law (Regulation (EU) 2017/1151, Article 2 point 16, the UK National
Archives copy at https://www.legislation.gov.uk/eur/2017/1151/article/2/data.xht, read 2026-11-17)
has no mild category, and no New Zealand authority was found to define the line. Publishers differ
on whether mild hybrids count as hybrids: ACEA's monthly release footnotes its hybrid figure
"Includes full and mild hybrids" (May 2025 release); the SMMT counts them under petrol and diesel
("Petrol and diesel totals include mild hybrid electric vehicles (MHEVs)"); the Motor Industry
Association of New Zealand's release for February 2024
(https://www.interest.co.nz/sites/default/files/2024-03/February%202024%20New%20Vehicle%20Sales%20Press%20Release.pdf,
read 2026-11-17) reports "EVs", "PHEVs", "Hybrids" and "ICE vehicles", one "Hybrids" category. A comparison with a published hybrid figure has to say which of these it
matches (see "Hybrids as one figure" below). The line moves no row by itself: a row's class changes
only with a primary source for the nameplate the row matches.

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
confidence only. At high confidence only, a classification below the high
level counts as none, whichever way it points: a `mild` row below it counts
as unknown, and so does a `full` row below it, because if that call is wrong a
mild hybrid has been missed. A `full` row at the high level leaves the
denominator, as at stated confidence, and vehicles identified by the code
mapping alone count at both levels. So the figure at high confidence only is
(mild at the high level + identified by the code mapping alone) ÷ (identified
mild + unknown + `full` below the high level); the stated figure's
denominator leaves out every `full` row. The two denominators differ by exactly the
vehicles called `full` below the high level (the manifest's `identified_full`
does not split them by confidence, so the figure at high confidence only
cannot be rebuilt from the manifest alone). No `full` row below high
confidence carries an override today, so none moves a vehicle between
powertrain values; the figure and what rests on it (the publish threshold and
the warning level) are all it changes (D-110). Before D-110 every `full` row
left the denominator at both levels; the figures below that predate it are
marked. On the 2026-10 snapshot the trailing figure at high confidence is
80.3% on the register and 80.2% on true registrations (78.5% and 78.5% before
D-119's Subaru rows, 74.0% and 74.0% before D-115's rows, and 79.3% and 79.2%
under the count before D-110) and the
all-time figure 63.0% (46,115 of 73,161) and 68.0% (46,157 of 67,886) (62.7% and 67.6% before D-119; 60.1% and 64.5% before D-115's rows; 63.6%
and 68.5% under the count before D-110). At the 2026-08 snapshot,
under the earlier count, all-time coverage is 83.0% at stated confidence but
62.8% at high confidence only, because 13,808 Honda IMA hybrids are classified
at medium confidence. Over the trailing 12 months it is 84.1% and 79.5%.
The headline charts use the trailing figures. A dataset publishes the
mild hybrid split only while its own trailing coverage at high confidence
is at or above `publish_split_at_trailing_high_confidence_coverage` in
`config/pipeline.json` (70%). The comparison is made on the whole counts
behind the figure, not on the figure rounded to four decimals that the manifest
shows: 139,999 of 200,000 reads 0.7 and is under 70%, so it withholds. Under
it the dataset shows its mild hybrids as Hybrid, undivided, in every slice, pair and fact table, the manifest
says `mild_split_published: false` beside the figure, and the build adds a
warning; the other dataset is judged on its own figure. A window with no hybrid
at all, or only `full` calls at the high level, has nothing to divide and
publishes (both figures read null). A window with no identified mild and no
unknown hybrid, only `full` calls below the high level, has those calls as its
whole denominator at high confidence only: that figure reads 0% while the stated
figure reads null, and the split is withheld (D-110). On the 2026-10
snapshot both are above it (80.3% and 80.2%, after the rows below), so both
publish the split. A figure below `warn_below_trailing_high_confidence_coverage` (70%, the
same today) is a build warning for a dataset that still publishes. A dataset
that crosses the threshold between one build and the next changes its whole
history of the two values at once, so that build adds a warning naming the
direction and both figures (`CUBE_SCHEMA.md`, Warnings; the margin on true
registrations is 14,327 of 17,864 hybrids at high confidence on 2026-10: 2,603
more unidentified hybrids in the window would cross 70%, and 2,610 on the
register, 14,297 of 17,814; it was 2,210 and 2,217 before D-119 and 1,101 and
1,111 before D-115, so keeping
`mild_hybrid_models.csv` current matters). All-time mild hybrid
history rests on the Honda IMA call and should be read that way.

**Subaru (D-119).** Subaru's hybrids (XV, Impreza, Forester and Crosstrek) were unresolved
as a whole because their motor can move the car alone at low speed while the engine is the main
drive. Under the line above that makes them full wherever Subaru states it. In the window
(Nov 2025 to Oct 2026) true registrations hold 1,462 of them (1,458 on the register). Now: the
Crosstrek and the Forester new in New Zealand of vehicle year 2026 are full at high
confidence (Subaru New Zealand's own pages state electric-only driving: 393 vehicles on true
registrations and on the register); the Crosstrek of 2023 to 2025 and the Forester of 2020 to
2025 new in New Zealand, the XV new in New Zealand from 2020, the used imports (XV Hybrid 2013 to 2016, e-BOXER from 2018 or
2019) are full at medium, because no Subaru page read states electric-only driving for those
cars or shows the e-BOXER to be one system across markets (867 on true registrations, 864 on
the register); the Impreza, the XV of vehicle years 2017 and 2018 (the changeover), the
Crosstrek used import before 2023, strays and re-registered cars stay unresolved at low
confidence (202 on true registrations, 201 on the register). `full` rows carry no override, so
no vehicle moves between powertrain values; the build rejects a `full` row whose powertrain
would be Mild hybrid. A `full` row at medium counts against the high-confidence figure
(above), so only the 393 at high change it. Honda's IMA rows are as they were (medium): under
the line an IMA car is mild if its motor cannot propel it alone, and no primary source read
says either way.

**Hybrids as one figure (D-118, D-124).** NZTA records a hybrid as hybrid, not as mild or
full. Every hybrid code of NZTA's that does not plug in maps to Hybrid or to Mild
hybrid (`powertrain_map.csv`), so the two lines added together hold every such
vehicle. On a chart that draws the mild line the site says so under it
(`identification_together` in `config/presets.json`); it says nothing about what
another source shows. A ranking or a share cannot be added up in the browser from two
lines. A count can: in Build, a count of vehicles with a condition on the powertrain that
keeps both values is one line of their sum (new passenger cars and vans in October
2026 on true registrations: 4,978, against 4,472 Hybrid and 506 Mild hybrid). A share
of the two together is the dimension `powertrain_group` ("Powertrain group" in Build): a
roll-up of the powertrain from the `powertrain_group_label` column of `powertrain_map.csv`, a slice and a
fact-table column of every dataset that has the powertrain. A share by it is of every
vehicle the question keeps, as every share is. It adds no row to a fact table, because a
group is a function of the powertrain, and it does not depend on the mild split, so it
is the same on a dataset that withholds the split. Its five values are named in
`powertrain_group_label`; the one that holds both hybrid values is the group of all
hybrids that do not plug in, full or mild. It is not the same thing as a source's hybrid
figure unless that source counts the same vehicles under it (whether plug-in hybrids are
in it, and the scope).

`powertrain_map.csv` gives each powertrain value one group in `powertrain_group` (a test holds it, and that the two values
the mild split moves a vehicle between, Hybrid and Mild hybrid, share a group) and each group a plain-word name in
`powertrain_group_label`, which is the name a visitor sees (D-124). The key column keeps its short values because the hybrid
classification reads them (`hybrid_classification.source_hybrid` in `config/pipeline.json`), and one of them is also a
powertrain value.

The file is keyed on the make and model as the dataset spells them, so a
nameplate the register and the dashboard spell differently needs a row for
each spelling. Measured on the 2026-10 snapshot, the hybrids that matched no
row were 177 of the register's 91,264 in the last 12 months and 4,832 of
true registrations' 91,614; 4,650 of those were Toyota's Corolla Cross,
which the dashboard names and the register records as COROLLA.
Seven rows were added for full hybrids (nine nameplates: Corolla Cross, Prius c
and v, Niro Plus, Staria and Staria Load, ES, H7 and X55), which moves no
powertrain line, and one for the Mercedes-Benz C 200 as mild, at medium
confidence. Trailing coverage, stated and at high confidence (counted as before D-110, with every
full row out of the denominator), went
from 83.0% and 78.9% to 83.5% and 79.3% on the register, and from 66.0%
and 62.7% to 83.5% and 79.2% on true registrations. All-time, from 80.4%
and 61.6% to 83.1% and 63.6%, and from 72.2% and 59.7% to 83.0% and 68.5%.
The nameplates still matching no row number six or fewer each over the last
12 months; the rows the file marked unresolved held another 2,894 hybrids on
the register and 2,905 on true registrations over the same months (before D-115;
the rows marked unresolved at low confidence hold 2,503 and 2,513 today).

D-115 raised three rows to high confidence on a maker's or its New Zealand
distributor's own page: the Chery Tiggo 4 Pro (New Zealand new, full), the
Nissan X-Trail's petrol hybrid as a used import of vehicle year 2015 to 2021
(full; 2022 holds both generations and is unresolved, with later years) and the
Foton Tunland (mild). The BAIC B30 is full at medium, because the
only page that says full hybrid is one dealership's stock listing for one
vehicle. 1,085 vehicles on true registrations in the window were counting
against the high-confidence figure and no longer do (1,029 left the denominator
as full calls, 56 joined the numerator as mild calls); on the register 1,082
(1,026 and 56). A used import Tiggo and the X-Trails of vehicle year 2022 or
later now match no row or an unresolved one, and count against it. Nothing was raised for the
Honda IMA hybrids, which the makers' own pages call neither mild nor full, nor
for Subaru's e-Boxer, whose maker says the car runs on its electric motor up to
40 km/h and assists the engine otherwise; both stayed as they were (D-119 later
classed Subaru's, above). The rows left at medium or low confidence held 3,930
vehicles in the window on true registrations (and on the wider dataset) and
3,910 on the register; after D-119 they hold 3,537 and 3,517 (1,253 unresolved at
low confidence, 1,504 full at medium, 704 mild at medium and 76 with no row, on true
registrations; 1,246, 1,500, 700 and 71 on the register).

**Named models** — the model dimension names the 300 models with the most
vehicles in the trailing 12 months and groups every other model as
`__OTHER__`, in every month (`CUBE_SCHEMA.md`, Model dimension). Where models
tie at the last place, the one whose `MAKE|MODEL` key sorts first in byte
order is named. On the 2026-10 snapshot that decided one place on
`registrations_flow`, then the dataset of two types (two models with 75 vehicles), and none on
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
*original* registration count needs `new_registrations` as the base.
Every survival figure states its base and its first observed snapshot.

**Completeness** — for a month, the survivors still on the register
(`registrations_surviving`) ÷ the vehicles registered in that month
(`new_registrations` since D-158, `registrations_flow_wider` since D-157, `registrations_flow` before), in total, by import status (new, used) and by
NZTA's vehicle type for the types in scope, from January 2021. Both
sides are the datasets as built, so it covers the five types of the trade scope since D-157 and the two of the default scope before. It is the one
ratio of the survivors to the registrations that the site draws: the two datasets never share any other chart (`ratio_of_clashing_datasets`, D-158).
The percentages in this paragraph were measured before D-157, on the two types, and are not restated.
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

## SUV or car, by nameplate: `model_segment.csv` (D-117, D-123, D-145)

The register records most SUVs as station wagons (`BODY_TYPE`), so no register field says whether a vehicle is an SUV. A
nameplate does: the class of a make and model is a lookup, not a measurement (invariant 4). `data/reference/model_segment.csv`
is that lookup for the nameplates that make up most recent passenger registrations. **The build reads it** (D-161): every vehicle is joined to it on its canonical make and
model and takes the row's class in the column `model_class` of `rows` (`config/pipeline.json`, `model_classes`), under the rules
of "When a build reads the file" below, and a build whose vehicles meet two rows stops. The dimension `market_type` reads that column
("Market type" below), and its figures depend on it. A maintainer reads its coverage with
`scripts/segment_coverage.py`; `pipeline/tests/test_model_segment.py` holds its form.

**The rule.**
- A nameplate is `suv` when its maker, or its maker's New Zealand distributor, places it in its SUV range or calls it an SUV on
  its own page, for the market the vehicles come from: the New Zealand site for NZ-new vehicles, the maker's Japanese or global
  site for used imports. It is `car` when the maker's own page places it among its hatchbacks, sedans, wagons, coupes,
  convertibles or people movers and does not call it an SUV. A maker's word that names no body, such as "compact car"
  (コンパクトカー), does not place a nameplate: such a page is not the row's `high` source, and the body comes from another
  source at the confidence it earns (D-145). "Sports car" (スポーツカー), and a maker's "sports" heading, is read as naming
  the coupe and convertible bodies that the file will group as sports cars (D-117's planned class); it differs from "compact
  car" because a sports car is never an SUV body, while a compact car can be either (D-145).
- **`car` means "not an SUV" in this file so far.** It includes people movers (a minivan or wagon body for more than five
  seats) and sports cars (coupes, convertibles and roadsters), which the FCAI's criteria put in their Passenger class beside
  hatchbacks and sedans, not in SUV. A finer class for them is a later piece. Utes, vans, trucks and buses are not in the file:
  `segment_map.csv` already separates them from register fields. A commercial van that NZTA registers as a passenger vehicle
  is `unresolved`, not `car`.
- **Why the maker's own categorisation.** A model's class in the trade (the FCAI's VFACTS classification in Australia, the
  Motor Industry Association's segments here) is a committee's judgement. The FCAI's criteria are indicative ("a 2/4 door wagon
  body style and elevated ride height", no ride height published, "exceptions do occur based on market focus and other
  subjective criteria"); the MIA publishes only its top five segments each month and no model-by-model list. So this file does
  not claim to reproduce either body's placement of any model. It states a rule the project can cite.
- **Confidence.** `high`: a primary page, a maker's or its distributor's, read in the session with its URL and the date read in
  the row's `basis`, covering the markets that make up at least 80% of the nameplate's vehicles in the trailing 12 months.
  `medium`: a review, a trade or reference source (Wikipedia is used and named as such), a maker's page found by search but
  not read (a number of makers' sites refuse automated readers), or a primary page that covers under 80% of the nameplate's
  vehicles. `low`: a recorded judgement (step 3 of the tie-break rule below), which gives the nameplate a class (`suv` or
  `car`) with the ground it rests on, or `unresolved`. An `unresolved` row is always `low`. A `low` row that names a class says
  "judgement" in its `basis`, and a test checks that. `unresolved` is for a nameplate where no judgement can honestly be made:
  one name covers both kinds, across generations that the match columns cannot separate or in one model year, or a van body
  that NZTA registers as a passenger vehicle, or nothing read or measured points either way. A large count never raises a
  row's confidence.
- **Market cover is measured on the register** (D-123): a row's markets are its NZ-new vehicles and its used imports by
  `PREVIOUS_COUNTRY`, in the register's trailing 12 months, since the dashboard has no previous country. Japan is the
  previous country of 98.2% (88,089 of 89,733) of passenger used imports in that window. A row's note gives the shares its
  `high` rests on. A maker's current page is taken to speak for earlier generations of the same name unless it says
  otherwise; where it does not cover them, the note says so.
- **Match columns.** `match_vehicle_year_min` and `match_vehicle_year_max`, as in the other reference files, and
  `match_gvm_min` and `match_gvm_max`, a vehicle's gross vehicle mass in kilograms (the register's `GROSS_VEHICLE_MASS`). All
  four are inclusive and optional, and used only where a nameplate changed kind between generations or models under one name and
  the field can be defended. The year can be defended under `docs/MODEL_AND_AGE.md` §1 (for NZ-new vehicles from 2007
  `VEHICLE_YEAR` is the registration year; for used imports it is a year from the vehicle's life overseas, so a bound on it is a
  bound on when the generation could have been first registered anywhere). A vehicle with no vehicle year matches no row that
  bounds the year, as for `model_registry.csv`; a vehicle with no recorded gross vehicle mass (missing, or NZTA's placeholder
  0) matches no row that bounds the mass, and a dataset with no gross vehicle mass (the dashboard's) matches none. Two rows for
  one nameplate may not overlap: the test treats the year range and the mass range together, and two rows conflict only when
  both ranges overlap, an open bound being open. The nameplates that use them are Corolla (below) and Leaf (the third
  generation, a crossover, is 2025 on; the years from there are `unresolved`).

**Which source decides (the tie-break rule).** A passenger model the file does not classify, with no row or an `unresolved`
row, is shown as its own value, "Not yet classified". A nameplate's class is taken from the first of these that settles it,
and the row's `basis` names what was read or measured:

1. **The maker's own New Zealand site**: the category it lists the model under, such as an "SUV" range page, a body-style menu
   or the model page's own wording. Where the New Zealand site gives no class (no site, a model not sold new here), the
   maker's Japanese or global site. `high` when the page was read and covers at least 80% of the nameplate's vehicles (the
   rule above); `medium` when the page was found by search and not read, covers less, or is another market's.
2. **The register's own fields**: body type and NZTA class (`MC` against `MA`), with the measured shares in the row's note.
   `medium`. Station wagons that are nearly all `MC` are `suv`; saloon, coupe, convertible and sports bodies are `car`; a
   hatchback body alone is taken as `car` and is the weakest case, because the register records some SUVs as hatchbacks (the
   Stonic and the Juke above, the Mercedes-Benz GLA in the 2026-10 pull). Where the fields are mixed, as with `MA` station
   wagons, which hold SUVs and wagons alike, or a van body, they do not settle it and the nameplate goes to step 3.
3. **A recorded low-confidence judgement**: when neither step settles it, the judgement is made and the nameplate is given a
   class (`suv` or `car`) at `low` confidence, with the ground it rests on in the `basis`, which says plainly that it is a
   judgement: what the maker's own pages say (a "crossover" that does not say SUV, a hatchback and SUV wording together), what
   the maker's own range groups it with, and the register's body type and class. It counts as classified, and the review
   queue's low-confidence list shows it for the owner to approve or change. `unresolved` is left only where no judgement can
   honestly be made: one register name that covers two different vehicles no row can separate (a brand name such as BMW's `I`
   that covers several models), a van body registered as a passenger vehicle, or a nameplate where nothing read or measured
   points either way.

A class is never taken from memory, and a review, dealer, press or reference page is never copied in as the maker's: such a
page may be named in a row's basis as supporting evidence only. Where the maker's own pages differ (a menu group that
holds small cars, against a model page's wording), the model page decides and the note says so.

**A register spelling the dashboard does not share.** The register records the Corolla Cross as `COROLLA` and the Prado as
`LANDCRUISER`; the dashboard records `COROLLA CROSS` and `LANDCRUISER PRADO` (the register's trailing `COROLLA` is 11,305
vehicles, the dashboard's `COROLLA` 6,600 plus `COROLLA CROSS` 4,651, to within 0.5%). A row is keyed on the make and model as the
pipeline derives them for either dataset, so one file serves both.

**The register's COROLLA is split on gross vehicle mass.** For NZ-new vehicles of vehicle year 2022 or later (20,366 in the
2026-10 pull, measured 2026-11-25) the register's gross vehicle mass separates the Corolla from the Corolla Cross with no
exception: every one has a recorded mass; the 9,533 at 1,925 kg or more (1,930 kg: 8,512; 2,005 kg: 1,020; one at 2,640 kg) are
station wagons and all carry the submodel engine token of the Cross (2.0PH), and the 10,833 lighter ones (1,735 to 1,915 kg:
hatchbacks, saloons, the GR Corolla at 1,915 kg and station wagons of 1,735 and 1,785 kg) none does. The first such NZ-new
vehicle was registered in September 2022. The submodel is free text and was looked at as a check, never used as a basis. The file
has four COROLLA rows: car up to vehicle year 2019 (the older Corolla, from Wikipedia and Toyota Japan); car for vehicle years
2020 and 2021 (of the 7,110 NZ-new vehicles of those years one saloon is at 1,925 kg or more); car for vehicle year 2022 on at
1,700 to 1,924 kg; and suv for vehicle year 2022 on at 1,925 kg or more. Toyota New Zealand's SUV range page lists the Corolla
Cross and not the Corolla, and its hatchback page lists the Corolla Hatch. The three newer rows are `medium`: the New Zealand
pages speak for the NZ-new vehicles, 60% of the register's trailing COROLLA vehicles (6,783 of 11,307).

*Used imports.* The rows cannot tell a used import from a NZ-new vehicle (the file has no column for it), and the mass rule does
not hold for used imports: the Japanese-market Cross weighs 1,605 to 1,805 kg and overlaps the wagons. Of the 1,004 used imports
and re-registrations of vehicle year 2022 or later, 815 weigh under 1,700 kg or have no mass and match no row (not classified),
175 are called car (16 of the 526 whose submodel says Corolla, 72 of the 231 that say Cross, 87 of the 247 that say neither) and
13 are called suv (1 that says Cross, 12 that say neither). Of the 275 used imports whose submodel says Cross, 158 match no
row, 116 are miscalled car (44 of vehicle year 2021, 72 of 2022 on) and 1 is called suv. Used imports of vehicle year 2020 and
2021 are called car, 44 of them Crosses. So the used-import Corolla is partly not classified and partly miscalled; the lower
bound of 1,700 kg is the lightest NZ-new vehicle (1,735 kg) rounded down, so that it keeps the lighter Japanese-market vehicles
out rather than call them car. New registrations, the owner's target, are classified completely. The dashboard has no gross
vehicle mass, so its COROLLA of vehicle year 2022 or later matches no row (it was `unresolved`) and its COROLLA CROSS has the row
of its own; a per-dataset rule is a later piece (D-117).

*Body type.* Every vehicle at 1,925 kg or more is a station wagon, so a station-wagon condition on the `suv` row would change no
call today. It would make the row safer against a heavier hatchback or sports body (the GR Corolla is 10 kg under the line and
the Cross 5 kg over it), but the file cannot express it: that needs a `match_body_type` column, which is proposed and not added.

*When a build reads the file.* A build that joins this file on canonical make and model must apply the year bounds and the mass
bounds together, inclusively; treat a vehicle with no recorded mass as matching no row that bounds the mass; and take the
`gvm` the `rows` table holds after sentinel handling, never the raw field. For the Market type rules (`market_type_map.csv`
rules 6 to 8), a vehicle that meets no row, or one whose row is `unresolved`, reads Not yet classified (rule 8), and one whose row is
`car` reads Passenger; a vehicle with no recorded mass meets no row that bounds the mass, so it takes the row (if any) that does
not.

**Coverage reached** (measured 2026-11-25; passenger vehicles, the `passenger` scope group of `vehicle_scope.csv`, each
dataset's own filter; the 2026-10 snapshot; trailing is November 2025 to October 2026; "has a row" counts `unresolved` rows,
"classified" does not).

| Dataset | Window | Vehicles | Has a row | Classified | `suv` | `car` | `unresolved` | no row |
|---|---|---|---|---|---|---|---|---|
| `registrations_flow` | trailing | 201,088 | 189,428 (94.20%) | 188,503 (93.74%) | 114,006 (56.69%) | 74,497 (37.05%) | 925 (0.46%) | 11,660 (5.80%) |
| `registrations_flow` | all time | 1,218,768 | 1,074,620 (88.17%) | 1,068,976 (87.71%) | 580,863 (47.66%) | 488,113 (40.05%) | 5,644 (0.46%) | 144,148 (11.83%) |
| `registrations_surviving` | trailing | 200,387 | 191,052 (95.34%) | 190,129 (94.88%) | 113,728 (56.75%) | 76,401 (38.13%) | 923 (0.46%) | 9,335 (4.66%) |
| `registrations_surviving` | all time | 3,617,895 | 2,425,110 (67.03%) | 2,411,107 (66.64%) | 1,096,702 (30.31%) | 1,314,405 (36.33%) | 14,003 (0.39%) | 1,192,785 (32.97%) |

"Classified" is a class at any confidence. In the trailing window the flow dataset's classified vehicles are 37.22% at `high`,
55.74% at `medium` and 0.78% at `low` (the recorded judgements); the register's are 34.23%, 59.87% and 0.78%. The script prints
the three shares apart. The flow dataset's trailing `no row` rose from 9,018 to 11,660 with the Corolla split: its COROLLA of
vehicle year 2022 or later has no mass and matches no row (it was `unresolved`).

The file has 223 rows for 298 entries (294 distinct make-and-model pairs; Corolla has four rows and Leaf two): 89 rows at
`high` (60 `suv`, 29 `car`), 122 at `medium` (57 `suv`, 65 `car`) and 12 at `low` (4 `suv`, 1 `car`, 7 `unresolved`). By entries:
`suv` 89 high, 82 medium and 4 low; `car` 33 high, 81 medium and 1 low; `unresolved` 8. The first slice's 169 pairs were the 150
largest passenger nameplates of the two datasets' trailing windows combined and 19 more, to the rank where the register's
cumulative share reached 90% (D-117); the second slice added the ten largest still without a row (D-123), and the third the
next ten and the Suzuki e VITARA (D-145). The fourth, the first batch of the classification review (2026-11-25), took the
passenger nameplates with the most NZ-new vehicles in the trailing window, every one with 20 or more in the last three months:
it added or changed 98 rows for 117 nameplates (the maker's own site for 81 of them, the register's fields for 27, a recorded
judgement for 5 classed at `low`, and 4 left `unresolved`). The largest nameplates still without a row (trailing, flow): Mazda
Biante 159, Nissan Sylphy 152, Mitsubishi Mirage 151, Honda Jade 143, Lexus RX450H 137, Subaru Exiga 121, Lexus GS450H 118,
Nissan Teana 118, BMW 320D 110, BMW 420I 108. The register's all-time figure is low because the file lists current
nameplates, not the many that were registered earlier and have since gone.

**Measured on new passenger vehicles** (the register: NZ-new vehicles of passenger type, first registered November 2025 to
October 2026, in the bodies the SUV-or-car rules cover: station wagon, hatchback, saloon, sports car, convertible, light and
heavy van; 110,606 vehicles; measured 2026-11-25). Before the fourth slice: `suv` 73.38%, `car` 7.47%, `unresolved` 12.57%, no
row 6.58%, so 80.85% classified. After the first batch and the recorded judgements: 92.55% classified, with the register's
COROLLA (6,783, 6.13%) the largest `unresolved` name. After the Corolla split: `suv` 93,720 (84.73%), `car` 15,432 (13.95%),
`unresolved` 581 (0.53%: the Ford Transit and Transit Courier, Hiace, Vito, BMW `I` and Yukon), no row 873 (0.79%), so 109,152
(98.69%) classified: 47.68% at `high`, 49.60% at `medium` and 1.40% (1,553 vehicles) at `low`.
`scripts/segment_coverage.py` prints these figures for either dataset.

**Set beside the trade's own placement, privately.** The file's first slice was set beside the FCAI's published sample of its
VFACTS report as a private check (D-117). Nothing from that report is in the file or in this repository, and no row's class,
basis or confidence rests on it. The check was not repeated for the second or third slice (D-120, D-123, D-145).

**The register's `CLASS` as a cross-check, not an input.** `MC` is the register's off-road passenger class. Measured on every
passenger vehicle in the register (all time, the 2026-10 snapshot), for each make-and-model pair of the first two slices
(D-117, D-123) with at least 30 of them; not re-measured for D-145: no `car` pair has a majority `MC`; one has over a
quarter (Mitsubishi Delica, 29%). `MC` is weak evidence for an SUV:
among the `suv` pairs it runs from under 1% (Mazda CX-5, Mitsubishi ASX, BYD Atto 3) to 99% or more (Ford Everest, Mitsubishi
Pajero Sport). Among passenger vehicles first registered in the trailing window and still registered, 11.2% of NZ-new
vehicles are `MC` and 1.7% of used imports, so it says little about recent used imports. The `suv` pairs with almost no `MC`
that the register records mostly as hatchbacks: BAIC X55 (all 186), BAIC B30 (all 457), Jaecoo J5 (all 724), Chery Tiggo 9
(all 289), Kia Stonic (85% hatchback), Nissan Juke (75%), Nissan Kicks (75%). The file follows the makers (for the Nissan
Juke and Kicks, Wikipedia) here, not the register's body type, which records a body shape and not a kind of vehicle.

**Set beside published figures** (new registrations of NZ-new vehicles: passenger vehicles for
April 2025, every type for June 2026, in what were `registrations_flow` and `registrations_flow_wider` and are `new_registrations` since D-158; measured 2026-11-18; reported, nothing adjusted to
match). The share is a range: the lowest counts only `suv` rows, the highest adds every `unresolved` and
no-row passenger vehicle.

| Month | Our NZ-new vehicles | Our SUV share | Published |
|---|---|---|---|
| April 2025 | 6,073 passenger (SUV 4,501; unresolved 347; no row 724) | 74.1% to 91.8% of passenger | MIA, light passenger vehicles: SUV Compact 34.3%, Medium 32.2%, Large 12.6%, at least 79.1% (its top five segments only) |
| June 2026, whole market | 13,411 of all types (SUV 8,007, of which 51 are recorded as goods vehicles; passenger unresolved 654; passenger no row 607) | 59.7% to 69.1% of all | AfMA: Medium SUV 4,292, Compact SUV 2,787, Large SUV 1,083 of 13,438, at least 60.7% |

The published figure lies inside our range at both dates. The range is 18 points wide in April 2025 and 9 in June 2026, so
the comparison tests the file's coverage and nothing finer. In April 2025 the MIA's three SUV segments held 4,820 vehicles
(2,087 + 1,963 + 770, read from a search result's quotation of the release; the PDF itself could not be read); our `suv` rows
alone hold 4,501, 319 fewer, and our unresolved and no-row passenger vehicles number 1,071. In June 2026 AfMA's three held
8,162 (read from the page); our `suv` rows hold 8,007, 155 fewer, against 1,261 unresolved and no-row passenger vehicles.
Our totals are within 0.2% of the published ones (6,073 passenger vehicles against about 6,085 light passenger vehicles,
derived from the MIA's quoted counts and shares (2,087 at 34.3%), not read from the release; 13,411 against 13,438). These are different definitions (the MIA's and AfMA's segments are a
committee's placements; here a vehicle's class is its nameplate's, whole), so the figures are not expected to match.

## Market type (D-154, D-155)

A vehicle's market type says what kind of vehicle it is in the way the published top level does, from its body and its
mass, not from the type NZTA registers it under. It has seven values, decided by `data/reference/market_type_map.csv`,
eighteen ordered rules of which the first that matches a vehicle wins (so the order is part of the definition). Rules 1 to 15
place the five vehicle types of the vehicle scope file's `trade_scope` column (D-154, D-155); rules 16 to 18 name the nine other
types, for a dataset that counts every vehicle type (D-161). A rule can
test the vehicle type, the body, NZTA's class (`nzta_classes`, values of `class_map.csv`), the GVM and the SUV file's class
for the model. The definitions below are the user's, an industry convention for which no source is cited; D-155 adds
Not yet classified and settles motor caravans and special purpose vehicles:

- **Heavy commercial**: a goods vehicle, bus, motor caravan or special purpose vehicle over 3,500 kg GVM, whatever its body.
  NZTA's own classes draw the same line (`class_map.csv`: goods NA up to 3.5 tonnes and NB over it; omnibuses MD1 and MD2
  up to it); 3,500 kg itself is on the light side.
- **Light commercial**: a ute (body UTILITY), whatever type NZTA registers it under; a goods vehicle with a cab-and-chassis
  or flat-deck body; a goods van up to 3,500 kg; a bus up to 3,500 kg; a motor caravan up to 3,500 kg (the industry files
  it under its base vehicle, and NZTA's class agrees: `class_map.csv` lists it under NA); a special purpose vehicle up to
  3,500 kg that NZTA classes NA, the one class of NZTA's table that is goods and up to that line. A ute has no weight bound of
  its own: a goods ute over 3,500 kg is heavy only because the heavy rule comes first.
- **SUV**: a passenger-registered car or van whose make and model `model_segment.csv` marks `suv`, at any confidence.
- **Passenger**: a passenger-registered car or van whose make and model `model_segment.csv` marks `car`, at any confidence;
  people movers and sports cars included. A passenger-registered van is a people mover, not light commercial. Passenger
  means only models the file marks car.
- **Not yet classified**: every other passenger-registered car or van: a model the file marks `unresolved`, a model it has no
  row for, and one whose vehicle year is outside the year bounds of its row. It is not known to be a car or an SUV, so it is
  counted as neither. A comparison with a published "passenger including SUV" figure adds Passenger, SUV and Not yet
  classified.
- **Other**: what the rules do not name, each in a rule of its own so it can be counted: a special purpose vehicle up to
  3,500 kg of any other NZTA class or none; a motor caravan or special purpose vehicle with no recorded GVM; a goods vehicle
  up to 3,500 kg whose body is an other truck, an articulated truck or a station wagon; a goods vehicle or bus with no recorded
  GVM that no rule above took (a ute with no recorded GVM is Light commercial under rule 2); a three-wheeler registered as a
  passenger vehicle. A recorded GVM of 0 is not recorded. A vehicle no rule matches is not Other: a build would count it as
  unmapped.
- **Other vehicle types** (rules 16 to 18, D-161): a vehicle of any of the nine types outside the five, whatever its body, class
  or mass: motorcycles, mopeds and all-terrain vehicles (231,107 vehicles on the register at 2026-10); trailers and caravans, and
  trailers not designed for highway use (884,271); tractors, high-speed agricultural vehicles, agricultural machines and mobile
  machines (76,981). They are not what the owner's five values describe, and they are kept out of Other so that Other stays
  what the five types' rules leave over, listed so it can be checked: 1,192,359 vehicles of the register's 5,926,990 would
  otherwise swamp it. Only a dataset that counts every vehicle type (the fleet) meets them; the vehicle scope file marks none of
  the nine in `trade_scope`. A passenger-registered three-wheeler stays in Other (rule 14), because it is registered as a passenger
  vehicle.

**Coverage caveat for the SUV file.** The register has no field that says SUV, so SUV, Passenger and Not yet classified rest on
the nameplate file, which does not cover every model. SUV is a floor, and Passenger is a floor too. The build measures how much
of the file's pool it places (below) and publishes the figure with every build.

**Built (D-161).** Market type is the dimension `market_type` (`config/dimensions.json`), derived by the generic `ordered_rules`
kind from `data/reference/market_type_map.csv` and, for the rules that read the nameplate's class, from `model_segment.csv`, which
the build joins onto every vehicle on its canonical make and model (`config/pipeline.json`, `model_classes`; the file's rules are
in "SUV or car, by nameplate" above). It is live on `registrations_surviving` (a slice, and a column of the fact table) and on
`fleet` (a slice), and not on `new_registrations`: the rules need NZTA's class and the gross vehicle mass, which the
dashboard's export does not carry (it does carry the body type), so that dataset's manifest says "the source does not carry" them and it
gets a market type when the history is retaken with them. A vehicle no rule takes stops the build, however few (`abort_on_unmapped` and `abort_on_any_unmapped`): the
five types of the vehicle scope file and the nine others are each named by a rule, and none of the 5,926,990 vehicles of the 2026-10
register is unmapped. Counts are of the vehicles each dataset counts, so the vehicles still registered count the five types in the
months they were first registered, and the fleet counts every vehicle on the register at the snapshot.

**The coverage guard** (`coverage` in the dimension's block of `config/dimensions.json`; invariant 4). The pool is the vehicles of
the five types, fleet entries, new (NZ New), first registered in the trailing 12 months, whose value is Passenger, SUV or Not yet
classified: the passenger-registered cars and vans, whose class comes from the file. Coverage is the share of the pool that is
not Not yet classified. The build warns below 75% and leaves the dimension not live below 70% (or aborts, if it was live in the last
good build, as any dimension that stops being live does). Both are shares of the pool, counted on whole vehicles, and both numbers are
config. The figure is published in each dataset's manifest entry under `dimension_coverage`, for the trailing window and for every
month (`docs/CUBE_SCHEMA.md`). Measured on the 2026-10 pull: the pool of the trailing 12 months holds 110,606 new vehicles, of which
1,454 are Not yet classified, so 98.69% are placed; of every month's new vehicles, 1,963,621 and 630,929 (67.87% placed, which is why
the guard looks at the trailing window); of the trailing window's used imports (not what the guard judges), 89,713 and 8,742 (90.26%).

Trailing 12 months (first registered November 2025 to October 2026), vehicles still registered, five types, as counted on the
2026-10 pull:

| Market type | New (NZ New) | Share | Used imports | Share |
|---|---|---|---|---|
| SUV | 93,720 | 62.54% | 20,003 | 21.16% |
| Light commercial | 33,327 | 22.24% | 3,943 | 4.17% |
| Passenger | 15,432 | 10.30% | 60,968 | 64.48% |
| Heavy commercial | 5,880 | 3.92% | 794 | 0.84% |
| Not yet classified | 1,454 | 0.97% | 8,742 | 9.25% |
| Other | 43 | 0.03% | 103 | 0.11% |
| Total | 149,856 | | 94,553 | |

Market type is not the split of `segment_group` (Vehicle class): that reads the type, body and mass alone, cannot tell an SUV from
a car, and puts buses, motor caravans and special purpose vehicles in Other. The two are different questions and are not
reconciled here.

## Buyer type

A vehicle's buyer type says who registered it, in the four values of `data/reference/buyer_type_map.csv`: **Private**
(NZTA's owner type Individual), **Company** (owner type Company, whatever the usage but rental), **Rental** (owner type
Company with the usage at registration rental) and **Other** (owner type Other: neither a person nor a company). The value is
read from the two columns of NZTA's registrations dashboard, `Owner Type` and `Vehicle usage`, one row of the file for each
pair; the fields, the counts, what the value does and does not say, and the pairs not yet sent are in `docs/DATA_MAP.md`
(*The dashboard's fields*, Buyer type).

- A count by buyer type counts vehicles first registered in the month, as the dataset it is read from does. Each buyer type's
  counts add up to the dataset's total for the month, so a table by buyer type and a table without it give the same total.
- A company includes a dealer registering a demonstrator or stock: the data does not separate them. Rental is companies with
  the rental usage and nobody else; usage splits no other owner type.
- Other holds every owner that is neither a person nor a company, a government body included. It is not named Government,
  because NZTA's data does not say so.
- The owner type is most likely the owner at first registration, not proven (`docs/DATA_MAP.md`); a change of owner after
  registration is not seen.

It is the dimension `buyer_type` of `new_registrations` and of no other dataset (the register carries neither column). It has a
slice, a pair with new or used and a narrow fact table (`docs/CUBE_SCHEMA.md`, *Buyer type*), and no count of it is hidden: it
says what kind of owner registered a vehicle, never who or where (`docs/DATA_MAP.md`), and it is never in one table with a field that
says where the owner lives (D-159). A pair of owner type and usage the file has no row for reads `__UNMAPPED__` and stops the build on any such row, however few (`guardrails.abort_on_any_unmapped`).
The canvas offers it as a field (group Buyer) to break a count or a share down by, drawn from the slice (new and used together); a condition on it, or crossing it with another field, is not drawn yet. No other page of the site reads it.

## Values in edge cases

- **A goods vehicle with a gross mass of zero reads "Not recorded" on the
  segment dimension.** The register records 0 where the mass was not captured
  (`sentinels.csv`), which the pipeline treats as no value. The segment
  reference has ranges of mass for goods vehicles, so a goods vehicle of a body
  type that has them and no mass is "Not recorded", not "No reference match".
  Passenger vehicles ignore mass.
- **A bus, a motor caravan or a special purpose vehicle reads "Other" in both `segment` and `segment_group` (D-157).** Once
  `registrations_surviving` counts the five types of `vehicle_scope.csv`'s `trade_scope` column, these three types reach those two
  dimensions. `segment_map.csv` names car, van, ute and truck for the two types it was written for, and a vehicle of a type and body
  it has no row for reads "No reference match" and counts as unmapped. Eight rows (bus: minibus, service coach, cab and chassis only;
  motor caravan: self-propelled caravan, heavy bus, cab and chassis only; special purpose vehicle: other truck, mobile machine) place
  them in "Other", the value the three-wheelers registered as passenger vehicles already have, with no weight bound. These
  are every type and body the three types hold on the register at 2026-10 (all statuses), so none of them reads "No reference match". This split
  does not call a bus or a motor caravan light or heavy commercial; Market type (D-154, D-155) is the split that places them, by mass.
- **A model whose make has no match in the brand reference keeps the raw make
  in its key.** The model's key is the canonical make, a separator and the
  model; where there is no canonical make, the make as the register records it
  stands in its place. Such a model is therefore listed under the make as
  recorded, while the brand dimension shows "No reference match" for the same
  vehicle. A vehicle with no make or no model has the model "Not recorded".

- **Reserved values in Build (D-109).** Build offers the two reserved values that say something true of the vehicles they hold, and
  not the third. *Not recorded* (the source gave no value) and *no reference match* (a value the reference has no row for) are
  offered like any value: as a value to compare, and as a condition. *Beyond the cap* is where a cardinality cap puts the values
  below it, which are not a group of vehicles and move with the cap's basis; it is not offered to compare or as a condition, and a
  ranking gives it no place. A link that names it for either is not refused: the value is left out, the address is corrected, and the
  page says so in a sentence from config (`builder.notices.left_out`). A condition left with no value keeps every vehicle and is
  held empty on the page, as a condition with no value yet is.
- **The unknown band of a banded field is *not recorded* (D-122).** A field cut into bands keeps its vehicles with no usable value in a
  band of its own (`unknown` in `config/dimensions.json`). The site reads that band as the reserved not-recorded value, so it is labelled
  "Not recorded", takes no place in a ranking, is a grey line on a share over time, follows the scale in a grid, and is chosen as a condition
  or a value under that name. A share by such a field, or by one that holds the reserved value, is a share of everything counted, the
  not-recorded vehicles included, and a line under the chart says so (`share_with_not_recorded`).

## Estimation rules

- Never interpolate a missing month. Render a gap. A month inside the dataset in which nothing is counted is not missing: it is zero
  ("Months in which nothing is counted").
- Never extrapolate beyond the latest snapshot.
- Grey or suppress rather than round to zero: a figure under a guard is never
  drawn or printed as 0 (`What a tripped guard does`, above).
- Any figure the user could mistake for official must carry its dataset's basis note (`basis_note` in `config/dimensions.json`, one per
  dataset, so a table of the register as it stands does not say it counts registrations). For the datasets that count registrations:
  *"Registrations recorded by NZTA. Not the same as vehicle sales."*
