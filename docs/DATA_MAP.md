# Data map

**Status: a first pass (the brief, Stage 0 item 7). Research only.** Nothing here is bound, public or
approved. Stage 2 finishes the map: definitions checked against the data, privacy classes approved by
the user, relations measured, and the machine-readable form in config. Until then Build offers only
what `config/dimensions.json` already defines.

## How this pass was made

- **Source:** NZTA's live service on 2026-11-13: `MVR_Mar26`, last edited 2026-11-09, snapshot
  2026-10-31, 5,926,990 rows, 40 fields. The saved August pull could not be used: it holds only the
  17 bound fields.
- **Method:** count queries only (how many rows have a value, by import status, vehicle type and
  first-registration year; how many distinct values; the most common values). A scratch script, not
  in the repo. `VIN11`, `CHASSIS7` and `ENGINE_NUMBER` were counted and never listed.
- **Scope:** every row in the register, in scope or not (trailers, tractors and motorcycles
  included). The site's `registrations_surviving` dataset is narrower.
- **Meanings** in quotes are NZTA's own ("MVR data field descriptions", ArcGIS item
  `de5669aeb6304620b09e79fe84f40b7c`). They are not yet checked against the data (AGENTS.md hard
  rule 6), except where a note says so.
- **"Filled"** means not empty, and for a number field above zero: the register writes zero where
  it has no value. (For `CC_RATING` a zero can also be true: a vehicle with no engine,
  `docs/DATA_SOURCES.md`.) NEW and USED are the import statuses.

## The 17 bound fields

Bound in `config/pipeline.json`. Their meanings and traps are in `docs/DATA_SOURCES.md` and
`docs/MODEL_AND_AGE.md`.

| Field | Kind | Filled | Notes from this pass |
|---|---|---|---|
| `OBJECTID` | identifier | 100% | A row number in the service, used to page the pull. Not a vehicle attribute |
| `FIRST_NZ_REGISTRATION_YEAR` | time | 100% | 1899 to 2026 |
| `FIRST_NZ_REGISTRATION_MONTH` | time | 100% | 1 to 12 |
| `IMPORT_STATUS` | category, 4 values | 100% | NEW 3,680,531; USED 1,938,692; RE-REG 282,573; SCRATCH 25,194 |
| `VEHICLE_TYPE` | category, 14 values | 100% | Passenger car/van 3,703,985; goods van/truck/utility 932,660; trailer/caravan 883,184 |
| `BODY_TYPE` | category, 27 values | 100% | Station wagon 1,714,105; hatchback 1,230,306; saloon 619,935; utility 574,749 |
| `GROSS_VEHICLE_MASS` | number, kg | 81.7% | Cars 91.6%, motorcycles 0.1%, trailers 40.9%. Largest value 787,627: needs a guard |
| `MOTIVE_POWER` | category, 18 values | 85.1% | Empty for trailers (0.0% filled); 100% for every powered type |
| `ALTERNATIVE_MOTIVE_POWER` | category, 9 values | 0.1% | LPG 3,585; CNG 2,824. 0.9% of vehicles registered before 2000 |
| `MAKE` | category, many values | 100% | 1,030 distinct across the whole register. Free text, cleaned by NZTA |
| `MODEL` | category, many values | 99.6% | 175,397 distinct. 95.4% filled before 2000 |
| `TLA` | place, 67 values | 99.8% | The owner's district as at the snapshot |
| `ORIGINAL_COUNTRY` | category, 48 values | 100% | `NOT KNOWN` 173,327. Built in, not brand nationality |
| `PREVIOUS_COUNTRY` | category, 49 values | 100% | `NONE` 3,898,082. Meaningful for used imports only |
| `VEHICLE_YEAR` | number, year | 100% | 1890 to 2027; one row is 0. Not model year (`docs/MODEL_AND_AGE.md` §1) |
| `CC_RATING` | number, cc | 83.4% | Trailers 0.0%. Largest value 99,999: needs a guard |
| `FC_COMBINED` | number stored as text, L/100km | 58.7% | NEW 56.9%, USED 69.0%. None before 2000, 22.7% for 2000 to 2009, about 74% since |

## The 23 unbound fields

