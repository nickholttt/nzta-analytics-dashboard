# Data map

**Status: finished (the work order's package E, 2026-11-14). The privacy classes were approved by
the user on 2026-11-16 (D-096):**

- the 31 register fields and 10 dashboard columns that describe the vehicle are public;
- an owner field (district, region, usage, industry class, road transport code) may be
  published only in a table of one or two fields, with any cell counting fewer than 10 vehicles
  hidden. **None is published yet** other than the `region` slice below and the usage tables of the
  stock `fleet` (the register's current usage alone and by vehicle type, approved on 2026-11-18, D-141):
  the pipeline hides small cells in a slice since D-127, but the user asked to be shown the first
  table of an owner field before a build publishes it (D-120), so every other owner field, and every
  other table of usage, stays out of every published file;
- the dashboard's `Owner Type` and `Vehicle usage` say what kind of owner registered a vehicle, not who they are or where they
  live, so on the user's direction of 2026-11-25 they are public and shown in full, with no cell hidden; they form the group
  `kind_of_owner`, which is not an owner group. The floor under that: a field of this group is never put in one table with a
  field that says where the owner lives or describes the owner (the `Territorial authority` column, the register's `TLA`,
  `VEHICLE_USAGE` and the rest of the owner groups), and an owner field still never reaches a fact table. The build refuses a
  config that breaks it (`owner_rule` in `config/data_map.json`; "Privacy classes" below). The committed store of the
  dashboard keeps the two columns, and the dimension `buyer_type` of `new_registrations` is built from them (D-159);
- the `region` slice (share of vehicles by the owner's region, by month), published since before
  the work order under D-078, stays, and since D-127 takes the minimum of 10 (the user's ruling of
  2026-11-17, D-120 item 4) with a second rule that limits what a total gives away of a hidden cell
  (`docs/CUBE_SCHEMA.md`, "Slices of owner dimensions"). A pair with it is not built;
- postcode totals are not published for now, and nothing derived from `VIN11` is covered.

The map itself binds nothing. A field is bound in `config/pipeline.json` and given a dimension in
`config/dimensions.json`, in the order under "Order for binding" (package F); the summary table and each
entry say which are. Build still offers only what `config/dimensions.json` defines.

The same map in machine-readable form is `config/data_map.json`, kept true to the pipeline's config
by `pipeline/tests/test_data_map.py`. That file holds no measured figure; the figures are here.

## How to read this map

- **Sources and bases.** Every figure names its basis:
  - **S**: the site's in-scope dataset, `registrations_surviving` as built: since D-157 five vehicle types
    (the `trade_scope` column of `vehicle_scope.csv`), first registered new or used: 4,615,306 vehicles in the
    cube at 2026-10 (passenger cars and vans 3,617,895; goods vans, trucks and utes 902,409; buses 37,053;
    motor caravans 54,693; special purpose vehicles 3,256). Before D-157 it held the first two only
    (4,520,304 in the cube). Every other figure marked S in this map was measured before D-157, on the two types
    (4,520,476 vehicles: NEW 2,732,333, USED 1,788,143; car/van 3,617,900, goods 902,576), and is not restated
    unless a line says so.
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
  says how strongly two fields move together and nothing about why. The figures on this page were
  measured by hand on 2026-11-15 and 16; since D-136 every build writes them for the dimensions
  (`docs/CUBE_SCHEMA.md`, Associations), and "Moves together with" below sets the two beside each other.

Each field below has the same parts: meaning; kind and values; uses; coverage; not recorded; traps;
privacy; relations.

## Summary

Uses: **B** break down, **F** filter, then what can be measured (count only, or also an average
and a median). Values are S then W. Privacy is the class the user approved (D-096).

| Field | Kind | Values (S; W) | Uses | Privacy | Bound as |
|---|---|---|---|---|---|
| `FIRST_NZ_REGISTRATION_YEAR` | time | 107; 127 | B F, count | public | `registration_year` |
| `FIRST_NZ_REGISTRATION_MONTH` | time | 12; 12 | B F, count | public | `registration_month` |
| `VEHICLE_YEAR` | number | 128; 136 | B (banded) F, count | public | `vehicle_year` |
| `VEHICLE_TYPE` | category, few | 2; 14 | B F, count | public | `vehicle_type` |
| `BODY_TYPE` | category, many | 13; 27 | B F, count | public | `body_type` |
| `CLASS` | category, few | 7; 21 | B F, count (from March 2002) | public | `nzta_class` |
| `MAKE` | category, many | 371; 1,030 | B F, count | public | `make` |
| `MODEL` | category, many | 28,000; 175,398 | B (within make) F, count | public | `model` |
| `BASIC_COLOUR` | category, many | 14; 14 | B F, count | public | `basic_colour` |
| `NUMBER_OF_SEATS` | number | 172; 193 | B (banded) F, count (average and median not built) | public | `seats` |
| `NUMBER_OF_AXLES` | number | 10; 10 | none (a count only on heavy vehicles, D-129) | public | no |
| `TRANSMISSION_TYPE` | category, many | 28; 28 | B F, count (NZ-new only) | public | `transmission` |
| `SYNTHETIC_GREENHOUSE_GAS` | category, many | 38; 39 | B F, count (from 2010) | public | no |
| `MOTIVE_POWER` | category, many | 15; 18 | B F, count | public | `motive_power` |
| `ALTERNATIVE_MOTIVE_POWER` | category, many | 9; 9 | F, count | public | `alternative_motive_power` |
| `CC_RATING` | number | 5,934; 7,644 | B (banded) F, count, average, median (engines only) | public | `cc` |
| `POWER_RATING` | number | 467; 488 | B (banded) F, count (NZ-new only; average and median not built) | public | `power` |
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
| `NZ_ASSEMBLED` | category, few | 3; 3 | B F, count (from December 1995) | public | `nz_assembled` |
| `TLA` | place, many | 67; 67 | B F, count | owner rule | `tla` |
| `POSTCODE` | place, many | not measured; 1,331 | B F, count | not published for now | no |
| `VEHICLE_USAGE` | category, few | 7; 8 | B F, count | owner rule | no |
| `INDUSTRY_CLASS` | category, many | 15; 15 | B F, count | owner rule | no |
| `ROAD_TRANSPORT_CODE` | category, many | 20; 20 | B F, count (heavy-vehicle topics) | owner rule | no |
| `SUBMODEL` | free text | 60,999; 93,703 | none (search at most) | public | no |
| `MVMA_MODEL_CODE` | identifier | 24,866; 30,633 | none (lookup key) | public | no |
| `INDUSTRY_MODEL_CODE` | identifier | 47,961; 61,555 | none (lookup key) | public | no |
| `VIN11` | identifier | not measured; 200,725 | none | never published | no |
| `CHASSIS7` | identifier | not measured | none | never pulled | no |
| `ENGINE_NUMBER` | identifier | not measured | none | never pulled | no |
| `OBJECTID` | identifier | one per row | none | never published | `object_id` |

The dashboard's 13 columns are in "The dashboard's fields" below: each is as its register field
except where that section says otherwise. Twelve are public, two of them as the
group `kind_of_owner` (`Owner Type` and `Vehicle usage`); `Territorial authority` falls under the owner rule.

Counts. Register: 22 bound and 18 not. By kind: 17 category, 12 number, 6 identifier, 2 time,
2 place, 1 free text. By class: 31 public, 5 under the owner rule, 2 never published,
2 never pulled. Dashboard: 10 category, 1 time, 1 number, 1 place; 12 public (two as what kind of owner), 1 under the owner rule.

## Privacy classes: approved by the user on 2026-11-16 (D-096)

| Class | Fields | Why |
|---|---|---|
| Public | The 31 register fields that describe the vehicle; the dashboard's 10 vehicle columns | They describe the vehicle, not its owner, and NZTA publishes each of them vehicle by vehicle |
| Public, as what kind of owner | The dashboard's `Owner Type` and `Vehicle usage` (the group `kind_of_owner`, `kind_of_owner_groups` in `config/data_map.json`) | They say what kind of owner registered the vehicle (a person, a company, a rental firm or neither), not who it is or where it lives. The user's direction of 2026-11-25: NZTA releases them in its open data and would have vetted them, so they are used in full, with no cell hidden. Never in one table with a field of an owner group (the floor, below) |
| Owner rule | `TLA` (and `region` from it), `POSTCODE`, `VEHICLE_USAGE`, `INDUSTRY_CLASS`, `ROAD_TRANSPORT_CODE`; the dashboard's `Territorial authority` | They describe or locate the owner. Published only in a table of one or two fields, with any cell under 10 vehicles hidden (`owner_rule` in `config/data_map.json`; the pipeline hides them in a slice since D-127 and in a pair with a second field since D-135), and not before the owner has been shown the field's first table (D-120). Postcode totals are not published for now (D-076, D-096) |
| Never published | `VIN11`, `OBJECTID` | `VIN11` narrows a vehicle to a handful, and only a field derived from it may be published, once checked and approved (D-076, D-079). `OBJECTID` is a row number |
| Never pulled | `CHASSIS7`, `ENGINE_NUMBER` | They identify a vehicle and serve no question (D-062, D-076; `register_archive.never_pulled`) |

**The floor under what kind of owner.** A field of the group `kind_of_owner` is never put in a pair, a fact table, a narrow
fact table or the committed snapshot aggregate together with a dimension that reads a field of an owner group, and the owner
fields still never reach a fact table. A dimension that reads a field of both sides is refused too, because its own slice would cross them. `pipeline/privacy.py` (`floor_problems`)
works out from the map and the derive blocks which dimensions are on which side, so no dimension is named in code; the build
checks it before it reads anything and aborts, leaving the last good build in place (`build.kind_of_owner_floor_problems`), and
`pipeline/tests/test_kind_of_owner_floor.py` holds the committed config to it and shows each kind of crossing caught. The reason
is that NZTA draws its own line at location, given at district level "to make sure it isn't possible to identify a person"
(Context from NZTA, below); the floor keeps a kind of owner on the safe side of that line.

**The one exception in place, and what the test checks.** The `region` slice, derived from `TLA`, is
published under the small-cell rule (status line above); the fact table leaves `region` out (D-078). The map records the
slice as an exception on the `TLA` entry (`published_exceptions`, with the outputs its decision
covers: the slice only). `pipeline/tests/test_data_map.py` fails if a field whose class is not
published is read by any of these, other than through a recorded exception: a fact-table column, a
pair, a dimension's slice, or the committed snapshot aggregate (`snapshot_archive.group_by` in
`config/pipeline.json`, written to the public repository's `data/snapshots/`). It works out which
fields a dimension reads from its `derive` block, plus the fields its kind reads without naming
them, plus make and model wherever motive power is read (the hybrid classification rewrites motive
power from them). It does not see a published file the pipeline writes by any other route, or a
field read by code that `config/data_map.json`'s `derive_reads` does not describe. It also fails if a
field derivable only from `VIN11` is marked published, if an owner field is marked published (until
the owner has been shown its first table, D-120; `owner_rule.enforced` is true since D-127 and does
not by itself open any field), or if an exception on an owner field reaches the fact table. An
owner field is refused in any output the owner rule does not name (the fact table, the snapshot
aggregate), and `POSTCODE` in every output (`owner_rule.not_published`), whatever its class or
exceptions say.

**Context from NZTA.** NZTA's notes say owner location is given by territorial authority "to make
sure it isn't possible to identify a person", and its field list leaves the postcode out, though the
field is in the service (as quoted in this map's first pass, 2026-11-13).

**Why public fields still need care.** A cell that counts one vehicle shows nothing NZTA does not
publish for that vehicle today. What the site adds is a monthly series of such files. On the
2026-10 dry run, 50.2% of the fact table's rows count one vehicle, and those rows hold 7.1% of the
vehicles (D-078). Binding another field into the table can only split rows, so the share of vehicles
alone in a row can only stay the same or rise. The table holds no owner field, so following a
one-vehicle row from month to month shows only whether that vehicle is still registered.

The questions this map put to the user were answered on 2026-11-16 (D-096).

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
- **Privacy.** Public.
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
- **Privacy.** Public.
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
- **Privacy.** Public.
- **Relations.** Picks out a vehicle in combination. Moves together with: registration year (banded)
  0.64 and import status 0.48, both by construction; transmission 0.34 (measured).

## What the vehicle is

### `VEHICLE_TYPE`

- **Meaning.** NZTA's vehicle type. It decides what the site counts (`vehicle_scope.csv`, which also
  gives every type a readable label: the name a visitor reads, with no part in scope). The file's
  `trade_scope` column marks the types of a wider scope: the two in scope and
  buses, motor caravans and special purpose vehicles; `registrations_surviving` counts that scope since D-157 and `new_registrations` since D-158; the default scope (`in_scope`) is no longer a dataset, but the Registered as filter (`vehicle_type`) narrows to it. With them added, our counts of new vehicles
  come within 0.06% of the published total for October 2026 and within 1.3% for the other periods compared
  (`docs/METRICS.md`; D-105, D-106). It decides which types `new_registrations` counts (D-113, D-158), and it is the set of types
  whose model names the committed store of the dashboard keeps (DATA_SOURCES §D). Its `trade_group` column sorts each of those types
  into two groups: passenger cars and vans are `Passenger`; every other type in `trade_scope`
  (goods vehicles, buses, motor caravans, special purpose vehicles) is `Commercial`; a type outside it has no
  group (D-113).
- **Kind and values.** Category. 5 values on S since D-157 (passenger car/van 3,617,895; goods van, truck or
  utility 902,409; bus 37,053; motor caravan 54,693; special purpose vehicle 3,256; before D-157, 2 values:
  3,617,900 and 902,576 as measured then), 14 on W (trailers and caravans 883,184, motorcycles 192,024 and others).
- **Uses.** Break down, filter. Count only. Offered as the dimension `vehicle_type` (labelled "Registered as",
  for visitors too, so it cannot be read as the site's "Vehicle type"; Build offers it as a
  condition as soon as a cube carries it) on `registrations_surviving` and `new_registrations`, which both carry it, with its pairs and
  fact-table columns listed in `docs/CUBE_SCHEMA.md`. It holds the types the dataset's scope counts
  (`vehicle_scope.csv`), so five values on `registrations_surviving` and `new_registrations`, under that file's labels (the retired
  `registrations_flow` had two). It is not live on
  `registrations_cars_long_run`, whose source is a published series with no register field.
- **Coverage.** Every vehicle.
- **Not recorded.** No form seen.
- **Traps.** None in the data beyond the body types it shares (below). It is not the site's
  `segment` ("Vehicle type" in Build: car, ute, van, truck, other), which reads body type and gross
  vehicle mass as well: a ute registered as a passenger vehicle is a passenger car or van here and a ute
  there.
- **Privacy.** Public.
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
- **Privacy.** Public.
- **Relations.** Moves together with: vehicle type 0.97 and class 0.71 (by definition, inferred -
  confirm); gross vehicle mass (banded) 0.53 and seats (banded) 0.43 (measured).

### `CLASS`

- **Meaning.** NZTA: "Vehicle equipment standard classification". A short code. The table the maintainer
  supplied by hand from NZTA's vehicle classes page on 2026-11-17 lists 27 codes (the page blocks
  automated readers, so no agent or build read it; D-121). `class_map.csv` holds those 27 and `OTH`, 28 in
  all. The definitions, in the supplied table's words shortened: M, passenger vehicles and omnibuses: MA a passenger car with up to nine seats
  including the driver's, MB a forward control passenger vehicle, MC an off-road passenger vehicle (up to
  nine seats, four-wheel drive, at least four of the listed off-road features); MD a light omnibus (more
  than nine seats, gross vehicle mass up to 5 tonnes; MD1 to MD4 split it by mass and seats) and ME a heavy
  omnibus (more than nine seats, over 5 tonnes). N, goods vehicles by gross vehicle mass: NA up to 3.5
  tonnes, NB over 3.5 and up to 12, NC over 12. T, trailers by gross vehicle mass: TA a single-axle trailer
  up to 0.75 tonnes, TB another trailer up to 3.5, TC over 3.5 and up to 10, TD over 10. L, mopeds,
  motorcycles and tricycles: LA and LB mopeds on two and three wheels, LC a motorcycle, LD a motorcycle and
  side-car, LE a motor tricycle (LB1, LB2, LE1 and LE2 say which wheels are at the front). AA and AB, pedal
  cycles. `OTH` is not in that table: it is a value the register holds (83,228 vehicles of seven vehicle
  types), and its label is the code. The dimension shows each label with its code in brackets.
