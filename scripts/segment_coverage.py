"""How much of a dataset's passenger vehicles the model segment file classifies, and how the SUV share moves, by month.

    python -I scripts/segment_coverage.py <dataset> [<saved pull folder>] --focus CLASS --group GROUP [--top N] [--months N] [--import-status LABEL]
                                           (from the repository root)

A dataset built from the register needs the saved pull (data/raw/YYYY-MM/<timestamp>); one built from a supplied source reads that
source's committed store. Reads the repository and the pull and writes nothing: the work happens in memory. A maintainer
script, run by hand; the pipeline never runs it (D-117). The build reads the file too (pipeline.json, model_classes, D-161), into a column of `rows`; this script joins it by its own SQL.

A vehicle counts here when the dataset's own filter counts it and its vehicle type is in the vehicle scope file's `--group`
(a `scope_group` value). It has a row when the file has a row for its canonical make and model whose vehicle-year bounds it
meets and, where the row bounds the gross vehicle mass (`match_gvm_min`, `match_gvm_max`, inclusive, in kilograms), whose mass
it meets; a vehicle with no vehicle year meets no row that bounds the year, and a vehicle with no recorded gross vehicle mass (or a
dataset that has none) meets no row that bounds the mass.
"""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

import duckdb

parser = argparse.ArgumentParser()
parser.add_argument("dataset")
parser.add_argument("pull", nargs="?")
parser.add_argument("--top", type=int, default=25, help="how many nameplates without a row to list")
parser.add_argument("--months", type=int, default=24, help="how many of the latest months to show the share for")
parser.add_argument("--focus", required=True, help="the class (a value of the file's class column) whose share is shown by month")
parser.add_argument("--group", required=True, help="the scope_group of vehicle_scope.csv that counts as passenger vehicles")
parser.add_argument("--import-status", help="count only vehicles with this import status label, as import_status_map.csv spells it")
args = parser.parse_args()
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import build, config, metrics, normalise, reference, schema, supplied  # noqa: E402
from pipeline.errors import GuardrailError  # noqa: E402

FILE = "model_segment.csv"
cfg = config.load()
p = cfg.pipeline
if args.dataset not in p["datasets"]:
    sys.exit(f"{args.dataset} is not a dataset in config/pipeline.json: {sorted(p['datasets'])}")
dataset_cfg = p["datasets"][args.dataset]
if "source" in dataset_cfg and cfg.supplied(dataset_cfg["source"])["kind"] == supplied.SERIES:
    sys.exit(f"{args.dataset} is written from a published series: it has no vehicles to classify")

sep = p["brand"]["alias_separator"]
vehicle = p["scope"]["vehicle"]
passenger_types = [r[vehicle["key"]] for r in reference.read(cfg.reference(vehicle["file"])) if r.get("scope_group") == args.group]
if not passenger_types:
    sys.exit(f"{vehicle['file']} has no vehicle type with scope_group {args.group!r}")
segment_rows = reference.read(cfg.reference(FILE))
seg = []
for row in segment_rows:
    for model in reference.split(row["models"], sep):
        seg.append((row["make"], model, row["class"], row["confidence"],
                    row.get("match_vehicle_year_min") or None, row.get("match_vehicle_year_max") or None,
                    row.get("match_gvm_min") or None, row.get("match_gvm_max") or None))

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