| Field | NZTA's meaning | Kind | Filled | Recorded for | Notes from this pass |
|---|---|---|---|---|---|
| `VEHICLE_USAGE` | "Classification of how a vehicle is used. This field groups several more detailed usage types" | category, 8 values | 100% | Every vehicle | Private passenger 4,623,180; other goods 849,790; other 161,521; transport licensed goods 137,507; rental 77,977; taxi 40,669; agricultural 29,957; emergency 6,389 |
| `INDUSTRY_CLASS` | "The class of industry a vehicle is associated with" | category, 15 values | 100% | Every vehicle | Private 4,985,469; `UNKNOWN` 441,020; business/financial 129,953; commercial road transport 91,752 |
| `BASIC_COLOUR` | "The predominant colour of the vehicle" | category, 14 values | 100% | Every vehicle | White 1,426,254; silver 1,213,510; grey 733,886; black 708,568 |
| `NZ_ASSEMBLED` | "Indicates where the vehicle was assembled" | category, 3 values | 100% | Every vehicle | Imported built-up 4,838,632; NZ assembled/built 737,378; `UNKNOWN` 350,980 |
| `CLASS` | "Vehicle equipment standard classification" | category, 21 values | 93.5% | 31.0% of vehicles registered before 2000, 98.6% for 2000 to 2009, 100% since | MA 3,087,122; NA 744,929; TA 543,275; MC 423,485 |
| `NUMBER_OF_SEATS` | "Records the number of seats in a vehicle" | number | 79.7% | Cars 99.9%, goods vehicles 99.7%, buses 100%; not trailers or motorcycles | Largest value 999: needs a guard |
| `NUMBER_OF_AXLES` | "Records the number of axles the vehicle has" | number | 80.5% | 30.6% before 2000 rising to 91.6% from 2020 | 2 axles 4,663,486 |
| `POWER_RATING` | "The power rating of the vehicle", kW | number | 46.3% | **NZ-new only**: NEW 73.0%, USED 0.0% | Largest value 999: needs a guard |
| `TRANSMISSION_TYPE` | "The gearing system the vehicle has ... infrequently recorded" | category, 28 values | 43.7% | **NZ-new only**: NEW 69.3%, USED 0.0%; no motorcycles | 6-gear auto 735,272; continuously variable 496,641 |
| `MVMA_MODEL_CODE` | "Model code is assigned by the manufacturer at the time of VIN allocation to NZ-new vehicles" | identifier of a model variant, 30,633 values | 46.3% | **NZ-new only**: NEW 73.0%, USED 0.0% | A possible key for a model-level lookup |
| `INDUSTRY_MODEL_CODE` | "Non-validated field used by vehicle manufacturers to describe model code on imported used vehicles particularly from Japan" | identifier of a model variant, 61,555 values | 30.0% | **Used imports**: USED 87.8%, NEW 1.0% | The text `NONE` appears 18,443 times |
| `SUBMODEL` | "The sub model of the vehicle as assigned by the manufacturer" | free text, 93,668 values | 57.0% | NEW 75.1%, USED 26.9% | Never aggregate on it (CLAUDE.md trap 3) |
| `FC_URBAN` | Fuel consumption in the urban cycle, L/100km | number stored as text | 24.1% | Mostly NZ-new: NEW 37.5%, USED 1.7%. None before 2000 | |
| `FC_EXTRA_URBAN` | Fuel consumption in the extra-urban cycle, L/100km | number stored as text | 22.9% | Mostly NZ-new: NEW 35.5%, USED 1.7%. None before 2000 | |
| `SYNTHETIC_GREENHOUSE_GAS` | "The refridgerant used in the air-conditioning system" (NZTA's spelling) | category, 39 values | 54.7% | 0.4% before 2000, 1.6% for 2000 to 2009, 65.9% for 2010 to 2019, 80.8% since | HFC-134A 2,962,499; HFO-1234YF 197,393 |
| `ROAD_TRANSPORT_CODE` | "For vehicles with industry class recorded as 'commercial road transport' this shows the type of road transport" | category, 20 values | 1.6% | Buses 21.4%, goods vehicles 5.8% | General goods, local 25,152; line haul 20,465 |
| `VDAM_WEIGHT` | "The maximum allowable laden weight for the vehicle on the road", kg | number | 5.0% | Heavy vehicles: motor caravans 71.6%, buses 49.7%, goods vehicles 16.0% | |
| `HEIGHT` | Height, mm | number | 4.2% | Heavy vehicles: motor caravans 70.8%, buses 45.2%, goods vehicles 15.8% | The value 1 appears 10,487 times; largest 44,260 |
| `WIDTH` | Width, mm | number | 4.3% | Heavy vehicles: motor caravans 71.9%, buses 45.7%, goods vehicles 16.0% | Largest 50,300 |
| `POSTCODE` | **Not in NZTA's field descriptions** | place, 1,330 values | 95.1% | Every vehicle type | 197 postcodes hold fewer than 10 vehicles, and some hold 1. Zero stands for "not recorded": 288,172 vehicles, and no vehicle has an empty value (the archive's 2026-10 file, 2026-11-13). Kept in the private archive only (D-076). See privacy below |
| `VIN11` | "First 11 characters of the Vehicle Identification Number" | identifier | 81.2% | NEW 76.9%, USED 94.8%; 39.3% before 2000 | Kept in the private archive only; never published itself (D-076). Checked against the data on 2026-11-13, below: it gives no model year for used imports and one for about four in ten NZ-new vehicles; nothing is derived from it |
| `CHASSIS7` | "First 7 characters of the Chassis Number" | identifier | 40.4% | USED 91.7%, NEW 13.2% | Never pulled, never published (D-062, D-076) |
| `ENGINE_NUMBER` | "All characters of the Engine Number" | identifier | 84.2% | Powered vehicles: cars 99.6%, trailers 0.1% | Never pulled, never published (D-062, D-076) |