- **Checked against the register (2026-11-17, W, 5,926,990 vehicles).** 21 codes carry vehicles and 385,434
  vehicles have none. Every one of the 21 has a row in the supplied table except `OTH`; the table's other
  seven codes (AA, AB, LB1, LB2, LE1, LE2, MD) occur on no vehicle. Where a definition names something the
  register records, vehicles recorded that fit it and vehicles that do not (a mass of 0 and a seat count of
  0 are not recorded and are counted apart; mass is taken as kilograms, which the fits below support):
  - Seats, MA to MC (up to nine): of 3,519,756, 3,518,625 have one to nine seats, 1,114 have ten or more
    (MA 576, MB 432, MC 106) and 17 have 0 seats.
  - Seats, MD1 to ME (more than nine): of 37,355, 36,664 have ten or more, 690 have nine or fewer (MD1 559,
    MD2 1, MD3 47, MD4 9, ME 74) and 1 has 0 seats. MD1's 12-seat limit: no vehicle has more; 23,314 of
    23,874 have 10 to 12 seats, 559 have fewer and 1 has 0. MD2's over-12 limit: 261 of 361 have more, 100
    have 12 or fewer (90 with 12, 9 with 11, 1 with 3).
  - Mass, goods vehicles: NA (up to 3.5 t) 744,836 of 744,929 fit, 10 are heavier (9 between 3.5 and 4.5 t,
    1 over 12 t) and 83 have no mass; NB (3.5 to 12 t) 109,656 of 109,680 fit, 24 do not (6 at or under 3.5
    t, 18 over 12 t); NC (over 12 t) 74,427 of 74,475 fit, 48 do not (32 between 10 and 12 t, 16 between 5
    and 10 t).
  - Mass, omnibuses: MD1 (up to 3.5 t) 23,871 of 23,874 fit and 3 have no mass; MD2 (up to 3.5 t) 360 of
    361; MD3 (3.5 to 4.5 t) 1,486 of 1,535; MD4 (4.5 to 5 t) 800 of 876; ME (over 5 t) 10,628 of 10,709.
  - Mass, trailers: TA (up to 0.75 t) all 25,189 with a mass fit, and 518,086 of 543,275 have no mass; TB (up
    to 3.5 t) 186,425 of 186,427 fit, the other 2 are over 12 t; TC (3.5 to 10 t) all 1,511; TD (over 10 t)
    all 40,557.
  - Axles, TA (a single-axle trailer): of 543,275, 1,760 record one axle, 541,493 two and 22 three. The
    register's `NUMBER_OF_AXLES` does not agree with the definition for 99.7% of the class. The mismatch is
    stated, not explained or corrected. What the field holds on these trailers is measured under
    `NUMBER_OF_AXLES` (D-129).
  - Both seats and mass, MD1 to ME, vehicles with both recorded: the fit on both is MD1 23,311 of 23,870,
    MD2 260 of 361, MD3 1,440 of 1,535, MD4 793 of 876, ME 10,554 of 10,709. The mismatches are findings,
    not corrected here: the dimension reports the class NZTA recorded.
- **Kind and values.** Category. 7 values on S, 21 on W (`class_map.csv` holds all 21 and the 7 more the supplied table
  lists, so a wider scope, or a class that first appears later, does not trip the unmapped guard). S: MA 3,018,623; NA 701,639; MC 414,719; NB 72,851; NC
  68,051; MB 8,848; LE 1,702.
- **Uses.** Break down from March 2002, filter. Count only. **Bound** as the dimension `nzta_class`
  ("NZTA vehicle class"), a slice and a fact-table column of `registrations_surviving` (D-116).
- **Coverage.** S 94.8% (NEW 92.4%, USED 98.5%), and it depends on the year and on new or used.
  Not recorded, re-measured 2026-11-17 on the cube's 4,520,304 vehicles: NZ-new, 194,840 of 219,015
  first registered before 2000 (89%), 11,673 of 45,479 in 2000 and 2001 (26%), 588 of 409,840 in 2002
  to 2009, 25 of 2,057,836 from 2010; used imports, 26,849 of 60,661 before 2000 (44%), none of
  22,471 in 2000 and 2001, 6 of 213,328 in 2002 to 2009, 62 of 1,491,674 from 2010. By month, all
  vehicles: January 2000 54.3% not recorded (1,293 of 2,381), December 2000 10.8% (275 of 2,550),
  December 2001 2.2% (77 of 3,540), March 2002 0.64% (25 of 3,934). The last month above 1% is
  February 2002; from March 2002 on, 591 of 4,166,149 are not recorded. For NZ-new vehicles alone the
  last month above 1% is July 2002. **A chart of class over time is honest from March 2002**; before
  then the mix moves with what was recorded, not with what was registered (the earlier "from 2000"
  and "100% from 2010" were both wrong).
- **Not recorded.** NULL (W 385,434; S 234,043), covered. No other form occurs: the codes are 2 or 3
  letters and digits.
