# The query service

What the workbench (Build) would ask a hosted service, what the service checks and returns, how it
keeps answers, what happens when it is down, and where it plugs into the site (CLAUDE.md invariant
6; the brief §9 Stage 2 item 2; the work order, package G).

**Status: a specification and a local prototype. Nothing is hosted, chosen or paid for.** Which way
to host it is a proposal for the user, with the figures, in `docs/brief/QUERY_SERVICE_PROPOSAL.md`.
Until the user decides, Build reads the fact table in the browser as it always has (D-058), and the
site behaves exactly as before unless the build-time setting below is switched on.

## Why a service

Today a Build question with values or conditions downloads the fact table's columns it names
(`docs/CUBE_SCHEMA.md`, Fact table) and sums them in the browser. On a phone that is the slow part:
the more fields a question names, the more columns it downloads (measured below). A service sums the
same table where it sits and sends back only the counts the chart draws.

The stage (the home page, Explore and the preset charts) does not change. It reads small
precomputed files, costs nothing to run, and keeps working whatever happens to the service.

## The question

A question to the service is **the Build page's address**, the form Build already keeps in the
address bar (D-060), so a link, a saved question and a request are one thing. The service is asked

    GET /v1/<dataset>/answer?<the question>

where the question is the address's query string. `build` is the builder's id
(`config/presets.json`, `builder.id`), which prefixes every key.

| Key | Repeats | Meaning | Part of the request |
|---|---|---|---|
| `build.by` | no | The breakdown: a field id. Empty or absent: all vehicles together | yes |
| `build.value` | yes, up to 8 | A value of the breakdown to compare. None: every value | yes |
| `build.where.<field>` | yes, up to 500 per field | Keep only vehicles whose `<field>` is one of these values. Several fields: all must hold | yes |
| `build.by2` | no | A second breakdown, for the `matrix` shape (D-083). Needs `build.by` | yes (new) |
| `build.value2` | yes, up to 8 | A value of the second breakdown to compare | yes (new) |
| `build.snapshot` | no | `YYYY-MM`: pin the question to that month's snapshot. Absent: the newest | yes (new) |
| `build.measure` | no | Share, number, both, or a derived measure | accepted, not stored |
| `build.view`, `build.period`, `build.range`, `build.smoothing`, `build.granularity` | no | How the chart draws the rows: map or lines, which months, smoothing | accepted, not stored |
| `build-<part>.period` and the like | no | The same settings for the second chart of a two-part measure (share and number) | accepted, not stored |

**Why the measure and the chart's settings are not part of the stored question.** The answer is a
count per month and value, with each month's total. A share is a count over its month's total, a
number is the count itself, a derived measure such as the share of the five largest is computed from
every value's count, and a period or a smoothing chooses and averages months. All of them are drawn
from the same rows. So the service accepts these keys, so that a whole link can be sent as it is,
and leaves them out of the question it stores: a share and a number of the same question, or the
same question over ten years and over all time, are one answer.

**A second breakdown** (`build.by2`, `build.value2`) is what the `matrix` shape will need: one field
down the side, one across the top. The prototype answers it already; Build does not ask it yet
(package F builds the renderer).

**A pinned snapshot** (`build.snapshot=2026-10`) keeps a quoted figure still: the answer is the one
that snapshot gave. Without it, a question is answered from the newest snapshot, so a saved link
redraws on the newest month with no work from the visitor (CLAUDE.md, the goal, rule 9). Every
answer says which snapshot it came from.

### The question as a structured object