## What this pass found

1. **"Who is buying" can be asked** (starter question 7). `VEHICLE_USAGE` and `INDUSTRY_CLASS` hold
   a value for every vehicle, though not always a telling one: the industry class is `UNKNOWN` for
   441,020 vehicles (7.4%) and the usage is `OTHER` for 161,521 (2.7%). New passenger cars and vans
   first registered in October 2026 (11,832):
   by usage, private passenger 6,912 and rental 4,868; by industry class, private 6,862,
   tourism/leisure 3,171, business/financial 1,122, vehicle trader 422.
   - **Trap, checked on 2026-11-14 for usage (D-087): the register's `VEHICLE_USAGE` is the usage
     today.** It answers "how is it used now", which matches "who bought it" only for the newest
     months. The dashboard's `Vehicle usage` holds an earlier value, most likely the one at first
     registration (below, "The dashboard's fields"). `INDUSTRY_CLASS` is not in the dashboard and
     is not settled: two snapshots at that field would settle it (D-063).
2. **Zero stands for "not recorded"** in the number fields. A mean must leave those zeros out, and
   each field needs its sentinels in `sentinels.csv` before it is bound.
3. **Several fields hold values that cannot be real**: seats and power of 999, an engine size of
   99,999 cc, a gross mass of 787,627 kg, a height of 1 mm. Each needs a guard before any mean.
4. **Six fields exist for only one kind of vehicle, or almost**: power, transmission and the MVMA
   model code for NZ-new vehicles only; the two urban fuel figures mostly for NZ-new (1.7% of used
   imports have them); the industry model code for used imports. A question using one must be
   narrowed to where it exists, and say so.
5. **Four fields are for heavy vehicles** (`VDAM_WEIGHT`, `HEIGHT`, `WIDTH`,
   `ROAD_TRANSPORT_CODE`), and matter only once heavy vehicles are a topic (the brief, Stage 4).
6. **Coverage changes over time**: `CLASS`, `NUMBER_OF_AXLES`, `SYNTHETIC_GREENHOUSE_GAS` and the
   fuel figures are thin before 2000 or before 2010. A chart over time must start where the field
   does.
7. **`CLASS` may help with SUVs** (starter question 6). 423,485 vehicles are class MC, which in New
   Zealand's vehicle classes is the off-road passenger class (inferred — confirm against NZTA's
   class definitions). It would not replace a model-level segment, but it is in the register.

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
quoted; none is checked against the data here except where a note says so.

- **`VEHICLE_YEAR`**: "the year of first registration anywhere", with a history of what was recorded
  since before 1994. Read against the data in `docs/MODEL_AND_AGE.md` §1.