- **Traps.** **`NA` is a class, not "not applicable"**: 701,639 S goods vehicles. A rule that treats
  `NA` as missing would remove nearly every light commercial. It must never become a sentinel, and
  a test holds that it does not (D-116). MC is not an SUV marker on its own (`segment_map.csv`'s
  note).
- **Privacy.** Public.
- **Relations.** Rolls up to vehicle type on S (MA, MB, MC and LE under passenger cars and vans; NA,
  NB and NC under goods vans, trucks and utes; 1 vehicle of 4,286,433 with a class disagrees: an MA
  registered as a goods vehicle); not on W (6 of 21 classes have two parents, 99,365 vehicles
  off), so a question that crosses class with vehicle type should be refused on S. Near-collinear
  with gross vehicle mass for goods vehicles: on the cube's goods vehicles NA is at or under 3.5 t
  for 701,555 of 701,637 (9 above, 73 with no mass), NB between 3.5 and 12 t for 72,772 of 72,774, and
  NC over 12 t for all 67,963. Moves together with: vehicle type 1.00, body type 0.71 and gross vehicle
  mass (banded) 0.57 (all by definition, inferred - confirm); road transport code 0.44 on 57,020
  vehicles.

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
- **Privacy.** Public.
- **Relations.** Rolls up to manufacturer group, to owner country and to heritage country through
  `brand_registry.csv`, by construction (heritage country added on 2026-11-18, D-136). Picks out
  a vehicle in combination. Not measured for moving together by hand (too many values); the build
  measures it (D-136).

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
- **Privacy.** Public.
- **Relations.** Rolls up to make only as the make-and-model pair the site builds; the raw name does
  not. Picks out a vehicle in combination. Not measured for moving together.

### `BASIC_COLOUR`

- **Meaning.** NZTA: "The predominant colour of the vehicle". Whether it is the colour at first
  registration or today is not shown by the data; read as today's (inferred - confirm).
- **Kind and values.** Category, 14 values (W and S). S: white 1,194,221; silver 787,901; black
  567,210; blue 564,009; grey 537,023.
- **Uses.** Break down, filter. Count only. **Bound** as the dimension `colour` ("Colour as recorded"), a slice of
  `registrations_surviving` with NZTA's colour words as they stand and no reference file. It is not a column of the wide fact
  table: as one it was measured at 1,324,975 bytes, +75% of the table (D-116 item 6). It is a column of a narrower table of its own,
  `colour`, beside the wide one, with make and the powertrain in five groups (D-144, `docs/CUBE_SCHEMA.md`, *Narrow fact tables*).
- **Coverage.** S 100.0% in every period; W all but 6.
- **Not recorded.** NULL (W 6, S 5), covered. Re-checked on 2026-11-18 on the whole 2026-10 pull (5,926,990 rows): 14
  values and 6 NULLs, no other form, so `sentinels.csv` lists none for the field. Of the values: white 1,426,254; silver
  1,213,510; grey 733,886; black 708,568; blue 671,428; red 542,164; green 231,807; orange 86,118; brown 84,313; yellow
  83,035; gold 71,647; purple 38,110; cream 28,668; pink 7,476.
- **Traps.** None found.
- **Privacy.** Public.
- **Relations.** Picks out a vehicle in combination. Moves together with nothing strongly: vehicle
  type 0.25, import status 0.15, vehicle year (banded) 0.15, gross vehicle mass (banded) 0.14.

### `NUMBER_OF_SEATS`

- **Meaning.** NZTA: "Records the number of seats in a vehicle".
- **Kind and values.** Number. 172 values on S, 193 on W. Median 5.
- **Uses.** Break down banded, filter; average and median inside the guard. **Bound as bands only**
  (D-116): the dimension `seats_band` ("Seats"), a slice and a fact-table column of
  `registrations_surviving`. On the cube's 4,520,304 vehicles the bands are 1-2: 201,636 (4.5%); 3-4:
  364,527 (8.1%); 5: 3,402,655 (75.3%); 6-7: 441,525 (9.8%); 8+ (8 to 60): 101,346 (2.2%); unknown:
  8,615 (0.2%). An average or a median needs a sum and a count per cell, as fuel consumption has, and
  is not built.
- **Coverage.** S 99.8% (NEW 99.7%, USED 100.0%); the 1990s 94.7%. W 79.8%: trailers and motorcycles
  have none. **The gap is in 1994 and 1995.** Of the 8,408 zeros on the cube, 8,368 are vehicles first
  registered from January 1994 to December 1995, 34 were first registered before 1994 and 6 in 1998
  to 2001. In 23 months, January 1994 to November 1995, more than 1% of the month's vehicles have no seats
  recorded: between 27% and 37% of each month's vehicles from April 1994 to October 1995 (428 of 1,507
  in August 1995). In December 1995 it is 2 of 1,388, and from January 1996 on 6 vehicles in all. So a chart of seats over
  time is honest up to December 1993 and from December 1995, and the `unknown` band shows the gap in
  between.
- **Not recorded.** Zero (S 8,408, almost all NZ-new: 8,398 NZ-new and 10 used; W 1,200,405).
  `0` is in `sentinels.csv` under this field since D-116, so it is counted as a source sentinel and
  falls in `unknown`.
- **Traps.** 207 S vehicles have more than 60 seats (up to 999; 174 passenger cars and vans, 33
  goods vehicles); 158 S vehicles with about 50 seats are cars or goods vehicles. The guard is 1 to 60
  (D-116): a count above it falls in `unknown`, counted apart from the zeros in the manifest
  (`bands.seats_band.out_of_bands` 207, `source_sentinel` 8,408). The mean moves little (S 5.011 over
  every real value, 5.001 inside the guard).
- **Privacy.** Public.
- **Relations.** Moves together with: vehicle type 0.49, road transport code 0.44 (57,219 vehicles),
  body type 0.43 (measured).

### `NUMBER_OF_AXLES`

