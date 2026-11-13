# Deferred until after the gate

The gate is the scheduled monthly runs on 8 October and 8 November 2026
completing clean and unattended. Every item here touches pipeline code, a
reference file, a test or the workflow, so none of it happens before both
runs pass.

Two parts, in order:

- **Part A — cube changes that unblock charts.** Each changes what the
  pipeline emits, so each changes the golden contract. Do these first,
  in order, each in its own commit with a deliberate golden update.
- **Part B — the three logged build fixes.** Do them in one commit and
  delete Part B from this file in that commit.

---

# Part A — cube changes that unblock charts

A1 and A3 are blocked purely by the freeze. Neither is hard; both are
held because `config/dimensions.json` and the pair-slice list drive what
the pipeline emits, and a change to either fails `test_golden.py` on a
gate run. `config/presets.json` records both as the `requires` of the
presets they block. A2 is a new dataset, build step 1b, moved up because
of what it unlocks.

## A1. Pair slice: `import_status` x `age_at_registration_band`

The first thing to do after 8 November.

`used_imports` is defined in `dimensions.json` as `registrations_surviving`
filtered to `import_status = Used Import`, and the cube carries
one-dimensional slices only, so the dataset cannot be served at all. Three
presets are waiting on it, all of them in the "New or old?" group:

- `used-import-age` — how old used imports are when they arrive
- `age-distribution-moving-hole` — the moving import cutoff
- `import-age-trend` — also needs a renderer for `median_import_age`

`docs/CUBE_SCHEMA.md` already lists the pairs to generate on demand; this
one is not among them, so add it there in the same commit.

Two further used-import presets need their own pair slices and are not
part of this item: `used-import-source` needs
`import_status` x `imported_from`, and `regional-import-age` needs
`import_status` x `region`.

## A2. Step 1b, `registrations_flow`: the unlock for cohort survival

Second, behind only A1. Moved up on 2026-09-13: step 1b was treated as
the unlock for volume charts, but it is also the unlock for the flagship
metric.

`registrations_surviving` counts vehicles first registered in month M
that are still registered at the snapshot. The Stats NZ TPT series counts
how many were registered in M in the first place. Their ratio is the
share of month M's registrations still on the road at the snapshot:
survival, retrospectively, for every month TPT covers. It needs no
accumulated snapshots, so it is computable the day step 1b lands, not
after years of archived aggregates.

Note only; nothing is built. Three things to settle when it is:

- **Scope match.** The ratio means something only if both sides count the
  same vehicles. TPT's vehicle types and its new / ex-overseas split must
  map onto `vehicle_scope.csv` and `import_status_map.csv`. A mismatch
  shows up as survival above 100% in recent months: build that in as a
  guardrail, never clip it.
- **What the curve is.** One snapshot gives each cohort one observation,
  at age (snapshot − M). Drawn against M it looks like survival by age,
  but every point is a different cohort, so it mixes how vehicles age with
  how cohorts differ. Each later snapshot adds another observation per
  cohort; a chart must say which it shows.
- **Two bases.** `METRICS.md` defines cohort survival against the first
  snapshot in which a cohort was observed. This is survival against
  original registrations. Name both there, and on any chart, before
  either ships.

## A3. Promote `segment_group` to a dimension

`powertrain-mix` filters on `segment_group = Light passenger`. That is a
column in `segment_map.csv`, not a dimension, so it resolves against
nothing and the preset is the canon's only `invalid` entry.

Promote it rather than rewriting the filter to use `segment`. The two are
not interchangeable, and the data says so: `Ute` appears under Heavy
commercial, Light commercial **and** Light passenger, and `Van` under all
three as well. `segment_group = Light passenger` is every Car plus the
light-passenger utes and vans; `segment = Car` silently drops those. It
is derivable by the same `range_lookup` the `segment` dimension already
uses, from a column that is already maintained, so it costs one block in
`dimensions.json` and no new curation.

Applying the filter then also needs a `powertrain` x `segment_group` pair
slice. Until both land, the chart draws every in-scope vehicle and says so.