- **`VEHICLE_USAGE`**: "the vehicle's primary use or purpose when it was registered". **`IMPORT_STATUS`**:
  "the vehicle's status when it was registered". These are NZTA's words on the trap in finding 1
  (as first registered, or as now); two snapshots are still what would settle it.
- **Region**: "the region where the registered owner is based". **Territorial authority**: "the city
  or district council where the vehicle is registered". The dashboard also has "Physical town: the
  town where the registered owner is based" and "Owner Type: ... Individual, Company or Other";
  neither is a field of the open data service.
- **`ORIGINAL_COUNTRY`**: "the country where the vehicle was principally manufactured" (CLAUDE.md trap 2).
- **`CC_RATING`**: "engine size ... This also includes electric vehicles."
- **`VIN11`**: "This field can be repeated", which the check above bears out.
- **`MVMA_MODEL_CODE`**, power and axles: "Only recorded for NZ New vehicles" (finding 4).
- **`ROAD_TRANSPORT_CODE`**: "Data is that provided by the owner or dealer and is not verified or certified."
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

## The dashboard's fields

The source of `registrations_flow` (`docs/METRICS.md`; `docs/DATA_SOURCES.md` §D). Measured on
2026-11-14 from the user's export of January 2021 to October 2026 (991,274 rows, 1,883,786
vehicles) against the register as at 31 October 2026, vehicles first registered in the same 70
months (D-087). The file has no empty cell: what is not recorded is written as text.

| Dashboard field | Register field | Kind | Values | How it lines up with the register | Class (proposed) |
|---|---|---|---|---|---|
| `Registration month` | first NZ registration year and month | time | 70 months, none missing | For vehicles still registered, the month totals agree to within 0.08% | Public |
| `Import status` | `IMPORT_STATUS` | category | 4 | The same four values | Public |
| `Vehicle type` | `VEHICLE_TYPE` | category | 14 | The same values | Public |
| `Body type` | `BODY_TYPE` | category | 27 | The same values | Public |
| `Motive power` | `MOTIVE_POWER` | category | 19 | The same 18, plus `-` where the register is empty (267,782 vehicles, all trailers) | Public |
| `Make` | `MAKE` | category | 853 | Three values the register does not have, the largest `LANDROVER` beside `LAND ROVER` (424 vehicles, most in 2021); no make is in the register only. 99.82% of in-scope vehicles map through `brand_registry.csv` | Public |
| `Model` | `MODEL` | category | 58,164 | NZTA's cleaned name. 2,854 values (18,946 vehicles) are in the register nowhere: some nameplates are split finer than the register holds them. `UNKNOWN` for 12 vehicles; some are placeholders for a class of vehicle | Public |
| `Country of origin` | `ORIGINAL_COUNTRY` | category | 48 | The same values; `NOT KNOWN` 720 and `OTHER` 760 vehicles | Public |
| `Vehicle year` | `VEHICLE_YEAR` | number, year | 129 | Every value is in the register | Public |
| `Vehicle Status` | none | category | 2 | `ACTIVE`: still registered on the export's date. `INACTIVE`: since removed (80,852 vehicles; 9.9% of January 2021, none of October 2026). NZTA's page also names "reversed"; the file has none | Public |
| `Owner Type` | none | category | 3 | Individual 1,045,469; Company 810,118; Other 28,199. Whether it is the owner at first registration or today is **not settled**: the company share of still-registered passenger cars is 30.9% for 2021 and 39.0% for 2026, with no sharp fall with age | Describes the owner: not published before the Stage 2 review |
| `Territorial authority` | `TLA` | place | 70 | The owner's district. `UNKNOWN` 5,141 vehicles (the register leaves it empty); two values the register does not have: `AUCKLAND CITY` (272 vehicles) and `OVERSEAS` (22) | Describes the owner: not published before the Stage 2 review |
| `Vehicle usage` | `VEHICLE_USAGE` | category | 20 | **A finer list, and a different moment** (below). `UNDEFINED` 382 vehicles | Describes the owner: not published before the Stage 2 review |