- **Meaning.** NZTA: "Records the number of axles the vehicle has". Measured on the whole 2026-10
  pull (W, 5,926,990 vehicles; D-129): it behaves as a count of axles on heavy vehicles and not on
  light ones.
  - **Heavy vehicles, and buses: a count.** Gross vehicle mass rises with it. Class NC (74,475 vehicles):
    median mass 15,000 kg at two axles (16,167 vehicles), 24,500 at three (32,937), 31,600 at four
    (24,873), 35,000 at five (470). Class TD trailers (40,557): one axle 304, two 5,893, three
    12,227, four 14,160, five 7,959. Buses: median mass 3,250 kg at two axles (34,549) and 21,350
    at three (2,746). Zero is rare: 2 of class NC, 1 of class ME, none of class TD.
  - **Light vehicles and light trailers: zero or two.** Passenger cars and vans (3,703,985): zero
    on 687,152, two on 3,015,304, one on 1,153, three or more on 376. Motorcycles (192,024): zero
    on 178,720, two on 13,246. Class TA, which NZTA defines as a single-axled trailer (543,275):
    one axle on 1,760, two on 541,493, three on 22, never zero. Of the TA trailers first
    registered before 1996 (334), 292 record one axle; of those from 1996 (542,941), 1,468 do.
    The two goes with a mass that was not recorded: 517,911 of the 541,493 two-axle TA trailers
    have no gross vehicle mass, against 158 of the 1,760 one-axle ones. Class TB (186,427): one
    axle on 2,728, two on 183,563.
  - **What that supports.** A two on a light vehicle or a light trailer cannot be told from a value
    filled in without counting: on class TA it contradicts the class's own definition for 99.7% of
    the class. Whether NZTA's system fills it in is not known; no public source that says how the
    field is filled was found (NZTA's field descriptions give only the sentence above). It is not
    a count of wheels: cars read two, and 13,246 motorcycles read two while 178,720 read zero.
- **Kind and values.** Number, 10 values (0 to 9). W: zero 1,156,224; one 9,759; two 4,663,486;
  three 49,551; four 39,257; five 8,646; six to nine 67. Never NULL. On S, two axles on 3,735,046
  vehicles, 98.5% of those inside the range.
- **Uses.** None for now (D-126, D-129): not a breakdown, a filter or a measure in any dataset.
  It may be offered later only within heavy vehicle classes, as axles as recorded, with the heavy
  vehicle topic (package I) and a record of its own. Across all vehicles, a share with two axles
  would chart how the field was filled, not the vehicles.
- **Coverage.** S 83.9% (NEW 87.8%, USED 77.9%): before 1990 11.5%, 1990s 38.9%, 2000s 65.5%, 2010s
  88.8%, 2020 to 2026 95.6%; 2023 alone 86.8%. W 80.5%. "Covered" here means only "not zero".
- **Not recorded.** Zero (S 727,150). **Not in `sentinels.csv`.**
- **Traps.** One axle (S 1,966) and seven to nine (S 15; W 24) are implausible for S vehicles; one
  axle is real on heavy trailers (class TD 304, class TC 314). A zero is common on cars, and a
  two is nearly universal on light vehicles whatever they are, so axles are not a heavy-vehicle
  marker and say nothing about a light vehicle.
- **Privacy.** Public.
- **Relations.** Not measured for moving together.

### `TRANSMISSION_TYPE`

- **Meaning.** NZTA: "The gearing system the vehicle has", which it says is "infrequently recorded".
  The values give the number of gears and automatic or manual, or continuously variable.
- **Kind and values.** Category, 28 values. S: 6-gear auto 719,347; continuously variable 492,914;
  4-gear auto 280,612; 5-gear manual 254,689.
- **Uses.** Break down and filter, NZ-new vehicles only. Count only. The grouping into automatic,
  manual, continuously variable and other is a reference lookup (invariant 4): `transmission_map.csv`
  (D-128) holds all 28 values the register carries, each with its group, a readable label and the basis
  for the group. A value goes in a group by what the value itself says: the 11 values of the form
  `N-GEAR AUTO` (3 to 18 gears) are automatic, the 15 of the form `N-GEAR MANUAL` (3 to 18) are manual,
  `CONTINUOUSLY VARIABLE` is continuously variable, and `OTHER`, which says only that, is other: the
  register does not say what it holds, so it is not placed. "Automatic" is NZTA's word AUTO; the
  register does not say whether it is a torque-converter, dual-clutch or automated manual gearbox. On
  the cube's 4,520,304 vehicles the groups hold: automatic 1,530,025; manual 383,358; continuously
  variable 492,914; other 110,739; no value (NULL) 2,003,268. **Bound (D-128)** as the dimension
  `transmission` ("Gearbox"), a lookup on `transmission_map.csv` publishing the group, a slice and a
  fact-table column of `registrations_surviving`, and in `abort_on_unmapped`: a raw value the file does
  not hold reads `__UNMAPPED__` and counts against the guard.
- **Coverage.** **NZ-new only**: NEW 92.1% (2,516,920 of 2,732,170 on the cube), USED 0.0% (116 of
  1,788,134). Nothing before 1990; 1990s 33.9%; from 2000 between 56.9% and 64.2% of all S vehicles.
  W 43.7%. The pipeline does not look at the import status: the 116 used imports keep their value and
  every other used import reads not recorded. **Where the gap is, among the NZ-new vehicles of the
  cube** (power has a similar gap of its own: `POWER_RATING`). Passenger cars and vans: no month
  from May 2003 has more than 1% with no gearbox recorded (April 2003: 18 of 1,791), and 4,027 of
  1,757,869 from May 2003 on have none. Goods vehicles of 3.5 tonnes gross mass or less: no month from
  February 2017 above 1%. Goods vehicles heavier than that, or with no mass recorded (ten): every month to October
  2026 is above 1% (42,429 of 81,369 first registered from May 2003 have none, over 12 tonnes 32,468 of 49,624). For all
  NZ-new vehicles together the last month above 1% is the latest, October 2026 (172 of 14,912, 1.15%), and
  320 of the 322 months from January 2000 are above it: of the 215,250 NZ-new vehicles with none,
  118,540 are passenger cars and vans (114,513 of them before May 2003) and 96,710 are goods vehicles
  (44.9%). By year of first registration (D-128's review; NZ-new vehicles of the cube):
  before 1994 no vehicle has a gearbox recorded; in 1994 it is missing on 100.0% of passenger cars and vans and of
  goods vehicles of 3.5 tonnes or less, in 1995 on 85.8% and 87.1%; from 1996 it is missing on at most 1.9% and 0.9% of
  any year's (4,844 of 1,854,158 and 1,308 of 623,296 in all). Heavier goods vehicles from 1996: 46,213 of 90,336 have
  none. `transmission`'s public note gives the years, not the months.
- **Not recorded.** NULL, covered. `sentinels.csv` lists nothing for the field: no other form occurs.
- **Traps.** `OTHER` is a recorded value on 110,739 S vehicles, 105,880 of them first registered from
  2020; what it holds is not shown. By NZTA's motive power, on the cube's 110,739 vehicles (all NZ-new,
  none a used import): electric 75,794 (68.4%), plug-in petrol hybrid 17,974, petrol 15,476,
  range-extended electric 636, petrol electric hybrid 437, petrol hybrid 396, diesel 22 and fuel cell
  hydrogen 4. So most, not all, are battery electric, and whether a single-speed drive is what the value
  means is a guess, so the value stays in other. All 28 values are matched to a
  group by their text; the 12-, 16- and 18-gear AUTO values are on goods vehicles only. A question using this
  field is narrowed to NZ-new vehicles and says so.
- **Privacy.** Public.
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
- **Privacy.** Public.
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
- **Privacy.** Public.
- **Relations.** Rolls up to the powertrain group (`powertrain_group`, the `powertrain_group_label` column of
  `powertrain_map.csv`, D-124): each powertrain value is in one group, so Build does not cross the
  powertrain with its group. Moves together with: vehicle type 0.72, combined fuel consumption (banded) 0.49,
  transmission 0.34 (measured).

### `ALTERNATIVE_MOTIVE_POWER`

- **Meaning.** A second fuel. Read as empty when the vehicle has none, so an empty value would mean
  "none", not "not recorded" (inferred - confirm: nothing in the data or in NZTA's words checked here
  shows it; it rests on 99.9% of S vehicles being empty).
- **Kind and values.** Category, 9 values. 5,792 S vehicles (0.13%) have one: LPG 3,084, CNG 2,612.
- **Uses.** Filter only ("also runs on LPG or CNG"). Too sparse to break down. Bound today only so the
  build can report dual-fuel vehicles; the powertrain ignores it (`docs/DATA_SOURCES.md`).
- **Coverage.** S 0.1%: before 1990 3.4%, 1990s 0.1%, 2000s 0.0%, 2010s 0.1%, 2020 to 2026 0.0%.
  W 0.1% (6,789 vehicles).
- **Not recorded.** If the reading above holds, none: NULL is "none".
- **Traps.** **`sentinels.csv`'s rule for every field turns NULL into "not recorded"**, which would
  be wrong if the reading holds: binding it as a breakdown would need a "none" label instead.
  Petrol (S 51), diesel (24) and `OTHER` (1) as a second fuel are odd beside a primary fuel.
- **Privacy.** Public.
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
- **Traps.** 999 cc is read as a real size, not a placeholder: it is on 11,811 S vehicles, which the
  profile finds are Ford and Volkswagen petrol vehicles with 1.0-litre engines (not checked against
  specifications). 1 cc appears on 13,446 S vehicles, 12,802 of them electric. 16,350 cc on 1,093
  trucks is read as a real heavy engine; above 20,000 (S 382, up to 98,930) is read as not real.
  Proposed guard: 50 to 20,000, engines only. 13,952 S vehicles fall outside 50 to 20,000; that count
  includes the 12,802 electric vehicles at 1 cc, which "engines only" leaves out anyway, and how many
  vehicles with an engine fall outside was not measured. **The bound band "4.0 L and over" has no
  upper limit**, so the 382 values land in it today. Never average over every vehicle: the zeros
  pull it down.
- **Privacy.** Public.
- **Relations.** Picks out a vehicle in combination. Moves together with: gross vehicle mass (banded)
  0.52, vehicle type 0.52, class 0.44, combined fuel consumption (banded) 0.42 (measured).

### `POWER_RATING`

- **Meaning.** NZTA: "The power rating of the vehicle", in kilowatts. NZTA's dashboard page: power
  is "Only recorded for NZ New vehicles".
- **Kind and values.** Number. 467 values on S, 488 on W. Median on S 126.
- **Uses.** Break down banded and filter, NZ-new only; average and median inside the guard. **Bound as
  bands only** (D-128): the dimension `power_band` ("Power"), a slice and a fact-table column of
  `registrations_surviving`. An average or a median needs a sum and a count per cell, as fuel consumption
  has, and is not built. On the cube's 4,520,304 vehicles the bands are under 75 kW: 183,756 (7.3% of the
  2,532,040 inside the guard); 75-99: 328,214 (13.0%); 100-149: 1,383,637 (54.6%); 150-199: 406,126
  (16.0%); 200-299: 175,806 (6.9%); 300-499: 52,893 (2.1%); 500 and over (500 to 900): 1,608 (0.1%);
  unknown: 1,988,264 (1,988,072 zeros, 59 below 5 kW, 133 above 900).
- **Coverage.** **NZ-new only**: NEW 92.7% (2,532,091 of 2,732,170 on the cube), USED 0.0% (141 of
  1,788,134). Nothing before 1990. W 46.3%. The pipeline does not look at the import status: the 141 used
  imports keep their value and every other used import is in `unknown`. **Where the gap is, among the
  NZ-new vehicles of the cube.** Passenger cars and vans: no month from May 2003 has more than 1% with no
  power (April 2003: 18 of 1,791), and 3,989 of 1,757,869 from May 2003 on have none. Goods vehicles of 3.5
  tonnes gross mass or less: no month from February 2017 above 1%. Goods vehicles heavier than that, or with no mass
  recorded (ten): every month to October 2026 is above 1% (42,412 of 81,369 first registered from May 2003
  have none, over 12 tonnes 32,457 of 49,624); makes that record none on nearly every vehicle include Hino, Scania, Kenworth,
  DAF and UD Trucks. So for all NZ-new vehicles together the last month above 1% is the latest, October
  2026 (172 of 14,912, 1.15%), and 320 of the 322 months from January 2000 are above it: the gap stands in
  the goods vehicles, 90,909 of the 200,079 NZ-new vehicles with none (45.4%), the rest being passenger cars
  and vans, 105,181 of the 109,170 before May 2003. By year of first registration (D-128's review; NZ-new vehicles of the cube, a
  power being a value inside the guard): before 1994 a power is on 12 of 101,625 passenger cars and vans and 33 of
  30,867 goods vehicles of 3.5 tonnes or less; in 1994 it is missing on 34.1% and 29.9%, in 1995 on 10.3% and 9.6%; from
  1996 it is missing on at most 2.0% and 0.8% of any year's (4,960 of 1,854,158 and 1,310 of 623,296 in all). Heavier goods
  vehicles from 1996: 46,059 of 90,336 have none, between 21.7% and 58.1% of a year's. Counting values outside the guard
  as missing, as the `unknown` band does, the last month above 1% for passenger cars and vans is April 2004, not April
  2003. `power_band`'s public note gives the years, not the months.
- **Not recorded.** Zero. S 1,988,207 on the map's own count; on the cube's 4,520,304 vehicles
  1,988,072: 1,787,993 used imports (all but 141 of 1,788,134) and 200,079 NZ-new (7.3% of 2,732,170).
  No value is empty. `0` is in `sentinels.csv` under this field since D-128, so it reads as not recorded
  wherever the field is bound.
- **Traps.** 999 on 118 S vehicles (107 of them Jaguar petrol) is a placeholder. 99 on 4,016
  (2,916 Mitsubishi petrol) may be real or a default: unverified. 59 S vehicles are below 5 kW. Between 901
  and 998 kW are 15 passenger cars (13 at 980 and 2 at 959): not checked, and outside the guard.
  The guard is 5 to 900 (D-128, bound): a value outside it falls in `unknown`, counted apart from the
  zeros and the blanks in the manifest (`bands.power_band`: `source_sentinel` 1,988,072, `out_of_bands`
  192 (59 below 5 kW, 15 from 901 to 998, 118 of 999), `source_missing` 0).
- **Privacy.** Public.
- **Relations.** Recorded on the same vehicles as transmission and the MVMA code: all three on
  2,517,036 S vehicles (2,516,929 NZ-new, and 107 used imports, which is the count of used imports
  with all three, not with any one), 92.1% of NZ-new. Picks out a vehicle in
  combination. Moves together with: engine size (banded) 0.37, transmission 0.32, combined fuel
  consumption (banded) 0.31 (measured). Its 0.34 with previous country rests on 114 vehicles and
  means nothing.

### `FC_COMBINED`

- **Meaning.** Fuel consumption over the combined test cycle, litres per 100 km, as NZTA records it
  (when it is recorded is not shown by the data). Stored as text.
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
- **Privacy.** Public.
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
  0 to 30 (60 S above 30).
- **Privacy.** Public.
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
- **Privacy.** Public.
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
  Of all S vehicles: before 1990 6.4%, 1990s 8.1%, 2000s 6.2%, 2010s 3.1%, 2020 to 2026 3.6%.
  W 5.0%.
- **Not recorded.** Zero (S 4,337,512). **Not in `sentinels.csv`.**
- **Traps.** Bunched on a few values. Proposed guard: 1,000 to 60,000 (none outside on S, 2 on W).
- **Privacy.** Public.
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
  15.8% and 16.0%; cars 0.0%). Of all S vehicles, height then width: before 1990 6.0% and 7.4%,
  1990s 7.3% and 7.6%, 2000s 5.4% each, 2010s 2.3% each, 2020 to 2026 2.6% each. W 4.2% and 4.3%.
  Together on 143,775 S vehicles.
