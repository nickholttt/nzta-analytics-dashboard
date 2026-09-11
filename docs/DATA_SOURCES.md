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

**Make and model** come from a predefined list; **submodel is free text**.
Never aggregate on submodel.

**Vehicle year** changed meaning in 2007. Before then it could be year of
manufacture, model year, or year of first registration in NZ or overseas.
From January 2007 it means year of first registration in NZ or overseas.
Any chart spanning the boundary must render a visible break marker.

**Undefined values** are common. Some attributes are not captured at first
registration and are updated later, so an "undefined" bucket is legitimate
and must be shown, not silently dropped.

**History is not frozen.** Vehicles are added and removed retrospectively
and a registration date can be updated after the fact. Prior months will
move between snapshots. Store every monthly snapshot and never overwrite;
restatement is a feature of the data, not a bug in the pipeline.

**Region** is the region of the registered person, not where the vehicle
is used. Rental and lease fleets distort this badly.

**Registration is not sale.** Repeat this on the Method page.
