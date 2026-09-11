# Events Layer

## What it is

An append-only registry of dated things that plausibly moved the market:
government policy, tax changes, macro shocks, brand entries and exits,
model launches, marketing pushes. Rendered as markers on any time-series
chart whose dimension the event is scoped to.

This is the feature that stops the site going stale. A chart of BEV share
is a picture of a line. The same chart with `2021-07-01 Clean Car Discount
rebates begin` and `2023-12-31 Clean Car Discount ends` on it is an
explanation of consumer behaviour. In 2035 the line will be different and
the events will be different, but the mechanism is unchanged and requires
no code.

## The hard rule: annotate, never assert

The site places a dated marker next to an inflection. It does **not** say
the event caused the inflection. The user draws the conclusion.

- Marker label: what happened, and when. Nothing else.
- Tooltip: one-sentence factual summary + source link.
- `expected_effect` in the data is a *directional hypothesis*, used only
  to decide default visibility and to power pull-forward detection. It is
  never rendered as prose on the chart.

Getting this wrong turns a data product into an opinion piece, which is
exactly what the project is not.

## Schema — `data/reference/events.csv`

| column | type | notes |
|---|---|---|
| `id` | slug | stable, never reused |
| `date_start` | ISO date | the date the effect could first appear in registrations |
| `date_end` | ISO date, nullable | for windowed events (a scheme's active period) |
| `category` | enum | `policy` `tax` `macro` `fuel` `supply` `oem_launch` `brand_entry` `brand_exit` `marketing` `regulatory` |
| `mechanism` | enum | `demand` `supply` `measurement` `mix` — **see below** |
| `scope` | enum | `market` `powertrain` `make` `brand_group` `origin` `owner_country` `segment` `region` `import_status` `imported_from` `built_in` `model` |
| `scope_values` | pipe-list, nullable | e.g. `BEV\|PHEV`. Empty = applies to whole scope. Values are the dimension's own output vocabulary: the label from its reference file where it has one (`NZ New` via `import_status_map.csv`, `Auckland` via `tla_region.csv`), otherwise the raw NZTA value (`JAPAN`) |
| `title` | short | ≤60 chars, shown on the marker |
| `summary` | 1 sentence | tooltip body |
| `expected_effect` | enum | `up` `down` `pull_forward` `mixed` `none` |
| `announced_date` | ISO date, nullable | **see below** |
| `confidence` | enum | `documented` `reported` `inferred` |
| `verified` | bool | `false` = seeded but not yet source-checked. Not rendered until true |
| `source_url` | url | required when `verified=true` |

### Build-time checks

The build fails, and the last good build stays deployed, if any
`verified=true` row has a `scope` outside the enum above, a `scope_value`
that does not resolve through the vocabulary its dimension produces from
the data and reference files, or an empty `source_url`. An event whose
values cannot match any chart is a silent failure; it is caught at build
time instead.

### Why `mechanism` matters

Three different things can move a registration line, and conflating them is
the most likely way this site misleads someone.

- **`demand`** — buyers changed their behaviour. A rebate, a fuel price
  spike, a tax. The line moved because people chose differently.
- **`supply`** — buyers didn't change; the available stock did. A border
  rule that disqualifies a slice of used imports, a chip shortage, a brand
  entering or leaving. Registrations in these windows measure availability,
  not preference.
- **`measurement`** — neither demand nor supply changed; **the way the data
  is generated changed.** A distributor moving to an agency model changes
  who is recorded as the registering party and how demonstrator stock
  enters the register. So does a brand renaming. These are artefacts, and
  the site must never let a reader interpret one as consumer behaviour.
- **`mix`** — composition shifted within an unchanged total, e.g. a
  nameplate's production moving country.

Render `measurement` markers in a visually distinct style with a plain
warning in the tooltip: *this reflects a change in how the data was
recorded, not a change in the market.* Everything else can share a style.

### Why `announced_date` matters

Behaviour changes on announcement, not on effect. The Clean Car Discount
repeal was passed under urgency on 14 December 2023 and the scheme ended
31 December 2023, but registrations reacted from the announcement in
November. Charts should be able to render both dates: a solid marker at
`date_start` and a faint one at `announced_date`. The gap between them is
often the most interesting part of the picture.

## Rendering rules

- Markers appear only when the event's `scope`/`scope_values` intersect the
  chart's dimension and active filters. A `make=BYD` brand entry does not
  clutter a powertrain chart.
- `market`-scope events show everywhere but default to collapsed behind a
  single "show events" toggle, on by default.
- Windowed events (`date_end` present) render as a shaded band, not two pins.
- Max 8 visible markers; beyond that, cluster by year and expand on tap.
- `verified=false` rows are excluded from the build entirely.

## Derived analysis: pull-forward and payback

This is where the events layer earns its place beyond decoration, and it is
genuine consumer-behaviour insight rather than a chart annotation.

For any event with `expected_effect = pull_forward`:

1. Fit a baseline from the 12 months ending 2 months before `announced_date`
   (12-month rolling mean, seasonally adjusted).
2. **Pull-forward volume** = cumulative excess over baseline from
   `announced_date` to `date_start`.
3. **Payback volume** = cumulative shortfall below baseline in the 6 months
   after `date_start`.
4. **Payback ratio** = payback ÷ pull-forward. A ratio near 1 means demand
   was moved, not created. Well under 1 means the policy created genuine
   incremental demand.

Surface this as a small card on the event's detail view: *"An estimated
X vehicles were brought forward ahead of this date, of which an estimated
Y% was paid back within six months."* Label every figure as an estimate and
publish the baseline method.

The December 2023 Clean Car Discount deadline is the reference case to
validate against. If the method doesn't clearly detect that spike, the
method is wrong.

## Maintenance

One CSV row per event. Target under 10 minutes a month. Sources worth
watching: NZTA and Ministry of Transport releases, Gazette notices for
RUC and excise, MIA and MTA announcements, OEM NZ press releases.

Do not attempt to log every model facelift. The bar is: *would a reasonable
person expect this to be visible in monthly registration data?*
