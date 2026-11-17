# NZ Vehicle Registration Analytics

Plain answers about New Zealand's vehicle market, built from open government
data. A visitor asks one question, such as "how many vehicles were registered
last month, and is that up or down on a year ago?", and gets one clear answer,
the evidence for it, and the freedom to dig further.

**Status (15 November 2026): work in progress. The website is not online
yet.** The data pipeline runs on GitHub every day. The site itself runs only
on a computer that has the code and a copy of the data.

## What it can answer today

From the data GitHub builds, which anyone can download (see "Run it"):

- **How the mix has changed**: powertrains (petrol, diesel, hybrid, electric),
  new against used imports, who owns the brands, where vehicles are built, how
  old used imports are when they arrive, cars against utes, vans and trucks,
  how many seats vehicles have, NZTA's class code, and whether a vehicle was
  imported or assembled here.
- **Which brands lead** over the latest twelve months, and who is gaining or
  losing ground.
- **Your own question**, on the Build page: choose what to count, break it
  down, pick the brands or values to compare, add conditions, cross two
  fields in a grid, download the figures, share the link.
- **Your saved questions**, under "My questions" on the Build page: save the
  question on screen, rename it, list and export them as links. They are kept in
  your browser only (no account, nothing sent anywhere, and the list does not
  follow you to another device). A saved question opens on the newest month.
  Pin it to the snapshot being served and a ranking or a grid keeps its window
  ending in that month. Where the deploy has kept that snapshot's files, a
  pinned link shows that snapshot's figures; where it has not, it shows the
  newest snapshot's, and the page says which snapshot the figures are from.

These count vehicles that are still registered, so older months are missing
the vehicles since scrapped.

With two more sets of figures that the maintainer downloads by hand each month
(their counts are kept in this repository, in `data/supplied/`; the data
GitHub has released so far was built before they were, so it does not hold
them until the next month is built):

- **How many vehicles were registered in any month since January 2021**, and
  whether that is up or down on a year ago, by brand and by model.
- **Which brands and models lead** in any single month.
- **The same count on a wider scope**, with buses, motor caravans and special
  purpose vehicles counted too, and passenger against commercial.
- **How complete the picture is**: for each month, how many of the vehicles
  registered are still on the register, by kind of vehicle and new or used.
- **How many cars were registered each month back to 1961**, new and
  ex-overseas, from Stats NZ's series, and how the cars still registered
  compare with that count.

Without those files the site says plainly that these charts are not in the
build.

Every figure is one step from its definition, its source and the date of the
data. The site says what the data shows, never why. There are no forecasts and
no commentary.

## Where the figures come from

| Dataset | What it counts | Source | Covers |
|---|---|---|---|
| Vehicles still registered | Vehicles first registered in a month that are still on the register | NZTA's open Motor Vehicle Register, pulled by the pipeline | All history; older months thin out as vehicles are scrapped |
| True registrations | Vehicles first registered in a month, including those since removed | NZTA's registrations dashboard, exported by hand | January 2021 on |
| Cars registered since 1961 | Cars and station wagons first registered each month, new and ex-overseas | Stats NZ's monthly series, from its Infoshare tool | January 1961 on (the new and ex-overseas split from July 1975) |

The first two count cars, vans, utes and trucks only, new or used when they
arrived. Motorcycles, buses and trailers are not counted yet.

The three are never drawn as separate lines on one chart. The completeness
chart is the one place two of them meet: it divides one by the other.
Registrations are not sales, and these figures will not match the motor
industry's own; the site's "Why these figures differ from others" page
explains each difference.

GitHub builds all three from the next new month on. The other two rest on
files the maintainer downloads by hand and adds to `data/supplied/`.

**Licence and attribution.** NZTA's data is released under CC BY 4.0. Stats
NZ's series: "This work is based on/includes Stats NZ's data which are licensed
by Stats NZ for reuse under the Creative Commons Attribution 4.0 International
licence." The region outlines on the map are also from Stats NZ (CC BY 4.0).
This project is not affiliated with NZTA, the Motor Industry Association or
the Motor Trade Association.

