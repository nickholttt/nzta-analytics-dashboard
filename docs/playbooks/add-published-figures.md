# Playbook: add a month's published figures

Every build sets our figures beside figures other organisations publish, and a gap is caught before a visitor sees it
(`reconciliation.json`, `docs/CUBE_SCHEMA.md`; D-149). What is compared is two reference files: `data/reference/published_sources.csv`
(the organisations) and `data/reference/published_figures.csv` (one row per published figure). Their columns and the filter
encoding are in `docs/DATA_SOURCES.md`, section F. This playbook is the monthly step of adding the new month's rows.

**Who and when.** The lead, or an agent the lead briefs, once a month when a build has landed and the sources have published
that month. One pull request adds that month's rows and nothing else.

**The pull request is high risk** (`CLAUDE.md`, How the work is done, rule 2): it guards published figures, and a wrong row can
stop a build or, worse, make a wrong figure look checked. It gets one independent reviewer, briefed with the rows and these
checks, and one round: for each new row, that the figure is the one on the page at `source_url` on `date_read`; that
`measure_as_published` is the source's own wording; that the dataset and filters ask for the same thing the source counts; that
each tolerance is the gap measured when the row was added, with room above it (a wide one, such as 12%, must carry a
known difference that says why); that each `figure_kind` is the figure's kind, and that a tolerance of 5% or more
(`reconciliation.single_figure_limit.gap_pct`) on a listed kind has a known difference that says why; and that `known_difference` is a difference that is known and
explained, not a way to quiet a warning.

## Rules

- **Never enter a figure that was not read from the source's page in this session.** Not from memory, not from the press, not
  from an earlier decision record. A gap stays a gap: a month a source has not published has no row.
- **The MIA is the one exception to "not from the press", by the user's word of 2026-11-24 (D-151).** Its figures are taken
  only from what it releases publicly: its own site, its monthly media releases (Scoop publishes them in full), or a news
  report that credits the MIA for the figure on the same page. The row's `source_url` is that page, read in the session, and its
  measure says in brackets where the figure was read. Never its members' data, and never a figure reached through anyone's
  work login. A figure given only rounded, or on a page that does not credit the MIA, has no row, and the month stays a gap.
- **Read, never scrape.** A source that cannot be read automatically is copied in by the maintainer; list exactly which figures
  and from which page, and park the rows until they are supplied.
- The figure is a whole number as the source prints it, with no thousands separator and no unit. A source that gives a rounded
  figure ("about 12,400") gives a wide tolerance, and the row says so in `known_difference`.
- A figure the source does not print, and that was worked out from what its page does show (a total added across the page's
  chart data, two lines of a table added together), states what it was added up from in `added_up_from` (a few lower case
  words, such as `chart` or `table`), and the public page labels it so: "added up from <the source's name>'s published
  <those words>". A figure the source prints itself leaves the column blank.
- Every row has a `figure_kind`, an id that says what sort of figure it is (`docs/DATA_SOURCES.md`, section F, lists the kinds in use;
  a kind must be one of `reconciliation.figure_kinds` in `config/pipeline.json`, or the row is refused when the files are read, so
  a misspelt kind stops the build; a new kind is added to that list first, and is not covered by the one-figure rule until
  `reconciliation.single_figure_limit.kinds` lists it too). A
  row of a listed kind needs a tolerance below the limit's `gap_pct`, or, at `gap_pct` or more, a `known_difference` that says why
  ours cannot come that close: a row without one is refused when the files are read.
- `measure_as_published` is the source's wording, so the page can say what was compared. The rows of one source, one month and
  one measure are told apart by their filters (a "top ten models" figure is one row per model, each with its `MAKE|MODEL`).
- Choose the dataset by what the source counts: first registrations are `registrations_flow` (the default scope) or
  `registrations_flow_wider` (the trade's scope); vehicles still registered are `registrations_surviving`, and a figure that is
  not a registration is set against it only with a `known_difference` saying so. The dataset carries the scope; there is no
  scope column. Filter values are written as the published files hold them (the labels), so look them up in the files, not
  in NZTA's raw codes.
- Never edit a row's figure, tolerance or filters to make a warning go away. A warning is a real gap. Add a `known_difference`
  only where the difference is known and explained; it is shown beside the row and does not hide it.
- A new organisation is a row in `published_sources.csv` first, in its own commit, with its `definition` copied from its page
  and the day read. `independent` is `false` only for a copy of the same export our datasets are built from.
- One reference file per commit, with the docs that describe it (`change-reference-data.md`). A month's rows are one commit.
  Both files use LF line endings.

## Steps (repository root)

1. Open each source's page for the month, copy the figure, the measure's exact wording, the page address and today's date.
2. Add the rows to `published_figures.csv` (open the file in an editor that keeps the quoting: a filters cell holds JSON, so its
   double quotes are doubled inside the CSV's own quotes, as `"{""import_status"": [""a value""]}"`).
3. Check the two files without a build. This reads both, checks every cell, source, dataset and filter dimension against the
   configuration, and prints what is wrong, or `[]`:

   ```
   .venv/Scripts/python.exe -c "from pipeline import config, reconcile; print(reconcile.prepare(config.load())[1])"
   ```

4. Run the new rows against the saved pull of the snapshot they are for, which publishes nothing (12 to 16 minutes). It stops
   with exit 2 if a filter names a dimension the dataset cannot derive or that is not live; if, in one month, at least two
   independent sources, and more than half of those with a compared row that month, each have half or more of what they published
   in rows more than twice their tolerance (never under 2%) from ours, on the same side (the hard limit, `docs/CUBE_SCHEMA.md`);
   or if one compared row of a listed `figure_kind` of an independent source, with a tolerance below 5%, is 5% or more from ours,
   on either side (the single-figure limit, D-150), whatever else is compared. A month in which only one independent source has a
   compared row cannot stop a build by the hard limit, but its rows are still subject to the single-figure limit. A filter value the published files do not
   hold does not stop it: the row is `not_compared` with `reason_kind` `value_not_held`, and the build's warnings say how many
   figures of each source did that:

   ```
   .venv/Scripts/python.exe -m pipeline build data/raw/YYYY-MM/<timestamp> --dry-run
   ```

   Then read `data/staging/build/reconciliation.json`: every new row should be `pass`, `warn` or `not_compared`, and each
   `not_compared` should have the reason you expect (the newest month before its export is supplied is `month_not_held`). Read
   it for `value_not_held` in particular, because a typing mistake in a model or a label looks the same as a model that has
   dropped out of the capped list: look the value up in the published files, and correct the row if it is a typo.
5. If a row warns, look at ours before theirs: which of the two is wrong? A known and explained difference goes in
   `known_difference`; an unexplained one is reported to the lead, not hidden, and the Differences page shows it.
6. If the build stopped on the hard limit, our data is the likelier fault: report it to the lead, do not change the rows.
7. Commit the rows with the message naming the month and the sources. Open the pull request, say that it is high risk, and give
   the reviewer the rows and the checks above.