- **Not recorded.** Zero. **Not in `sentinels.csv`.**
- **Traps.** **The worst guards in the register.** 1 mm is a placeholder (height S 4,722; width
  S 822). Some values look like centimetres (height 100 to 460: 92 S; width 150 to 299: 1,967 S) and
  some ten times too large (height 10,000 and over: 91 S); the largest are 44,260 and 50,300.
  Proposed guards: height 1,000 to 4,600 (5,020 S outside, 3.5% of those recorded), width 1,200 to
  2,600 (4,278 outside, 2.9%). Without them the mean height is 2.8% lower and the mean width 1.0%
  lower.
- **Privacy.** Public.
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
- **Privacy.** Public.
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
- **Privacy.** Public.
- **Relations.** Moves together with: vehicle type 0.59, import status 0.53, class 0.35 (measured).

### `PREVIOUS_COUNTRY`

- **Meaning.** The country where a used import was registered before New Zealand. It does not apply
  to NZ-new vehicles.
- **Kind and values.** Category. 45 values on S, 49 on W.
- **Uses.** Break down and filter, used imports only (`imported_from`, which applies to
  `used_imports`). Count only.
- **Coverage.** **Used imports**: USED 100.0%, NEW 0.0% on S. As a share of all S vehicles, which
  follows the used share of each period: before 1990 4.5%, 1990s 34.6%, 2000s 34.1%, 2010s 42.0%,
  2020 to 2026 42.0%. W 34.2%.
- **Not recorded.** `NONE` (S 2,732,667: every NZ-new vehicle, where it means "not applicable", and
  334 used imports, where it means "not recorded") and `USED UN-REGIST` (S 40), both covered.
- **Traps.** `OTHER` (S 1,172) is a catch-all. `NEW ZEALAND` is the previous country of 299 S used
  imports (33,858 W vehicles, and 66,084 re-registered W vehicles).
- **Privacy.** Public.
- **Relations.** Recorded only for used imports. Moves together with (used imports only): age at
  registration 0.26, vehicle year (banded) 0.23, country built in 0.21, engine size (banded) 0.21.

### `NZ_ASSEMBLED`

- **Meaning.** NZTA: "Indicates where the vehicle was assembled": imported built up, or assembled or
  built in New Zealand.
- **Kind and values.** Category, 3 values. S: imported built-up 4,303,049; NZ assembled or built
  32,564; `UNKNOWN` 184,863.
- **Uses.** Break down and filter, from December 1995. Count only. **Bound** as the dimension
  `nz_assembled` ("Imported or assembled here"), a slice and a fact-table column of
  `registrations_surviving` (D-116).
- **Coverage.** S 95.9%: before 1990 0.0% (`UNKNOWN` on 119,994 of 120,012), 1990s 59.6%, 100% from
  2000 (370 of 4.24 million unknown). W 94.1%. By month (re-measured 2026-11-17 on the cube's 4,520,304
  vehicles): all but 24 of the 179,720 vehicles first registered up to July 1995 are `UNKNOWN`; recording
  starts in August 1995 (10 of 1,507 recorded), reaches about two thirds in November (936 of 1,429 recorded)
  and is nearly complete in December (1,379 of 1,388). From January 1996 no month has more than 1% unknown (7 vehicles in 1996 to 1999,
  370 from 2000), so **it is honest to chart from December 1995** (0.6% unknown in that month). The
  earlier "from 2000" was more cautious than the data.
- **Not recorded.** `UNKNOWN` (W 350,980; S 184,863: 162,984 NZ-new, 21,879 used). NULL does not
  occur on S. NULL is covered for every field and `UNKNOWN` is in `sentinels.csv` under this field only
  (D-116), so both read "not recorded" in the cube.
- **Traps.** The first pass counted it "100% filled" because it counted `UNKNOWN` as a value.
  **It is a flag, not a place.** 28,721 of the 32,564 S vehicles marked assembled or built here (88%)
  record Japan as where they were built: NZTA's guidance for where built is that a vehicle assembled
  here from a kit records the kit's country (`docs/DATA_SOURCES.md`). Two small contradictions are
  kept as recorded: 616 used imports are marked assembled here, and 238 vehicles marked imported
  built up record New Zealand as where they were built. **Few vehicles are assembled here
  now**: the S vehicles marked assembled here fall from 624 in 2010 to between 28 and 103 a
  year from 2016 to 2025 (NZ-new alone, 17 to 70; 14 in 2026 to October), against 112,745 to 158,075
  NZ-new vehicles first registered each year, so a month's share rests on a handful of vehicles.
- **Privacy.** Public.
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
- **Privacy.** **Owner rule** (D-096). The `region` slice derived from it is published, as the
  recorded exception (status line above), and the user confirmed that it stays. Since D-127 the slice
  takes the minimum of 10, a cell under it hidden, and a second rule that limits what a total gives away of a
  hidden cell. A pair with it is not built.
- **Relations.** Rolls up to region through `tla_region.csv`: all 67 S values are in the file, none
  twice. Picks out a vehicle in combination. Moves together with nothing above 0.15 (road transport
  code 0.15, vehicle type 0.13).

### `POSTCODE`

- **Meaning.** The postcode of the registered owner's address. Not in NZTA's field descriptions.
  Kept in the private archive only (D-076).
- **Kind and values.** Place. 1,331 values in the 2026-10 archive file, one of them the zero (W;
  D-079).
- **Uses.** None for now (D-096). If that changes: area totals above a minimum count only.
- **Coverage.** W 95.1% (5,638,818 vehicles above zero). Not measured on S.
- **Not recorded.** Zero (W 288,172; no empty value). **Not in `sentinels.csv`.**
- **Traps.** NZTA stores it as a number, so a postcode starting with zero loses it: 152 postcodes
  holding 885,064 vehicles are below 1000 (W). Of the 1,330 above zero, 154 hold fewer than 5 vehicles
  and 237 fewer than 20 (D-079).
- **Privacy.** **Not published for now** (the user, D-096); if ever, area totals above a minimum
  count only (D-076).
- **Relations.** Postcode to district is not checked. Picks out a vehicle in combination.

### `VEHICLE_USAGE`

- **Meaning.** NZTA: "Classification of how a vehicle is used. This field groups several more
  detailed usage types". **Read as the latest usage recorded, not the usage at first registration:
  shown for rental; other values not tested** (D-087). For the newest month the register and the
  dashboard agree on rental, and for older months the register's rental share is far lower; taxi
  does not fit the pattern (below, "As first registered, or today").
- **Kind and values.** Category, 7 values on S, 8 on W. S: private passenger 4,226,874; transport
  licensed goods 93,914; other goods 85,136; rental 60,172; taxi 25,987; other 23,662; emergency 4,731.
- **Uses.** Break down, filter. Count only. For rental at least, it answers "how are they used now",
  not "who bought them". `vehicle_usage_map.csv` (D-135) gives each of the eight values the register
  carries on the whole register a readable label and a note saying what the value itself says; a value
  is labelled by its words and not placed in a group, because the register defines none of them (`OTHER`
  is a recorded catch-all, not a blank, and `TAXI COMMERCIAL PASSENGER` runs its words together without
  saying whether it is one group or two). The field is bound (D-135) as the dimension `vehicle_usage`, labelled "Current use", and
  counted only over the vehicles registered today (the stock `fleet`), by vehicle type if asked, never by the month or year of first
  registration: the data map marks it `stock_only`, so the build offers it to no other dataset. It reads as the latest usage the
  register records; for rental that is shown to differ from the usage at first registration, and for the other values it is not
  tested, so nothing is said of them beyond what the register records now. The slice and the pair are held to the small-cell rules
  (`docs/CUBE_SCHEMA.md`). The first table was shown to the owner, who approved publishing the slice and the pair since D-141, with
  the figures in that record. That covers these two tables only: usage by month or year of first registration, and every other
  owner field, stay unpublished.
- **Coverage.** Every vehicle.
- **Not recorded.** No form seen. `OTHER` (S 23,662) is a recorded catch-all.
- **Traps.** The rental share differs widely between months: among NZ-new passenger cars on S it is
  41.1% for October 2026, 4.6% for July 2026 and 0.9% for March 2026. The dashboard's usage list is
  finer (20 values).
- **Privacy.** **Owner rule** (D-096): a table of one or two fields, cells under 10 vehicles hidden.
- **Relations.** Moves together with: road transport code 0.44 (57,232 vehicles; partly by
  definition, inferred - confirm); industry class 0.41, gross vehicle mass (banded) 0.41 and vehicle
  type 0.40 (measured). Industry class at 0.41 is not a copy of usage.

### `INDUSTRY_CLASS`

- **Meaning.** NZTA: "The class of industry a vehicle is associated with". Read as the owner's
  industry (inferred - confirm), and **at least partly the current owner's** (below, "As first
  registered, or today").
- **Kind and values.** Category: 14 classes and `UNKNOWN` (W and S). S: private 4,129,137;
  business/financial 116,081; constructing 54,312; commercial road transport 53,667.
- **Uses.** Break down, filter. Count only.
- **Coverage.** S 99.6% (before 1990, 88.0%). W 92.6%: `UNKNOWN` is mostly trailers and machines.
- **Not recorded.** NULL (S 18), covered; `UNKNOWN` (W 441,020; S 18,653, 0.4%). **`UNKNOWN` is not in
  `sentinels.csv`.**
- **Traps.** `VEHICLE DEALER` (S 15) and `VEHICLE TRADER` (S 8,610) read as two names for one idea
  (inferred - confirm); if so, binding should join them by a reference lookup.
- **Privacy.** **Owner rule** (D-096): a table of one or two fields, cells under 10 vehicles hidden.
- **Relations.** Road transport code does not roll up to it (below). Moves together with: usage 0.41,
  vehicle type 0.36, class 0.30 (measured).

### `ROAD_TRANSPORT_CODE`

- **Meaning.** NZTA: "For vehicles with industry class recorded as 'commercial road transport' this
  shows the type of road transport"; on its dashboard page, "provided by the owner or dealer and is
  not verified or certified".
- **Kind and values.** Category, 20 values. S: general goods, local 19,882; general goods, line
  haulage 10,547; bulk cartage, solids 7,765.
