# Data map

**Status: finished (the work order's package E, 2026-11-14), with the privacy classes PROPOSED and
not approved.** Until the user approves them, the work order's §3 is binding: no owner field
(district, region, usage, industry class, owner type), no postcode and nothing derived from `VIN11`
is published. Nothing here binds a field. Build still offers only what `config/dimensions.json`
defines.

The same map in machine-readable form is `config/data_map.json`, kept true to the pipeline's config
by `pipeline/tests/test_data_map.py`. That file holds no measured figure; the figures are here.

## How to read this map

- **Sources and bases.** Every figure names its basis:
  - **S**: the site's in-scope dataset, `registrations_surviving` as built: passenger cars and vans,
    and goods vans, utes and trucks, first registered new or used. 4,520,476 vehicles: NEW 2,732,333,
    USED 1,788,143; car/van 3,617,900, goods 902,576.
  - **W**: the whole register, every vehicle type and import status: 5,926,990 vehicles.
  - **D**: NZTA's registrations dashboard, the user's export of January 2021 to October 2026: 991,274
    rows, 1,883,786 vehicles (D-084, D-087).
- **Where the figures come from.** The register as at 31 October 2026:
  - 35 fields: a read-only profile, run on 2026-11-14 on the private archive's `mvr-2026-10.parquet`
    (the file without `VIN11` and `POSTCODE`). Its report and tables are in gitignored
    `data/staging/profiles/2026-10/`; they are not in the repository.
  - `VIN11` and `POSTCODE`: the archive's 37-field file, measured on 2026-11-13 (D-076, D-079).
  - `OBJECTID`, `CHASSIS7`, `ENGINE_NUMBER`: the first pass of 2026-11-13, count queries on NZTA's live
    service (W). They were not profiled again.
  - The dashboard's columns: the comparison of 2026-11-14 (D-087).
- **"Recorded"** means a real value: not NULL, not a word meaning nothing (UNKNOWN, NOT KNOWN, NONE,
  N/A, `-` and the like), and above zero for a number. `OTHER` and the class code `NA` count as real
  values. A zero engine size on an electric vehicle counts as not recorded, so engine-size coverage
  falls where electric vehicles are many.
- **NZTA's words** are in quotes: from its field descriptions (ArcGIS item
  `de5669aeb6304620b09e79fe84f40b7c`) or its dashboard page, as the first pass read them. A meaning
  that is a reading of the data rather than a check is marked **inferred - confirm**.
- **"Few" or "many"** values: few is at most 8 recorded values in the dataset the field serves
  (`cardinality.few_max_values` in `config/data_map.json`), the number of line colours the site can
  tell apart (`src/lib/theme.ts`, D-060). Numbers, codes and free text are always "many".
- **Moves together** is the bias-corrected Cramér's V between two fields, from 0 (no association) to
  1 (one decides the other), over S rows where both are recorded, with numbers cut into bands. It
  says how strongly two fields move together and nothing about why.

Each field below has the same parts: meaning; kind and values; uses; coverage; not recorded; traps;
privacy; relations.

## Summary

Uses: **B** break down, **F** filter, then what can be measured (count only, or also an average
and a median). Values are S then W. Privacy is the proposed class, and is not approved.

| Field | Kind | Values (S; W) | Uses | Privacy (proposed) | Bound as |
|---|---|---|---|---|---|
| `FIRST_NZ_REGISTRATION_YEAR` | time | 107; 127 | B F, count | public | `registration_year` |
| `FIRST_NZ_REGISTRATION_MONTH` | time | 12; 12 | B F, count | public | `registration_month` |
| `VEHICLE_YEAR` | number | 128; 136 | B (banded) F, count | public | `vehicle_year` |
| `VEHICLE_TYPE` | category, few | 2; 14 | B F, count | public | `vehicle_type` |
| `BODY_TYPE` | category, many | 13; 27 | B F, count | public | `body_type` |
| `CLASS` | category, few | 7; 21 | B F, count | public | no |
| `MAKE` | category, many | 371; 1,030 | B F, count | public | `make` |
| `MODEL` | category, many | 28,000; 175,398 | B (within make) F, count | public | `model` |
| `BASIC_COLOUR` | category, many | 14; 14 | B F, count | public | no |
| `NUMBER_OF_SEATS` | number | 172; 193 | B (banded) F, count, average, median | public | no |
| `NUMBER_OF_AXLES` | number | 10; 10 | F, count | public | no |
| `TRANSMISSION_TYPE` | category, many | 28; 28 | B F, count (NZ-new only) | public | no |
| `SYNTHETIC_GREENHOUSE_GAS` | category, many | 38; 39 | B F, count (from 2010) | public | no |
| `MOTIVE_POWER` | category, many | 15; 18 | B F, count | public | `motive_power` |
| `ALTERNATIVE_MOTIVE_POWER` | category, many | 9; 9 | F, count | public | `alternative_motive_power` |
| `CC_RATING` | number | 5,934; 7,644 | B (banded) F, count, average, median (engines only) | public | `cc` |
| `POWER_RATING` | number | 467; 488 | B (banded) F, count, average, median (NZ-new only) | public | no |
| `FC_COMBINED` | number | 292; 300 | B (banded) F, count, average, median (engines only) | public | `fuel_consumption` |
| `FC_URBAN` | number | 293; 297 | F, count, average, median | public | no |
| `FC_EXTRA_URBAN` | number | 234; 238 | F, count, average, median | public | no |
| `GROSS_VEHICLE_MASS` | number | 5,372; 9,398 | B (banded) F, count, average, median | public | `gvm` |
| `VDAM_WEIGHT` | number | 86; 139 | F, count, average, median (heavy vehicles) | public | no |
| `HEIGHT` | number | 994; 1,627 | F, count, average, median (heavy vehicles) | public | no |
| `WIDTH` | number | 870; 1,128 | F, count, average, median (heavy vehicles) | public | no |
| `IMPORT_STATUS` | category, few | 2; 4 | B F, count | public | `import_status` |
| `ORIGINAL_COUNTRY` | category, many | 46; 48 | B F, count | public | `original_country` |
| `PREVIOUS_COUNTRY` | category, many | 45; 49 | B F, count (used imports) | public | `previous_country` |
| `NZ_ASSEMBLED` | category, few | 3; 3 | B F, count (from 2000) | public | no |
| `TLA` | place, many | 67; 67 | B F, count | held for review | `tla` |
| `POSTCODE` | place, many | not measured; 1,331 | B F, count | held for review | no |
| `VEHICLE_USAGE` | category, few | 7; 8 | B F, count | held for review | no |
| `INDUSTRY_CLASS` | category, many | 15; 15 | B F, count | held for review | no |
| `ROAD_TRANSPORT_CODE` | category, many | 20; 20 | B F, count (heavy-vehicle topics) | held for review | no |
| `SUBMODEL` | free text | 60,999; 93,703 | none (search at most) | public | no |
| `MVMA_MODEL_CODE` | identifier | 24,866; 30,633 | none (lookup key) | public | no |
| `INDUSTRY_MODEL_CODE` | identifier | 47,961; 61,555 | none (lookup key) | public | no |
| `VIN11` | identifier | not measured; 200,725 | none | never published | no |
| `CHASSIS7` | identifier | not measured | none | never pulled | no |
| `ENGINE_NUMBER` | identifier | not measured | none | never pulled | no |
| `OBJECTID` | identifier | one per row | none | never published | `object_id` |

The dashboard's 13 columns follow the same shape in "The dashboard's fields" below: ten are proposed
public; `Owner Type`, `Territorial authority` and `Vehicle usage` are held for the review.

Counts. Register: 17 bound and 23 not. By kind: 17 category, 12 number, 6 identifier, 2 time,
2 place, 1 free text. By proposed class: 31 public, 5 held for the review, 2 never published,
2 never pulled. Dashboard: 10 category, 1 time, 1 number, 1 place; 10 public, 3 held.

## Privacy classes: proposed, for the user to approve

| Class | Fields | Why |
|---|---|---|
| Proposed public | The 31 register fields that describe the vehicle; the dashboard's 10 vehicle columns | They describe the vehicle, not its owner, and NZTA publishes each of them vehicle by vehicle |
| Held: not published before the privacy review | `TLA` (and `region` from it), `POSTCODE`, `VEHICLE_USAGE`, `INDUSTRY_CLASS`, `ROAD_TRANSPORT_CODE`; the dashboard's `Owner Type`, `Territorial authority`, `Vehicle usage` | They describe or locate the owner. Proposed for after the review: public only above a minimum count; the postcode only as area totals above a minimum count (D-076) |
| Never published | `VIN11`, `OBJECTID` | `VIN11` narrows a vehicle to a handful, and only a field derived from it may be published, once checked and approved (D-076, D-079). `OBJECTID` is a row number |
| Never pulled | `CHASSIS7`, `ENGINE_NUMBER` | They identify a vehicle and serve no question (D-062, D-076; `register_archive.never_pulled`) |

**Where the classes already have an exception.** The `region` slice, derived from `TLA`, is in the
public release `cube-2026-10` and in every build; the fact table leaves `region` out (D-078). The
data map records this as the one exception (`published_exceptions` on `TLA`), and the test fails if
any other published output reads a held field.

**Why public fields still need care.** A cell that counts one vehicle shows nothing NZTA does not
publish for that vehicle today. What the site adds is time: a monthly series of published files.
With fine vehicle detail alone, half the fact table's rows already count one vehicle (50.2% of rows,
7.1% of vehicles, the 2026-10 dry run, D-078). Each field bound into the table makes that share
larger. With no owner field in the table, following such a cell from month to month shows only
whether a vehicle is still registered.

The questions the user is asked are listed in the draft decision record for this map, and in the
report that delivered it.

## Identity and time

### `FIRST_NZ_REGISTRATION_YEAR`

