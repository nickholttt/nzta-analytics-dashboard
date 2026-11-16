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

from pipeline import build, config, metrics, normalise, reference, schema, supplied  # noqa: E402

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

if "source" in dataset_cfg:
    aborts, warnings = [], []
    ledger, first, latest = supplied.load_store(con, cfg, dataset_cfg["source"], aborts, warnings)
    assert not aborts, aborts
    build.supplied_raw(con, cfg, dataset_cfg["source"], types)
    snapshot = latest.replace(day=1)
else:
    if not args.pull:
        sys.exit("a dataset built from the register needs the saved pull folder")
    source = json.loads((Path(args.pull) / "source.json").read_text(encoding="utf-8"))
    normalise.ingest(con, f"{args.pull}/pages/*.json.gz", types)
    snapshot = date.fromisoformat(source["change_key"]["snapshot"]).replace(day=1)
normalise.build_src(con, cfg, types, names)
con.execute("DROP TABLE raw")
normalise.build_rows(con, cfg)

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
print(f"at high confidence only: {high:,} of {denominator:,} = {high / denominator:.2%}; the split is "
      f"{'published' if block['mild_split_published'] else 'withheld'} at {threshold:.0%}")
needed = Fraction(str(threshold))
if block["mild_split_published"]:
    print(f"room for {math.floor(high / needed - denominator):,} more unidentified hybrids in the window before it falls under {threshold:.0%}")
else:
    print(f"it reaches {threshold:.0%} with {math.ceil(needed * denominator - high):,} more mild calls at high confidence, "
          f"or with {denominator - math.floor(high / needed):,} of the unidentified hybrids settled as full calls at high confidence")

h, engine = p["hybrid_classification"], p["engine"]["field"]
recorded = engine + normalise.SOURCE_SUFFIX
keys = reference.hybrid_keys(cfg)
codes = ", ".join(normalise.lit(k) for k in sorted(keys["source_hybrid"]))
mild_codes = ", ".join(normalise.lit(k) for k in sorted(keys["mild"])) or "NULL"
high_level = normalise.lit(h["high_confidence_level"])
# What the figure at high confidence only leaves out of its numerator: a vehicle that is no mild call at the high level, not
# identified by the code mapping alone, and not a full call at the high level (which leaves the denominator).
rows = con.execute(f"""
    SELECT make_final, model_final, coalesce(hybrid_class, 'no row') AS call, coalesce(hybrid_confidence, '') AS confidence, count(*) AS vehicles
    FROM rows
    WHERE in_scope AND fleet_entry AND reg_month BETWEEN DATE '{start}' AND DATE '{snapshot}'
      AND {normalise.quote(recorded)} IN ({codes})
      AND NOT coalesce(hybrid_class = {normalise.lit(h['types']['mild'])} AND hybrid_confidence = {high_level}, FALSE)
      AND NOT coalesce(hybrid_class = {normalise.lit(h['types']['full'])} AND hybrid_confidence = {high_level}, FALSE)
      AND NOT (hybrid_class IS NULL AND {normalise.quote(recorded)} IN ({mild_codes}))
    GROUP BY ALL ORDER BY vehicles DESC, make_final, model_final
""").fetchall()
print(f"\nvehicles that count against the figure, by make and model ({sum(r[4] for r in rows):,} in all; "
      f"'no row' is a nameplate the hybrid file does not list):")
for make, model, call, confidence, vehicles in rows[: args.top]:
    print(f"{vehicles:>7,}  {make} {model}  [{call}{' at ' + confidence if confidence else ''}]")
