# NZ Vehicle Registration Analytics

Plain answers about New Zealand's vehicle market, built from open government
data. A visitor asks one question, such as "how many vehicles were registered
last month, and is that up or down on a year ago?", and gets one clear answer,
the evidence for it, and the freedom to dig further.

**Status (15 November 2026): work in progress, not yet public.** The data
pipeline runs on GitHub every day. The site runs on a developer's computer
only; nothing is deployed.

## What it can answer today

On a local build:

- **How many vehicles were registered in any month since January 2021**, and
  whether that is up or down on a year ago, by brand and by model.
- **Which brands and models lead**, for any month or the latest twelve.
- **How the mix has changed**: powertrains (petrol, diesel, hybrid, electric),
  new against used imports, who owns the brands, where vehicles are built, how
  old used imports are when they arrive.
- **How complete the picture is**: for each month, how many of the vehicles
  registered are still on the register.
- **Your own question**, on the Build page: choose what to count, break it
  down, pick the brands or values to compare, add conditions, share the link.

Every figure is one step from its definition, its source and the date of the
data. The site says what the data shows, never why. There are no forecasts and
no commentary.

## Where the figures come from

| Dataset | What it counts | Source | Covers |
|---|---|---|---|
| Vehicles still registered | Vehicles first registered in a month that are still on the register | NZTA's open Motor Vehicle Register, pulled by the pipeline | All history; older months thin out as vehicles are scrapped |
| True registrations | Every vehicle first registered in a month, including those since removed | NZTA's registrations dashboard, exported by hand | January 2021 on |
| Cars registered since 1961 | Cars and station wagons first registered each month, new and ex-overseas | Stats NZ's monthly series, exported by hand | January 1961 on (the new and ex-overseas split from July 1975) |

The three are never mixed on one chart. Registrations are not sales, and these
figures will not match the motor industry's own; the site's "Why these figures
differ from others" page explains each difference.

The pipeline on GitHub builds the first dataset unattended. The other two are
built wherever their hand-exported files have been supplied, which today is on
the maintainer's computer only; a build without them says so plainly.

**Licence and attribution.** NZTA's data is released under CC BY 4.0. Stats
NZ's series: "This work is based on/includes Stats NZ's data which are licensed
by Stats NZ for reuse under the Creative Commons Attribution 4.0 International
licence." This project is not affiliated with NZTA, Stats NZ, the Motor
Industry Association or the Motor Trade Association.

## How it is built

- **A pipeline** (Python and DuckDB, `pipeline/`) checks NZTA's register every
  day in GitHub Actions and builds each month once. It turns about 5.9 million
  vehicle rows into a small "cube" of counts. The browser never receives a
  vehicle row.
- **It fails loudly.** A change in the source's fields, a missing month, a
  collapse in row counts or too many unrecognised values stops the build and
  leaves the last good one in place.
- **Nothing about the market is written in code.** Brands, powertrains,
  countries, vehicle types and events live in `data/reference/` and `config/`.
  A new powertrain is a one-row edit.
- **Charts are data.** Each chart on the Explore page is an entry in
  `config/presets.json`, drawn by one of a fixed set of renderers.
- **Every field is defined before it can be asked about.** `docs/DATA_MAP.md`
  gives each of the register's 40 fields its meaning, its coverage, its traps
  and a proposed privacy class. Fields that describe a vehicle's owner are not
  published.
- **The site** (Astro, React and Observable Plot, `src/`) reads the cube as
  static files.

## Run it

```
python -m venv .venv
.venv/Scripts/pip install -r pipeline/requirements.txt     # .venv/bin/pip on Linux or macOS
.venv/Scripts/python.exe -m pytest pipeline/tests -q       # the pipeline's tests

npm install
npm run dev                             # the site at http://127.0.0.1:4321/, reading public/data
node --test "tests/site/*.test.ts"      # the site's tests
```

The site needs a built cube in `public/data` (not in the repository). The
playbooks say how to get one: `docs/playbooks/refresh-public-data.md` and
`docs/playbooks/local-ui-dev.md`. `AGENTS.md` lists every command with the
result last observed, and the few that must not be run by hand. Last run with
Python 3.13 and Node 22.19 on Windows 11; GitHub's runs use Python 3.13 on
Linux.

## Keeping the reference data right

Brand ownership is what goes stale first, and every "who owns the brands"
chart inherits it. In `data/reference/brand_registry.csv`, `as_at` is the date
a row's ownership was last checked; blank means not checked since the project
began. Recheck the oldest and blank rows when a brand changes hands. Ownership
is not versioned over time on purpose: the charts answer who owns these brands
now, and say so. The playbooks cover adding an event, a chart or a reference
value.

## Find your way around

| Start here | What it is |
|---|---|
| `docs/STATE.md` | What is true right now: what runs, what is in progress, known issues |
| `docs/CHECKPOINT.md` | The work queue and the questions waiting on the owner |
| `docs/DECISIONS.md` | Why things are the way they are, one record per decision |
| `CLAUDE.md` | The project brief: the goal, the design rules, the chart shapes, the field traps |
| `AGENTS.md` | For anyone (or any coding agent) working on the repository: commands and hard rules |
| `docs/METRICS.md` | The exact definition of every figure |
| `docs/DATA_SOURCES.md` | Each source: where it comes from, how often, its licence, its traps |
| `docs/DATA_MAP.md` | Every field of the register, defined and checked against the data |
| `docs/CUBE_SCHEMA.md` | The contract between the pipeline and the site |
| `docs/EVENTS_LAYER.md` | The dated policy and market events placed beside the charts (54 on file, 50 verified) |
| `docs/playbooks/` | Step-by-step guides: checks, the local site, adding an event or a chart, supplying a month's export, going public |
| `docs/brief/` | The direction of the work: the master brief and the current work order |

## Not there yet

- The site is not public. The About page is a marked draft.
- True registrations and the long-run car series are not built on GitHub, only
  where their files have been supplied.
- The long-run car series is in the cube but not yet on a chart.
- SUVs cannot be told apart from cars: the register records most as station
  wagons. A model-level classification is planned.
- The first chart is slow to appear on a phone.
- Four of the 54 events are unverified and left out of the build.

`docs/STATE.md` has the full list.

## Feedback

Found a wrong figure, or something unclear? Open an issue on this repository.
