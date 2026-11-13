"""python -m pipeline {init-schema | run | build | archive}"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import duckdb

from . import build as build_step
from . import archive, config, fetch, schema
from .arcgis import Client
from .errors import GuardrailError, SourceError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m pipeline")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init-schema", help="read the live field list and write pipeline/expected_schema.json")
    run = sub.add_parser("run", help="check the source, and pull and build if it changed")
    run.add_argument("--force", action="store_true", help="build even if the change key matches the last good run")
    run.add_argument("--github-output", help="append step outputs (built, snapshot) to this file")
    run.add_argument("--github-summary", help="append the reason nothing was built to this file")
    rebuild = sub.add_parser("build", help="rebuild from a saved pull directory (data/raw/YYYY-MM/<timestamp>)")
    rebuild.add_argument("pull_dir", type=Path)
    rebuild.add_argument("--dry-run", action="store_true", help="run every check but publish nothing")
    keep = sub.add_parser("archive", help="write the last built snapshot's whole register to one Parquet file")
    keep.add_argument("--out", type=Path, required=True, help="the Parquet file to write")
    keep.add_argument("--snapshot", help="fail unless the last good build is this month (YYYY-MM)")
    keep.add_argument("--from-pull", type=Path, help="write from a saved pull directory, not from the live register")
    args = parser.parse_args(argv)

    cfg = config.load()
    try:
        if args.command == "init-schema":
            service = Client(cfg.pipeline["source"]).discover()
            doc = schema.write_expected(cfg.path("expected_schema"), service)
            print(f"Wrote {cfg.path('expected_schema')} with {len(doc['fields'])} fields from {service.service_name}")
            return 0
        if args.command == "run":
            return fetch.run(cfg, force=args.force, github_output=args.github_output, github_summary=args.github_summary)
        if args.command == "archive":
            done = archive.from_pull(cfg, args.from_pull, args.out) if args.from_pull else archive.run(cfg, args.out, args.snapshot)
            print(f"Wrote the register for snapshot {done['snapshot']}: {done['rows']:,} rows at {done['fields']} fields, "
                  f"{done['bytes']:,} bytes, to {args.out}")
            return 0
        source = json.loads((args.pull_dir / "source.json").read_text(encoding="utf-8"))
        manifest = build_step.build(cfg, source, (args.pull_dir / "pages" / "*.json.gz").as_posix(),
                                    fetch.load_state(cfg), publish=not args.dry_run)
        fetch.print_summary(manifest)
        return 0
    except GuardrailError as exc:
        print(f"ABORTED: the last good build is unchanged.\n{exc}", file=sys.stderr)
        return 2
    except SourceError as exc:
        print(f"SOURCE FAILURE: the last good build is unchanged.\n{exc}", file=sys.stderr)
        return 3
    except duckdb.Error as exc:
        print(f"BUILD FAILURE: the last good build is unchanged.\n{type(exc).__name__}: {exc}", file=sys.stderr)
        return 4


if __name__ == "__main__":
    sys.exit(main())