- **Uses.** Break down and filter, for heavy-vehicle topics only. Count only.
- **Coverage.** S 1.3% (57,232 vehicles): goods 5.9%, cars 0.1%. Of all S vehicles: before 1990
  0.8%, 1990s 1.3%, 2000s 1.4%, 2010s 1.2%, 2020 to 2026 1.4%. W 1.6%.
- **Not recorded.** Read as none: an empty value would mean the vehicle has no road transport code
  (inferred - confirm). Partial support: NZTA ties the code to the commercial road transport class.
  On S that class holds 53,667 vehicles, and 53,667 of the 57,232 vehicles with a code sit under
  their code's commoner class, which the profile's examples show is that class for the largest codes.
  That fits every vehicle in the class having a code; it was not measured directly. If the reading
  holds, `sentinels.csv`'s rule for every field would wrongly call an empty value "not recorded", as
  for the second fuel.
- **Traps.** 6.2% of its vehicles sit outside the commercial road transport class. 669 S log haulage
  vehicles are passenger cars.
- **Privacy.** **Owner rule** (D-096): it describes the owner's business, in the owner's own words.
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
- **Privacy.** Public, never a breakdown.
- **Relations.** Picks out a vehicle in combination.

### `MVMA_MODEL_CODE`

- **Meaning.** NZTA: "Model code is assigned by the manufacturer at the time of VIN allocation to NZ
  new vehicles".