reference.register(con, "seg", ["make", "model", "cls", "confidence", "ymin", "ymax", "gmin", "gmax"], seg)
# The dashboard's rows have no gross vehicle mass: there a row that bounds it matches nothing.
columns = {r[0] for r in con.execute("DESCRIBE rows").fetchall()}
has_gvm = {"gvm", "gvm__missing", "gvm__sentinel"} <= columns
gvm_known = "NOT coalesce(r.gvm__missing, false) AND NOT coalesce(r.gvm__sentinel, false) AND r.gvm IS NOT NULL" if has_gvm else "false"
window = int(p["trailing_window_months"])
start = metrics.month_add(snapshot, -(window - 1))
ds = metrics.dataset_filter(dataset_cfg["require"], snapshot)
types_sql = ", ".join(normalise.lit(t) for t in passenger_types)
status_sql = f" AND r.status_label = {normalise.lit(args.import_status)}" if args.import_status else ""
vehicle_type = reference.quote(vehicle["field"])
# One row for each vehicle, with the file row it meets. A vehicle that meets two rows would be counted twice, so that is
# checked against the vehicle count before anything is shown.
con.execute(f"""
    CREATE TABLE pv AS
    SELECT r.make_final AS make, r.model_final AS model, r.reg_month, coalesce(s.cls, 'no row') AS cls,
           coalesce(s.confidence, '') AS confidence
    FROM rows r
    LEFT JOIN seg s ON s.make = r.make_final AND s.model = r.model_final
        AND (s.ymin IS NULL OR r.vehicle_year >= CAST(s.ymin AS BIGINT))
        AND (s.ymax IS NULL OR r.vehicle_year <= CAST(s.ymax AS BIGINT))
        AND (s.gmin IS NULL OR ({gvm_known} AND r.gvm >= CAST(s.gmin AS BIGINT)))
        AND (s.gmax IS NULL OR ({gvm_known} AND r.gvm <= CAST(s.gmax AS BIGINT)))
    WHERE {ds} AND r.{vehicle_type} IN ({types_sql}){status_sql}
""")
counted = con.execute(f"SELECT count(*) FROM rows r WHERE {ds} AND r.{vehicle_type} IN ({types_sql}){status_sql}").fetchone()[0]
joined = con.execute("SELECT count(*) FROM pv").fetchone()[0]
if joined != counted:
    sys.exit(f"{joined - counted:,} vehicles meet more than one row of {FILE}: it has overlapping rows")
trailing = f"reg_month BETWEEN {metrics.date_sql(start)} AND {metrics.date_sql(snapshot)}"
print(f"{args.dataset}, passenger vehicles ({args.group}){' with import status ' + args.import_status if args.import_status else ''}, {start:%Y-%m} to {snapshot:%Y-%m}; "
      f"{FILE} has {len(segment_rows)} rows for {len(seg)} model entries")

for label, where in ((f"trailing {window} months", trailing), ("all time", "TRUE")):
    total = con.execute(f"SELECT count(*) FROM pv WHERE {where}").fetchone()[0]
    if not total:
        print(f"\n{label}: no vehicles")
        continue
    with_row = con.execute(f"SELECT count(*) FROM pv WHERE {where} AND cls <> 'no row'").fetchone()[0]
    print(f"\n{label}: {with_row:,} of {total:,} vehicles have a row = {with_row / total:.2%}")
    for cls, confidence, n in con.execute(
            f"SELECT cls, confidence, count(*) FROM pv WHERE {where} GROUP BY cls, confidence ORDER BY cls = 'no row', cls, confidence").fetchall():
        print(f"{n:>9,}  {n / total:>7.2%}  {cls}{' at ' + confidence if confidence else ''}")
    # A class at low confidence is a recorded judgement (docs/METRICS.md, the tie-break rule): it counts as classified, and its share is shown apart.
    split = dict(con.execute(
        f"SELECT confidence, count(*) FROM pv WHERE {where} AND cls IN ('suv', 'car') GROUP BY confidence").fetchall())
    classified = sum(split.values())
    print(f"{classified:>9,}  {classified / total:>7.2%}  classified: "
          + ", ".join(f"{c} {split.get(c, 0):,} ({split.get(c, 0) / total:.2%})" for c in ("high", "medium", "low")))

print(f"\nlargest nameplates without a row, trailing {window} months:")
for make, model, n in con.execute(
        f"SELECT make, model, count(*) n FROM pv WHERE cls = 'no row' AND {trailing} GROUP BY ALL ORDER BY n DESC, make, model LIMIT {args.top}").fetchall():
    print(f"{n:>7,}  {make} {model}")

print(f"\nshare of passenger vehicles by month, for class {args.focus!r}: lowest counts only that class, highest adds "
      f"'unresolved' and 'no row':")
print(f"{'month':<8}{'vehicles':>9}{args.focus:>9}{'unres.':>8}{'no row':>8}{'lowest':>9}{'highest':>9}")
rows = con.execute(f"""
    SELECT strftime(reg_month, '%Y-%m') AS m, count(*),
           count(*) FILTER (WHERE cls = ?), count(*) FILTER (WHERE cls = 'unresolved'), count(*) FILTER (WHERE cls = 'no row')
    FROM pv WHERE reg_month >= {metrics.date_sql(metrics.month_add(snapshot, -(args.months - 1)))} GROUP BY 1 ORDER BY 1
""", [args.focus]).fetchall()
for month, total, focus, unresolved, norow in rows:
    print(f"{month:<8}{total:>9,}{focus:>9,}{unresolved:>8,}{norow:>8,}{focus / total:>9.1%}{(focus + unresolved + norow) / total:>9.1%}")
