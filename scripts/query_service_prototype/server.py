"""A local prototype of the query service (docs/QUERY_SERVICE.md). It runs on this computer only.

It answers Build's question, sent in the same address-bar form a Build link carries, by summing the fact table's
Parquet files with DuckDB, and answers only with counts summed over the cells the question asks for. It loads only
the fact-table columns on the public list, so a field that is not on the list cannot be served: its column is never
read. The browser never sends SQL; the only SQL is written here, from field names checked against that list, with
every value passed as a parameter.

    python scripts/query_service_prototype/server.py --data public/data --port 4491

A prototype for measuring, not a service to deploy. It holds one snapshot, keeps its answers in memory (and on disk
with --store), and has no authentication, rate limit or logging beyond the console.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import threading
import time
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit

import duckdb

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
CONTRACT = 1
SNAPSHOT_FORMAT = re.compile(r"[0-9]{4}-[0-9]{2}")
# Columns of the fact table that are not fields: the month and the count (docs/CUBE_SCHEMA.md, Fact table).
MONTH, COUNT = "month", "n"


class Refused(Exception):
    """A question the service will not answer, with the HTTP status and a sentence that says why and what to change."""

    def __init__(self, status: int, message: str, field: str | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.field = field


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def quoted(identifier: str) -> str:
    # Only ever called on a name already checked against the public list; quoting is a second guard, not the first.
    return '"' + identifier.replace('"', '""') + '"'


class Service:
    def __init__(self, data: Path, settings: dict | None = None, store: Path | None = None):
        self.settings = settings if settings is not None else read_json(HERE / "settings.json")
        self.limits = self.settings["limits"]
        presets = read_json(REPO / "config" / "presets.json")
        builder = presets["builder"]
        self.prefix = builder["id"] + "."
        parts = {p for m in builder["measures"] for p in m.get("parts", [])}
        self.part_keys = {f"{builder['id']}-{p}.{s}" for p in parts for s in self.settings["presentation_keys"]}
        self.dimensions = {d["id"]: d for d in read_json(REPO / "config" / "dimensions.json")["dimensions"]}
        # The words a visitor sees for a dimension sit on the dimension (`public_note`, D-089); Build may add its own.
        public_notes = {d["id"]: d["public_note"] for d in self.dimensions.values() if d.get("public_note")}
        self.notes = {**public_notes, **builder.get("dimension_notes", {})}
        self.manifest = read_json(data / "manifest.json")
        self.snapshot = self.manifest["latest_snapshot"][:7]
        self.store_dir = store
        self.answers: OrderedDict[str, bytes] = OrderedDict()
        self.lock = threading.Lock()
        self.forget_other_builds()
        self.con = duckdb.connect()
        self.public: dict[str, list[str]] = {}
        self.months: dict[str, list[str]] = {}
        for dataset, entry in self.manifest["datasets"].items():
            facts = entry.get("facts")
            if not facts:
                continue
            self.public[dataset] = self.public_fields(entry)
            self.load(data / "facts" / dataset, dataset)

    def forget_other_builds(self) -> None:
        """A month built again (a corrected run) replaces that month's stored answers: the month's store folder records
        which build its answers came from, and is emptied when that differs from the build loaded."""
        if not self.store_dir:
            return
        folder = self.store_dir / self.snapshot
        marker = folder / "build.txt"
        if folder.exists() and (not marker.exists() or marker.read_text(encoding="utf-8") != self.manifest["generated_at"]):
            for old in folder.glob("*.json"):
                old.unlink()
        folder.mkdir(parents=True, exist_ok=True)
        marker.write_text(self.manifest["generated_at"], encoding="utf-8")

    def public_fields(self, entry: dict) -> list[str]:
        """The public list: defined in config/dimensions.json, live in this build, carried by the fact table, and not
        withheld. Later the data map's config form replaces the first test (D-062)."""
        live = set(entry.get("live_dimensions", []))
        withheld = set(self.settings.get("withheld", []))
        return [d for d in entry["facts"]["dimensions"] if d in self.dimensions and d in live and d not in withheld]

    def load(self, folder: Path, dataset: str) -> None:
        columns = [MONTH, COUNT, *self.public[dataset]]
        # Every column file holds the same rows in the same order, so a positional join rebuilds the table.
        sources = " POSITIONAL JOIN ".join(f"read_parquet(?) AS {quoted('c' + str(i))}" for i in range(len(columns)))
        files = [str(folder / f"{c}.parquet") for c in columns]
        table = quoted("facts_" + dataset)
        joined = quoted("joined_" + dataset)
        self.con.execute(f"CREATE TEMP TABLE {joined} AS SELECT * FROM {sources}", files)
        # Each row's month as a position in the answer's list of months, so an answer's cells carry a small number.
        self.con.execute(
            f"CREATE TABLE {table} AS SELECT *, (dense_rank() OVER (ORDER BY {quoted(MONTH)}) - 1)::SMALLINT AS mi FROM {joined}"
        )
        self.con.execute(f"DROP TABLE {joined}")
        rows = self.con.execute(f"SELECT DISTINCT mi, strftime({quoted(MONTH)}, '%Y-%m') FROM {table} ORDER BY 1").fetchall()
        self.months[dataset] = [m for _, m in rows]

    # The question -------------------------------------------------------------------------------------------------

    def parse(self, dataset: str, query: str) -> dict:
        if dataset not in self.public:
            raise Refused(404, f"This service answers no dataset called '{dataset}'.")
        if len(query.encode("utf-8")) > self.limits["max_query_bytes"]:
            raise Refused(413, f"The question is longer than {self.limits['max_query_bytes']} bytes. Ask for fewer values or conditions.")
        q: dict = {"by": None, "by2": None, "values": [], "values2": [], "where": {}, "snapshot": None}
        presentation = set(self.settings["presentation_keys"])
        for key, value in parse_qsl(query, keep_blank_values=True, strict_parsing=False):
            # A second chart of a two-part measure scopes its settings by the builder's id and its own
            # (src/lib/builder.ts): exactly <builder id>-<part>.<chart setting>, such as build-count.period.
            if key in self.part_keys:
                continue
            if not key.startswith(self.prefix):
                raise Refused(400, f"'{key}' is not part of a question. A question is the address of a Build page.", key)
            name = key[len(self.prefix):]
            if name in presentation:
                continue
            if name in ("by", "by2", "snapshot"):
                if q[name] is not None:
                    raise Refused(400, f"'{key}' is given twice.", key)
                q[name] = value or None
            elif name == "value":
                q["values"].append(value)
            elif name == "value2":
                q["values2"].append(value)
            elif name.startswith("where.") and len(name) > len("where."):
                q["where"].setdefault(name[len("where."):], []).append(value)
            else:
                raise Refused(400, f"'{key}' is not part of a question.", key)
        return self.check(dataset, q)

    def check(self, dataset: str, q: dict) -> dict:
        public = self.public[dataset]
        named = [f for f in (q["by"], q["by2"]) if f] + list(q["where"])
        for field in named:
            if field not in public:
                raise Refused(400, f"'{field}' is not a field this service can answer for. It answers for: {', '.join(public)}.", field)
        if q["by2"] and not q["by"]:
            raise Refused(400, "A second breakdown needs a first.", "by2")
        if q["by2"] and q["by2"] == q["by"]:
            raise Refused(400, "The second breakdown is the same field as the first.", "by2")
        for field in (q["by"], q["by2"]):
            if field and field in q["where"]:
                raise Refused(400, f"'{field}' is both a breakdown and a condition. Choose its values to compare instead.", field)
        if q["values"] and not q["by"]:
            raise Refused(400, "Values to compare need a breakdown.", "value")
        if q["values2"] and not q["by2"]:
            raise Refused(400, "Values for a second breakdown need a second breakdown.", "value2")
        if len(set(named)) > self.limits["max_fields"]:
            raise Refused(422, f"A question may name at most {self.limits['max_fields']} fields; this one names {len(named)}.")
        # Duplicates are dropped before anything is counted: a value named twice is named once.
        for key in ("values", "values2"):
            q[key] = sorted(set(q[key]))
            if len(q[key]) > self.limits["max_values"]:
                raise Refused(422, f"At most {self.limits['max_values']} values can be compared at once; this question names {len(q[key])}.", key)
        for field, kept in q["where"].items():
            kept = q["where"][field] = sorted(set(kept))
            if len(kept) > self.limits["max_condition_values"]:
                raise Refused(422, f"A condition may keep at most {self.limits['max_condition_values']} values; the one on '{field}' keeps {len(kept)}.", field)
        if q["snapshot"] is not None and not SNAPSHOT_FORMAT.fullmatch(q["snapshot"]):
            raise Refused(400, "A snapshot is a month written YYYY-MM.", "snapshot")
        return q

    def canonical(self, q: dict) -> str:
        """The question in one spelling: keys and values in order, chart settings left out, snapshot always stated."""
        pairs: list[tuple[str, str]] = []
        for name in ("by", "by2"):
            if q[name]:
                pairs.append((self.prefix + name, q[name]))
        pairs += [(self.prefix + "value", v) for v in q["values"]]
        pairs += [(self.prefix + "value2", v) for v in q["values2"]]
        for field in sorted(q["where"]):
            pairs += [(self.prefix + "where." + field, v) for v in q["where"][field]]
        pairs.append((self.prefix + "snapshot", q["snapshot"] or self.snapshot))
        return urlencode(pairs)

    # The answer ---------------------------------------------------------------------------------------------------

    def compute(self, dataset: str, q: dict) -> dict:
        table = quoted("facts_" + dataset)
        conditions, params = [], []
        for field, kept in sorted(q["where"].items()):
            conditions.append(f"list_contains(?::VARCHAR[], {quoted(field)})")
            params.append(kept)
        kept_sql = " AND ".join(conditions) or "TRUE"
        months = self.months[dataset]
        totals = [0] * len(months)
        for mi, total in self.con.cursor().execute(
            f"SELECT mi, COALESCE(SUM({quoted(COUNT)}) FILTER (WHERE {kept_sql}), 0) FROM {table} GROUP BY mi", params
        ).fetchall():
            totals[mi] = int(total)
        answer: dict = {"months": months, "denominator": totals}
        by = [f for f in (q["by"], q["by2"]) if f]
        if by:
            where, cell_params = [kept_sql], list(params)
            for field, chosen in zip(by, (q["values"], q["values2"])):
                if chosen:
                    where.append(f"list_contains(?::VARCHAR[], {quoted(field)})")
                    cell_params.append(chosen)
            dims = ", ".join(quoted(f) for f in by)
            rows = self.con.cursor().execute(
                f"SELECT mi, {dims}, SUM({quoted(COUNT)}) AS n FROM {table} WHERE {' AND '.join(where)} "
                f"GROUP BY ALL HAVING SUM({quoted(COUNT)}) > 0 ORDER BY ALL",
                cell_params,
            ).fetchall()
            if len(rows) > self.limits["max_cells"]:
                raise Refused(422, f"This question's answer has {len(rows)} cells, more than the {self.limits['max_cells']} one answer may hold. Choose values to compare, or add a condition.")
            rows = [[*r[:-1], int(r[-1])] for r in rows]
        else:
            rows = []
        suppression = self.suppress(q, answer, rows, by)
        if by:
            # A value is listed only if it has a figure that is shown, or was chosen: the list of values must not
            # reveal that a value too small to show exists.
            chosen_lists = (q["values"], q["values2"])[: len(by)]
            shown = [r for r in rows if r[-1] is not None]
            value_lists = [sorted({r[1 + i] for r in shown} | set(chosen)) for i, chosen in enumerate(chosen_lists)]
            index = [{v: j for j, v in enumerate(vs)} for vs in value_lists]
            answer["values"] = value_lists[0]
            if len(by) == 2:
                answer["values2"] = value_lists[1]
            answer["cells"] = [
                [r[0], *(index[i][r[1 + i]] for i in range(len(by))), r[-1]]
                for r in rows
                if all(r[1 + i] in index[i] for i in range(len(by)))
            ]
        answer["suppression"] = suppression
        return answer

    def suppress(self, q: dict, answer: dict, rows: list[list], by: list[str]) -> dict:
        """The minimum-count hook. When a question names a field that has a rule, the strictest rule named applies to
        every figure in the answer: a cell, and a month's total, counting fewer vehicles than it (and more than none)
        is withheld as null. So a ruled field asked only as a condition, whose answer is month totals, is covered
        too. Whether a withheld figure could be worked back from the figures beside it is for the Stage 2 privacy
        review to settle before any rule is set."""
        rules = {f: n for f, n in self.settings.get("min_count", {}).items() if f in by or f in q["where"]}
        cells = totals = 0
        if rules:
            floor = max(rules.values())
            for row in rows:
                if 0 < row[-1] < floor:
                    row[-1] = None
                    cells += 1
            for i, total in enumerate(answer["denominator"]):
                if 0 < total < floor:
                    answer["denominator"][i] = None
                    totals += 1
        return {"rules": rules, "cells_withheld": cells, "totals_withheld": totals}

    def describe(self, dataset: str, q: dict) -> dict:
        entry = self.manifest["datasets"][dataset]
        named = [f for f in (q["by"], q["by2"]) if f] + sorted(q["where"])
        fields = {}
        for f in named:
            d = self.dimensions[f]
            fields[f] = {"label": d.get("label", f), "notes": [n for n in (d.get("note"), self.notes.get(f)) if n]}
        return {
            "contract": CONTRACT,
            "dataset": dataset,
            "snapshot": self.manifest["latest_snapshot"],
            "generated_at": self.manifest["generated_at"],
            "definition": entry.get("definition"),
            "fields": fields,
            "warnings": self.manifest.get("warnings", []),
        }

    def answer(self, dataset: str, query: str) -> tuple[bytes, dict]:
        """The answer's JSON and what the response headers need: store hit or miss, compute time, whether pinned."""
        q = self.parse(dataset, query)
        if q["snapshot"] and q["snapshot"] != self.snapshot:
            stored = self.stored(dataset, q["snapshot"], self.canonical(q))
            if stored is None:
                raise Refused(404, f"This service holds the {self.snapshot} snapshot, not {q['snapshot']}, and has no stored answer to this question for {q['snapshot']}.", "snapshot")
            # An older month is not rebuilt, so its answer will not change.
            return stored, {"store": "hit", "compute_ms": 0.0, "final": True}
        key = self.canonical(q)
        stored = self.stored(dataset, self.snapshot, key)
        if stored is not None:
            return stored, {"store": "hit", "compute_ms": 0.0, "final": False}
        started = time.perf_counter()
        body = {**self.describe(dataset, q), "question": key, **self.compute(dataset, q)}
        compute_ms = (time.perf_counter() - started) * 1000
        encoded = json.dumps(body, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        self.keep(dataset, self.snapshot, key, encoded)
        # The newest month can still be rebuilt (a corrected run), so even a pinned answer to it may change.
        return encoded, {"store": "miss", "compute_ms": compute_ms, "final": False}

    # The answer store: each answer kept against its question and snapshot, served from there until the next. ---------

    def store_key(self, dataset: str, snapshot: str, canonical: str) -> str:
        return hashlib.sha256(f"{dataset}\n{snapshot}\n{canonical}".encode("utf-8")).hexdigest()

    def stored(self, dataset: str, snapshot: str, canonical: str) -> bytes | None:
        key = self.store_key(dataset, snapshot, canonical)
        with self.lock:
            if key in self.answers:
                self.answers.move_to_end(key)
                return self.answers[key]
        if self.store_dir:
            path = self.store_dir / snapshot / f"{key}.json"
            if path.exists():
                body = path.read_bytes()
                self.remember(key, body)
                return body
        return None

    def remember(self, key: str, body: bytes) -> None:
        # The least recently used answer leaves memory first, so a stream of made-up questions cannot grow it for ever.
        # Many requests are answered at once, each on its own thread, so the store is changed under a lock.
        with self.lock:
            self.answers[key] = body
            self.answers.move_to_end(key)
            while len(self.answers) > self.limits["max_answers_in_memory"]:
                self.answers.popitem(last=False)

    def keep(self, dataset: str, snapshot: str, canonical: str, body: bytes) -> None:
        key = self.store_key(dataset, snapshot, canonical)
        self.remember(key, body)
        if self.store_dir:
            folder = self.store_dir / snapshot
            folder.mkdir(parents=True, exist_ok=True)
            (folder / f"{key}.json").write_bytes(body)


def handler_for(service: Service):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self):  # noqa: N802 (the standard library's name)
            url = urlsplit(self.path)
            parts = [p for p in url.path.split("/") if p]
            try:
                if parts == ["v1", "health"]:
                    body = json.dumps({"snapshot": service.manifest["latest_snapshot"], "datasets": service.public}).encode("utf-8")
                    return self.send(200, body, {"Cache-Control": "no-store"})
                if len(parts) != 3 or parts[0] != "v1" or parts[2] != "answer":
                    raise Refused(404, "Ask /v1/<dataset>/answer?<the question>.")
                body, meta = service.answer(parts[1], url.query)
            except Refused as e:
                body = json.dumps({"error": e.message, "field": e.field}).encode("utf-8")
                return self.send(e.status, body, {"Cache-Control": "no-store"})
            except Exception as e:  # noqa: BLE001 (any other failure is still answered, with nothing internal in it)
                print(f"failed: {self.path}: {e!r}", flush=True)
                body = json.dumps({"error": "The service failed while answering this question.", "field": None}).encode("utf-8")
                return self.send(500, body, {"Cache-Control": "no-store"})
            # One tag per body as sent: the gzipped and the plain body differ.
            gz = "gzip" in self.headers.get("Accept-Encoding", "")
            etag = '"' + hashlib.sha256(body).hexdigest()[:32] + ("-gz" if gz else "") + '"'
            if self.headers.get("If-None-Match") == etag:
                return self.send(304, b"", {"ETag": etag})
            cache = "public, max-age=31536000, immutable" if meta["final"] else f"public, max-age={service.settings['cache_seconds_latest']}"
            self.send(200, body, {
                "Cache-Control": cache,
                "ETag": etag,
                "X-Answer-Store": meta["store"],
                "Server-Timing": f"compute;dur={meta['compute_ms']:.1f}",
            })

        def send(self, status: int, body: bytes, headers: dict):
            if body and "gzip" in self.headers.get("Accept-Encoding", ""):
                body = gzip.compress(body, compresslevel=6)
                headers = {**headers, "Content-Encoding": "gzip"}
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Vary", "Accept-Encoding")
            # A refusal repeats what was asked; the browser must read it as JSON and nothing else.
            self.send_header("X-Content-Type-Options", "nosniff")
            # The site is served from another origin; a plain GET needs no preflight.
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Expose-Headers", "Server-Timing, X-Answer-Store")
            self.send_header("Timing-Allow-Origin", "*")
            for k, v in headers.items():
                self.send_header(k, v)
            self.end_headers()
            if body:
                self.wfile.write(body)

        def log_message(self, format, *args):  # noqa: A002 (the standard library's name)
            print(f"{self.address_string()} {format % args}", flush=True)

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description="Local prototype of the query service. Listens on 127.0.0.1 only.")
    parser.add_argument("--data", type=Path, default=REPO / "public" / "data", help="a built public/data folder (default: public/data)")
    parser.add_argument("--port", type=int, default=4491)
    parser.add_argument("--store", type=Path, default=None, help="a folder to keep answers in across restarts (default: memory only)")
    args = parser.parse_args()
    started = time.perf_counter()
    service = Service(args.data, store=args.store)
    print(f"loaded snapshot {service.snapshot} in {(time.perf_counter() - started) * 1000:.0f} ms; public fields: {service.public}", flush=True)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_for(service))
    print(f"listening on http://127.0.0.1:{args.port}/v1/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
