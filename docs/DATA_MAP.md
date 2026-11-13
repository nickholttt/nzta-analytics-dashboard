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
| `POSTCODE` | **Not in NZTA's field descriptions** | place, 1,330 values | 95.1% | Every vehicle type | 197 postcodes hold fewer than 10 vehicles, and some hold 1. Kept in the private archive only (D-076). See privacy below |
| `VIN11` | "First 11 characters of the Vehicle Identification Number" | identifier | 81.2% | NEW 76.9%, USED 94.8%; 39.3% before 2000 | Kept in the private archive only; never published itself (D-076). What it can give (a model year, a factory) is not yet checked against the data |
| `CHASSIS7` | "First 7 characters of the Chassis Number" | identifier | 40.4% | USED 91.7%, NEW 13.2% | Never pulled, never published (D-062, D-076) |
| `ENGINE_NUMBER` | "All characters of the Engine Number" | identifier | 84.2% | Powered vehicles: cars 99.6%, trailers 0.1% | Never pulled, never published (D-062, D-076) |

## What this pass found

1. **"Who is buying" can be asked** (starter question 7). `VEHICLE_USAGE` and `INDUSTRY_CLASS` hold
   a value for every vehicle, though not always a telling one: the industry class is `UNKNOWN` for
   441,020 vehicles (7.4%) and the usage is `OTHER` for 161,521 (2.7%). New passenger cars and vans
   first registered in October 2026 (11,832):
   by usage, private passenger 6,912 and rental 4,868; by industry class, private 6,862,
   tourism/leisure 3,171, business/financial 1,122, vehicle trader 422.
   - **Trap, not yet checked:** whether these describe the vehicle when it was first registered or
     as it is now. If they are current values, they answer "who owns it now", which matches "who
     bought it" only for the newest months. Two snapshots at these fields would settle it (D-063).
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

## Privacy classes: a first reading, for the user to approve in Stage 2

| Class | Fields | Why |
|---|---|---|
| Never pulled, never published | `CHASSIS7`, `ENGINE_NUMBER` | D-062, D-076 |
| Kept in the private archive only; never published itself. A field derived from it may be published once it has been checked against the data (the user, 2026-11-13, D-076) | `VIN11` | It narrows a vehicle to a handful. A model year or a factory read from it describes the vehicle, not the owner; neither is derived or checked yet |
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
