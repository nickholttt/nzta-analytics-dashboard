# Stage 0 report

Written by claude on 2026-11-13 for the user. It answers `docs/brief/MASTER_BRIEF.md` §9, Stage 0,
items 1 to 8. Nothing on a frozen path was changed, nothing was merged, and no run was dispatched.

**Done when:** items 1 to 8 are reported (below), three decisions are proposed (D-063 the archive,
D-064 the retry window, D-065 Stats NZ), and the artifact commands are in item 2.

Everything here was read or measured on 2026-11-13 unless it says otherwise. Two sub-agents
(sonnet) did the first web reading; every fact below that came from them was then read first-hand,
or is marked "not read". A third (opus) reviewed this report and the decisions without seeing my
reasoning; what it found is corrected here. "What I did outside the repo" is at the end.

## The short version

1. **The 8 November run was clean but skipped, and NZTA refreshed the register the next day.** The
   October snapshot is waiting to be built. If NZTA's December refresh arrives first, that snapshot
   is never taken: the archive has a gap, the site stays a month behind, and October is first seen
   a month late. October's registrations themselves would still be in the next snapshot. This
   needs you (decision 1).
2. **In the one month that can be measured, a month read days after it ends is a sound count.**
   August 2026 lost 0.16% in its first month, and its cars matched Stats NZ's count to within 0.04%.
3. **The whole register is small enough to keep every month.** At the 16 bound fields it is a
   22.6 MB file; at every field but the identifiers and postcode, about 49 MB (an estimate). So
   the archive question has a simple answer: keep all of it, outside git, and privately (D-063).
4. **Stats NZ's series is real, current to September 2026 and CC BY 4.0**, but narrower than the
   brief assumes: new and used are split for cars only, and it publishes a month about two weeks
   after NZTA's service has it (D-065).
5. **Autotalk's StatsHub already does much of what the workbench aims at**: any make or model by
   region, buyer, fuel and body type, back to 2000, with CSV, behind an email gate. It and vstat
   both had October on 1 November, from NZTA's registrations dashboard, a source this project
   has ruled out until now (decision 8).
6. **"Who is buying" is in the register.** `VEHICLE_USAGE` and `INDUSTRY_CLASS` hold a value for
   every vehicle. And there is an undocumented `POSTCODE` field whose privacy class is yours to
   decide.

## 1. The 8 November run

| | |
|---|---|
| Run | 42484367432, `main` at `e3246bb` |
| Triggered by | `schedule`. Set for 06:17 UTC; GitHub started it at 13:19 UTC |
| Result | success |
| Built or skipped | **Skipped**: "Source unchanged since the last good build (snapshot 2026-09-30); nothing to do." |
| Committed | Nothing, as designed for a skip. `origin/main` is still `e3246bb Snapshot 2026-09` |
| Tests | 38 passed in 51 s |
| Peak memory | 1,015 MiB of 15,983 MiB; 62 s from checkout |

**Has NZTA refreshed since? Yes.** I asked the service the run's own change-detection question from
a scratch script that writes nothing. Its last edit is 2026-11-09 09:50 UTC, the day after the run.
It holds 5,926,990 rows (5,916,165 at the last good build) with 28,864 first registered in October
2026, and its change key differs. A run today would pull and build the 2026-10 snapshot.

The refresh has come later each month: 3 September, 6 October, 9 November.

**The gate.** `POST_GATE.md` defines it as "the scheduled monthly runs on 8 October and 8 November
2026 completing clean and unattended". Both did. Whether a clean skip lifts the freeze is yours to
say (decision 2); the brief says the freeze holds until this is resolved, so I have treated it as
holding.

**Step 1b's source check** (the playbook): `913 dataflows; no transport series`. The playbook's
command had stopped working (the service now answers in XML unless asked for JSON); I corrected it.

## 2. Artifacts

Both cube artifacts exist: `public-data-2026-08` (expires 2026-12-10) and `public-data-2026-09`
(expires 2027-01-06), 1.2 MB each. No release exists yet.

