"""ArcGIS REST access: discovery, metadata, grouped statistics and row pulls.

Everything that touches the network lives here, so the build can run from
saved responses and the tests never need the network.
"""

from __future__ import annotations

import gzip
import json
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from .errors import GuardrailError, SourceError

COUNT_STAT = [{"statisticType": "count", "onStatisticField": None, "outStatisticFieldName": "n"}]


@dataclass
class Service:
    item_id: str
    discovery: str
    service_name: str
    layer_url: str
    layer: dict
    warnings: list[str]


class Client:
    def __init__(self, source_cfg: dict):
        self.cfg = source_cfg

    def get(self, url: str, params: dict | None = None, raw: bool = False):
        query = urllib.parse.urlencode({**(params or {}), "f": "json"})
        full = f"{url}?{query}"
        last = None
        for attempt in range(self.cfg["retries"]):
            try:
                req = urllib.request.Request(full, headers={"Accept-Encoding": "gzip"})
                with urllib.request.urlopen(req, timeout=self.cfg["timeout_seconds"]) as resp:
                    data = resp.read()
                    if resp.headers.get("Content-Encoding") == "gzip":
                        data = gzip.decompress(data)
                body = json.loads(data)
                if isinstance(body, dict) and "error" in body:
                    raise SourceError(f"{url}: {body['error']}")
                return (body, data) if raw else body
            except Exception as exc:  # retry every transient failure, then give up loudly
                last = exc
                time.sleep(min(60, 2 ** attempt))
        raise SourceError(f"{url} failed after {self.cfg['retries']} attempts: {last}")

    # -- discovery -----------------------------------------------------------------

    def discover(self) -> Service:
        search = self.cfg["search"]
        warnings: list[str] = []
        item_id, discovery = None, "search"
        try:
            body = self.get(f"{self.cfg['portal']}/search", {"q": search["q"], "num": 50})
            matches = [
                r for r in body.get("results", [])
                if r.get("type") == search["type"] and r.get("title") == search["title"] and r.get("owner") == search["owner"]
            ]
            if len(matches) > 1:
                matches.sort(key=lambda r: r.get("modified", 0), reverse=True)
                warnings.append(
                    f"source discovery found {len(matches)} candidate items; using the most recently modified, "
                    f"{matches[0]['id']} ({matches[0].get('name')})"
                )
            if matches:
                item_id = matches[0]["id"]
        except SourceError as exc:
            warnings.append(f"source discovery search failed: {exc}")
        if item_id is None:
            item_id, discovery = self.cfg["fallback_item_id"], "fallback"
            warnings.append(
                f"SOURCE DISCOVERY FELL BACK to pinned item {item_id}. NZTA may have republished the register "
                "under a new item; check the portal before trusting this build."
            )
            print(f"WARNING: {warnings[-1]}", file=sys.stderr)

        item = self.get(f"{self.cfg['portal']}/content/items/{item_id}")
        service_url = item["url"].rstrip("/")
        service = self.get(service_url)
        parts = service.get("layers", []) + service.get("tables", [])
        if len(parts) != 1:
            raise GuardrailError("service_shape", f"{service_url} exposes {len(parts)} layers/tables; expected exactly 1")
        layer_url = f"{service_url}/{parts[0]['id']}"
        layer = self.get(layer_url)
        return Service(item_id, discovery, layer.get("name", ""), layer_url, layer, warnings)

    # -- queries -------------------------------------------------------------------

    def count(self, layer_url: str) -> int:
        return int(self.get(f"{layer_url}/query", {"where": "1=1", "returnCountOnly": "true"})["count"])

    def grouped_counts(self, layer_url: str, fields: list[str], count_field: str) -> list[dict]:
        stats = [{**COUNT_STAT[0], "onStatisticField": count_field}]
        rows, offset = [], 0
        while True:
            body = self.get(f"{layer_url}/query", {
                "where": "1=1",
                "groupByFieldsForStatistics": ",".join(fields),
                "outStatistics": json.dumps(stats),
                "orderByFields": ",".join(fields),
                "resultOffset": offset,
                "resultRecordCount": 2000,
            })
            page = [f["attributes"] for f in body.get("features", [])]
            rows.extend(page)
            if not body.get("exceededTransferLimit") and len(page) < 2000:
                return rows
            offset += len(page)

    def object_id_range(self, layer_url: str, oid: str) -> tuple[int, int]:
        stats = [
            {"statisticType": "min", "onStatisticField": oid, "outStatisticFieldName": "lo"},
            {"statisticType": "max", "onStatisticField": oid, "outStatisticFieldName": "hi"},
        ]
        attrs = self.get(f"{layer_url}/query", {"where": "1=1", "outStatistics": json.dumps(stats)})["features"][0]["attributes"]
        return int(attrs["lo"]), int(attrs["hi"])

    def pull_rows(self, layer_url: str, oid: str, out_fields: list[str], out_dir: Path) -> int:
        """Pull every row in OBJECTID ranges, saving each page's JSON gzipped. Returns rows saved."""
        out_dir.mkdir(parents=True, exist_ok=True)
        lo, hi = self.object_id_range(layer_url, oid)
        size = self.cfg["page_size"]
        ranges = [(start, min(start + size, hi)) for start in range(lo - 1, hi, size)]

        def fetch(bounds: tuple[int, int]) -> int:
            start, end = bounds
            body, data = self.get(f"{layer_url}/query", {
                "where": f"{oid} > {start} AND {oid} <= {end}",
                "outFields": ",".join(out_fields),
                "returnGeometry": "false",
                "resultType": self.cfg["result_type"],
                "resultRecordCount": end - start,
            }, raw=True)
            if body.get("exceededTransferLimit"):
                if end - start <= 1:
                    raise SourceError(f"transfer limit exceeded on a single-id range at {oid}={end}")
                mid = start + (end - start) // 2
                return fetch((start, mid)) + fetch((mid, end))
            n = len(body.get("features", []))
            if n:
                (out_dir / f"page_{start:010d}_{end:010d}.json.gz").write_bytes(gzip.compress(data))
            return n

        with ThreadPoolExecutor(self.cfg["concurrency"]) as pool:
            return sum(pool.map(fetch, ranges))