- **Kind and values.** Identifier. 24,866 values on S, 30,633 on W.
- **Uses.** None as a breakdown. A possible key for a model-level lookup (the work order's package I),
  with care.
- **Coverage.** **NZ-new only**: NEW 92.6%, USED 131 vehicles; nothing before 1990. S 56.0%, W 46.2%.
- **Not recorded.** NULL, covered.
- **Traps.** **Not a clean key.** On S, 96 codes hold more than one make (253 vehicles off the
  commoner make) and 1,306 more than one model name (11,861 vehicles off). Many are spellings of one
  model (`VX COMMODORE` and `COMMODORE`), not all (one code holds Colorado and Trailblazer).
- **Privacy.** Public, never a breakdown.
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
- **Privacy.** Public, never a breakdown.
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
- **Kind and values.** Identifiers. Number of values not measured: they were counted, never listed.
- **Uses.** None.
- **Coverage (first pass, W).** Chassis 40.4% (USED 91.7%, NEW 13.2%); engine number 84.2% (cars
  99.6%, trailers 0.1%). Not measured on S or by period.
- **Not recorded.** Not measured.
- **Traps.** Each identifies a vehicle, so neither is ever asked for: the archive job leaves both out
  of its pull, and the build's own pull takes only the bound fields.
- **Privacy.** **Never pulled** (`register_archive.never_pulled`; D-062, D-076).
- **Relations.** Each picks out a vehicle on its own.

### `OBJECTID`

- **Meaning.** A row number in NZTA's service, used to page the pull. Not a property of the vehicle.
- **Kind and values.** Identifier, one value per row.
- **Uses.** None for a visitor. The pull pages by it; the archive leaves it out of its file.
- **Coverage.** Every row (W).
- **Not recorded.** No form seen.
- **Traps.** It belongs to one release of NZTA's service. Whether it stays the same for a vehicle
  across releases was not measured, so it is no key for following vehicles or joining two pulls (the
  archive's two October files do not line up row for row: `docs/DATA_SOURCES.md`).
- **Privacy.** Never published.
- **Relations.** Picks out one row of one release.

## The dashboard's fields

The source of `new_registrations` (`docs/METRICS.md`; `docs/DATA_SOURCES.md` §D). Measured on
2026-11-14 from the user's export of January 2021 to October 2026 (D) against the register as at
31 October 2026, vehicles first registered in the same 70 months (D-087). The file has no empty
cell: what is not recorded is written as text. `Vehicles` is the count column, not a field.

**What holds for every column, unless a line below says otherwise.** Its meaning, kind, uses, who
it is recorded for, traps, privacy and relations are its register field's (above). Its coverage is
the whole file: every row carries a value, so coverage is the share not written as "not recorded",
and it covers January 2021 to October 2026 only. It is few or many as in the dataset built from the
file, whose scope was the survivors dataset's when it was written (D-087), the default scope: for example vehicle type has 14 values in the
file and 2 in the dataset (the survivors count five since D-157). None is `bound` (a test holds the map to that): `bound` names a register field's
logical name in the top-level `fields` of `config/pipeline.json`, and a dashboard column is named in
`supplied.nzta_dashboard` instead, as a `fields` entry, an `extra_fields` entry or, for the district alone, a private
column. The committed store keeps every column but `Territorial authority`, which `supply` checks and drops (rows that
differ only in it are summed). `Owner Type` and `Vehicle usage` are stored as the export has them, as `owner_type` and
`usage_registered` (3 and 20 values, none empty, in the committed store).

**Two dashboard columns are not taken** in any export: `VIN - first 11` and `Physical post code`.
They are the dashboard's forms of `VIN11` and `POSTCODE`, which are kept in the private archive
only and published in no form (D-076, D-084).

| Column | Register field | Values in the file | Where it differs from the register field | Not recorded | Privacy |
|---|---|---|---|---|---|
| `Registration month` | first NZ registration year and month | 70 months, none missing | The dashboard's registration month. NZTA calls it the date of first ownership, which "may differ from" the first registration in New Zealand; in count it agrees with the register's month (below) | none seen | public |
| `Import status` | `IMPORT_STATUS` | 4 | none | none seen | public |
| `Vehicle type` | `VEHICLE_TYPE` | 14 | none | none seen | public |
| `Body type` | `BODY_TYPE` | 27 | none | none seen | public |
| `Motive power` | `MOTIVE_POWER` | 19 | `-` where the register is empty | `-` (267,782, all trailers) | public |
| `Make` | `MAKE` | 853 | Spellings (below) | none seen | public |
| `Model` | `MODEL` | 58,164 | Finer for some nameplates (below) | `UNKNOWN` (12) | public |
| `Country of origin` | `ORIGINAL_COUNTRY` | 48 | none | `NOT KNOWN` (720) | public |
| `Vehicle year` | `VEHICLE_YEAR` | 129 | none | none seen | public |
| `Vehicle Status` | none | 2 | A column of the dashboard only (below) | none seen | public |
| `Owner Type` | none | 3 | A column of the dashboard only (below) | none seen | public, what kind of owner |
| `Territorial authority` | `TLA` | 70 | Two values the register lacks (below) | `UNKNOWN` (5,141) | owner rule |
| `Vehicle usage` | `VEHICLE_USAGE` | 20 | A finer list, at an earlier moment (below) | `UNDEFINED` (382) | public, what kind of owner |

**How each lines up with the register** (D-087):

- **Registration month.** For vehicles still registered, the totals agree to 0.08% over the 70
  months and within 65 vehicles (0.23%) in any one month.
- **Make.** Three values the whole register lacks, the largest `LANDROVER` beside `LAND ROVER`
  (424 vehicles, 165 of them in 2021). 30 makes of the register's same 70 months are absent, most
  with one to four vehicles. Over 99.8% of in-scope vehicles map through `brand_registry.csv`. On the types
  only the five-type dataset counts (buses, motor caravans, special purpose vehicles; `registrations_flow_wider`, now `new_registrations`), 97.8% of new
  vehicles of all time map once seven bus, crane and motorhome makes were added (93.6% before; D-113,
  `docs/METRICS.md`).
- **Model.** (The committed store keeps it only where a dataset or the wider scope counts the vehicle:
  DATA_SOURCES §D.) NZTA's cleaned name. 2,854 values (18,946 vehicles) are nowhere in the register, because
  some nameplates are split finer; since January 2025 the largest are `COROLLA CROSS` and
  `LANDCRUISER PRADO`. Since January 2025, 98.2% of vehicles carry a make and model spelled the same
  in the register. Some values are placeholders for a class of vehicle.
- **Country of origin.** The same values; `OTHER` (760) is a catch-all.
- **Territorial authority.** The owner's district. Two values the register lacks: `AUCKLAND CITY`
  (272) and `OVERSEAS` (22). The register leaves an unknown district empty, for a different count:
  4,848 still-registered `UNKNOWN` against 2,935 empty.
- **Vehicle usage.** 20 values to the register's 8; two names differ only in punctuation. It holds an
  earlier moment than the register's, shown for rental ("As first registered, or today"). Public, in
  the group `kind_of_owner`, as `Owner Type` is. It is the usage at registration, not the register's
  `VEHICLE_USAGE`, which stays an owner field of the stock `fleet` alone.

**The two columns with no register field:**

- **`Vehicle Status`** (category, few). Whether the dashboard counts the vehicle as still registered
  (`ACTIVE`) or since removed (`INACTIVE`) at its latest monthly update, read from the counts
  (`docs/METRICS.md`), not from NZTA's wording. 80,852 vehicles are `INACTIVE`: 9.9% of January 2021,
  none of October 2026. NZTA's page also names "reversed"; the file has none. Uses: break down and
  filter, count only. Public: it says whether the vehicle is still registered.
- **`Owner Type`** (category, few). Individual 1,045,469; Company 810,118; Other 28,199. Uses: break
  down and filter, count only. Public, in the group `kind_of_owner`: it says what kind of owner, not
  who or where, and the floor above keeps it out of a table with an owner field. Most likely the owner
  at first registration, **not proven** (below). Its use is the buyer type (below).

What the export cannot give: gross vehicle mass and engine size, so the site's `segment`,
`segment_group` and engine bands cannot be asked of true registrations (`docs/METRICS.md`).

**Owner type, the evidence.** Of the still-registered passenger cars the dashboard marks as rental, a
company owns 99.8% in every year from 2021 to 2025, though the register counts far fewer rental cars
in the older months (37 first registered in January 2021, against the dashboard's 254). If owner
type were today's owner, a car sold on to a household would show an individual. A dealer is a
company too, so this is not proof. The company share of all still-registered passenger cars is 30.9%
for 2021 and 39.0% for 2026.

**Buyer type: `data/reference/buyer_type_map.csv`.** The file decodes the dashboard's two owner columns into four buyer
types, one row for every `Owner Type` (3) times every `Vehicle usage` value (20) the history export holds: 60 rows.

| Buyer type | Rule | Vehicles in the history export (January 2021 to October 2026, every vehicle type; counted this session) |
|---|---|---|
| Private | `Owner Type` Individual, whatever the usage | 1,045,469 |
| Company | `Owner Type` Company, with any usage but rental | 701,954 |
| Rental | `Owner Type` Company with the rental usage | 108,164 |
| Other | `Owner Type` Other, whatever the usage | 28,199 |

- **Usage splits companies and nothing else.** The rental usage value sits under Company for 108,164 of its 108,439
  vehicles (99.7%). The other 275 (230 Individual, 45 Other) follow their owner type, so a buyer type says who registered
  the vehicle, not what it was used for. Three rows of the file carry the rental usage, one for each owner type; only the
  Company row says Rental.
- **Other is neither a person nor a company.** NZTA's `Owner Type` has no value for government, and neither the usage
  list nor the register's industry class has one, so a government body is counted inside Other and the value is named for
  what NZTA's data says. A dealer registering a demonstrator is a company: the export cannot tell a dealer from any other
  company.
- **Pairs the export has not sent.** 57 of the 60 pairs occur in the export. Three do not (Other with the overseas
  visitor licence, Other with hearse, Individual with commercial ambulance); they keep their rows so a later month that
  sends one still maps. A pair with no row at all, because NZTA sends an owner type or a usage value it has not sent
  before, reads `__UNMAPPED__` and stops the build on any such row, however few (invariant 5: `buyer_type` is in `guardrails.abort_on_unmapped` and in `guardrails.abort_on_any_unmapped`).
- **No empty value occurs.** None of the export's 991,274 rows has an empty `Owner Type` or an empty `Vehicle usage`.
  `UNDEFINED` is a value NZTA writes in `Vehicle usage` (382 vehicles); it is mapped like any other and follows its owner
  type. An empty value is not a pair of the file: it reads `__UNDEFINED__`, as an empty field does for every derived field
  (the store holds an empty value as null, and the lookup reads a null in either key as undefined).
- **The moment.** The owner type is most likely the owner at first registration, not proven (above). The usage is the
  usage at registration, not the register's current use (As first registered, or today, below).
- The dimension `buyer_type` (`config/dimensions.json`, for `new_registrations` only) reads the file through a lookup on
  both columns (`derive.lookup_keys`), so no value is named in code. Which fields may be published is decided by the privacy
  class each holds in the tables above, which this file does not change; the floor keeps the dimension out of every table that
  holds a field saying where the owner lives, and a test holds the published files to it (D-159).

## Stats NZ's series

The source of `registrations_cars_long_run` (`docs/METRICS.md`; `docs/DATA_SOURCES.md` §C). It is
not a field of the register: it is 26 monthly series Stats NZ publishes from NZTA's records, each
a count, listed in `data/reference/statsnz_series.csv` with its group (cars, motorcycles, power
cycles, tractors, commercial vehicles, buses) and whether it is a total of others. Measured on
2026-11-15 from the export of 14 November 2026: 789 months, January 1961 to September 2026; the
cars total from January 1961; the engine bands, motorcycles, power cycles and ex-overseas cars from
July 1975; tractors from March 1974; commercial vehicles and buses from January 1974. No series
has a gap once it starts. Every series is public (Stats NZ, CC BY 4.0) and none describes an
owner. Two breakdowns are built, for cars: new or ex-overseas, and Stats NZ's seven engine bands.
The others are stored and not built, because Stats NZ's classes are not lined up with NZTA's
vehicle types (D-065).

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
cohorts can be read (S, NZ-new passenger cars). The vehicle-trader share falls with the cohort's age
overall, though not month by month: 3.6% for October 2026, 2.8% for September, 3.2% for August,
2.2% to 2.8% for April to July, 2.1% for March, 1.2% and 1.5% for January and February 2026, 1.0%
for December 2025, then 0.2% to 0.5% for every month from January to November 2025. Used-import
cohorts show the same drop over a few months (1.7%, 1.1%, 1.1% for October, September and August
2026, then 0.5% or less). A value kept from first
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

The profile (§2) tested nine dependencies on S and the same nine on W (body type, road transport
code twice, the MVMA code three ways, the industry model code, class and model), and district to
region through `tla_region.csv`. Two of the first pass's claims failed.

| Roll-up | Holds? | Evidence |
|---|---|---|
| District (`TLA`) to region | Yes, through `tla_region.csv` | All 67 S values are in the file, none twice; seven districts straddle regions and are assigned to the region holding most residents |
| `CLASS` to vehicle type | Yes on S only | 1 of 4,286,433 S vehicles disagrees; on W, 6 of 21 classes have two parents |
| Make to manufacturer group to owner country, and make to heritage country | Yes, by construction | `brand_registry.csv` gives each canonical make one group, one owner country and one heritage country, and each group one owner country (a test holds the file to it) |
| Model to make | Only as the make-and-model pair the site builds | The raw model name sits under more than one make for 1,427 of 28,000 S models |
| Body type to vehicle type | **No** (first pass said yes) | 4 of 13 S body types under both vehicle types; 41,952 S vehicles off the commoner type |
| Road transport code to industry class | **No** (first pass said yes) | 19 of 20 codes under more than one class; 3,565 of 57,232 vehicles off the commoner class |
| MVMA model code to make and model | No: not a clean key | 1,329 S codes with more than one make and model; 12,008 vehicles off |
| Industry model code to make and model | No: not a clean key | 4,915 of 47,959 S codes; 80,830 vehicles off |

Postcode to district is not checked. Build uses a roll-up to offer a level up or down, and must not
cross a field with its own parent.

### Derived from

These are the derived fields the site offers today. Each one's definition lives in
`config/dimensions.json` (its `help`, `basis` and `bands`), not here; this table says only what it
is derived from, read from its `derive` block:

| Dimension | Register fields | Reference |
|---|---|---|
| `powertrain` | `MOTIVE_POWER` (mild hybrids identified by make and model) | `powertrain_map.csv`, `mild_hybrid_models.csv` |
| `powertrain_group` | `MOTIVE_POWER`, read as `powertrain` reads it | `powertrain_map.csv` (its `powertrain_group_label` column) |
| `make`, `parent_group`, `owner_country`, `heritage_country` | `MAKE`, `MODEL` (model exceptions match on motive power, import status, vehicle type and vehicle year) | `brand_registry.csv`, `model_registry.csv` |
| `model` | `MAKE`, `MODEL` | the same |
| `built_in` | `ORIGINAL_COUNTRY` | none |
| `imported_from` | `PREVIOUS_COUNTRY` | none |
| `segment`, `segment_group` | `VEHICLE_TYPE`, `BODY_TYPE`, `GROSS_VEHICLE_MASS` | `segment_map.csv` |
| `vehicle_type` | `VEHICLE_TYPE` | `vehicle_scope.csv` (its `label` column) |
| `trade_group` | `VEHICLE_TYPE` | `vehicle_scope.csv` (its `trade_group` column; `new_registrations` only) |
| `import_status` | `IMPORT_STATUS` | `import_status_map.csv` |
| `region` | `TLA` | `tla_region.csv` |
| `vehicle_year_band` | `VEHICLE_YEAR`, against the snapshot year | none |
| `engine_size_band` | `CC_RATING`, and `MOTIVE_POWER` for "no engine" | `powertrain_map.csv` |
| `age_at_registration_band` | `FIRST_NZ_REGISTRATION_YEAR`, `VEHICLE_YEAR` | none |
| `power_band` | `POWER_RATING`; `registrations_surviving` only (D-128) | none |
| `transmission` | `TRANSMISSION_TYPE`; `registrations_surviving` only (D-128) | `transmission_map.csv` (its `group` column) |

The dataset's scope is derived from `VEHICLE_TYPE` and `IMPORT_STATUS` (`vehicle_scope.csv`,
`import_status_map.csv`). No register field is derived from another.

Not yet a dimension: whether a nameplate is an SUV. `BODY_TYPE` records most SUVs as station wagons and no register field
separates them, so the class comes from `model_segment.csv`, a lookup on canonical `MAKE` and `MODEL` (and `VEHICLE_YEAR` and
`GROSS_VEHICLE_MASS` where a nameplate changed kind between generations or models under one name). The build joins it onto every vehicle as a column of its own (`model_classes` in `config/pipeline.json`, D-161), which no dimension reads yet; its rule, coverage and checks are in
`docs/METRICS.md` ("SUV or car, by nameplate", D-117).

### Recorded only for

- **NZ-new vehicles:** power, transmission and the MVMA model code, recorded together on 92.1% of
  NZ-new S vehicles and almost no used import (power: 141 of 1,788,134 used imports on the cube); urban and extra-urban fuel consumption, mostly (NEW
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
owner's district and postcode. In each monthly file the same combination can find the same vehicle,
and so show its owner fields changing. That is why the archive is private (D-063), why owner fields are
published only under the owner rule, and why no row-level file is ever published. Measured: on the 2026-10 dry run, month
and the twelve vehicle dimensions of the fact table already leave 50.2% of its rows counting one
vehicle (7.1% of vehicles; D-078). How unique the full combination is was not measured.

### Moves together with

The figure says how far knowing one field tells you the other. An example: knowing a vehicle's
class tells you its vehicle type exactly (1.00), while knowing its colour tells you almost nothing
about its type (0.25). It says nothing about why.

What was measured: the profile, on S, for 24 columns. Those are the 14 categories; previous country
(used imports only); six numbers cut into bands (seats, gross mass, engine size, power, combined fuel
consumption, vehicle year); registration year in bands; registration month; and age at registration
in bands. Not measured: make, model, the codes, free text, the second fuel, axles, height, width and
VDAM weight. A field with many values (district, 67; refrigerant, 37) leaves many cells nearly empty,
so its figures are less stable. Where a pair rests on few vehicles it is said.

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

A field and any dimension derived from it are always such a pair. The build marks all three kinds in its
file: a pair listed here, a dimension that rolls up to another, and two dimensions derived from the same field.

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

**Written each build (D-136).** `public/data/associations/{dataset}.json` holds the bias-corrected Cramér's V of every
pair of a dataset's fact-table dimensions, for the whole dataset and for the latest 12 months, with the vehicles
counted and the number of values on each side, and marks the pairs above that are not findings
(`docs/CUBE_SCHEMA.md`, Associations: the formula, which vehicles count, the faults that stop a build). Its pairs
are of the dimensions the site publishes, so it differs from the profile above wherever a dimension groups or bands
its field differently, and it measures pairs the profile did not (make, model, the brand lookups). The profile
and its table stay as the record of 2026-11-15 and 16, measured on the private archive's file. The build's figures
below are from the dry run of 2026-11-18 on the saved pull of the 2026-10 snapshot (`registrations_surviving`,
4,520,304 vehicles; the profile's 4,520,476 includes 172 with no registration month, which the cube leaves out).

| Pair | This page | Build | Why they differ |
|---|---|---|---|
| Country built in and vehicle type | 0.59 | 0.5939 | The same fields and values |
| Import status and country built in | 0.53 | 0.5319 | The same |
| Class and vehicle type | 1.00 | 1.0000 | The same |
| Country built in and class | 0.35 | 0.3467 | The same |
| Seats (banded) and vehicle type | 0.49 | 0.4864 | Equal to two places (this page does not give its seat bands) |
| Age at registration and import status | 0.99 | 0.9864 | Equal to two places |
| Motive power and vehicle type | 0.72 | 0.7102 | The build uses the powertrain: 10 values, with the mild hybrids divided by make and model. Raw motive power (15 values) recomputed from the pages: 0.7175 |
| Transmission and vehicle type | 0.54 | 0.4518 | The build uses four gearbox groups for NZTA's 28 values. Recomputed from the pages: raw 0.5372, groups 0.4518 |
| Class and transmission | 0.43 | 0.2940 | The same cause. Raw recomputed: 0.4277 |
| Motive power and transmission | 0.34 | 0.5904 | The same cause, and the largest gap. Recomputed from the pages: raw by raw 0.3423, raw motive power by the four groups 0.588 |
| Engine size (banded) and vehicle type | 0.52 | 0.4968 | The build's band for "no engine" (electric vehicles) is a value, so 4,518,886 vehicles count against 4,412,632 here, and its bands start at 50 cc and end at "4.0 L and over". This page's bands with zero engine size left out, recomputed: 0.5161 |
| Engine size (banded) and class | 0.44 | 0.3544 | The same cause. Recomputed: 0.4353 |
| Engine size and power (both banded) | 0.37 | 0.3543 | Not recomputed. The engine band's no-engine value and the power band's edges apply |
| Power (banded) and transmission | 0.32 | 0.2050 | Not recomputed. The gearbox groups apply |
| NZ-assembled flag and transmission | 0.21 | 0.1404 | Not recomputed. The gearbox groups apply |

Pairs of the strongest table with gross vehicle mass, combined fuel consumption, body type and road transport code have
no dimension in a fact table, so the build has no figure for them. Where a recomputed figure is given, it was
computed from the saved pages with plain DuckDB and no pipeline code, by the bands and sentinels written out in a
scratch script; the three pairs checked against the file itself are in D-136.

**What it will mean on the site.** The association is computed each build, not taken from this
page. Where a question crosses two fields that move together strongly (and the pair is not true by
definition), the workbench shows one neutral line, for example that the two fields move together
strongly and holding one fixed may change the answer, with the figure one step away. It never says
why. The threshold and the wording are config, set by the work that builds it; the site does not read
the file yet.

## `VIN11` checked against the data

Measured on 2026-11-13 from the private archive's 2026-10 file (5,926,990 vehicles, every vehicle
type), read into a scratch folder and deleted afterwards. Counts only; no VIN is listed here or
anywhere in the repo. The scratch scripts are not in the repo. D-079.

**Form.** 4,811,252 vehicles have a `VIN11` (81.2%), each 11 characters. 4,810,758 use only the
letters and digits a VIN allows; 494 do not (478 hold an I, O or Q, 16 a character that is neither
a letter nor a digit).

**A third start `7A`, which reads as a VIN assigned in New Zealand, and say nothing about the
vehicle's year.** 1,675,639
(34.8%) start `7A`: 83.5% of the used imports that have a `VIN11` (1,534,504 of 1,838,550) and 2.3%
of the NZ-new (64,289 of 2,828,885). The two largest prefixes are `7AT` (1,313,576) and `7A8`
(320,938). `7A` is the range the VIN standard gives New Zealand, and NZTA assigns a VIN to a vehicle
that arrives without a 17-character one (inferred - confirm against NZTA's VIN rules; the data
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
  out for the code and for power; axles are not zero for 77.9% of S used imports, though what a
  two means on a light vehicle is not established (D-129).
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
| `BASIC_COLOUR` | **Bound (D-144).** None new (NULL is covered). A raw dimension on `registrations_surviving`, a slice and a column of its narrow table `colour`. Its label says "colour as recorded", since the moment is not known |
| `NUMBER_OF_SEATS` | **Bound as bands (D-116).** `0` added to `sentinels.csv`. Bands 1-2, 3-4, 5, 6-7, 8+ and `unknown`; values above 60 fall to `unknown`. A mean only inside 1 to 60: not built |
| `NZ_ASSEMBLED` | **Bound (D-116).** `UNKNOWN` added to `sentinels.csv`. Charts over time start in December 1995 |
| `CLASS` | **Bound (D-116); labelled (D-121).** NULL is covered. **`NA` must never become a sentinel**; a test holds it. `class_map.csv` gives each code NZTA's label with the code in brackets, from the table the maintainer supplied on 2026-11-17; `OTH` is not in that table and keeps its code as its label. Charts start in March 2002 |

**2. NZ-new only.** Each `applies_to` the NZ-new dataset, or is narrowed to it, and says so.

| Field | Sentinels and guards before it is bound |
|---|---|
| `POWER_RATING` | **Bound as bands (D-128).** `0` added to `sentinels.csv`. Guard 5 to 900 (999 is a placeholder), applied by the bands: a value outside it falls to `unknown`. A mean or median needs a sum and a count per cell, as fuel consumption has: not built |
| `TRANSMISSION_TYPE` | None new. `OTHER` stays a value. The grouping lookup (automatic, manual, continuously variable, other) is the reference file `transmission_map.csv` (D-128), all 28 values |

**3. The rest.**

| Field | Sentinels and guards before it is bound |
|---|---|
| `SYNTHETIC_GREENHOUSE_GAS` | Add `UNKNOWN`. Charts start in 2010 |
| `FC_URBAN`, `FC_EXTRA_URBAN` | As measures beside `FC_COMBINED`: a sum and a count per cell; guards above 0 to 40 and above 0 to 30; engines only |
| `GROSS_VEHICLE_MASS` as a measure | Guard 300 to 60,000 (the 1 kg placeholder falls out); a mean only within a vehicle type |
| `CC_RATING` as a measure | Guard 50 to 20,000, engines only. Decide whether the top engine band should stop at 20,000 (a contract change) |
| `ALTERNATIVE_MOTIVE_POWER` as a filter | NULL must read "none", not `__UNDEFINED__`: a reference lookup or a sentinel exception, decided when bound |
| `NUMBER_OF_AXLES` | Not bound for now (D-129). If bound with the heavy-vehicle topic: add `0`; keep 1 to 6 (a guard of 2 to 6 would drop the 304 one-axle class TD trailers); count 7 and over apart; heavy classes only |
| `VDAM_WEIGHT`, `HEIGHT`, `WIDTH`, `ROAD_TRANSPORT_CODE` | With the heavy-vehicle topic (package I). Add `0` for the three numbers; guards 1,000 to 60,000, 1,000 to 4,600 and 1,200 to 2,600. The road transport code's NULL reads "none" once that reading is confirmed |
| `VEHICLE_USAGE` | **Bound (D-135)** as `vehicle_usage` over the vehicles registered today only. Published since D-141 as the fleet's slice and its pair by vehicle type (the owner was shown the first table, D-120); usage by month or year of first registration stays unpublished, as does every other owner field. No sentinel: the register holds no blank. Labels are NZTA's own words; usage is shown to be current for rental only |
| `INDUSTRY_CLASS` | Bound, and kept out of every published file until the owner has been shown the field's first table (D-120). Add `UNKNOWN`; join `VEHICLE DEALER` to `VEHICLE TRADER` by lookup once confirmed. Labels do not say "when first registered" |
| `MODEL` (already bound) | Add the clear forms of nothing (`UNKNOWN`, `NOT KNOWN`, `UNK`, `N/A`, `-`, `.`, `0`, `000`); look at `X`, `XX`, `OTHER` and `NA` by make first. Trim stray spaces |

**Not bound as fields:** `MVMA_MODEL_CODE` and `INDUSTRY_MODEL_CODE` (lookup keys for the model-level
segment, package I, each needing its forms of nothing first); `SUBMODEL` (never a breakdown);
`POSTCODE` (not published for now, D-096); `VIN11`, `CHASSIS7`, `ENGINE_NUMBER`, `OBJECTID`.

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
   the owner's district and may not be added before the pipeline enforces the owner rule (D-096).
8. **The first pass** gave whole-register coverage only, counted `UNKNOWN` as filled for where
   assembled and industry class, and read some numbers (999 seats, 99,999 cc) as the guards' main
   problem; on S the zeros and ones matter more.
9. **The `region` slice and the work order's §3.** Settled: the slice was published on D-078's
   point 3 while §3 named region among the fields not published without asking; the user
   confirmed on 2026-11-16 that it stays (D-096).
10. **The profile's own report** gives 107 used imports with a transmission and with an MVMA code;
    its `coverage.csv` gives 116 and 131. 107 is the count with all three NZ-new fields. This map
    uses `coverage.csv`.

## What builds on this

Notes for the work that follows. None of it is done here.

- **The chart rule table** (package E; built, D-100: `config/chart_rules.json`). It speaks of the data map's
  kinds and never of a field. A dimension in `config/dimensions.json` states its own `kind` and
  `cardinality`, and a test holds each to this map where the dimension is a plain binding of one
  field; a number becomes an ordered band through its dimension's `bands`. Two fields crossed,
  neither of them time, fit `matrix` (D-083), drawn as a grid since D-114. A table of figures always
  fits. Still to do: a field whose `uses.break_down` is false is never offered as a breakdown (Build
  offers only what `config/dimensions.json` defines today).
- **Build reading the map.** Offer a field only if it is bound, its dimension is live, its privacy
  class is published (`privacy_classes.<class>.published`), and its `uses` allow it. Narrow a
  question to `recorded_for` and say so. The method page's definition line is `definition`.
- **The association figures each build.** Built (D-136): `associations/{dataset}.json`, bias-corrected Cramér's V
  on each dataset's vehicles, rows with both values recorded, with the row count beside each figure. It marks
  rather than leaves out the pairs listed in `moves_together.true_by_definition`, those that roll up and those
  derived from one field, so the site can say "true by definition". Not done: the site's reading of it. The
  profile's method is in this doc ("Moves together with"); the figures are in the file, not in this doc.
- **Coverage each build.** The coverage figures here (by status, type and period) will go stale. A
  per-build output of the same shares would let a chart start where its field does without a
  hand-kept year.
- **Binding** (package F), in the order above. Each binding changes `sentinels.csv` and the map's
  `sentinels_pending` in one commit, and marks the entry `bound` with its logical name.
- **Enforcing the owner rule** (package F). Done for a slice (D-127): the pipeline hides any cell under
  10 vehicles in the slice of a dimension that reads an owner field, under a second rule, and reads the
  slice back; `owner_rule.enforced` is true. The `region` slice takes it (the user's ruling of 2026-11-17).
  Done for a pair of an owner field and another field (D-135): each line of the table keeps the rule, and the
  build proves it from the written file with an audit of what the totals pin down. Not done: the first table of
  any other owner field, which the user is shown before a build publishes it (D-120).
- **Settling usage and industry class** for good: the same vehicles in the October and November
  archive files, if the user agrees to the match ("As first registered, or today").