These commands download them. I ran both into a scratch folder and they worked (15 files each).
PowerShell, from any folder; change `D:\nzta-archive` to where you want them. They only download:
nothing in the repo or on GitHub changes.

```powershell
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$repo = "nickholttt/nzta-analytics-dashboard"
& $gh run download 34646200411 --repo $repo --name public-data-2026-08 --dir "D:\nzta-archive\public-data-2026-08"
& $gh run download 37784177375 --repo $repo --name public-data-2026-09 --dir "D:\nzta-archive\public-data-2026-09"
```

**The August raw pull** is `data\raw\2026-08\20260911T093818Z` in the repo folder: 185 pages and a
`source.json`, 177 MB, gitignored, on one disk. It is the only copy of the August snapshot finer
than the committed aggregate, and it holds the 17 bound fields only. Where should it be copied
(decision 5)? Once you name a folder, these two lines, run from the repo folder, copy it and lose
nothing. I have not run them; the path is yours to choose.

```powershell
New-Item -ItemType Directory -Force "D:\nzta-archive\raw"
Copy-Item -Recurse "data\raw\2026-08" "D:\nzta-archive\raw\2026-08"
```

No raw pull of September exists anywhere: the runner's copy went with the runner.

## 3. How much a month moves after it is first seen

From the two committed aggregates, `data/snapshots/2026-08.parquet` and `2026-09.parquet`. One
month can be measured this way, so read it as one month's evidence.

| August 2026 | In the 2026-08 snapshot | A month later | Change |
|---|---|---|---|
| All vehicles | 24,949 | 24,908 | −41 (−0.16%) |
| NEW | 15,238 | 15,214 | −24 (−0.16%) |
| USED | 9,022 | 9,006 | −16 (−0.18%) |
| RE-REG | 562 | 561 | −1 |
| SCRATCH | 127 | 127 | 0 |

- **By make:** 15 of 273 makes moved, all down. Toyota −16 of 6,906, Mazda −4 of 1,466, Honda,
  Mitsubishi and Nissan −3 each. No make gained a vehicle and none appeared or vanished.
- **By the archive's cells** (status, type, fuel, make): cells differ by 65 vehicles in all, and 4
  cells rose, so a few vehicles were reclassified as well as removed.
- **Older months move less:** each of the thirteen months before August fell by 0.04% to 0.12%.
- **Against Stats NZ's count of cars for August 2026:** 9,136 NEW against 9,138 (99.98%), and
  8,156 USED against 8,159 (99.96%). Stats NZ's figures come from NZTA's register too, so this is
  two readings of one source agreeing, not an independent check.

So for August 2026, the month as first observed was a sound count of its registrations, and what
it lost afterwards was slow removal, not late arrivals.

