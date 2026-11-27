# State

Last updated by claude on 2026-11-27 (D-165: the preview is uploaded to a Cloudflare Pages project of its own; GWM is one brand, the user's word)

A snapshot of now. History is in git and `docs/DECISIONS.md`; the queue and the Lanes table are in
`docs/CHECKPOINT.md`. The direction: `docs/brief/UI_DIRECTION.md` (2026-11-27) over `WORK_ORDER.md` and its additions.

## Live now

- **The pipeline** runs on `main` in GitHub Actions, tried every day (D-064). The last build is the forced
  run of 26 November 03:51 UTC, which rebuilt snapshot 2026-10 (release `cube-2026-10`) after #167. The
  private archive (`nickholttt/nzta-register-archive`) holds one release, `snapshot-2026-10`, untouched.
- **Datasets**: `registrations_surviving` (five vehicle types, D-157: 4,615,306 vehicles); `fleet`;
  `new_registrations` (first registrations from January 2021, new and used, D-158); `registrations_cars_long_run`.
- **Buyer type is published** (#167, D-159) on `new_registrations`: a slice, a pair with new or used, a narrow
  fact table with brand and model. It is never beside where an owner lives; the store drops the district.
- **The accuracy guard** (D-149 to D-153): every build sets 389 published figures beside ours; a figure
  past its tolerance warns, and the hard limits stop the build. The rebuilt October: 388 pass, 1 warns.
- **Market type is built on `main`** (#173, D-161) for the register datasets; the cube gains it at the next build.
- **The site's code is on `main`; nothing is deployed** (`CLOUDFLARE_PAGES_PROJECT` is unset). Pages:
  Explore, Canvas, Method, Caveats, About (a draft), Feedback, Differences, a not-found page, and script-free
  pages for 64 brands, 265 models and 6 powertrains. The home page opens with the latest month: new and used
  apart, four periods, buyer type. The canvas is the only builder (#132); it reads the narrow fact tables
  (#172), and its first chart is held to 3.0 s on the phone profile (D-156).

## Current step

The user's direction of 27 November (`docs/brief/UI_DIRECTION.md`): the site built so far is the engine's proof
and is not published; vcore.co.nz gets a new UI in which every page is a canvas the visitor can re-ask (D-162,
the design accepted in D-163). **Re-scoped the same day (D-164): first a working preview for the user and a few
automotive experts, on 28 or 29 November**, and three standing rules: set and forget (no monthly hand work, no
monthly check against the MIA); every brand apart, as NZTA registers it; light vehicles by default, with heavy
vehicles and motorcycles on pages of their own. Lane F's rebuild in `src/` waits for the experts' feedback.

## In progress (all claude; nothing by gemini)

- **The stakeholder preview** (D-164) is built, outside the repository, and **uploaded to a Cloudflare Pages
  project of its own** on the user's account (D-165). Anyone holding its address can open it until the user sets
  an Access rule; it tells search engines to stay away; vcore.co.nz is attached to nothing. It is also a private
  hosted page. Its pages and what can be asked are in D-164. Nothing in `src/` or the pipeline changed.
- Its checks on 27 November: its engine against the published slices and sums made apart from it (54,005
  comparisons, none differ); a headless-browser run (885 checks); axe on 11 pages at 390 and 1,280 px, light and
  dark, nothing found; no sideways scroll 320 to 1,440 px; the uploaded page counts the same (16 checks).
- **Why the dashboard is below the MIA** (D-164): a month is largest when first read. On the committed
  aggregates, August 2026 as first read is the MIA's 12,216; September is 8 short and October 1 short.
- Worktrees: `nzta-lane-a`, `-b` and `-c` detached on `main`, clean; with work not on `main`, `nzta-screens`
  (narrative drafts, **uncommitted**, D-102), `nzta-segments` (a draft scheme file, D-103), `nzta-notes`.
- Private, on the computer: the preview, the figure audit and the dive into the MIA's gaps; the new UI's
  proposal; the vstat study; the "Existing fleet" workbooks; the location plan. Impeccable's hook is on (D-163).

## Raw files on this computer (gitignored)

- `data/raw/2026-08/`, `data/raw/2026-10/20261113T045017Z` (5,926,990 rows, 36 fields), the dashboard
  exports and Stats NZ's series; none holds `VIN11` or `POSTCODE`. The main folder's `public/data` is the
  release `cube-2026-10` as rebuilt on 26 November (with buyer type).
- `data/raw/geo/`: two map sources no build reads yet. The dashboard history's yearly totals are with the exports.
- `data/staging/build` is a dry run of the October pull made on 27 November (exit 0), with Market type on the
  register datasets. It was not copied over `public/data`; the preview reads Market type from it (D-164).

## Known issues

1. A link that reads the fact table is bound by its data (6.5 s first chart). No link draws a map today.
2. A page left open across a monthly refresh draws new figures under the old snapshot date.
3. `/method`, `/caveats` and `/differences` are hand-written and fall behind at each refresh. Nothing checks
   a `restated_from` figure (D-153). The site's tests that read built data are skipped in `Checks`.
4. Not tested: Safari, a real screen reader, a browser without `:has()`. A chosen period is not kept in the
   address. The latest month's powertrain table at 12 months is 11 px too wide at 390 px, with a cue (#171).
5. The canvas has no year to date and no "New entry"; a buyer-type chart does not say it counts new vehicles.
6. With #173, a chart of SUV or Passenger over many years shows the nameplate list's coverage too (D-161).
7. What D-164 found is answered in the preview only. The published data still counts light and heavy
   together, splits Haval, Ora and Tank out of GWM (one brand, the user's word: D-165), records Honda CR-V two
   ways, hides 36 of October's new vehicles under an unmatched make, and has no grouping of powertrains that
   equals the MIA's. `new_registrations` is a hand export and reads each month later than the MIA does.

## Where docs and code disagree (noted, not changed)

- `docs/brief/MASTER_BRIEF.md` knows no canvas; the order wins. Work order 3's 12 December date: see UI_DIRECTION.
  `docs/DATA_MAP.md` lists ten disagreements, fixed as each field is touched. The stub dataset `ownership_changes`
  says "vehicles"; it counts changes. D-144, D-159 and D-160 say the site does not read the narrow tables: true
  when written; #172 reads them. The go-public playbook's command for making a Pages project failed with the
  pinned upload tool; the playbook now gives the one that ran (D-165).

## Blocked or waiting on the user

Waiting on the user (CHECKPOINT): the session with the experts and what they say; who may open the uploaded
preview (an Access rule) and the domain, both in the user's Cloudflare console (`docs/playbooks/go-public.md` §7);
whether October is built again; D-158's questions; the NZTA email; the Existing fleet licence line.

## How to run

`AGENTS.md` §Commands has the verified commands. On 2026-11-26: the site's tests on #172's branch, with
the site built on the rebuilt cube, 933 passed; the pipeline suite on #173's branch, 3,618 passed.

- Claude Code refuses a merge into `main` without the user's word in that session's own messages. It is
  asked for, never worked around. Before a merge, wait for `Checks` on the newest commit in a command of its
  own; never merge during a Monthly build. Before a high-risk pull request, run every test that builds a cube.
- A cube is published only from a Monthly build on `main` (D-158). A forced build of the month already built
  needs no asking only after the counts in `data/supplied/` changed on `main` (D-120).
- NZTA's sites block automated readers: they are read only from files the user supplies.
