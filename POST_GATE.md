# Deferred until after the gate

The gate is the scheduled monthly runs on 8 October and 8 November 2026
completing clean and unattended. Every item here touches pipeline code, a
reference file, a test or the workflow, so none of it happens before both
runs pass.

Two parts, in order:

- **Part A — cube changes that unblock charts.** Both change what the
  pipeline emits, so both change the golden contract. Do these first,
  each in its own commit with a deliberate golden update.
- **Part B — the three logged build fixes.** Do them in one commit and
  delete Part B from this file in that commit.

---

# Part A — cube changes that unblock charts

Each of these is blocked purely by the freeze. Neither is hard; both are
held because `config/dimensions.json` and the pair-slice list drive what
the pipeline emits, and a change to either fails `test_golden.py` on a
gate run. `config/presets.json` records the same two items as the
`requires` of the presets they block.

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

## A2. Promote `segment_group` to a dimension

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
