"""pipeline/expected_schema.json: written once from a live read, asserted on every run."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .errors import GuardrailError

ESRI_TO_DUCKDB = {
    "esriFieldTypeOID": "BIGINT",
    "esriFieldTypeInteger": "BIGINT",
    "esriFieldTypeSmallInteger": "BIGINT",
    "esriFieldTypeBigInteger": "BIGINT",
    "esriFieldTypeDouble": "DOUBLE",
    "esriFieldTypeSingle": "DOUBLE",
    "esriFieldTypeString": "VARCHAR",
    "esriFieldTypeDate": "BIGINT",
    "esriFieldTypeGUID": "VARCHAR",
    "esriFieldTypeGlobalID": "VARCHAR",
}


def fields_of(layer: dict) -> list[dict]:
    return [{"name": f["name"], "type": f["type"]} for f in layer.get("fields", [])]


def write_expected(path: Path, service) -> dict:
    doc = {
        "$comment": "Captured from the live service by `python -m pipeline init-schema`. Every run asserts the source still "
                    "has each of these columns with the same type. Regenerate only as a deliberate, reviewed change.",
        "captured_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "captured_from": {"item_id": service.item_id, "service_name": service.service_name, "layer_url": service.layer_url},
        "fields": fields_of(service.layer),
    }
    path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    return doc


def check(expected: dict, layer: dict, bound_fields: list[str]) -> list[str]:
    """Abort on a missing or retyped expected column. Return warnings for new columns."""
    live = {f["name"]: f["type"] for f in fields_of(layer)}
    want = {f["name"]: f["type"] for f in expected["fields"]}
    unbound = sorted(set(bound_fields) - set(want))
    if unbound:
        raise GuardrailError("schema", f"config/pipeline.json binds fields absent from expected_schema.json: {unbound}")
    problems = [f"column {n} is missing from the source" for n in want if n not in live]
    problems += [f"column {n} changed type from {t} to {live[n]}" for n, t in want.items() if n in live and live[n] != t]
    if problems:
        raise GuardrailError("schema", "; ".join(problems))
    extra = sorted(set(live) - set(want))
    return [f"source has columns not in expected_schema.json: {', '.join(extra)}"] if extra else []


def pull_types(expected: dict, names: list[str]) -> dict[str, str]:
    by_name = {f["name"]: f["type"] for f in expected["fields"]}
    types = {}
    for name in names:
        esri = by_name.get(name)
        if esri not in ESRI_TO_DUCKDB:
            raise GuardrailError("schema", f"field {name} has unsupported or unknown type {esri!r}")
        types[name] = ESRI_TO_DUCKDB[esri]
    return types