**Survivors of older years** (cars, 2026-09 snapshot as a share of Stats NZ's registrations). This
assumes Stats NZ's "cars and station wagons" and NZTA's "passenger car/van" have always meant the
same vehicles, which I checked for 2026 only (98.8% to 99.98% across its nine months).

| First registered | New | Ex-overseas |
|---|---|---|
| 2025 | 99.2% | 98.0% |
| 2022 | 97.4% | 89.8% |
| 2018 | 94.8% | 73.8% |
| 2014 | 88.5% | 58.3% |
| 2010 | 76.9% | 34.8% |
| 2005 | 50.1% | 17.0% |
| 2000 | 24.2% | 7.7% |
| 1990 | 5.6% | 2.3% |

## 4. The archive: D-063 (proposed)

**What is actually lost today.** When NZTA refreshes, the register as it stood at the month's end
cannot be read again at anything finer than our aggregate (month, import status, vehicle type,
fuel, make). The month's registrations are still in later snapshots, less what has been removed.
What cannot be rebuilt is the snapshot: which vehicles were on the register that day by model,
region or segment, each month as first observed, and the 23 fields the pull does not take.

Sizes from the saved August pull (5,905,376 rows), as sorted Parquet:

| Option | What is kept | Measured |
|---|---|---|
| (a) newest months at every bound field | 3 months, 74,926 rows | 247 KB. At every field but the identifiers: 651 KB (measured on August to October) |
| (b) the committed aggregate, widened | with model | 4.6 MB |
| | with model and district | 9.0 MB |
| | with model, district, body type and gross mass | 14.0 MB |
| (c) the whole snapshot, 16 bound fields | 5,905,376 rows | 22.6 MB |
| | at every field but the identifiers and postcode | **about 49 MB (estimate)** |
| Today | counts by month, status, type, fuel, make | 0.53 MB |

**Recommendation:** (c), one file a month, outside git, with the committed aggregate left as it
is. (a) and (b) can both be computed from (c) later, at any grain, including for fields not yet
bound. (b) is too large for git, and (a) alone gives no survival by model or region.

Three things you should know before agreeing:

- **Keep it private.** The file has one row per vehicle. NZTA publishes one current snapshot; a
  public series of monthly files would let a vehicle be followed from month to month, showing its
  owner's district and usage changing. So I recommend a release in a private GitHub repository
  (yours to set up; not tested), which can be made public later.
- **It goes further than the brief's (c).** The pull widens from 17 fields to 36, so that fields
  not yet bound are kept too. The run's time and memory with the wider pull are not measured.
- **It cannot reach `main` quickly.** It is frozen-path work on top of the five pipeline pull
  requests. October, and probably November, will have to be kept by a hand pull (decision 4).

Full reasoning: D-063.

## 5. The retry window: D-064 (proposed)

**Recommendation:** run every day, not on the 8th, with two rules: a month is built once and never
overwritten, and from the 15th a run fails loudly if the previous month has not been built. A skip
costs 1m17s. The brief's example (daily from the 3rd to the 14th) would also work today, but its
edges are a guess from three refreshes that have each come three days later than the last. Full
reasoning: D-064.

## 6. Stats NZ, and NZTA's other extracts

**Stats NZ: D-065, drafted for you to accept.** Read on Infoshare:

- "New and Ex-Oseas Motor Vehicles Registered by Type (Monthly)", file `TPT052601`, table reference
  `TPT001AA`, last updated 19 October 2026, "Source: NZ Transport Agency".
- Latest month: **September 2026**. The cars total starts in January 1961.
- **Narrower than the brief's §7 table:** new and ex-overseas are split for cars only, from July
  1975. Commercial vehicles, buses and motorcycles are not split. No trailers.
- A trap: "New Cars and Station Wagons Total" and the seven engine-size bands all include the
  ex-overseas cars.
- Its commercial and motorcycle classes are not yet lined up with NZTA's vehicle types (August
  2026: 474 new motorcycles against our 452), so completeness can be shown for cars only for now.
- Licence: CC BY 4.0, with a set statement for adapted content (`docs/DATA_SOURCES.md` §C).
- Export: CSV, Excel, or a saved query. No API and no stable link.
- Infoshare is to be replaced by the Aotearoa Data Explorer in 2027; the Explorer has no transport
  series yet.
- It publishes a month about two weeks after NZTA's service has it (one month observed: September,
  6 October against 19 October). So the newest month has no Stats NZ figure at first.

**NZTA's "Additions to the national vehicle fleet" and "Existing fleet": not read.** NZTA's website
answers automated readers with a block page, for me and for the sub-agent, and I did not work
around it. What I could establish:

- NZTA's open data account lists 87 items. The vehicle ones are the Motor Vehicle Register service
  (CC BY 4.0, modified 2026-11-09), a link to the registrations dashboard, a link to the CSV
  downloads page, a 2023 CSV collection and the field descriptions. Neither extract is there.
- A search-engine summary, seen by the sub-agent and not verified, says the additions page carries
  "as at August 2023, a review of this extract is underway".
- To settle it, open these two pages in a browser and tell me what they offer:
  `nzta.govt.nz/resources/new-zealand-motor-vehicle-register-statistics/additions-to-the-national-vehicle-fleet`
  and `.../existing-fleet/`.

**NZTA's registrations dashboard.** Its listing in NZTA's open data account says: an "interactive
table which shows all vehicles registered in New Zealand for the first time, during the most recent
calendar month. It also shows a subset of reregistered vehicles", CC BY 4.0, listing last modified
2025-11-28. The dashboard itself is on `nzta.govt.nz`, which I could not read.