The project's own code and reference files are under the MIT licence
(`LICENSE`). That licence does not cover the data: figures and outlines that
come from NZTA or Stats NZ (for example `data/snapshots/`, `public/geo/`, and
the data a build writes) stay under CC BY 4.0 with the attribution above.
Third-party packages and fonts keep their own licences.

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
- **Every field is written up.** `docs/DATA_MAP.md` gives each of the
  register's 40 fields its meaning, its coverage, its traps and a privacy
  class, approved by the owner. Fields that describe a vehicle's owner are
  not published, with one exception: the share of vehicles by the owner's
  region. The rest may appear later, only in simple tables with small counts
  hidden.
- **The site** (Astro, React and Observable Plot, `src/`) reads the cube as
  static files.

## Run it

The pipeline's tests:

```
python -m venv .venv
.venv/Scripts/pip install -r pipeline/requirements.txt
.venv/Scripts/python.exe -m pytest pipeline/tests -q
```

On Linux or macOS use `.venv/bin/pip` and `.venv/bin/python`.

The site, with the data GitHub last built (the commands are written for Git
Bash; the download needs no account):

```
npm install
curl -L -o public-data.tar.gz https://github.com/nickholttt/nzta-analytics-dashboard/releases/download/cube-2026-10/public-data.tar.gz
mkdir -p public/data
tar -xzf public-data.tar.gz -C public/data
rm public-data.tar.gz
npm run dev                             # the site at http://127.0.0.1:4321/
node --test "tests/site/*.test.ts"      # the site's tests
```

`npm run dev` keeps running in the background; stop it with
`npx astro dev stop`. A newer month's data is a release named `cube-YYYY-MM`.

`AGENTS.md` lists every command with the result last observed, and the few
that must not be run by hand. Last run with Python 3.13 and Node 22.19 on
Windows 11; GitHub's runs use Python 3.13 on Linux.

## Keeping the reference data right

Brand ownership is what goes stale first, and every "who owns the brands"
chart inherits it. In `data/reference/brand_registry.csv`, `as_at` is the date
a row's ownership was last checked; blank means never checked since the
project began. Recheck the oldest and blank rows when a brand changes hands.
Ownership is not versioned over time on purpose: the charts answer who owns
these brands now, and say so. The playbooks cover adding an event, a chart or
a reference value.

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
| `docs/DATA_MAP.md` | Every field of the register, written up and checked against the data |
| `docs/CUBE_SCHEMA.md` | The contract between the pipeline and the site |
| `docs/EVENTS_LAYER.md`, `data/reference/events.csv` | The dated policy and market events placed beside the charts: how they work, and the 54 on file (50 verified) |
| `docs/playbooks/` | Step-by-step guides: checks, the local site, adding an event or a chart, supplying a month's export, going public |
| `docs/brief/` | The direction of the work: the master brief and the current work order |
| `POST_GATE.md` | Work queued while the pipeline was frozen (the freeze ended on 13 November 2026); kept for the record |

## Not there yet

- The website is not online. Its About page is a marked draft.
- True registrations and the long-run car series are not in the data GitHub
  has released so far; its next monthly build holds them.
- SUVs cannot be told apart from cars: the register records most as station
  wagons. A model-level classification is planned.
- A pinned question shows an older snapshot's figures only where the deploy has
  kept that snapshot (it unpacks every earlier cube release beside the newest;
  a local build keeps none). Otherwise a pin holds the window and the figures
  are the newest snapshot's, and the page says which snapshot the figures are
  from. Then the charts that always run to the newest month (lines over time,
  the distribution, the map) cannot hold even the window, and say so. A kept
  snapshot is not used for a question it cannot answer, nor for a field that
  describes the owner unless that snapshot says its small counts were hidden;
  the page says so and shows the newest snapshot instead.
- A question on the Build page takes several seconds to answer on a phone.
  Most of the wait is the page's own code and fonts; the rest is the table of
  counts the browser downloads and adds up itself.
- Apart from the owner's region, fields that describe a vehicle's owner
  (district, usage, industry class, owner type) cannot be asked about yet.
  They will appear only in simple tables, with small counts hidden.
- The method and caveats pages are written by hand and fall behind when a new
  month arrives.
- Four of the 54 events are unverified and left out of the build.

`docs/STATE.md` has the full list.

## Feedback

Found a wrong figure, or something unclear? Open an issue on this repository.
