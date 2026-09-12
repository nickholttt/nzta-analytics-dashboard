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

---

# Part B — build fixes logged on 2026-09-12

Evidence for all three is from the forced run on 2026-09-11
(run 34646200411) compared with a local build of the same commit.

## B1. Log the pull and build phases separately on the runner

The runner's pipeline step took 233s for pull and build together; the same
work locally took 433s (pull 75.6s, build 357.5s). The runner log cannot
split its 233s: Python buffers stdout when it is not a terminal, so every
line was stamped when the process exited (the "Pulling" and "Built" lines
are 0.1 ms apart), and `fetch.run` prints nothing when the pull finishes.

- Print a line when `client.pull_rows` returns in `pipeline/fetch.py`:
  rows saved and seconds taken.
- Run the pipeline step unbuffered: `PYTHONUNBUFFERED: "1"` in that step's
  `env` in `.github/workflows/monthly-build.yml`.
- Compare the next built run's split with the local one: ingest 207.8s,
  build_rows 119.3s at 12 DuckDB threads (78.6s at 4, the runner's count),
  build_dims 19.9s, everything else about 10s. Local ingest is single-core
  JSON parsing: CPU time matches wall time, and it takes the same time in
  memory, on either drive and with one thread.

Not a risk item: peak memory on the runner was 2,723 MiB of 15,989 MiB.

## B2. Write JSON outputs with `\n` line endings on every platform

`outputs.write_json` uses `Path.write_text`, which writes `\r\n` on
Windows. A Windows build's `events.json` and `manifest.json` then differ
in bytes from the runner's, and `payload_bytes` over-reports: 1,239,507
locally against 1,238,896 on the runner at the 2026-08 snapshot, exactly
the 611 carriage returns in `events.json`. Published output comes from the
runner and is correct; only a Windows-reported number is wrong.

- Pass `newline="\n"` in `outputs.write_json`, and in the `source.json`
  write in `fetch.run`.

## B3. Make the golden test compare `payload_bytes`

`test_golden.built_contract` removes `payload_bytes` before comparing,
which is why B2 survived the golden test.

- Stop removing it, and regenerate `contract.json` with `UPDATE_GOLDEN=1`
  after B2. It depends on DuckDB's Parquet byte layout, so a DuckDB
  version bump will need a deliberate golden update. That is the point: a
  change in what the site downloads should never pass unnoticed.