- **Meaning.** The year the vehicle was first registered in New Zealand. Checked: no S row is dated
  after October 2026, the snapshot month. Re-registered vehicles are not in S.
- **Kind and values.** Time. 107 values on S, 127 on W. The earliest on S is 1912 (the first pass
  read 1899 to 2026 on W); 69,109 S vehicles were first registered before 1980.
- **Uses.** The time axis; break down by year, filter. Count only.
- **Coverage.** Every vehicle but 188 on W (172 on S), which have neither a year nor a month.
- **Not recorded.** NULL, covered by `sentinels.csv`. The 172 S vehicles cannot be placed in a
  month and are counted in the manifest (`docs/MODEL_AND_AGE.md` §5).
- **Traps.** A count by this year is of survivors, not registrations (`docs/METRICS.md`).
- **Privacy.** Proposed public.
- **Relations.** With the month, it picks out a vehicle in combination with other fields. Moves
  together with: vehicle year (banded) 0.64, true by construction for NZ-new vehicles from 2007;
  then transmission 0.37 and where assembled 0.30 (measured).

### `FIRST_NZ_REGISTRATION_MONTH`

- **Meaning.** The month of the year, 1 to 12, of first registration in New Zealand.
- **Kind and values.** Time, 12 values.
- **Uses.** With the year, the month axis; on its own, a seasonal breakdown. Count only.
- **Coverage.** As the year: all but 188 vehicles on W, 172 on S.
- **Not recorded.** NULL, covered.
- **Traps.** Counts by month of year are seasonal: on S, January 377,650 and June 418,581 vehicles.
  2026 holds months 1 to 10 only.
- **Privacy.** Proposed public.
- **Relations.** Picks out a vehicle in combination. It moves with no field above 0.05.

### `VEHICLE_YEAR`

- **Meaning.** NZTA's field description says "year of manufacture or model year – if unknown, year of
  first registration"; its dashboard page says "the year of first registration anywhere". The data
  supports the second from 2007: equal to the first NZ registration year on 100% of 2,238,676 S NZ-new
  vehicles registered from 2007, and on 93.8% of earlier NZ-new vehicles. For used imports it equals
  the registration year on 0.4% to 0.8%: it is a year from the vehicle's life overseas. It is not the
  model year (`docs/MODEL_AND_AGE.md` §1, where the regimes before 2007 are set out).
- **Kind and values.** Number (a year). 128 values on S, 136 on W. S runs from 1900 to 2027 (the
  first pass read 1890 to 2027 on W).
- **Uses.** Break down banded: as vehicle age (`vehicle_year_band`) and as age at first registration
  (`age_at_registration_band`). Filter. Count only; age measures are derived and scoped to used
  imports (`docs/METRICS.md`).
- **Coverage.** Every vehicle but one.
- **Not recorded.** Zero, on 1 vehicle (W and S), covered by `sentinels.csv`.
- **Traps.** 3,756 S vehicles have a vehicle year after their registration year, 20 of them by more
  than a year; they fall to the age bands' `unknown`. Any series that includes NZ-new vehicles and
  crosses January 2007 needs a break marker.
- **Privacy.** Proposed public.
- **Relations.** Picks out a vehicle in combination. Moves together with: registration year (banded)
  0.64 and import status 0.48, both by construction; transmission 0.34 (measured).

## What the vehicle is

### `VEHICLE_TYPE`

- **Meaning.** NZTA's vehicle type. It decides what the site counts (`vehicle_scope.csv`).
- **Kind and values.** Category. 2 values on S (passenger car/van 3,617,900; goods van, truck or
  utility 902,576), 14 on W (trailers and caravans 883,184, motorcycles 192,024 and others).
- **Uses.** Break down, filter. Count only.
- **Coverage.** Every vehicle.
- **Not recorded.** No form seen.
- **Traps.** None in the data beyond the body types it shares (below).
- **Privacy.** Proposed public.
- **Relations.** Moves together with: class 1.00 and body type 0.97 (by definition, inferred -
  confirm); road transport code 0.82 on the 57,232 S vehicles that have one; gross vehicle mass
  (banded) 0.77 (measured).

### `BODY_TYPE`

- **Meaning.** NZTA's body type. Most SUVs are recorded as station wagons and cannot be told apart
  from them (`segment_map.csv`; D-003).
- **Kind and values.** Category. 13 values on S, 27 on W. S: station wagon 1,692,157; hatchback
  1,210,348; saloon 587,739; utility 556,953.
- **Uses.** Break down, filter. Count only.
- **Coverage.** Every vehicle.
- **Not recorded.** No form seen.
- **Traps.** **It does not roll up to vehicle type.** 4 of the 13 S body types sit under both vehicle
  types: 41,952 S vehicles (0.9%) are not under their body type's commoner type. On S, 32,977 light
  vans and 5,087 utilities are passenger vehicles. On W, 9 of 27 body types have two parents (88,124
  vehicles off the commoner one).
- **Privacy.** Proposed public.
- **Relations.** Moves together with: vehicle type 0.97 and class 0.71 (by definition, inferred -
  confirm); gross vehicle mass (banded) 0.53 and seats (banded) 0.43 (measured).

### `CLASS`