The service reads the query string into this object, and checks it against this schema before
anything else:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "A question to the query service",
  "type": "object",
  "additionalProperties": false,
  "required": ["dataset"],
  "properties": {
    "dataset":  { "type": "string", "description": "From the path: /v1/<dataset>/answer" },
    "by":       { "type": ["string", "null"], "description": "build.by: a field on the public list, or null for all vehicles together" },
    "values":   { "type": "array", "items": { "type": "string" }, "maxItems": 8 },
    "by2":      { "type": ["string", "null"], "description": "build.by2: a second field on the public list; needs by" },
    "values2":  { "type": "array", "items": { "type": "string" }, "maxItems": 8 },
    "where":    {
      "type": "object",
      "description": "build.where.<field>: each a field on the public list, never by or by2",
      "additionalProperties": { "type": "array", "items": { "type": "string" }, "minItems": 1, "maxItems": 500 }
    },
    "snapshot": { "type": ["string", "null"], "pattern": "^[0-9]{4}-[0-9]{2}$" }
  }
}
```

A value named twice counts once: duplicates are dropped before the limits are checked, so the
`maxItems` above count different values.

**One spelling per question.** Before it is stored or looked up, the question is written one way:
keys in a fixed order, the values of each key sorted, duplicates dropped, chart settings left out,
and the snapshot always stated (the newest, when the request named none). That string is the
question's key in the answer store, and the answer carries it.

## What the service checks

In this order, and it answers nothing until every check passes:

1. **Only a question.** Every key must be one of those above. Anything else (`sql=`, a misspelt
   key) is refused. The browser never sends SQL, and the service has nowhere to put it: the only
   SQL is written inside the service, from field names that passed check 2, with every value passed
   as a parameter, never spliced into the text.
2. **Every field is on the public list.** `by`, `by2` and every condition's field. Today the list
   is the fields that are defined in `config/dimensions.json`, live in this build
   (`manifest.json`, `live_dimensions`), carried by the fact table (`facts.dimensions`), and not
   withheld in the service's settings. Later the data map's config form replaces the first test:
   a field is public when the map says so (CLAUDE.md, the goal, rule 8; `docs/DATA_MAP.md`,
   privacy classes). **The service loads only the columns on the list**, so a field that is not on
   it cannot be served even by mistake: its column is never read. No owner field, postcode or
   anything derived from `VIN11` is in the fact table (D-076, D-078), so none can be on the list.
3. **The question makes sense.** A second breakdown needs a first, and differs from it; a field is
   not both a breakdown and a condition; values need their breakdown; a snapshot is `YYYY-MM`.
4. **The question is not too big.** At most 16 fields named, 8 values per breakdown (Build's own
   cap, the palette's eight colours), 500 values per condition, 32,768 bytes of question, and
   200,000 cells in one answer. These are set at or above what Build can ask today (it offers all 12
   fact-table fields as conditions, and a condition may keep every value of a field, about 300 for
   model), so the service answers every question the page answers from the static table; when Build
   gains fields, it and the limits are raised together. A question over a limit is refused with the
   limit named, never cut short: a chart quietly missing part of its question answers a different
   one. The limits are config (`scripts/query_service_prototype/settings.json`).
5. **The minimum count.** A field may carry a minimum count (`min_count` in the settings). When a
   question names such a field, as a breakdown or as a condition, the strictest rule named applies
   to every figure in the answer: each cell, and each month's total, counting fewer vehicles than
   the rule (and more than none) is withheld as `null`. So a ruled field asked only as a condition,
   whose answer is month totals, is covered too. A value is listed only if one of its figures is
   shown or it was chosen, so the list does not reveal that a value too small to show exists. The
   answer's `suppression` block names the rules and how many cells and totals were withheld. **No
   field has a rule yet**; the Stage 2 privacy review sets them (`docs/DATA_MAP.md`). Whether a
   withheld figure could be worked back from the figures beside it, or from two questions asked
   one after the other, is for that review to settle before any rule is set. Build does not yet
   draw a chart around withheld figures: it says that some figures count too few vehicles to be
   shown.

Refusals answer `400` (not a question, or not a public field), `404` (no such dataset, or a
snapshot the service does not hold and has no stored answer for), `413` (too long) or `422` (over
a limit), each with one sentence saying what was wrong and what to change. Any other failure
answers `500` with a sentence that holds nothing internal:

```json
{ "error": "'region' is not a field this service can answer for. It answers for: powertrain, make, ...", "field": "region" }
```

## What it returns

The rows the chart needs and nothing else: a count for each month and value, and each month's total
over the vehicles the conditions keep. Cells with no vehicles are left out (a value chosen to
compare is read as 0 there). Months and values are listed once and cells point into those lists, so
an answer is small. The definition, the notes on each field named, the snapshot and the build's
warnings come with it, so a stored answer describes itself.

```json
{
  "contract": 1,
  "dataset": "registrations_surviving",
  "snapshot": "2026-10-31",
  "generated_at": "2026-11-13T09:36:02Z",
  "definition": "Vehicles first registered in month M that are still registered as at the snapshot date.",
  "fields": { "make": { "label": "Brand", "notes": [] }, "powertrain": { "label": "Powertrain", "notes": ["..."] } },
  "warnings": [],
  "question": "build.by=make&build.value=...&build.where.powertrain=...&build.snapshot=2026-10",
  "months": ["1912-01", "...", "2026-10"],
  "denominator": [3, "...", 12345],
  "values": ["...", "..."],
  "cells": [[1170, 0, 812], [1170, 1, 54]],
  "suppression": { "rules": {}, "cells_withheld": 0, "totals_withheld": 0 }
}
```

Each cell is `[month index, value index, count]`, or `[month index, value index, value2 index,
count]` with a second breakdown. The browser turns the answer into exactly the rows it computes from
the fact table today (`factView` in `src/lib/data.ts`): every month, a denominator of 0 where the
conditions keep nothing, and a row of 0 for a chosen value in a month it has none. That they are the
same rows was checked on the measured questions: every chart, figure and sentence on the page was
identical, character for character, with the service and without it (Measurements, below).

Every number in an answer is a count of vehicles summed over a cell. The service never sends a
row of the fact table, and the fact table itself holds no vehicle (`docs/CUBE_SCHEMA.md`).

## Keeping answers

The register changes once a month, so an answer is computed once per question and snapshot:

- **The answer store** keeps each answer under its question's one spelling and its snapshot. The
  same question asked again, by anyone, is served from the store without touching the table.
- **A new snapshot** means a new key: a question that names no snapshot is answered afresh from
  the new month the first time it is asked, and from the store after that.
- **A month built again** (a corrected run of the same month) replaces that month's stored
  answers: the store records which build of the month its answers came from (the manifest's
  `generated_at`) and starts the month afresh when it differs.
- **An older snapshot's answer** is served only if that same question was asked, and stored on
  disk (`--store`), while the snapshot was the newest; otherwise the request is refused with 404.
  So a figure pinned after its month has been replaced cannot be served by the prototype. A hosted
  service that must keep every pinned link working needs either to keep each month's table or to
  carry the stored answers forward; that is a choice for the build, recorded in the proposal.
- **In memory** the prototype keeps at most 10,000 answers, the least recently used dropped
  first, so a stream of made-up questions cannot grow it for ever. On disk it is not capped.
- **The browser and any cache in between** may keep an answer too. An answer to an older snapshot
  never changes (`Cache-Control: public, max-age=31536000, immutable`). An answer for the newest
  snapshot, pinned or not, is kept for 5 minutes (`max-age=300`, with an `ETag`), since the newest
  month can still be built again; a visitor sees a new month within minutes of the service loading
  it.

## When the service is down

- **The stage still works.** The home page, Explore and every preset chart read static files and
  never ask the service. Checked: with the prototype stopped, the home page drew all 7 of its charts.
- **The workbench says so plainly.** Each chart that needed the service says: "The question
  service is not answering, so this chart cannot be drawn just now. Explore's charts do not need it
  and still work. Try again in a few minutes." Each list of values says: "The question service is
  not answering, so the values to choose from did not load. Try again in a few minutes." A refused
  question shows the service's own sentence.
- **No silent fallback** to the static fact table: while the static table is still published it
  could be, but the point of the service is that a phone does not download the table, and a page
  that sometimes downloads a megabyte and sometimes does not is harder to reason about. Recorded as
  a choice to review in the proposal.

## The seam

`src/lib/data.ts` is the only place the browser reads published data (CLAUDE.md, Stack). The service
plugs in there and nowhere else:

- `PUBLIC_QUERY_SERVICE`, a **build-time** setting (an environment variable read by Astro when the
  site is built), holds the service's address. **Unset, as by default, nothing changes**: `factView`
  reads the fact table's columns and sums them in the browser, as before, and the service is never
  asked. Checked: the default build made the same requests as `main` on the home page, the empty
  Build page and the three measured questions.
- Set, `factView` sends the question to the service instead and turns the answer into the same
  rows. Both the charts and the lists of values to choose from go through `factView`, so both move.
  Everything else (manifest, events, slices, pairs) is read from static files either way.
- A failure of the service raises a `ServiceError`. When the service did not answer, the chart and
  the value lists say it is not answering; when it refused the question, they show its sentence,
  since trying again would not help. Either replaces the advice to reload.
- No automated test compares `serviceView` with `factView` yet: the parity was checked by hand on
  the three measured questions (below), and an independent review ported both to Python and found
  the same rows on 31 more cases. A test that runs both in Node would close this.

Per the brief, Build keeps reading the static fact table until a hosted service passes the
acceptance question (`docs/brief/WORK_ORDER.md`, package F), and only then is the setting switched
on for the public build.

## The prototype

`scripts/query_service_prototype/`: a maintainer's prototype, run by hand on one computer, never by
the pipeline or the deploy. It uses only what the pipeline already installs (Python and DuckDB,
`pipeline/requirements.txt`) and adds no dependency.

| File | What it is |
|---|---|
| `server.py` | The service: Python's own HTTP server, DuckDB over the fact table's Parquet files, the checks, the answer store |
| `settings.json` | Limits, the minimum-count rules (none yet), fields withheld (none), the chart-setting keys |
| `questions.json` | The questions measured below, as Build links |
| `test_server.py` | 30 tests: answers are counts summed over cells and match the published slices; a field off the public list is refused and its column never loaded; no SQL gets in; the limits, duplicates, every field at once, the snapshot's format; the minimum-count hook on cells, totals and the list of values; the store, its cap and a month built again; no domain value in the code |

**To run it**, from the repository root, with a local build of `public/data` that has a fact table
(`docs/playbooks/refresh-public-data.md`):

```sh
.venv/Scripts/python.exe scripts/query_service_prototype/server.py --port 4491
# in another terminal: build the site against it, and serve that build
PUBLIC_QUERY_SERVICE=http://127.0.0.1:4491 npx astro build
npx astro preview --port 4480
```

It listens on `127.0.0.1` only. `--data` points it at another `public/data`; `--store <folder>` keeps
answers on disk across restarts (default: memory only). Stop it with Ctrl+C. Build the site again
without the setting before using it for anything else.

**To test it:** `.venv/Scripts/python.exe -m pytest scripts/query_service_prototype -q -p no:cacheprovider`
(skipped without a fact table in `public/data`; the CI workflow does not run it).

It is a prototype for measuring, not a service to deploy: it holds one snapshot, and has no
authentication, rate limit or monitoring.

## Measurements (2026-11-14)

**What was compared.** (a) Today's site: Build reads the fact table's columns and sums them in the
browser. (b) The same site built with `PUBLIC_QUERY_SERVICE` pointing at the local prototype. Both
against the local dry-run build of the 2026-10 pull (the fact table: 641,618 rows over 12 fields).
The timings were taken before an independent review's fixes to the prototype (the minimum-count
hook, the limits, the store); those change no query that was timed, and the pages were checked
again afterwards: the same requests as `main` with the setting off, and identical charts and words
with it on.

**(b) is a floor, not a forecast.** The prototype ran on the same computer as the browser: no
distance to a data centre, no cold start, no queue of other visitors. A hosted service adds the
round trip to wherever it runs and, after a quiet spell, the time to wake (the proposal gives the
documented figures). Its answers here are as fast as they will ever be.

**The questions** (`scripts/query_service_prototype/questions.json`; "fields" counts the breakdown
and the conditions). The 3-field one is the work order's acceptance question.

- 3 fields: `/build/?build.measure=share_and_count&build.by=make&build.value=FORD&build.value=TOYOTA&build.value=BYD&build.where.powertrain=Hybrid&build.where.segment_group=Light%20passenger`
- 5 fields: the 3-field question `&build.where.import_status=NZ%20New&build.where.engine_size_band=1.5-1.9%20L&build.where.engine_size_band=2.0-2.4%20L`
- 8 fields: the 5-field question `&build.where.built_in=JAPAN&build.where.built_in=THAILAND&build.where.built_in=CHINA&build.where.age_at_registration_band=0&build.where.heritage_country=Japan&build.where.heritage_country=United%20States&build.where.heritage_country=China`

**How it was measured.** Headless Chromium (headless shell 1248, `playwright-core` 1.64.1, in a
scratch folder). The site was served from a local static server standing in for Cloudflare Pages:
text compressed with gzip, Parquet sent as it is, an `ETag` on every file and Pages' default
`Cache-Control: public, max-age=0, must-revalidate`. Each figure is the median of 3 runs; the range
is in brackets.

- **Phone**: 390 by 844 px; 150 ms added latency, 1.6 Mbps down, CPU slowed four times: the
  profile of STATE known issue 1 and D-058. Its upload speed was not recorded; 750 kbps was set
  here, for both sides.
- **Desktop**: 1280 by 800 px, no throttling, so the network is the computer itself.
- **First answer**: a new visitor (empty browser cache) opens the link, and for (b) the service has
  just started, so nothing is in its store. Timed from the start of navigation until both charts
  of the question are drawn.
- **Repeat, new visitor**: another visitor with an empty browser cache opens the same link; for (b)
  the answer store already holds the answers.
- **Repeat, same visitor**: the first visitor reloads the link.
- **Bytes**: everything the browser downloaded, as sent over the wire (headers included). "Data"
  is the fact-table columns, manifest and events for (a), and the manifest and events for (b);
  "answers" is what the service sent; the rest is the page, its code and fonts (460 KB either way).
  A KB here is 1,024 bytes.

| Profile | Fields | First answer (a) static | First answer (b) service | Repeat, new visitor (a) / (b) | Repeat, same visitor (a) / (b) | Downloaded, first visit (a) | Downloaded, first visit (b) |
|---|---|---|---|---|---|---|---|
| Phone | 3 | 7.4 s [7.2–8.4] | 4.2 s [4.0–4.3] | 7.5 s / 4.3 s | 2.8 s / 1.5 s | 1,024 KB (565 data) | 511 KB (10 data, 41 answers) |
| Phone | 5 | 8.9 s [8.8–9.0] | 5.0 s [4.5–5.1] | 9.0 s / 4.6 s | 3.3 s / 1.6 s | 1,218 KB (758 data) | 516 KB (10 data, 46 answers) |
| Phone | 8 | 11.6 s [11.6–12.6] | 5.0 s [4.8–5.0] | 11.4 s / 4.5 s | 4.2 s / 1.4 s | 1,671 KB (1,211 data) | 531 KB (10 data, 62 answers) |
| Desktop | 3 | 0.72 s [0.69–0.80] | 0.42 s [0.40–0.43] | 0.70 s / 0.31 s | 0.50 s / 0.14 s | 1,024 KB | 511 KB |
| Desktop | 5 | 0.82 s [0.74–0.82] | 0.66 s [0.55–0.86] | 0.86 s / 0.35 s | 0.62 s / 0.16 s | 1,218 KB | 516 KB |
| Desktop | 8 | 0.96 s [0.87–1.04] | 1.21 s [1.02–1.21] | 0.91 s / 0.35 s | 0.82 s / 0.18 s | 1,671 KB | 531 KB |

On a reload, (a) downloaded 4 to 6 KB (each file answered "not changed") and (b) 3 KB (the answers
came from the browser's own cache). No run logged a console error.

**What the figures say.**

- On the phone, the service roughly halves the first answer (7.4 to 4.2 s with 3 fields, 11.6 to
  5.0 s with 8), and it stops growing with the number of fields: the static side downloads one more
  column per field, the service sends a few kilobytes more.
- **Neither meets the brief's "Fast" target of 3 s on the phone profile.** With the service, 460 KB
  of the 511 KB is the page's own code and fonts; at 1.6 Mbps that alone is about 2.4 s
  (arithmetic, not measured separately). Reaching 3 s needs a lighter page as well as a service.
- On the desktop, the 8-field question was slower with the prototype (1.21 s against 0.96 s). Build
  asks for each condition's list of values as well as the chart, so this question sends 9 requests
  at once, and on this one computer the browser and nine queries share the same processor: each
  took 469 ms (median) at once, against 105 to 157 ms alone (below). That the slowdown is the
  shared processor is the likely reading, not a measured one. A hosted service runs on its own
  processor or answers from its store; the local desktop also has no network to save.
- A repeat by a new visitor is where the store shows: on the desktop 0.31 to 0.35 s whatever the
  question.

**The service's own work**, one request at a time, store empty each time (median of 5), and the
size of each answer as JSON and gzipped. Build makes one request for the chart and one for each
list of values (the breakdown under the conditions, and each condition's field under the others).

| Question | Requests | Compute per request | Compute, all requests | Answers, raw | Answers, gzip | Chart answer, gzip | From the store |
|---|---|---|---|---|---|---|---|
| 3 fields | 4 | 34–56 ms | 195 ms | 134 KB | 40 KB | 5.2 KB | 0.06–0.10 ms |
| 5 fields | 6 | 58–93 ms | 448 ms | 154 KB | 44 KB | 5.0 KB | 0.06–0.11 ms |
| 8 fields | 9 | 105–157 ms | 1,167 ms | 209 KB | 58 KB | 5.2 KB | 0.09–0.42 ms |

- Start-up (reading the 14 column files and indexing the months): 2.0 to 2.2 s (3 runs). After a
  quiet spell, a service that stops when idle adds this to its host's own wake-up time.
- Memory: about 200 MB once loaded, 507 MB at its peak (Windows working set of the service's
  processes, after three answers including the largest list, models among new vehicles).
- For the edge-function option in the proposal: the browser's own summing loop (the same code as
  `factView`) took 13 to 18 ms per question in Node.js 22 on the same computer (median of 7), and
  decoding all 14 column files into JavaScript arrays took 1.3 s and 119 MB of heap.

**The static files made lighter, measured for the no-service option.** Build opens a question that
names values on its last ten years. Written as the pipeline writes them (zstd), the columns for
November 2016 to October 2026 alone (43% of the rows) would be:

| Question | Columns, all months | Columns, last ten years |
|---|---|---|
| 3 fields | 553 KB | 238 KB |
| 5 fields | 746 KB | 312 KB |
| 8 fields | 1,198 KB | 506 KB |

"Every pair of fields" as precomputed files would be 66 files for the 12 fields, and every three,
220; neither answers a question that names more fields than that.
