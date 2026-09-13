# Playbook: add or correct an event

Events are append-only data in `data/reference/events.csv` (invariant #3). Schema and rules:
`docs/EVENTS_LAYER.md` §Schema. **`data/reference/` is frozen until the 8 November 2026 run
passes.** Get the user's go-ahead first.

## Rules

- `id` is a stable slug and is never reused. Correct a row in place; never delete and re-add it.
- `verified=true` needs a `source_url`, and you must actually have checked the source. If no source
  gives a month, leave the row `verified=false` and say why in `notes`. Never guess a date to clear
  the count (four rows are unverified for exactly this reason).
- `mechanism = measurement` means the event changed how data is recorded, not what people bought.
  Choosing between `demand`, `supply`, `measurement` and `mix` is the important decision; read
  EVENTS_LAYER §Why `mechanism` matters.
- `scope_values` must use the dimension's output vocabulary: the reference-file label where one
  exists (`NZ New`), otherwise the raw NZTA value (`JAPAN`). An unresolvable value fails the build.
- `notes` is for maintainers and is never published.
- Event counts appear in prose in `README.md` and `CLAUDE.md` ("54 events", "50 source-verified").
  Update them in the same commit.

## Commands

```bash
# count rows and verified rows (54 and 50 on 2026-09-13)
.venv/Scripts/python.exe -c "import csv;r=list(csv.DictReader(open('data/reference/events.csv',encoding='utf-8')));print(len(r),sum(x['verified']=='true' for x in r))"

.venv/Scripts/python.exe -m pytest pipeline/tests -q -p no:cacheprovider
# build-time scope checks run in the real build, so exercise them on the saved pull:
.venv/Scripts/python.exe -m pipeline build data/raw/2026-08/20260911T093818Z --dry-run

git add data/reference/events.csv README.md CLAUDE.md
```

## Real example

`4a8608c Events: add the Reserve Bank tightening cycle that began in July 2026` changed
`data/reference/events.csv`, `CLAUDE.md` and `README.md` in one commit. It appended:

```
rbnz-tightening-cycle-2026,2026-07-08,,macro,demand,market,,Reserve Bank tightening cycle from 2026,The Reserve Bank raised the official cash rate from 2.25 percent to 2.5 percent on 8 July 2026 and to 2.75 percent on 2 September 2026.,down,,documented,true,https://www.rbnz.govt.nz/monetary-policy/monetary-policy-decisions,"Verified 2026-09-12 against RBNZ decision releases: ..."
```

It also corrected the `notes` of the existing `rbnz-tightening-cycle` row (2021–2023) to name the new row.