- **Meaning.** NZTA: "Vehicle equipment standard classification". A short code. Read from the data
  (inferred - confirm against NZTA's class definitions): codes beginning M are passenger vehicles,
  N goods vehicles, T trailers and L motorcycle-type vehicles. MA holds most cars; MC is the passenger
  class for off-road vehicles (402,266 of its 414,719 S vehicles are station wagons); MB holds light
  vans; NA, NB and NC are goods classes holding, in turn, utes and light vans, then trucks, then
  heavier trucks.
- **Kind and values.** Category. 7 values on S, 21 on W. S: MA 3,018,623; NA 701,639; MC 414,719;
  NB 72,851; NC 68,051; MB 8,848; LE 1,702.
- **Uses.** Break down from 2000, filter. Count only.
- **Coverage.** S 94.8% (NEW 92.4%, USED 98.5%): before 1990 8.1%, 1990s 30.2%, 2000s 98.2%, and
  100% from 2010. W 93.5%.
- **Not recorded.** NULL (W 385,434; S 234,043), covered.
- **Traps.** **`NA` is a class, not "not applicable"**: 701,639 S goods vehicles. A rule that treats
  `NA` as missing would remove nearly every light commercial. It must never become a sentinel. MC is
  not an SUV marker on its own (`segment_map.csv`'s note). A chart over time starts in 2000.
- **Privacy.** Proposed public.
- **Relations.** Rolls up to vehicle type on S (1 vehicle of 4,286,433 with a class disagrees); not
  on W (6 of 21 classes have two parents, 99,365 vehicles off). Moves together with: vehicle type
  1.00, body type 0.71 and gross vehicle mass (banded) 0.57 (all by definition, inferred - confirm);
  road transport code 0.44 on 57,020 vehicles.

### `MAKE`

- **Meaning.** The make as NZTA records it. NZTA marks it free text and has cleaned it
  algorithmically; the site maps it to a brand through `brand_registry.csv` and `model_registry.csv`.
- **Kind and values.** Category. 371 values on S, 1,030 on W; 73 appear once on S. S: Toyota
  1,135,722; Nissan 429,546; Mazda 386,990.
- **Uses.** Break down (a ranking), filter. Count only.
- **Coverage.** Every vehicle.
- **Not recorded.** No form seen.
- **Traps.** Sub-brands and bare words persist (`model_registry.csv`). `TRAILER` is a make on W
  (549,041 vehicles; 3 on S).
- **Privacy.** Proposed public.
- **Relations.** Rolls up to manufacturer group and to owner country through `brand_registry.csv`,
  by construction. Picks out a vehicle in combination. Not measured for moving together (too many
  values).

### `MODEL`

- **Meaning.** The model name as NZTA records it, cleaned by NZTA. It means something only inside its
  make.
- **Kind and values.** Category. 28,000 values on S (16,696 appear once), 175,398 on W (123,251 once).
  S: Corolla 173,420; Hilux 161,092; Ranger 134,798.
- **Uses.** Break down within a make (the `model` dimension keeps the 300 with most volume over the
  trailing 12 months), filter. Count only.
- **Coverage.** S 99.9%; before 1990, 96.6%. W 99.6%.
- **Not recorded.** NULL (W 24,971; S 4,108), covered. Words that mean nothing, not yet in
  `sentinels.csv`: `UNKNOWN` (W 24), `NOT KNOWN` (1), `UNK` (1), `N/A` (7), `-` (7), `.` (1), `0`
  (2), `000` (1). Candidates that need a look by make before they become sentinels: `X` (W 112,
  S 101), `XX` (3), `OTHER` (W 15), `NA` (W 5, S 3).
- **Traps.** Stray spaces on 545 W vehicles (65 S); 239 further duplicates once values are
  upper-cased and trimmed (the profile does not give the basis); one row is not upper case. The
  same model name sits under more than one make for 1,427 of 28,000 S models (40,793 vehicles off
  the commoner make).
- **Privacy.** Proposed public.
- **Relations.** Rolls up to make only as the make-and-model pair the site builds; the raw name does
  not. Picks out a vehicle in combination. Not measured for moving together.

### `BASIC_COLOUR`

- **Meaning.** NZTA: "The predominant colour of the vehicle". Whether it is the colour at first
  registration or today is not shown by the data; read as today's (inferred - confirm).
- **Kind and values.** Category, 14 values (W and S). S: white 1,194,221; silver 787,901; black
  567,210; blue 564,009; grey 537,023.
- **Uses.** Break down, filter. Count only.
- **Coverage.** S 100.0% in every period; W all but 6.
- **Not recorded.** NULL (W 6, S 5), covered.
- **Traps.** None found.
- **Privacy.** Proposed public.
- **Relations.** Picks out a vehicle in combination. Moves together with nothing strongly: vehicle
  type 0.25, import status 0.15, vehicle year (banded) 0.15, gross vehicle mass (banded) 0.14.

### `NUMBER_OF_SEATS`

- **Meaning.** NZTA: "Records the number of seats in a vehicle".
- **Kind and values.** Number. 172 values on S, 193 on W. Median 5.
- **Uses.** Break down banded, filter; average and median inside the guard. Proposed bands, with the
  S share inside the range: 1-2 (4.5%), 3-4 (8.1%), 5 (75.4%), 6-7 (9.8%), 8+ (2.2%).
- **Coverage.** S 99.8% (NEW 99.7%, USED 100.0%); the 1990s 94.7%. W 79.8%: trailers and motorcycles
  have none.
- **Not recorded.** Zero (S 8,408, almost all NZ-new; W 1,200,405). **Not in `sentinels.csv`.**
- **Traps.** 207 S vehicles have more than 60 seats (up to 999); 158 S vehicles with about 50 seats
  are cars or goods vehicles. Proposed guard: 1 to 60. The mean moves little (S 5.011 over every
  real value, 5.001 inside the guard).
- **Privacy.** Proposed public.
- **Relations.** Moves together with: vehicle type 0.49, road transport code 0.44 (57,219 vehicles),
  body type 0.43 (measured).

### `NUMBER_OF_AXLES`

- **Meaning.** NZTA: "Records the number of axles the vehicle has".
- **Kind and values.** Number, 10 values. 2 axles on 3,735,046 S vehicles, 98.5% of those inside the
  range.
- **Uses.** Filter only (three or more axles). Not a breakdown: nearly every vehicle has two.
- **Coverage.** S 83.9% (NEW 87.8%, USED 77.9%): before 1990 11.5%, 1990s 38.9%, 2000s 65.5%, 2010s
  88.8%, 2020 to 2026 95.6%; 2023 alone 86.8%. W 80.5%.
- **Not recorded.** Zero (S 727,150). **Not in `sentinels.csv`.**
- **Traps.** One axle (S 1,966) and seven to nine (S 15) are implausible for these vehicles. A zero
  is common on cars too, so axles are not a clean heavy-vehicle marker.
- **Privacy.** Proposed public.
- **Relations.** Not measured for moving together.

### `TRANSMISSION_TYPE`

- **Meaning.** NZTA: "The gearing system the vehicle has", which it says is "infrequently recorded".
  The values give the number of gears and automatic or manual, or continuously variable.
- **Kind and values.** Category, 28 values. S: 6-gear auto 719,347; continuously variable 492,914;
  4-gear auto 280,612; 5-gear manual 254,689.
- **Uses.** Break down and filter, NZ-new vehicles only. Count only. A grouping into automatic,
  manual, continuously variable and other would be a reference lookup (invariant 4).
- **Coverage.** **NZ-new only**: NEW 92.1%, USED 0.0% (107 vehicles). Nothing before 1990; 1990s
  33.9%; from 2000 between 56.9% and 64.2% of all S vehicles. W 43.7%.
- **Not recorded.** NULL, covered.
- **Traps.** `OTHER` is a recorded value on 110,739 S vehicles, 105,880 of them first registered from
  2020; what it holds is not shown (electric drives, inferred - confirm). A question using this field
  is narrowed to NZ-new vehicles and says so.
- **Privacy.** Proposed public.
- **Relations.** Recorded on the same vehicles as power and the MVMA model code (below). Moves
  together with: vehicle type 0.54, class 0.43, gross vehicle mass (banded) 0.40, registration year
  (banded) 0.37 (measured).

### `SYNTHETIC_GREENHOUSE_GAS`

- **Meaning.** NZTA: "The refridgerant used in the air-conditioning system" (NZTA's spelling).
- **Kind and values.** Category. 38 values on S, 39 on W. S: HFC-134A (R134A) 2,882,961;
  HFO-1234YF (R1234YF) 195,514; R404A 35,437.
- **Uses.** Break down and filter from 2010. Count only.
- **Coverage.** S 69.0%: none before 2010, 77.9% for 2010 to 2019, 99.4% to 99.7% in each year from
  2021. W 54.0%.
- **Not recorded.** NULL, covered. `UNKNOWN` (W 37,425; S 5,749), **not in `sentinels.csv`**.
- **Traps.** `NOT ON LIST` (W 56, S 36) is a recorded value. Some values look like spellings of one
  refrigerant. R404A sits on 35,377 S passenger cars; not checked against specifications. A chart
  over time starts in 2010.
- **Privacy.** Proposed public.
- **Relations.** Moves together with nothing strongly: vehicle year (banded) 0.23, import status
  0.20.

## How it is powered

### `MOTIVE_POWER`

- **Meaning.** The primary fuel, in NZTA's spellings (`PLUGIN`, not `PLUG-IN`). The hybrid codes do
  not say whether a hybrid is mild or full (`docs/DATA_SOURCES.md`; `mild_hybrid_models.csv`). The
  site's powertrain is derived from it.
- **Kind and values.** Category. 15 values on S, 18 on W. S: petrol 2,830,413; diesel 1,056,495;
  petrol hybrid 439,891; electric 106,978; plug-in petrol hybrid 54,809.
- **Uses.** Break down (as powertrain), filter. Count only.
- **Coverage.** Every S vehicle. W 85.1%: trailers have none (884,255 NULL).
- **Not recorded.** NULL, covered.
- **Traps.** `OTHER` is a recorded catch-all (S 115). Two petrol hybrid codes are in use at once.
- **Privacy.** Proposed public.
- **Relations.** Moves together with: vehicle type 0.72, combined fuel consumption (banded) 0.49,
  transmission 0.34 (measured).

### `ALTERNATIVE_MOTIVE_POWER`

- **Meaning.** A second fuel. Empty when the vehicle has none: an empty value means "none", not "not
  recorded".
- **Kind and values.** Category, 9 values. 5,792 S vehicles (0.13%) have one: LPG 3,084, CNG 2,612.
- **Uses.** Filter only ("also runs on LPG or CNG"). Too sparse to break down. Bound today only so the
  build can report dual-fuel vehicles; the powertrain ignores it (`docs/DATA_SOURCES.md`).
- **Coverage.** S 0.1%; before 1990, 3.4%.
- **Not recorded.** None: NULL is "none".
- **Traps.** **`sentinels.csv`'s rule for every field turns NULL into "not recorded", which is wrong
  here**: binding it as a breakdown needs a "none" label instead. Petrol (S 51), diesel (24) and
  `OTHER` (1) as a second fuel are odd beside a primary fuel.
- **Privacy.** Proposed public.
- **Relations.** Not measured for moving together.

### `CC_RATING`

- **Meaning.** Engine capacity in cubic centimetres. NZTA's dashboard page: "engine size ... This also
  includes electric vehicles." Electric vehicles hold 0 (93,190 of 106,978 S) or 1 (12,802), not an
  engine size.
- **Kind and values.** Number. 5,934 values on S, 7,644 on W. Median on S 1,998.
- **Uses.** Break down banded (`engine_size_band`), filter; average and median over vehicles with an
  engine, inside the guard. The profile's bands, S share inside the range: under 1,000 (1.2%),
  1,000-1,499 (21.4%), 1,500-1,999 (32.0%), 2,000-2,499 (19.1%), 2,500-2,999 (12.3%), 3,000-3,999
  (7.8%), 4,000-5,999 (3.9%), 6,000 and over (2.3%).
- **Coverage.** S 97.9% (NEW 97.2%, USED 99.0%); 2020 to 2026 94.4%, because a zero counts as not
  recorded. W 83.4%.
- **Not recorded.** Zero means "no engine" on an electric vehicle and "not recorded" on one with an
  engine. It is deliberately not a sentinel: the engine band decides it from
  `has_combustion_engine` in `powertrain_map.csv` (`docs/DATA_SOURCES.md`).
- **Traps.** 999 cc is a real size (S 11,811, Ford and Volkswagen 1.0-litre petrol), not a
  placeholder. 1 cc appears on 13,446 S vehicles, 12,802 of them electric. 16,350 cc on 1,093 trucks
  is real; above 20,000 (S 382, up to 98,930) is not. Proposed guard: 50 to 20,000, engines only;
  13,952 S vehicles fall outside it. **The bound band "4.0 L and over" has no upper limit**, so those
  382 values land in it today. Never average over every vehicle: the zeros pull it down.
- **Privacy.** Proposed public.
- **Relations.** Picks out a vehicle in combination. Moves together with: gross vehicle mass (banded)
  0.52, vehicle type 0.52, class 0.44, combined fuel consumption (banded) 0.42 (measured).

### `POWER_RATING`

- **Meaning.** NZTA: "The power rating of the vehicle", in kilowatts. NZTA's dashboard page: power
  is "Only recorded for NZ New vehicles".
- **Kind and values.** Number. 467 values on S, 488 on W. Median on S 126.
- **Uses.** Break down banded and filter, NZ-new only; average and median inside the guard. Bands,
  S share inside the range: under 75 (7.3%), 75-99 (13.0%), 100-149 (54.6%), 150-199 (16.0%),
  200-299 (6.9%), 300-499 (2.1%), 500 and over (0.1%).
- **Coverage.** **NZ-new only**: NEW 92.7%, USED 0.0%. Nothing before 1990. W 46.3%.
- **Not recorded.** Zero (S 1,988,207: every used import and about 200,000 NZ-new vehicles). **Not in
  `sentinels.csv`.**
- **Traps.** 999 on 118 S vehicles (107 of them Jaguar petrol) is a placeholder. 99 on 4,016
  (2,916 Mitsubishi petrol) may be real or a default: unverified. 59 S vehicles are below 5 kW.
  Proposed guard: 5 to 900 (192 S vehicles outside).
- **Privacy.** Proposed public.
- **Relations.** Recorded on the same vehicles as transmission and the MVMA code: all three on
  2,517,036 S vehicles (2,516,929 NZ-new, 107 used), 92.1% of NZ-new. Picks out a vehicle in
  combination. Moves together with: engine size (banded) 0.37, transmission 0.32, combined fuel
  consumption (banded) 0.31 (measured). Its 0.34 with previous country rests on 114 vehicles and
  means nothing.

### `FC_COMBINED`

- **Meaning.** Fuel consumption over the combined test cycle, litres per 100 km, as recorded at
  registration. Stored as text.
- **Kind and values.** Number. 292 values on S, 300 on W. Median on S 7.1.
- **Uses.** The site's mean fuel consumption (`fc_sum`, `fc_n`: `docs/METRICS.md`); break down
  banded and filter. Bands, S share inside the range: under 2 (1.2%), 2-3.9 (7.6%), 4-5.9 (20.4%),
  6-7.9 (39.8%), 8-9.9 (23.8%), 10-11.9 (5.5%), 12 and over (1.7%).
- **Coverage.** S 75.3% (NEW 76.0%, USED 74.2%; goods vehicles NEW 71.2%, USED 37.0%): nothing before
  2000, 30.4% for 2000 to 2009, 89.7% for 2010 to 2019, 90.3% since. W 58.7%. Only 11 of 106,978 S
  electric vehicles have a value.
- **Not recorded.** NULL, covered.
- **Traps.** Whole numbers have no decimal point. Medians differ by powertrain (plug-in hybrid 1.7,
  petrol hybrid 3.8, petrol 7.0), so a mean over all powertrains reflects the mix. **The bound guard
  is above 0 and at most 60** (`config/pipeline.json`); the profile's proposed range is 0.1 to 30,
  with 83 S values above 30 (largest 95). How many lie above 60 was not measured.
- **Privacy.** Proposed public.
- **Relations.** Moves together with: motive power 0.49, engine size (banded) 0.42, vehicle type 0.40
  (measured).

### `FC_URBAN` and `FC_EXTRA_URBAN`

- **Meaning.** Fuel consumption over the urban and the extra-urban test cycles, litres per 100 km.
  Stored as text.
- **Kind and values.** Numbers: urban 293 values on S (297 W), median 9.3; extra-urban 234 (238),
  median 6.4.
- **Uses.** Filter; average and median inside the guard, beside the combined figure. Not
  breakdowns: the combined figure does that.
- **Coverage.** Mostly NZ-new: urban NEW 49.8%, USED 1.8%; extra-urban NEW 47.2%, USED 1.8% (S).
  None before 2000; 2000 to 2009, urban 17.9% and extra-urban 7.4%; about 35% to 37% of S since 2010.
  W 24.1% and 22.9%.
- **Not recorded.** NULL, covered.
- **Traps.** The combined figure is outside the urban-to-extra-urban range on 5,297 of 1,280,676 S
  vehicles that have all three. Proposed guards: urban above 0 to 40 (11 S above), extra-urban above
  0 to 30 (60 S at 30 or more).
- **Privacy.** Proposed public.
- **Relations.** 97.6% of the S vehicles with an urban figure also have power (1,359,738 of
  1,393,284). Not measured for moving together.

## Size and weight

### `GROSS_VEHICLE_MASS`

- **Meaning.** The vehicle's maximum laden mass, in kilograms, as recorded. Not its empty weight.
- **Kind and values.** Number. 5,372 values on S, 9,398 on W. Median on S 1,970.
- **Uses.** Used by the segment (`segment_map.csv`). Break down banded, filter; average and median
  inside the guard, split by vehicle type; never a total. Bands, S share inside the range: 300-1,199
  (0.9%), 1,200-1,599 (21.3%), 1,600-1,999 (29.3%), 2,000-2,499 (20.9%), 2,500-3,499 (23.7%),
  3,500-7,499 (1.6%), 7,500 and over (2.2%).
- **Coverage.** S 93.8%: goods vehicles 100%, cars 92.3%. Before 1990 26.8%, 1990s 65.6%, 2000s 88.3%,
  2010s 97.5%, 2020 to 2026 99.5%. W 81.7%.
- **Not recorded.** Zero (S 280,297: 186,280 NZ-new and 93,905 used cars), covered. 112 S goods
  vehicles have zero (`sentinels.csv`'s note gives 89 at 2026-08 for those matching no
  `segment_map.csv` row; whether these are the same vehicles was not checked).
- **Traps.** 1 kg is a placeholder (S 1,477), and `segment_map.csv`'s goods rows start at 1 kg, so a
  goods vehicle at 1 kg lands in a light class; how many do was not measured. The largest on S is
  315,600 (787,627 on W). Proposed guard: 300 to 60,000 (1,824 S outside). A mean over cars and
  trucks together is set by the trucks.
- **Privacy.** Proposed public.
- **Relations.** Picks out a vehicle in combination. Moves together with: vehicle type 0.77 and engine
  size (banded) 0.52 (measured); class 0.57 and body type 0.53 (by definition, inferred - confirm).

### `VDAM_WEIGHT`

- **Meaning.** NZTA: "The maximum allowable laden weight for the vehicle on the road", in kilograms.
  A different measure from gross vehicle mass: higher on 121,696 and lower on 60,407 of the 182,103
  S vehicles that have both.
- **Kind and values.** Number. 86 values on S, 139 on W. S runs from 1,855 to 54,000; 14,200 holds
  79,061 vehicles, and 12,000, 21,000 and 26,000 are also common.
- **Uses.** Filter; average and median inside the guard for heavy vehicles. Bands, S share: under
  13,000 (25.6%), 13,000-19,999 (44.3%), 20,000-24,999 (16.9%), 25,000 and over (13.3%).
- **Coverage.** Heavy vehicles: goods 16.0% on S (used goods 28.5%, NZ-new goods 13.7%), cars 1.1%.
  W 5.0%.
- **Not recorded.** Zero (S 4,337,512). **Not in `sentinels.csv`.**
- **Traps.** Bunched on a few values. Proposed guard: 1,000 to 60,000 (none outside on S, 2 on W).
- **Privacy.** Proposed public.
- **Relations.** Recorded with axles on 182,960 of the 182,964 S vehicles that have it. Not measured
  for moving together.

### `HEIGHT` and `WIDTH`

- **Meaning.** The vehicle's height and width in millimetres. No length field exists.
- **Kind and values.** Numbers. Height 994 values on S (1,627 W), median 3,000; width 870 (1,128),
  median 2,430.
- **Uses.** Filter; average and median inside the guard, heavy vehicles only. Height bands, S share:
  1,000-1,999 (4.0%), 2,000-2,999 (44.2%), 3,000-3,499 (23.6%), 3,500-3,999 (15.8%), 4,000-4,600
  (12.4%). Width: 1,200-1,799 (9.4%), 1,800-2,199 (22.1%), 2,200-2,449 (19.3%), 2,450-2,499 (17.1%),
  2,500-2,600 (32.2%).
- **Coverage.** Goods vehicles over 3.5 t, not cars: height on 93,654 of 94,640 S goods vehicles over
  7.5 t, 47,503 of 65,998 from 3.5 t to 7.5 t, and 1,153 of 741,938 under 3.5 t. S 3.2% each (goods
  15.8% and 16.0%; cars 0.0%). W 4.2% and 4.3%. Together on 143,775 S vehicles.
- **Not recorded.** Zero. **Not in `sentinels.csv`.**
- **Traps.** **The worst guards in the register.** 1 mm is a placeholder (height S 4,722; width
  S 822). Some values look like centimetres (height 100 to 460: 92 S; width 150 to 299: 1,967 S) and
  some ten times too large (height 10,000 and over: 91 S); the largest are 44,260 and 50,300.
  Proposed guards: height 1,000 to 4,600 (5,020 S outside, 3.5% of those recorded), width 1,200 to
  2,600 (4,278 outside, 2.9%). Without them the mean height is 2.8% lower and the mean width 1.0%
  lower.
- **Privacy.** Proposed public.
- **Relations.** Not measured for moving together.

## Where it came from

### `IMPORT_STATUS`

- **Meaning.** NZTA's dashboard page: "the vehicle's status when it was registered". New or used when
  first registered in New Zealand; `RE-REG` is a vehicle returning to the register and `SCRATCH` is
  home-built (`import_status_map.csv`).
- **Kind and values.** Category. 2 values on S; 4 on W: NEW 3,680,531, USED 1,938,692, RE-REG
  282,573, SCRATCH 25,194.
- **Uses.** Break down, filter. Count only.
- **Coverage.** Every vehicle.
- **Not recorded.** No form seen.
- **Traps.** It decides which other fields exist: power, transmission and the MVMA code for NZ-new
  vehicles; previous country and the industry model code for used imports.
- **Privacy.** Proposed public.
- **Relations.** Moves together with: age at registration 0.99 and vehicle year (banded) 0.48, both by
  construction; country built in 0.53 and gross vehicle mass (banded) 0.47 (measured).

### `ORIGINAL_COUNTRY`

- **Meaning.** NZTA's dashboard page: "the country where the vehicle was principally manufactured".
  "Built in", not the brand's home country, which comes from `brand_registry.csv` (CLAUDE.md trap 2).
- **Kind and values.** Category. 46 values on S, 48 on W.
- **Uses.** Break down ("Built in"), filter. Count only.
- **Coverage.** S 97.9% (NEW 96.6%, USED 100.0%): before 1990 22.0%, about 100% since. W 97.1%.
- **Not recorded.** `NOT KNOWN` (W 173,327; S 94,208, 2.1%; 93,652 of the 120,012 S vehicles first
  registered before 1990) and `USED UN-REGIST` (W 8; S 0), both covered.
- **Traps.** `OTHER` (S 15,592) is a recorded catch-all, not "not known".
- **Privacy.** Proposed public.
- **Relations.** Moves together with: vehicle type 0.59, import status 0.53, class 0.35 (measured).

### `PREVIOUS_COUNTRY`

- **Meaning.** The country where a used import was registered before New Zealand. It does not apply
  to NZ-new vehicles.
- **Kind and values.** Category. 45 values on S, 49 on W.
- **Uses.** Break down and filter, used imports only (`imported_from`, which applies to
  `used_imports`). Count only.
- **Coverage.** **Used imports**: USED 100.0%, NEW 0.0% on S.
- **Not recorded.** `NONE` (S 2,732,667: every NZ-new vehicle, where it means "not applicable", and
  334 used imports, where it means "not recorded") and `USED UN-REGIST` (S 40), both covered.
- **Traps.** `OTHER` (S 1,172) is a catch-all. `NEW ZEALAND` is the previous country of 299 S used
  imports (33,858 W vehicles, and 66,084 re-registered W vehicles).
- **Privacy.** Proposed public.
- **Relations.** Recorded only for used imports. Moves together with (used imports only): age at
  registration 0.26, vehicle year (banded) 0.23, country built in 0.21, engine size (banded) 0.21.

### `NZ_ASSEMBLED`

- **Meaning.** NZTA: "Indicates where the vehicle was assembled": imported built up, or assembled or
  built in New Zealand.
- **Kind and values.** Category, 3 values. S: imported built-up 4,303,049; NZ assembled or built
  32,564; `UNKNOWN` 184,863.
- **Uses.** Break down and filter from 2000. Count only.
- **Coverage.** S 95.9%: before 1990 0.0% (`UNKNOWN` on 119,994 of 120,012), 1990s 59.6%, 100% from
  2000 (371 of 4.24 million unknown). W 94.1%.
- **Not recorded.** `UNKNOWN` (W 350,980; S 184,863: 162,984 NZ-new, 21,879 used). **Not in
  `sentinels.csv`.**
- **Traps.** The first pass counted it "100% filled" because it counted `UNKNOWN` as a value.
- **Privacy.** Proposed public.
- **Relations.** Moves together with: registration year (banded) 0.30, transmission 0.21 (measured).

## Who has it

### `TLA`

- **Meaning.** The district of the registered owner's address as at the snapshot (NZTA's dashboard
  page: "the city or district council where the vehicle is registered"). Not where the vehicle is
  used, and not where the owner lived at first registration (`docs/DATA_SOURCES.md`).
- **Kind and values.** Place, 67 values (W and S). S: Auckland 1,447,345; Christchurch City 383,352;
  Hamilton City 173,372.
- **Uses.** Break down (as `region`), filter. Count only.
- **Coverage.** S 99.8% to 99.9% in every period and status (NULL on 6,693 S, 9,563 W).
- **Not recorded.** NULL, covered.
- **Traps.** Seven districts straddle regions (Rotorua 62,637, Taupo 38,317, Waitaki 26,000, Tararua
  18,721, Rangitikei 14,717, Stratford 10,292, Waitomo 8,528 S vehicles; 179,212 in all), so region is
  a best fit there (`tla_region.csv`). Rental and lease fleets are counted at their owner's address
  (`docs/DATA_SOURCES.md`).
- **Privacy.** **Held for the review.** The `region` slice is the recorded exception (D-078). Proposed
  for after the review: public above a minimum count.
- **Relations.** Rolls up to region through `tla_region.csv`: all 67 S values are in the file, none
  twice. Picks out a vehicle in combination. Moves together with nothing above 0.15 (road transport
  code 0.15, vehicle type 0.13).

### `POSTCODE`

- **Meaning.** The postcode of the registered owner's address. Not in NZTA's field descriptions.
  Kept in the private archive only (D-076).
- **Kind and values.** Place. 1,331 values in the 2026-10 archive file, one of them the zero (W;
  D-079).
- **Uses.** None before the review. Proposed for after it: area totals above a minimum count.
- **Coverage.** W 95.1% (5,638,818 vehicles above zero). Not measured on S.
- **Not recorded.** Zero (W 288,172; no empty value). **Not in `sentinels.csv`.**
- **Traps.** NZTA stores it as a number, so a postcode starting with zero loses it: 152 postcodes
  holding 885,064 vehicles are below 1000 (W). Of the 1,330 above zero, 154 hold fewer than 5 vehicles
  and 237 fewer than 20 (D-079).
- **Privacy.** **Held for the review**; then area totals above a minimum count only (D-076).
- **Relations.** Postcode to district is not checked. Picks out a vehicle in combination.

### `VEHICLE_USAGE`

- **Meaning.** NZTA: "Classification of how a vehicle is used. This field groups several more
  detailed usage types". **It is the latest usage recorded, not the usage at first registration**
  (D-087): for the newest month the register and the dashboard agree, and for older months the
  register's rental share is far lower (below, "As first registered, or today").
- **Kind and values.** Category, 7 values on S, 8 on W. S: private passenger 4,226,874; transport
  licensed goods 93,914; other goods 85,136; rental 60,172; taxi 25,987; other 23,662; emergency 4,731.
- **Uses.** Break down, filter. Count only. It answers "how are they used now", not "who bought them".
- **Coverage.** Every vehicle.
- **Not recorded.** No form seen. `OTHER` (S 23,662) is a recorded catch-all.
- **Traps.** Rental is 41.1% of NZ-new passenger cars first registered in October 2026 (S), so the
  newest months swing with fleet buying. The dashboard's usage list is finer (20 values).
- **Privacy.** **Held for the review**; then above a minimum count.
- **Relations.** Moves together with: road transport code 0.44 (57,232 vehicles; partly by
  definition, inferred - confirm); industry class 0.41, gross vehicle mass (banded) 0.41 and vehicle
  type 0.40 (measured). Industry class at 0.41 is not a copy of usage.

### `INDUSTRY_CLASS`

- **Meaning.** NZTA: "The class of industry a vehicle is associated with". **At least partly the
  current owner's** (below, "As first registered, or today").
- **Kind and values.** Category: 14 classes and `UNKNOWN` (W and S). S: private 4,129,137;
  business/financial 116,081; constructing 54,312; commercial road transport 53,667.
- **Uses.** Break down, filter. Count only.
- **Coverage.** S 99.6% (before 1990, 88.0%). W 92.6%: `UNKNOWN` is mostly trailers and machines.
- **Not recorded.** NULL (S 18), covered; `UNKNOWN` (W 441,020; S 18,653, 0.4%). **`UNKNOWN` is not in
  `sentinels.csv`.**
- **Traps.** `VEHICLE DEALER` (S 15) and `VEHICLE TRADER` (S 8,610) are two names for one idea, which
  binding should join by a reference lookup.
- **Privacy.** **Held for the review**; then above a minimum count.
- **Relations.** Road transport code does not roll up to it (below). Moves together with: usage 0.41,
  vehicle type 0.36, class 0.30 (measured).

### `ROAD_TRANSPORT_CODE`

- **Meaning.** NZTA: "For vehicles with industry class recorded as 'commercial road transport' this
  shows the type of road transport"; on its dashboard page, "provided by the owner or dealer and is
  not verified or certified".
- **Kind and values.** Category, 20 values. S: general goods, local 19,882; general goods, line
  haulage 10,547; bulk cartage, solids 7,765.
- **Uses.** Break down and filter, for heavy-vehicle topics only. Count only.
- **Coverage.** S 1.3% (57,232 vehicles): goods 5.9%, cars 0.1%. W 1.6%.
- **Not recorded.** None: an empty value means the vehicle has no road transport code. As with the
  second fuel, `sentinels.csv`'s rule for every field would call it "not recorded".
- **Traps.** 6.2% of its vehicles sit outside the commercial road transport class. 669 S log haulage
  vehicles are passenger cars.
- **Privacy.** **Held for the review**: it describes the owner's business, in the owner's own words.
- **Relations.** **Does not roll up to industry class**: 19 of its 20 codes on S sit under more than
  one class (3,565 of 57,232 vehicles off the commoner class). Moves together with: vehicle type 0.82
  (by definition, inferred - confirm); seats (banded) 0.44 and class 0.44 (measured), on 57,000
  vehicles.

## Codes and free text

### `SUBMODEL`

- **Meaning.** NZTA: "The sub model of the vehicle as assigned by the manufacturer". Free text.
- **Kind and values.** Free text. 60,999 values on S (32,053 appear once), 93,703 on W.
- **Uses.** None: never aggregated (CLAUDE.md trap 3). At most a search term.
- **Coverage.** S 67.7%: NEW 94.2%, USED 27.2%; before 1990 1.6%. W 57.0%.
- **Not recorded.** NULL, covered. Not covered: `.` (S 270), `N/A` (7), `-` (W 5), `0` (6), `00`
  (W 1). Candidates that need a look: `X` (S 1,318), `XX` (38), `NA` (W 113), which may be real trim
  names.
- **Traps.** Stray spaces on 1,399 S vehicles (1,839 W); 201 rows are not upper case (W, as the
  profile reads).
- **Privacy.** Proposed public, never a breakdown.
- **Relations.** Picks out a vehicle in combination.

### `MVMA_MODEL_CODE`

- **Meaning.** NZTA: "Model code is assigned by the manufacturer at the time of VIN allocation to NZ
  new vehicles".
- **Kind and values.** Identifier. 24,866 values on S, 30,633 on W.
- **Uses.** None as a breakdown. A possible key for a model-level lookup (the work order's package I),
  with care.
- **Coverage.** **NZ-new only**: NEW 92.6%, USED 107 vehicles; nothing before 1990. S 56.0%, W 46.2%.
- **Not recorded.** NULL, covered.
- **Traps.** **Not a clean key.** On S, 96 codes hold more than one make (253 vehicles off the
  commoner make) and 1,306 more than one model name (11,861 vehicles off). Many are spellings of one
  model (`VX COMMODORE` and `COMMODORE`), not all (one code holds Colorado and Trailblazer).
- **Privacy.** Proposed public, never a breakdown.
- **Relations.** Recorded with power and transmission (above). Picks out a vehicle in combination.

### `INDUSTRY_MODEL_CODE`

- **Meaning.** NZTA: "Non-validated field used by vehicle manufacturers to describe model code on
  imported used vehicles particularly from Japan".
- **Kind and values.** Identifier. 47,961 values on S (30,352 once), 61,555 on W.
- **Uses.** None as a breakdown; a possible lookup key.
- **Coverage.** **Used imports**: USED 92.3%, NEW 0.8%; nothing before 1990. S 37.0%, W 29.7%.
- **Not recorded.** NULL, covered. Not covered, about twenty forms of nothing: `NONE` (W 18,443;
  S 15,389), `UNKNOWN` (S 295), `UNK` (79), `0` (43), `N/A` (20), `NA` (9), `XXXX` (8), `XXX` (5),
  `0000` (5), `NIL` (4), `.` (2) and single vehicles with `00`, `XXXXX`, `????`, `??????`, `-`,
  `NOT AVAILABLE` (S).
- **Traps.** 4,915 of 47,959 codes on S point to more than one make and model (80,830 vehicles off
  the commonest). Stray spaces on 46 S vehicles (55 W).
- **Privacy.** Proposed public, never a breakdown.
- **Relations.** Picks out a vehicle in combination.

### `VIN11`

- **Meaning.** NZTA: "First 11 characters of the Vehicle Identification Number". NZTA's dashboard
  page: "This field can be repeated". Kept in the private archive only (D-076).
- **Kind and values.** Identifier. 4,811,252 vehicles have one (81.2% of W), each 11 characters,
  200,725 distinct (D-076).
- **Uses.** None. What it can give was checked (below, "`VIN11` checked against the data"): nothing
  is derived from it.
- **Coverage.** NEW 76.9%, USED 94.8%; 39.3% before 2000 (the first pass, W).
- **Not recorded.** The form of a missing value was not recorded in the check.
- **Traps.** 494 hold a character a VIN does not allow. A third start `7A`: assigned in New Zealand
  (inferred - confirm), and their tenth character is not a year.
- **Privacy.** **Never published.** A derived field could be published only once checked against the
  data and approved by the user (D-076; the work order §3).
- **Relations.** Picks out a vehicle on its own, or nearly.

### `CHASSIS7` and `ENGINE_NUMBER`

- **Meaning.** NZTA: "First 7 characters of the Chassis Number" and "All characters of the Engine
  Number".
- **Coverage (first pass, W).** Chassis 40.4% (USED 91.7%, NEW 13.2%); engine number 84.2% (cars
  99.6%, trailers 0.1%).
- **Uses, values, not recorded.** None: never pulled, so never measured beyond the first pass.
- **Privacy.** **Never pulled** (`register_archive.never_pulled`; D-062, D-076).
- **Relations.** Each picks out a vehicle on its own.

### `OBJECTID`

- **Meaning.** A row number in NZTA's service, used to page the pull. Not a property of the vehicle.
- **Coverage.** Every row (W).
- **Uses.** None for a visitor. The archive leaves it out of its file.
- **Privacy.** Never published.
- **Relations.** Picks out one row of one release of the service. Whether it stays the same for a
  vehicle across releases was not measured.

## The dashboard's fields

The source of `registrations_flow` (`docs/METRICS.md`; `docs/DATA_SOURCES.md` §D). Measured on
2026-11-14 from the user's export of January 2021 to October 2026 (D) against the register as at
31 October 2026, vehicles first registered in the same 70 months (D-087). The file has no empty
cell: what is not recorded is written as text. `Vehicles` is the count column, not a field.

| Column | Register field | Kind | Values (D) | How it lines up with the register | Not recorded | Privacy (proposed) |
|---|---|---|---|---|---|---|
| `Registration month` | first NZ registration year and month | time | 70 months, none missing | For vehicles still registered, totals agree to 0.08% over the 70 months and within 65 vehicles (0.23%) in any month. NZTA calls it the date of first ownership | none seen | public |
| `Import status` | `IMPORT_STATUS` | category, few | 4 | The same four values | none seen | public |
| `Vehicle type` | `VEHICLE_TYPE` | category | 14 | The same values | none seen | public |
| `Body type` | `BODY_TYPE` | category | 27 | The same values | none seen | public |
| `Motive power` | `MOTIVE_POWER` | category | 19 | The same 18, plus `-` where the register is empty (267,782 vehicles, all trailers) | `-` | public |
| `Make` | `MAKE` | category | 853 | Three values the whole register lacks, the largest `LANDROVER` beside `LAND ROVER` (424 vehicles, 165 of them in 2021); 30 makes of the register's same 70 months are absent, most with one to four vehicles. Over 99.8% of in-scope vehicles map through `brand_registry.csv` | none seen | public |
| `Model` | `MODEL` | category | 58,164 | NZTA's cleaned name. 2,854 values (18,946 vehicles) are nowhere in the register: some nameplates are split finer (since January 2025 the largest are `COROLLA CROSS` and `LANDCRUISER PRADO`). Since January 2025, 98.2% of vehicles carry a make and model spelled the same in the register | `UNKNOWN` (12 vehicles); some values are placeholders for a class of vehicle | public |
| `Country of origin` | `ORIGINAL_COUNTRY` | category | 48 | The same values | `NOT KNOWN` (720); `OTHER` (760) is a catch-all | public |
| `Vehicle year` | `VEHICLE_YEAR` | number | 129 | Every value is in the register | none seen | public |
| `Vehicle Status` | none | category, few | 2 | `ACTIVE` behaves as still registered at the dashboard's latest monthly update, `INACTIVE` as since removed (80,852 vehicles; 9.9% of January 2021, none of October 2026), read from the counts (`docs/METRICS.md`). NZTA's page also names "reversed"; the file has none | none seen | public |
| `Owner Type` | none | category, few | 3 | Individual 1,045,469; Company 810,118; Other 28,199. Most likely the owner at first registration, **not proven** (below) | none seen | held for the review |
| `Territorial authority` | `TLA` | place | 70 | The owner's district. Two values the register lacks: `AUCKLAND CITY` (272) and `OVERSEAS` (22) | `UNKNOWN` (5,141; the register leaves it empty, for a different count: 4,848 still-registered `UNKNOWN` against 2,935 empty) | held for the review |
| `Vehicle usage` | `VEHICLE_USAGE` | category | 20 | **A finer list, and an earlier moment** (below); two names differ only in punctuation | `UNDEFINED` (382) | held for the review |

What the export cannot give: gross vehicle mass and engine size, so the site's `segment`,
`segment_group` and engine bands cannot be asked of true registrations (`docs/METRICS.md`).

**Owner type, the evidence.** Of the still-registered passenger cars the dashboard marks as rental, a
company owns 99.8% in every year from 2021 to 2025, though the register counts far fewer rental cars
in the older months (37 first registered in January 2021, against the dashboard's 254). If owner
type were today's owner, a car sold on to a household would show an individual. A dealer is a
company too, so this is not proof. The company share of all still-registered passenger cars is 30.9%
for 2021 and 39.0% for 2026.

## As first registered, or today

The work order asks whether `VEHICLE_USAGE` and `INDUSTRY_CLASS` describe the vehicle at first
registration or now.

**`VEHICLE_USAGE`: today's, settled for rental.** The dashboard and the register hold the same
vehicles (still-registered vehicles differ by under 0.1%). The dashboard figures are its `ACTIVE`
vehicles only, so vehicles leaving the register cannot explain a difference. Rental share of
passenger cars and vans, dashboard then register: October 2026 25.1% and 25.3%; January 2025 3.89%
and 1.64%; January 2023 7.63% (1,197 vehicles) and 2.18% (342); January 2021 1.45% (254) and 0.21%
(37). The register's share shrinks as a cohort ages and the dashboard's does not, which is what a
value updated after first registration shows. Only rental was tested. Taxi does not follow the
pattern: the register counts more taxis than the dashboard in every year, the newest month included
(165 against 36 passenger vehicles for October 2026); why is not known, and taxi is not used as
evidence (D-087).

**`INDUSTRY_CLASS`: at least partly today's.** It is not in the dashboard, so only the register's own
cohorts can be read (S, NZ-new passenger cars). The vehicle-trader share falls with the cohort's age:
3.6% for October 2026, 3.2% for August, 2.2% to 2.8% for April to July, 2.1% for March, 1.2% and
1.5% for January and February 2026, 1.0% for December 2025, then 0.2% to 0.5% for every month from
January to November 2025. Used-import cohorts show the same drop over a few months (1.7%, 1.1%,
1.1% for October, September and August 2026, then 0.5% or less). A value kept from first
registration would not depend on how long ago the month was. Tourism/leisure does not settle it: it
is concentrated in August to November cohorts (17.9%, 26.5%, 26.8% for August to October 2026;
9.3%, 20.0%, 24.0% a year earlier) and still high a year later, which the cohort method cannot
separate from a rising share. It could also be that dealers' practice changed over 2025 and 2026.

**What would settle both:** the same vehicles in two snapshots. The private archive holds October
2026; November's file arrives after NZTA's December refresh (D-063). Matching vehicles between the
two files means following vehicles over time, even if only in a private scratch folder, so whether
it is done, and how, is the user's to decide.

## Relations

### Rolls up to

Five roll-ups were tested on S (the profile, §2); two of the first pass's claims failed.

| Roll-up | Holds? | Evidence |
|---|---|---|
| District (`TLA`) to region | Yes, through `tla_region.csv` | All 67 S values are in the file, none twice; seven districts straddle regions and are assigned to the region holding most residents |
| `CLASS` to vehicle type | Yes on S only | 1 of 4,286,433 S vehicles disagrees; on W, 6 of 21 classes have two parents |
| Make to manufacturer group to owner country | Yes, by construction | `brand_registry.csv` gives each canonical make one group and one country |
| Model to make | Only as the make-and-model pair the site builds | The raw model name sits under more than one make for 1,427 of 28,000 S models |
| Body type to vehicle type | **No** (first pass said yes) | 4 of 13 S body types under both vehicle types; 41,952 S vehicles off the commoner type |
| Road transport code to industry class | **No** (first pass said yes) | 19 of 20 codes under more than one class; 3,565 of 57,232 vehicles off the commoner class |
| MVMA model code to make and model | No: not a clean key | 1,329 S codes with more than one make and model; 12,008 vehicles off |
| Industry model code to make and model | No: not a clean key | 4,915 of 47,959 S codes; 80,830 vehicles off |

Postcode to district is not checked. Build uses a roll-up to offer a level up or down, and must not
cross a field with its own parent.

### Derived from

What `config/dimensions.json` derives from which register fields (its `derive` blocks):

| Dimension | Register fields | Reference |
|---|---|---|
| `powertrain` | `MOTIVE_POWER` (mild hybrids identified by make and model) | `powertrain_map.csv`, `mild_hybrid_models.csv` |
| `make`, `parent_group`, `owner_country`, `heritage_country` | `MAKE`, `MODEL` (model exceptions match on motive power, import status, vehicle type and vehicle year) | `brand_registry.csv`, `model_registry.csv` |
| `model` | `MAKE`, `MODEL` | the same |
| `built_in` | `ORIGINAL_COUNTRY` | none |
| `imported_from` | `PREVIOUS_COUNTRY` | none |
| `segment`, `segment_group` | `VEHICLE_TYPE`, `BODY_TYPE`, `GROSS_VEHICLE_MASS` | `segment_map.csv` |
| `import_status` | `IMPORT_STATUS` | `import_status_map.csv` |
| `region` | `TLA` | `tla_region.csv` |
| `vehicle_year_band` | `VEHICLE_YEAR`, against the snapshot year | none |
| `engine_size_band` | `CC_RATING`, and `MOTIVE_POWER` for "no engine" | `powertrain_map.csv` |
| `age_at_registration_band` | `FIRST_NZ_REGISTRATION_YEAR`, `VEHICLE_YEAR` | none |

The dataset's scope is derived from `VEHICLE_TYPE` and `IMPORT_STATUS` (`vehicle_scope.csv`,
`import_status_map.csv`). No register field is derived from another.

### Recorded only for

- **NZ-new vehicles:** power, transmission and the MVMA model code, recorded together on 92.1% of
  NZ-new S vehicles and almost no used import; urban and extra-urban fuel consumption, mostly (NEW
  47.2% to 49.8%, USED 1.8%).
- **Used imports:** previous country and the industry model code.
- **Heavy vehicles:** height, width and VDAM weight (goods vehicles over 3.5 t); the road transport
  code (commercial road transport, mostly goods).
- **Vehicles with an engine:** a real engine size and a fuel consumption figure.
- **From a period:** class and where assembled from 2000; the refrigerant from 2010; fuel
  consumption from 2000; seats, gross mass and axles thin before 2000.

A question that uses one of these is narrowed to where the field exists, and says so. A chart over
time starts where the field does.

### Follows a vehicle over time

Some fields pick out a vehicle on their own: `VIN11`, `CHASSIS7`, `ENGINE_NUMBER`, and `OBJECTID`
within one release. Others do it in combination: the first registration year and month, vehicle
year, make, model, submodel, the two model codes, engine size, power, gross mass and colour, with the
owner's district and postcode. In each monthly file the same combination finds the same vehicle, and
so shows its owner fields changing. That is why the archive is private (D-063), why owner fields wait
for the review, and why no row-level file is ever published. Measured: on the 2026-10 dry run, month
and the twelve vehicle dimensions of the fact table already leave 50.2% of its rows counting one
vehicle (7.1% of vehicles; D-078). How unique the full combination is was not measured.

### Moves together with

Measured on S by the profile for 24 columns: 14 categories, previous country (used imports only),
six numbers cut into the profile's bands (seats, gross mass, engine size, power, combined fuel
consumption, vehicle year), registration year in bands, registration month, and age at registration
in bands. Not measured: make, model, codes, free text, the second fuel, axles, height, width and VDAM
weight. Fields with many values (district, 67; refrigerant, 37) have many sparse cells, and their
figures are less stable. Where a pair rests on few vehicles it is said.

**True by definition or by construction** (listed in `config/data_map.json`, `moves_together`; the
site never offers these as a finding):

| Pair | V | Why it is not a finding |
|---|---|---|
| Class and vehicle type | 1.00 | Class codes are per vehicle category (inferred - confirm) |
| Age at registration and import status | 0.99 | NZ-new age is 0 by construction from 2007 |
| Body type and vehicle type | 0.97 | Body types belong mostly to one vehicle type (inferred - confirm) |
| Road transport code and vehicle type | 0.82 | The codes name goods or passenger services (inferred - confirm) |
| Body type and class | 0.71 | As class and vehicle type (inferred - confirm) |
| Registration year and vehicle year (banded) | 0.64 | Equal for NZ-new vehicles from 2007 |
| Class and gross vehicle mass (banded) | 0.57 | The goods classes rise with mass (inferred - confirm) |
| Import status and vehicle year (banded) | 0.48 | Through the same construction |
| Road transport code and usage | 0.44 | Both name commercial services (inferred - confirm) |
| Age at registration and vehicle year (banded) | 0.27 | Age is computed from vehicle year |

A field and any dimension derived from it are always such a pair.

**Measured pairs, the strongest** (S; rows are vehicles with both recorded):

| Pair | V | Rows |
|---|---|---|
| Gross vehicle mass (banded) and vehicle type | 0.77 | 4,238,355 |
| Motive power and vehicle type | 0.72 | 4,520,476 |
| Country built in and vehicle type | 0.59 | 4,426,268 |
| Transmission and vehicle type | 0.54 | 2,517,073 |
| Import status and country built in | 0.53 | 4,426,268 |
| Body type and gross vehicle mass (banded) | 0.53 | 4,238,355 |
| Engine size and gross vehicle mass (both banded) | 0.52 | 4,131,429 |
| Engine size (banded) and vehicle type | 0.52 | 4,412,632 |
| Combined fuel consumption (banded) and motive power | 0.49 | 3,402,914 |
| Seats (banded) and vehicle type | 0.49 | 4,511,861 |
| Gross vehicle mass (banded) and import status | 0.47 | 4,238,355 |
| Seats (banded) and road transport code | 0.44 | 57,219 |
| Engine size (banded) and class | 0.44 | 4,179,385 |
| Industry class and usage | 0.41 | 4,501,805 |

Each field's strongest partners are in its own section above. District moves with nothing above
0.15; colour with nothing above 0.25; registration month with nothing above 0.05.

**What it will mean on the site.** The association is computed each build, not taken from this
page. Where a question crosses two fields that move together strongly (and the pair is not true by
definition), the workbench shows one neutral line, for example that the two fields move together
strongly and holding one fixed may change the answer, with the figure one step away. It never says
why. The threshold and the wording are config, set by the work that builds it.

## `VIN11` checked against the data

Measured on 2026-11-13 from the private archive's 2026-10 file (5,926,990 vehicles, every vehicle
type), read into a scratch folder and deleted afterwards. Counts only; no VIN is listed here or
anywhere in the repo. The scratch scripts are not in the repo. D-079.

**Form.** 4,811,252 vehicles have a `VIN11` (81.2%), each 11 characters. 4,810,758 use only the
letters and digits a VIN allows; 494 do not (478 hold an I, O or Q, 16 a character that is neither
a letter nor a digit).

**A third were assigned in New Zealand, and say nothing about the vehicle's year.** 1,675,639
(34.8%) start `7A`: 83.5% of the used imports that have a `VIN11` (1,534,504 of 1,838,550) and 2.3%
of the NZ-new (64,289 of 2,828,885). The two largest prefixes are `7AT` (1,313,576) and `7A8`
(320,938). `7A` is the range the VIN standard gives New Zealand, and NZTA assigns a VIN to a vehicle
that arrives without a 17-character one (inferred — confirm against NZTA's VIN rules; the data
agrees: the prefix is on most used imports and on NZ-built trailers). On `7AT` the tenth character
looks like a year code on 99.8% and equals the first NZ registration year on none: it is not a
year.

**The tenth character is a model year for some makes only.** Of the 3,135,613 VINs a manufacturer
assigned (not `7A`), the tenth character is one of the thirty year codes on 2,099,062 (66.9%) and a
zero on 1,032,997 (32.9%). A code can mean two years thirty years apart; the later was taken
unless it is more than a year after the first NZ registration. Among NZ-new vehicles first
registered from 2010 (2,198,959 with a manufacturer's VIN), by make:

| Makes | Vehicles | Share | The decoded year is within one of the registration year |
|---|---|---|---|
| 20 makes whose VINs mostly carry no year code (a code is on 0.2% of Toyota's, 6.1% of Suzuki's, 12.7% of BMW's, 19.0% of Mazda's) | 752,192 | 34.2% | not applicable |
| 112 makes where it agrees on 95% or more (Hyundai, Kia, Volkswagen, Audi, Holden, Tesla among them) | 836,165 | 38.0% | 98.5% |
| 60 makes where it agrees on 80% to 95% | 165,736 | 7.5% | 91.9% |
| 103 makes where a valid-looking character agrees on under 80% (Mercedes-Benz 0.2%, Nissan 11.0%, Ford 64.9%, Isuzu 76.0%) | 444,866 | 20.2% | 45.7% |

Inside the 112 makes the decoded year is the registration year on 68.7%, one ahead on 15.5%, one
behind on 14.2% and older on 1.5%: it behaves as a model year there. A valid character alone does
not prove a year code, so a model year could only come through a lookup of which makes or prefixes
use one (invariant 4), and it would cover about four in ten NZ-new vehicles and almost no used
import. It is not derived.

**The eleventh character adds little to "built in".** It is the plant in a manufacturer's VIN. Of
the three-character prefixes with 100 vehicles or more, 114 use one eleventh character (310,112
vehicles), 111 use two or three (589,481), 100 use four to ten (1,300,666) and 39 use more
(924,994). `ORIGINAL_COUNTRY` is the commonest country of the vehicle's prefix on 93.1% of
manufacturer VINs, and the commonest of its prefix and eleventh character together on 95.1%. The
first character alone gives Japan on 99.1% of `J`, South Korea on 99.6% of `K`, China on 97.0% of
`L`, Thailand on 92.7% of `M` and Germany on 70.8% of `W`. No table of plant codes is in the repo,
and nothing is derived.

## What NZTA's dashboard page adds

NZTA's page "Motor vehicle registrations – dashboard and open data", saved by the user on 2026-11-13
(`data/raw/nzta-dashboard/2026-10/`; the website itself is not opened by an agent). Its words are
quoted in the field sections above where they bear on a meaning. Beyond those:

- **Region**: "the region where the registered owner is based". The dashboard also has "Physical
  town: the town where the registered owner is based" and "Owner Type: ... Individual, Company or
  Other"; neither is a field of the open data service.
- **`MVMA_MODEL_CODE`**, power and axles: "Only recorded for NZ New vehicles". The data bears this
  out for the code and for power; axles are recorded for 77.9% of S used imports.
- **The dashboard is a different base from the register** (D-075): it shows vehicles "with a date of
  first ownership within the past five years", which "may differ from the vehicle's latest
  registration year or its first registration in New Zealand"; it "displays a subset of
  *reregistered vehicles"; and its vehicle status is "active vehicle – registered. Inactive vehicles –
  registered and registration cancelled in the same month. Reversed – vehicle was incorrectly
  registered". It is "updated at the beginning of each month", and "Vehicles may be added to or
  removed from the dataset" and "A vehicle's registration date (MMM-YYYY) may be updated".
- **The make and model cleansing code** the page links to
  (`github.com/NZTA/vehicle-make-and-model-cleansing-code`) could not be read: GitHub answered "Not
  Found" on 2026-11-13, and a search of NZTA's 20 public repositories for "cleansing" and for "make
  model" found none. Whether it was moved, made private or removed is not known.

## Order for binding

The work order's §5.F gives the outline: first the fields every vehicle has, then the NZ-new ones,
then the rest. Each is bound with its sentinels and guards in the same commit as its reference file
(AGENTS.md hard rule 5). `sentinels_pending` in `config/data_map.json` lists, per field, the forms
`sentinels.csv` does not yet cover; the test makes the map change in the same commit as the file.

**1. Every vehicle has them.**

| Field | Sentinels and guards before it is bound |
|---|---|
| `BASIC_COLOUR` | None new (NULL is covered). A raw dimension. Its label says "colour as recorded", since the moment is not known |
| `NUMBER_OF_SEATS` | Add `0` to `sentinels.csv`. Bands 1-2, 3-4, 5, 6-7, 8+ and `unknown`; values above 60 fall to `unknown`. A mean only inside 1 to 60 |
| `NZ_ASSEMBLED` | Add `UNKNOWN`. Charts over time start in 2000 |
| `CLASS` | NULL is covered. **`NA` must never become a sentinel.** A label for each code needs a small reference file from NZTA's class definitions (inferred meanings until then). Charts start in 2000 |

**2. NZ-new only.** Each `applies_to` the NZ-new dataset, or is narrowed to it, and says so.

| Field | Sentinels and guards before it is bound |
|---|---|
| `POWER_RATING` | Add `0`. Guard 5 to 900 (999 is a placeholder). Bands as above. A sum and a count per cell for the mean, as fuel consumption has |
| `TRANSMISSION_TYPE` | None new. `OTHER` stays a value. A grouping lookup (automatic, manual, continuously variable, other) is optional and a reference file of its own |

**3. The rest.**

| Field | Sentinels and guards before it is bound |
|---|---|
| `SYNTHETIC_GREENHOUSE_GAS` | Add `UNKNOWN`. Charts start in 2010 |
| `FC_URBAN`, `FC_EXTRA_URBAN` | As measures beside `FC_COMBINED`: a sum and a count per cell; guards above 0 to 40 and above 0 to 30; engines only |
| `GROSS_VEHICLE_MASS` as a measure | Guard 300 to 60,000 (the 1 kg placeholder falls out); a mean only within a vehicle type |
| `CC_RATING` as a measure | Guard 50 to 20,000, engines only. Decide whether the top engine band should stop at 20,000 (a contract change) |
| `ALTERNATIVE_MOTIVE_POWER` as a filter | NULL must read "none", not `__UNDEFINED__`: a reference lookup or a sentinel exception, decided when bound |
| `NUMBER_OF_AXLES` as a filter | Add `0`. Guard 2 to 6 |
| `VDAM_WEIGHT`, `HEIGHT`, `WIDTH`, `ROAD_TRANSPORT_CODE` | With the heavy-vehicle topic (package I). Add `0` for the three numbers; guards 1,000 to 60,000, 1,000 to 4,600 and 1,200 to 2,600. The road transport code's NULL reads "none" |
| `VEHICLE_USAGE`, `INDUSTRY_CLASS` | Bound but kept out of every published file until the review. Add `UNKNOWN` for industry class; join `VEHICLE DEALER` to `VEHICLE TRADER` by lookup. Labels say "now", not "when first registered" |
| `MODEL` (already bound) | Add the clear forms of nothing (`UNKNOWN`, `NOT KNOWN`, `UNK`, `N/A`, `-`, `.`, `0`, `000`); look at `X`, `XX`, `OTHER` and `NA` by make first. Trim stray spaces |

**Not bound as fields:** `MVMA_MODEL_CODE` and `INDUSTRY_MODEL_CODE` (lookup keys for the model-level
segment, package I, each needing its forms of nothing first); `SUBMODEL` (never a breakdown);
`POSTCODE` (waits for the review); `VIN11`, `CHASSIS7`, `ENGINE_NUMBER`, `OBJECTID`.

## Where this map disagrees with other files (noted, not changed)

1. **`config/dimensions.json`** still describes `registrations_flow` as "Stats NZ Transport (TPT)
   monthly series", "planned: build step 1b". D-087 and `docs/DATA_SOURCES.md` §C give the name to the
   dashboard's dataset.
2. **`sentinels.csv`'s notes** carry 2026-08 counts. At 2026-10 on S: `VEHICLE_YEAR` 0 is 1 vehicle
   (the note says none in scope); `PREVIOUS_COUNTRY` `NONE` on used imports is 334 (335);
   `ORIGINAL_COUNTRY` `USED UN-REGIST` is 8 on W (7). Its 89 goods vehicles at GVM 0 and the
   profile's 112 may not count the same thing.
3. **The bound engine band** "4.0 L and over" has no upper limit, so 382 S engine sizes above 20,000,
   which are not real, land in it.
4. **The bound fuel-consumption guard** (above 0, at most 60) is wider than the profile's proposed
   0.1 to 30. The map declares the bound guard; narrowing it is a contract change.
5. **`segment_map.csv`** starts its goods rows at 1 kg, so the 1 kg placeholder places a goods vehicle
   in a light class.
6. **`docs/brief/MASTER_BRIEF.md` §6** gives "body type → vehicle type" as a roll-up and "colour and
   vehicle weight" as an example of fields that move together. The first does not hold; the second is
   weak (colour and gross mass, 0.14). It also lists `CHASSIS7` and `ENGINE_NUMBER` as "never
   published"; they are never pulled.
7. **`docs/CUBE_SCHEMA.md`'s list of pairs that may be added** includes `powertrain__region`: it reads
   the owner's district and may not be added before the review.
8. **The first pass** gave whole-register coverage only, counted `UNKNOWN` as filled for where
   assembled and industry class, and read some numbers (999 seats, 99,999 cc) as the guards' main
   problem; on S the zeros and ones matter more.

## What builds on this

Notes for the work that follows. None of it is done here.

- **The chart rule table** (package E). Read each field's `kind` and `cardinality` from
  `config/data_map.json`, and `cardinality.few_max_values` for the threshold; never a per-field list
  of charts. A number becomes an ordered band through its dimension's `bands`. Two fields crossed,
  neither of them time, fit `matrix` (D-083). A table of figures always fits. A field whose
  `uses.break_down` is false is never offered as a breakdown.
- **Build reading the map.** Offer a field only if it is bound, its dimension is live, its privacy
  class is published (`privacy_classes.<class>.published`), and its `uses` allow it. Narrow a
  question to `recorded_for` and say so. The method page's definition line is `definition`.
- **The association figures each build.** Bias-corrected Cramér's V on the in-scope dataset, rows
  with both fields recorded, numbers cut into their bands, with the row count beside each figure;
  leave out pairs listed in `moves_together.true_by_definition` and pairs of a field with a dimension
  derived from it. The profile's method is in this doc ("Moves together with"). The figures go to a
  per-build output, not to this file.
- **Coverage each build.** The coverage figures here (by status, type and period) will go stale. A
  per-build output of the same shares would let a chart start where its field does without a
  hand-kept year.
- **Binding** (package F), in the order above. Each binding changes `sentinels.csv` and the map's
  `sentinels_pending` in one commit, and marks the entry `bound` with its logical name.
- **The privacy review.** The user approves or changes the classes; the decision record says what
  was approved, `approval.privacy_classes` becomes `approved`, and only then may an owner field reach
  a published file.
- **Settling usage and industry class** for good: the same vehicles in the October and November
  archive files, if the user agrees to the match ("As first registered, or today").
