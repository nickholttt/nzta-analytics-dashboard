# Data Sources

All NZTA registration data used here is released under **CC BY 4.0**.
Attribution is required in the site footer and in every CSV export.

## A. ArcGIS Feature Service — Motor Vehicle Register (primary)

Point-in-time snapshot of all vehicles currently registered in NZ, updated
monthly and accurate to the end of the previous month. NZTA has
algorithmically cleaned make and model errors.

- Hub item ID: `7b4df667d5014f1a93e6050b31d18407`, layer `0`
- Resolve the FeatureServer URL from the ArcGIS item endpoint, then hit
  `.../FeatureServer/0?f=json` first to read the live field list and
  `maxRecordCount`. **Do not hardcode field names from this doc** — read
  them at runtime and assert against `pipeline/expected_schema.json`.
- Supports `where`, `groupByFieldsForStatistics` + `outStatistics`, and
  `resultOffset` pagination. Use server-side aggregation wherever possible
  rather than pulling rows.

## B. Azure Blob CSVs — full fleet (for the stock cube)

- Container: `nztaopendata.blob.core.windows.net/motorvehicleregister/`
- Split into one CSV per vehicle year from 1990; pre-1990 in a single zip
- A cleaned version and a raw ungroomed version exist. **Use the cleaned
  version.** NZTA only recommends the raw one for specialist use.
- The all-years file takes roughly 20 minutes to download and exceeds
  Excel's row limit. Stream it into DuckDB, never load it in memory.

## C. Stats NZ Transport (TPT) time series — backfill and cross-check

Monthly aggregates of vehicles currently licensed by type and new /
ex-overseas vehicles registered by type, derived from NZTA administrative
data. Small, long history. Use it to backfill trend charts before the
detailed data starts, and as an independent sanity check on our own totals.

## D. Registrations dashboard — do not automate

Export-only, no API. Useful for manual verification of a suspect figure.
Never build a dependency on it.

## E. Motor Industry Association — reference only

Not open data. Do not scrape. Our numbers will not match theirs; MIA counts
vehicles delivered to buyers. Say so on the Method page rather than trying
to reconcile.

---

## Field notes that will bite you

**Country of origin** is where the vehicle was *principally manufactured*.
NZTA's own guidance: a vehicle assembled in NZ from a Japanese CKD kit
records Japan. So a Thai-built Hilux records Thailand, not Japan. This
field is **not** brand nationality — that comes from `brand_registry.csv`.
Label them "Built in" and "Brand owned from" in the UI, never "origin".

**Country of previous registration** is only meaningful for used imports.

**Import status** has four values, not two: `NEW`, `USED`, `RE-REG` and
`SCRATCH`. Only `NEW` and `USED` are entries to the fleet. `RE-REG` is a
vehicle returning to the register (mostly trailers) and `SCRATCH` is
home-built. `import_status_map.csv` records how each is treated.

**Motive power** is the primary fuel, in NZTA's own spellings (`PLUGIN`,
not `PLUG-IN`). Two petrol hybrid codes are in concurrent use, not a
rename. A second fuel, where present, is in `ALTERNATIVE_MOTIVE_POWER`:
about 0.1% of in-scope rows, mostly petrol vehicles also running LPG or
CNG. The powertrain dimension uses the primary fuel only, so a dual-fuel
vehicle counts under its primary fuel. The pipeline reports how many rows
carry a different alternative fuel rather than dropping that fact.

**Make and model** come from a predefined list; **submodel is free text**.
Never aggregate on submodel.

**Vehicle year** changed meaning in 2007, and the data confirms it. NZTA's
field description page says "year of manufacture or model year – if
unknown, year of first registration", which matches the pre-2007 records,
not later ones. For NZ-new vehicles first registered from 2007 it equals
the registration year on all but 504 of 2.2 million in-scope rows, and it
is not model year (checked against VIN model-year codes). For used imports
it is a year from the vehicle's life overseas, with no break at 2007.
Before 2007, NZ-new records mix manufacture year, model year and
registration year across several regimes. Any chart that includes NZ-new
vehicles and spans the boundary must render a visible break marker.
Details: `MODEL_AND_AGE.md` §1.

**Undefined values** are common. Some attributes are not captured at first
registration and are updated later, so an "undefined" bucket is legitimate
and must be shown, not silently dropped.

What counts as undefined is data, not code. `sentinels.csv` lists, per
field, the raw values that become `__UNDEFINED__`: blanks, `NOT KNOWN`, a
GVM of 0, and so on. `OTHER` is a real category, not a sentinel.
`CC_RATING` has no sentinel because 0 is meaningful for a vehicle with no
engine; engine size bands decide that from `has_combustion_engine` in
`powertrain_map.csv`.

**History is not frozen.** Vehicles are added and removed retrospectively
and a registration date can be updated after the fact. Prior months will
move between snapshots. Store every monthly snapshot and never overwrite;
restatement is a feature of the data, not a bug in the pipeline.

**Region** is not a field. The register records `TLA`: the territorial
authority where the registered owner lives *as at the snapshot*, from their
most recent address. It is not where the vehicle is used, and not where the
owner lived when the vehicle was first registered. Region is derived through
`tla_region.csv`. Seven districts straddle regional boundaries; each is
assigned to the region holding most of its residents, and the `straddles`
column names the others. Rental and lease fleets distort this badly.

**Registration is not sale.** Repeat this on the Method page.
