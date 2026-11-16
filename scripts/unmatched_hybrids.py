"""The hybrids that lower a dataset's coverage at high confidence in its trailing window, by make and model.

    python -I scripts/unmatched_hybrids.py <dataset> [<saved pull folder>] [--top N]   (from the repository root)

A dataset built from the register needs the saved pull (data/raw/YYYY-MM/<timestamp>); one built from a supplied source reads that
source's committed store. Reads the repository and the pull and writes nothing: the work happens in memory. A maintainer
script, run by hand; the pipeline never runs it (docs/playbooks/check-monthly-run.md, D-112).
"""

import argparse
import json
import math
import sys
from datetime import date
from fractions import Fraction
from pathlib import Path

import duckdb

parser = argparse.ArgumentParser()
parser.add_argument("dataset")
parser.add_argument("pull", nargs="?")
parser.add_argument("--top", type=int, default=25)
args = parser.parse_args()
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import build, config, metrics, normalise, schema, supplied  # noqa: E402
from pipeline.errors import GuardrailError  # noqa: E402

cfg = config.load()
p = cfg.pipeline
if args.dataset not in p["datasets"]:
    sys.exit(f"{args.dataset} is not a dataset in config/pipeline.json: {sorted(p['datasets'])}")
dataset_cfg = p["datasets"][args.dataset]
if "source" in dataset_cfg and cfg.supplied(dataset_cfg["source"])["kind"] == supplied.SERIES:
    sys.exit(f"{args.dataset} is written from a published series: it has no vehicles to classify")
expected = json.loads(cfg.path("expected_schema").read_text(encoding="utf-8"))
types = schema.pull_types(expected, list(p["fields"].values()))
names = {f["name"] for f in expected["fields"]}
con = duckdb.connect()

try:
    if "source" in dataset_cfg:
        aborts, warnings = [], []
        loaded = supplied.load_store(con, cfg, dataset_cfg["source"], aborts, warnings)
        if aborts or loaded is None:
            sys.exit(f"the supplied store for {dataset_cfg['source']} cannot be read: {'; '.join(aborts) or 'it is absent'}")
        build.supplied_raw(con, cfg, dataset_cfg["source"], types)
        snapshot = loaded[2].replace(day=1)
    else:
        if not args.pull:
            sys.exit("a dataset built from the register needs the saved pull folder")
        if not (Path(args.pull) / "source.json").exists():
            sys.exit(f"{args.pull} has no source.json: it is not a saved pull folder (data/raw/YYYY-MM/<timestamp>)")
        source = json.loads((Path(args.pull) / "source.json").read_text(encoding="utf-8"))
        normalise.ingest(con, f"{args.pull}/pages/*.json.gz", types)
        snapshot = date.fromisoformat(source["change_key"]["snapshot"]).replace(day=1)
    normalise.build_src(con, cfg, types, names)
    con.execute("DROP TABLE raw")
    normalise.build_rows(con, cfg)
except GuardrailError as exc:
    sys.exit(f"the data could not be read: {exc}")

window = int(p["trailing_window_months"])
start = metrics.month_add(snapshot, -(window - 1))
ds = metrics.dataset_filter(dataset_cfg["require"], snapshot)
# hybrid_coverage reads `rows`, and the dataset's filter names columns `rows` has.
block, counts = metrics.hybrid_coverage(con, cfg, ds, start, snapshot, window)
high, denominator = counts["trailing"]
threshold = block["publish_split_at_trailing_high_confidence_coverage"]
t = block["trailing"]
print(f"{args.dataset}, {start:%Y-%m} to {snapshot:%Y-%m}: {t['source_hybrids']:,} hybrids; identified mild {t['identified_mild']:,}, "
      f"identified full {t['identified_full']:,}, unknown {t['unknown']:,}")
if not denominator:
    # Nothing to divide: the build publishes the split here (docs/METRICS.md), and there is nothing that counts against it.
    print("at high confidence only: no hybrid in the window that could be mild, so there is no figure and the split is "
          f"{'published' if block['mild_split_published'] else 'withheld'}; nothing counts against it")
    sys.exit(0)
print(f"at high confidence only: {high:,} of {denominator:,} = {high / denominator:.2%}; the split is "
      f"{'published' if block['mild_split_published'] else 'withheld'} at {threshold:.0%}")
needed = Fraction(str(threshold))
if block["mild_split_published"]:
    print(f"room for {math.floor(high / needed - denominator):,} more unidentified hybrids in the window before it falls under {threshold:.0%}")
else:
    print(f"it reaches {threshold:.0%} with {math.ceil(needed * denominator - high):,} more mild calls at high confidence, "
          f"or with {denominator - math.floor(high / needed):,} of the unidentified hybrids settled as full calls at high confidence")

# The vehicles behind the figure: the dataset's own row set, the window, and the pipeline's own condition for what the figure at
# high confidence only leaves out of its numerator (metrics.hybrid_conditions), so the two cannot drift apart.
conditions = metrics.hybrid_conditions(cfg)
rows = con.execute(f"""
    SELECT make_final, model_final, coalesce(hybrid_class, 'no row') AS call, coalesce(hybrid_confidence, '') AS confidence, count(*) AS vehicles
    FROM rows
    WHERE {metrics.hybrid_base(ds, conditions)} AND reg_month BETWEEN {metrics.date_sql(start)} AND {metrics.date_sql(snapshot)}
      AND {conditions['against_high']}
    GROUP BY ALL ORDER BY vehicles DESC, make_final, model_final
""").fetchall()
listed = sum(r[4] for r in rows)
# The same vehicles counted the pipeline's way: the figure's denominator less its numerator. A difference is a bug here, not data.
if listed != denominator - high:
    sys.exit(f"the list holds {listed:,} vehicles and the figure leaves out {denominator - high:,}: the two rules have drifted apart")
print(f"\nvehicles that count against the figure, by make and model ({listed:,} in all; "
      f"'no row' is a nameplate the hybrid file does not list):")
for make, model, call, confidence, vehicles in rows[: args.top]:
    print(f"{vehicles:>7,}  {make} {model}  [{call}{' at ' + confidence if confidence else ''}]")
