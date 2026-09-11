# Deferred until after the gate

The gate is the scheduled monthly runs on 8 October and 8 November 2026
completing clean and unattended. Each item below touches pipeline code, a
test or the workflow, so none of it happens before both runs pass. Do all
three in one commit after 8 November and delete this file in that commit.

Evidence for all three is from the forced run on 2026-09-11
(run 34646200411) compared with a local build of the same commit.

## 1. Log the pull and build phases separately on the runner

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

## 2. Write JSON outputs with `\n` line endings on every platform

`outputs.write_json` uses `Path.write_text`, which writes `\r\n` on
Windows. A Windows build's `events.json` and `manifest.json` then differ
in bytes from the runner's, and `payload_bytes` over-reports: 1,239,507
locally against 1,238,896 on the runner at the 2026-08 snapshot, exactly
the 611 carriage returns in `events.json`. Published output comes from the
runner and is correct; only a Windows-reported number is wrong.

- Pass `newline="\n"` in `outputs.write_json`, and in the `source.json`
  write in `fetch.run`.

## 3. Make the golden test compare `payload_bytes`

`test_golden.built_contract` removes `payload_bytes` before comparing,
which is why item 2 survived the golden test.

- Stop removing it, and regenerate `contract.json` with `UPDATE_GOLDEN=1`
  after item 2. It depends on DuckDB's Parquet byte layout, so a DuckDB
  version bump will need a deliberate golden update. That is the point: a
  change in what the site downloads should never pass unnoticed.