## 7. The data map: first pass

`docs/DATA_MAP.md`. All 40 fields, profiled with count queries against NZTA's live service
(snapshot 2026-10-31), because the saved August pull holds only the 17 bound fields. Research only;
nothing is bound.

- **Starter question 7 can be answered.** `VEHICLE_USAGE` (8 values, rental among them) and
  `INDUSTRY_CLASS` (15 values) hold a value for every vehicle, though 7.4% of industry classes are
  `UNKNOWN`. Of 11,832 new cars first registered in October 2026, 4,868 are rental. One trap to
  settle first: whether they describe the vehicle at first registration or today.
- **Six fields exist only, or almost only, for NZ-new vehicles or for used imports** (power,
  transmission, two model codes, the two urban fuel figures).
- **Zero stands for "not recorded"** in the number fields, and several hold impossible values
  (999 seats, 99,999 cc). Each needs sentinels and a guard before it is bound.
- **`POSTCODE` is in the service but not in NZTA's field list**, and 197 postcodes hold fewer than
  10 vehicles. Its privacy class is in doubt (decision 9).
- **`CLASS`** has an off-road passenger class (MC, 423,485 vehicles; inferred — confirm), a possible
  lead on SUVs.

## 8. vstat and StatsHub, read as a visitor

Read from each site's pages on 2026-11-13. Phone layout cannot be judged this way. StatsHub's tool
sits behind an email gate, so its features are as its page describes them, not tried.