**Usage: the dashboard and the register hold different moments.** The two hold the same vehicles
(still-registered vehicles differ by under 0.1%), and for the newest month they agree: of
passenger cars and vans first registered in October 2026, 25.1% are rental in the dashboard and
25.3% in the register. For older months they part. January 2023: 7.6% rental in the dashboard
(1,197 vehicles) and 2.2% in the register (342). January 2021: 1.45% (254) and 0.21% (37). The
register's rental share shrinks as a cohort ages, as today's usage would when rental cars are
sold on; the dashboard's does not. So the register's `VEHICLE_USAGE` is the usage today, and the
dashboard's is an earlier value, consistent with NZTA's words for it ("when it was registered").
It is not proof of the exact moment. Taxi does not follow the pattern: the register counts more
taxis than the dashboard in every year, the newest month included (165 against 36 passenger
vehicles for October 2026), so that category is defined differently in the two and is not used as
evidence. The dashboard's 20 usage values are finer than the register's 8, and two names differ
only in punctuation.

## Privacy classes: a first reading, for the user to approve in Stage 2

| Class | Fields | Why |
|---|---|---|
| Never pulled, never published | `CHASSIS7`, `ENGINE_NUMBER` | D-062, D-076 |
| Kept in the private archive only; never published itself. A field derived from it may be published once it has been checked against the data (the user, 2026-11-13, D-076) | `VIN11` | It narrows a vehicle to a handful. A model year or a factory read from it describes the vehicle, not the owner. Both were checked against the data on 2026-11-13 (below) and neither is derived |
| Never published | `OBJECTID` | A row number, no meaning to a visitor |
| Kept in the private archive only. Publishing waits for the Stage 2 privacy review, and then only as area totals above a minimum count (the user, 2026-11-13, D-076, superseding D-066 item 9) | `POSTCODE` | NZTA's own notes say owner location is given by territorial authority "to make sure it isn't possible to identify a person", and its field list leaves postcode out, yet the field is in the service. 197 postcodes hold fewer than 10 vehicles. The minimum count is not set |
| Public only above a minimum count | `TLA`, `INDUSTRY_CLASS`, `VEHICLE_USAGE`, `ROAD_TRANSPORT_CODE` when crossed with fine vehicle detail | They describe the owner, not the vehicle. A district crossed with model, colour and year can come down to one vehicle |
| Not offered as a breakdown | `SUBMODEL`, `MVMA_MODEL_CODE`, `INDUSTRY_MODEL_CODE` | Free text or fine codes. Useful as lookup keys |
| Public | Everything else | Describes the vehicle |

## Relations: a first reading

- **Rolls up to:** model → make → parent group → owner country (`brand_registry.csv`); district →
  region (`tla_region.csv`); body type → vehicle type; road transport code → industry class.
  Postcode → district is not checked.
- **Derived from:** segment from vehicle type, body type and gross mass; powertrain from motive
  power; the engine, vehicle-year and age bands from their numbers.
- **Recorded only for:** findings 4 and 5 above.
- **Follows a vehicle over time:** make, model, submodel, the model codes, engine size, vehicle
  year, first-registration month and colour together can pick one vehicle out of each snapshot. So
  a series of row-level snapshots shows the owner fields changing, which is why D-063 recommends
  keeping the archive private.
- **Moves together with:** not measured. Stage 2 measures the association between every pair of
  public fields each build.

## A first order for binding, for the Stage 2 review

1. `VEHICLE_USAGE` and `INDUSTRY_CLASS`: starter question 7, filled everywhere. First settle the
   trap in finding 1.
2. `BASIC_COLOUR`, `NUMBER_OF_SEATS`, `NZ_ASSEMBLED`, `CLASS`: filled, simple, few values.
3. `POWER_RATING` and `TRANSMISSION_TYPE`: NZ-new only, each with its guard.
4. `FC_URBAN`, `FC_EXTRA_URBAN`, `SYNTHETIC_GREENHOUSE_GAS`: beside `FC_COMBINED`.
5. The heavy-vehicle fields, with the heavy-vehicle topic.
6. The model codes, only as keys for the model-level lookup.

## Not done in this pass

- No meaning was checked against the data beyond the counts above.
- Coverage was measured over the whole register, not over the in-scope dataset.
- The values of `CLASS`, `VEHICLE_USAGE`, `INDUSTRY_CLASS` and `ROAD_TRANSPORT_CODE` are listed, not
  defined.
- No relation was measured.
- The machine-readable form is not designed. Whether it extends `config/dimensions.json` or is a
  new file is a decision for Stage 2.
