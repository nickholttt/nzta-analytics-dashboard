# Playbook: add or change a preset chart

Charts are data (invariant #2): a preset is an object in `config/presets.json` under
`groups[].presets[]`. `config/presets.json` is **allowed on `ui/explore`**, because the pipeline,
workflow and tests never read it (D-020). Check `docs/STATE.md` first: this file currently has
uncommitted changes owned by claude.

## Fields (as used by existing presets)

| Field | Meaning |
|---|---|
| `id` | stable slug |
| `question` | the chart title, as a plain question that the dataset can honestly answer |
| `status` | `live`, `blocked` or `invalid` (defined in the file's `$status` block) |
| `requires` | every outstanding deliverable, as prose; omit when `live` |
| `dataset`, `measure`, `dimension`, `period` | what to read; must exist in `config/dimensions.json` / `config/measures.json` |
| `derived` | a derived measure id that `src/lib/derived.ts` registers (instead of `measure`) |
| `shape_override` | pins the shape. Only a shape the chart rules say fits the question is allowed (below); the resolver marks a preset that pins another `invalid` |
| `note_template` / `note` | a note on the chart. Any figure must come from `{dotted.path}` into the manifest, never typed in |
| `answer` | on a `count` trend: the figure and sentence above the chart for one month (`up`, `down`, `same`, `alone` templates; `{month}`, `{count}`, `{prior_month}`, `{prior_count}`, `{change|pct}`). A template names no month, figure or cause |
| `derived` of a ratio | a derived measure in `config/measures.json` with `numerator_dataset` and `denominator_dataset` (`completeness`) is drawn by the trend renderer from both datasets' slices for the preset's `dimension`; it needs both built and the dimension live in both |
| `cross` | on a ratio preset: a second dimension; each value of `dimension` is crossed with each of its values (completeness by vehicle type and new or used). The numerator needs the pair slice of the two, the denominator a fact table carrying both |
| `dimension2`, `cell_basis` | a second breakdown: the preset is a grid (`matrix`), `dimension` down the side and `dimension2` across the top, for one window (`period` `latest_year` or `latest_month`), read from the dataset's fact table (both fields must be in it). It must pin `"shape_override": "matrix"`, so the time row offers a window and no span of years. `cell_basis` is what a cell holds when the address does not say: `count`, `all`, `row` or `column` (docs/METRICS.md, "A grid of two fields"). `values` and `values2` choose the lines of each side; with none the grid shows the largest |
| a ratio measure's `numerator_dimension`, `numerator_narrowed_to`, `caveat` | in `config/measures.json`: divide on the numerator's own breakdown, narrowed to values of another dimension through a pair slice; and one line with a link under the chart. Any measure naming both datasets is drawn by the ratio chart, whatever its id. A caveat's link must reach a section of `/method`; a test checks it. `show_dataset_definitions: false` keeps the notes from repeating both datasets' definitions where the measure's own definition says what each side counts |
| a count by a low-cardinality `dimension`, no `values` | draws one line per value. A month in which the source records nothing of the breakdown (every vehicle under the not-recorded token) is a gap with a grey band and a sentence (`defaults.phrases.not_recorded`), never a zero; months the manifest lists under `exceeds_total` are said (`phrases.exceeds_total`), with the parts as published. A ratio chart's line breaks at a month it leaves out, and a month standing alone between gaps is a dot |

## Which shape a question gets

Shape is inferred, never chosen per field, and there is no seventh (the sixth, `matrix`, is D-083; D-114 gives it a renderer, `MatrixChart`, a table rather than a Plot figure).
One table decides it for every question: `config/chart_rules.json`, read by `src/lib/shapes.ts` (D-100).

- **The facts.** A question is judged on six: the `kind` of the measure (count, share, average, ratio; `config/measures.json`),
  the `kind` of the field it breaks down by (category, ordered_band, number, time, place; `config/dimensions.json`, in the
  words of the data map), whether its list of values is few, some or many (the dimension's own judgement, its `cardinality`, through the
  table's `value_classes`; not a count), whether it looks at one window of at most `trailing_window_months` or over time, how
  many values the visitor picked, and the kind of a second field crossed with it (a preset's `cross`). `questionFacts` in
  `src/lib/resolve.ts` builds them. A share is one part of a whole with a figure for each value; a ratio is one figure set
  against another, such as the combined share of the largest few.
- **The rules.** `rules` are read from the top and the first whose `when` matches gives the answer: the shapes that fit,
  best first. The last rule matches everything, so every question fits at least one shape. The first is drawn; where more
  than one fits and has a renderer, Build lets the visitor switch among them (`viewsFor` in `src/lib/builder.ts`). A
  shape with no renderer is dropped from what is offered; `RENDERED_SHAPES` in `src/lib/resolve.ts` is the one place that knows
  which have one.
- **A table of the figures** is available for every shape that is drawn: the trend and distribution renderers give a
  disclosure, the lines and the map a key table, the ranking is a table.
- **A dimension states what it is, never which chart it gets.** Give a new dimension a `kind` and a `cardinality`
  (its own judgement of whether its list is ranked, not a count and not checked against one: `low` is a short list, `medium`
  is a list that is not ranked, `high` and `very_high` are long enough to rank. Several `low` dimensions have more values than the
  data map's `cardinality.few_max_values`, and only the ranking rule reads the class). A new measure states its `kind`. A test checks a dimension that is a plain binding of one
  register field against the data map (`tests/site/shapes.test.ts`).
- **To add a rule,** put an object in `rules` above the one it should win over, with an `id`, a `when` made of the facts it
  cares about (a word or a list of words each; leave out what does not matter), `shapes` (best first, only the six) and a
  `note`. Name no field, measure or value: a test fails if a rule does. Then run `node --test "tests/site/*.test.ts"`. Every
  rule must be reached by some question, and `tests/site/shape-defaults.test.ts` lists any preset or Build question whose shape
  or switches changed; read each difference, regenerate with `UPDATE_SHAPE_DEFAULTS=1`, and list it in the decision record.

## Groups

`groups[]` lay out the Explore page: `label` (the section's short name, also its link in the page
navigation), `title` (the section heading), optional `lead: true` (larger charts), and `presets`. The
page shows only the presets that draw against the current build, and drops a group left with none;
`/status` shows every preset with its diagnostics (D-041).

A group may carry `"defer": true`: its charts draw their data only when scrolled to, so the group adds nothing to what the page downloads before its first chart. A preset's ranking month and a count's chosen month are in the address as `<preset id>.month`.

## Visitor wording

A dimension in `config/dimensions.json` may carry `public_label` and `public_note`, and a dataset a
`public_definition`: visitor wording for text that is written for maintainers (D-042). The Explore
and Build pages use one when there is one and fall back to `label`, `note` and `definition`;
`/status` always shows the original.

A dataset the cube has no entry for (a cube built before it existed), or marks `not_built`, makes a group of charts that need it show the dataset's `not_built_message` in place of them, so a dataset that has `not_built_message` in `config/dimensions.json` is covered both ways. A dataset whose figures are Stats NZ's carries its statement in `source_note` as `{dataset.supplied.attribution}`, which the manifest supplies.

A dataset's `words` block says what its charts count (column headings, captions), `source_note` is said under every chart of it (filled from the manifest, with the export's date), and `not_built_message` is what a chart says where the build did not make it. On the Build page `builder.datasets` lists what a question can count; a text that differs by dataset is an object keyed by dataset id, and the choice is `build.dataset` in the address (absent means the first).

## Rules

- A preset that needs a **new dimension, measure or pair slice** changes `config/dimensions.json` or
  `config/measures.json`. Those are pipeline paths: the change goes through a branch cut from `main`
  and its own pull request (AGENTS.md hard rule 2). Until it is on the branch the site is built from,
  the preset is `blocked` and `requires` names the deliverable. Don't work around it in code.
- The UI (`src/components/PresetTriage.tsx`, `src/lib/resolve.ts`) cross-checks the authored
  `status` against what the cube resolves and shows a warning when they disagree. A new preset must
  show no warning.
- No domain value in `src/`: labels, categories and thresholds come from config.

## Verify

```bash
npx -y -p typescript tsc --noEmit
npx astro build
npm run dev          # open http://127.0.0.1:4321/ and check the chart and the triage list
npx astro dev stop   # only if you started it
```

## Real example

`1d1d0ed Concentration: render top_5_share, the direct view of fragmentation` added this preset. It was
one commit; today its `config/measures.json` part would go through its own pull request into `main`:

```json
{
 "id": "concentration",
 "question": "Is the market getting more crowded?",
 "status": "live",
 "shape_override": "trend",
 "derived": "top_5_share",
 "dataset": "registrations_surviving",
 "dimension": "make",
 "period": "all",
 "note_template": "The combined share of the {measure.top_n} largest brands in each month. ..."
}
```

Files changed: `config/measures.json`, `config/presets.json`, `src/lib/derived.ts` (registers
`top_5_share`), `src/lib/resolve.ts`, `src/lib/measures.ts`, `src/lib/config.ts`,
`src/components/TrendChart.tsx`, `src/components/PresetPanel.tsx`, `src/pages/index.astro`.