**MTA vstat** (`vstat.mta.org.nz`). Free, no login. Data snapshot October 2026; its brand page
says "Updated: 1 November 2026". Light vehicles: 14,630 new (+7.6% on a year ago) and 8,659 used
imports (+18.6%). Pages for new and used passenger and commercial vehicles, buyer mix, brand
competition, age at import, heavy vehicles and motorcycles. Controls: month or quarter; current
month, 3, 6 and 12 months, year to date; a fuel filter; buyer tabs; top 20 models; any month in
the last 12. It carries hand-written commentary ("This month saw a large volume of rental
vehicles"). No export, search, region, shareable view or way to pick brands was found.

Its About page does state its definitions: the data is "sourced from the motor vehicle
registrations dashboard as published by" NZTA; "Vstat is updated early in each calendar month"; a
light vehicle has a gross mass of 3,500 kg or less; passenger against commercial is "an arbitrary
distinction: Sedans, hatchbacks, and SUVs ('cars') are passenger, Utes and vans are commercial".

**Autotalk StatsHub** (`autotalk.co.nz/statistics/`), marked Beta. Free, but the tool unlocks with
a newsletter email address. "Every vehicle registered in New Zealand since 2000": first
registrations, January 2000 to October 2026; "Last read from NZTA: 10 November 2026"; its October
story is dated 1 November. Ask in plain words ("Ranger vs Hilux", "used Aqua in Waikato"); filters
for new or used, vehicle class, period, 16 regions, buyer (private, businesses, rental fleets,
dealers, government), fuel and body type ("SUVs and wagons" is one value). Rankings, biggest
movers and CSV downloads of every table. It states its definitions and its source: NZTA's
registrations dashboard from 2021, re-read monthly, and the open register for 2000 to 2020, which
"no longer holds vehicles deregistered since. For 2019, the register file holds 95.6% of the new
passenger registrations AutoTalk published at the time." Also arrivals at the border and a Clean
Vehicle Standard page.

| # | Question | vstat | StatsHub | This site today |
|---|---|---|---|---|
| 1 | Registered last month, against a year ago | Yes | Yes | Partly: survivors, September |
| 2 | Leading brands, gainers and losers | Yes | Described | Yes |
| 3 | One brand against another | Partly: same list, no picking | Described | Yes, in Build |
| 4 | Electric, plug-in and hybrid share | Yes | Yes | Yes, once #28 lands |
| 5 | Leading models | Yes, top 20 | Described | No |
| 6 | SUVs against cars | Not found | Partly: SUVs with wagons | No |
| 7 | Who is buying | Yes | Described | No |
| 8 | Used imports: origin and age | Partly: age page | Not found | Partly |
| 9 | My region | No | Described | Partly: Build only |
| 10 | Fleet age and survival | No | No | No |
| 11 | Ford, Toyota and BYD, one powertrain, one segment | No | Could not tell | Close: unmerged, no ranking of picks yet |

**What this means for the brief.**

- Both sites had October on 1 November. This project could not have it before 9 November, when
  NZTA's open-data service refreshed, and does not have it yet.
- Both take buyer type and true first registrations from NZTA's registrations dashboard.
  `docs/DATA_SOURCES.md` §D rules that source out ("never build a dependency on it"). It may be the
  fourth source the brief's §7 does not list (decision 8).
- StatsHub covers much of the workbench's ground. What neither site has: the fleet and survival;
  events beside the charts; every field of the register; saved questions that update; no gate;
  sentences from neutral templates (vstat's are hand-written); completeness stated beside the
  figures (StatsHub states one figure, for 2019).

## Where the brief should change

The brief is yours; these are what I found against it.

| Brief | Says | Found |
|---|---|---|
| §4, the gate | The 8 November run "skipped or failed" | Skipped, clean. NZTA refreshed on 9 November |
| §4, pull requests | 19 open | 20 with #36 |
| §4, archive | "Nothing finer can be recovered for a month once it has passed" | The month's vehicles stay in later snapshots; what is lost is the snapshot of that day and the first observation |
| §1, vstat | "definitions not stated on the page" | Stated on its About page |
| §1, StatsHub | "Not verified" | Read: §8 above |
| §1, Fresh | "vstat shows October" | So does StatsHub, both from 1 November |
| §2, question 7 | "No: `VEHICLE_USAGE` is unbound" | Unbound, but it holds a value for every vehicle |
| §7, Stats NZ detail | "Vehicle type and new/used only", "January 1961 onward" | New and used for cars only, from July 1975; only the cars total reaches 1961; about two weeks behind |
| §9, item 7 | Profile "from the saved August pull" | That pull has 17 fields; the live service was profiled |

## Decisions for you

Each has options, my recommendation, and what happens with no answer. The first five are tied to
NZTA's December refresh, which on the last three months' pattern lands between the 3rd and the
12th.

1. **Build October 2026 now.**
   - (a) You start one unforced run on `main`. It pulls and builds October with the code that
     passed both gate runs, and the bot commits `Snapshot 2026-10` to `main`, as every built run
     does.
   - (b) Wait for 8 December. If NZTA refreshes first, the October snapshot is never taken: a gap
     in the archive, and the site a month behind until then.
   - (c) Merge the pipeline pull requests first, then run. The first run of new code would then be
     a hand-started one on live data.
   - **Recommend (a), before any merge.** This command starts it (PowerShell). It changes nothing
     on your computer. It is the playbook's forced command without the force flag; I have not run
     it:
     `& "C:\Program Files\GitHub CLI\gh.exe" workflow run "Monthly build" --repo nickholttt/nzta-analytics-dashboard --ref main`
   - No answer: nothing is dispatched, and I raise it again at the next session.
2. **Has the gate passed?**
   - (a) Yes. Both scheduled runs completed clean and unattended, which is `POST_GATE.md`'s
     wording, and a skip is what the run is designed to do when the source has not changed.
   - (b) No: the gate needs a scheduled run that builds. The next is 8 December (or sooner under
     D-064), and the freeze holds until then.
   - **Recommend (a), after decision 1's run is green**, so the merges start from a `main` that
     has October.
   - No answer: the freeze holds.
3. **The archive (D-063).** Keep each month's whole snapshot as one file? If yes, where:
   - (a) A release in a private GitHub repository, written by the monthly run. You create the
     repository and a token; I give the steps.
   - (b) A public release on this repository. Then the owner fields (district, usage, industry
     class) should be left out or coarsened, which gives up survival by district.
   - (c) Not on GitHub: you download it from each run's artifact by hand within 90 days.
   - (d) No whole snapshot: commit only the newest three months, row by row, to git (0.65 MB a
     run). It keeps first-observed registrations and gives up survival by model and region.
   - **Recommend (a).** Publishing cannot be taken back; a private file can be opened later. No
     answer: nothing is built, and each month's snapshot is kept only as today's aggregate.
4. **Pull October by hand now.** This is the only practical way to keep the October snapshot at
   every field: D-063 cannot reach `main` before December.
   - (a) I run one read-only pull of the live register into gitignored `data/raw/2026-10/`: every
     field but the three identifiers and `POSTCODE`. About 185 requests, as a monthly run makes,
     but more than twice the bytes.
   - (b) No.
   - **Recommend (a).** It keeps October at full detail whatever is decided later. The same would
     be needed in December for November. No answer: not pulled.
5. **Where the August raw pull is copied.** Name a folder outside the repo that is backed up; the
   commands are in §2. It can also go wherever decision 3 puts the monthly files. **Recommend
   both.** No answer: it stays on one disk.
6. **The daily run (D-064).** Accept option 3 with its two rules, or the 3rd-to-14th window, or
   leave the schedule? **Recommend option 3.** No answer: the schedule stays, and a late refresh is
   missed again.
7. **Stats NZ (D-065).** Accept it, and choose how it is fetched: (2) you export the CSV by hand
   each month and a script checks it, which is what the brief says; or (3) one command fetches it.
   (3) worked today, but I have not checked whether Stats NZ's terms allow automated use of
   Infoshare. **Recommend accepting, with (2)**, and (3) later if you want it and the terms allow.
   No answer: not built.
8. **NZTA's registrations dashboard as a source.** vstat and StatsHub both use it for true first
   registrations and buyer type, on the 1st of the month.
   - (a) You export one month from it by hand, so its fields, history and terms can be read before
     Stage 1's headline count is designed.
   - (b) Keep `docs/DATA_SOURCES.md` §D's rule and leave it alone.
   - **Recommend (a).** It is a look, not a dependency. No answer: left alone.
9. **`POSTCODE`'s privacy class.** Never published; published only above a minimum count; or
   public. **Recommend never published**, and not pulled or archived either: NZTA's own notes say
   owner location is given by district so that a person cannot be identified. No answer: treated
   as never published.
10. **CLAUDE.md's three untagged changes** ("static" dropped from the first sentence; the
    `segment_map.csv` comment; "monthly" dropped from the first non-goal). Accept as they are, or
    have them named in a decision? **Recommend accepting**: all three follow from D-062. No answer:
    they stand.

Still open from the brief's §12, unchanged by Stage 0: the `matrix` shape, the running cost, the
limit of five pull requests (20 are open; #36 is the twentieth, opened as you asked), the About
page, and the name.

## What I did outside the repo, and what I changed in it

- **Changed in the repo, beyond the report, STATE, CHECKPOINT and the three decisions:**
  `docs/DATA_MAP.md` (new, the first pass); `docs/DATA_SOURCES.md` §A (refresh dates) and §C (Stats
  NZ, as read); `docs/playbooks/check-monthly-run.md` (the corrected command). The brief calls
  Stage 0 read-only apart from the filing commit; these are corrections of fact, each in its own
  commit, so any can be reverted alone.
- **Asked of outside services, all read-only:** NZTA's service (the change-detection query; count
  queries for the field profile; one pull of 83,951 rows for sizing); NZTA's open data account
  listings; Infoshare (its browse pages, and the monthly table exported twice as CSV by a script);
  the Stats NZ catalogue and two stats.govt.nz pages; vstat's and Autotalk's public pages.
- **A mistake to tell you about.** The sizing pull took every field but the three identifiers, so
  it included `POSTCODE`, before I had seen that its privacy class was in doubt. The rows stayed
  in my scratch folder, were used only to measure file sizes, and are deleted, with every file
  cut from them.
- **Scratch files** are in claude's scratch folder for that session, outside the repo:
  the scripts, the count results, the two downloaded cubes, the Stats NZ CSV, saved web pages, and
  size-test files cut from the saved August pull (bound fields only). They are not part of the
  repo and can be deleted.
