"""events.json: verified events only, each scope value resolved against the vocabulary its dimension produces."""

from __future__ import annotations

import re

from . import reference
from .contract import MODEL_KEY_SEPARATOR
from .normalise import lit
from .reference import quote

ENUM_LINE = re.compile(r"^\| `scope` \| enum \|(?P<values>[^|]*)\|", re.M)


def scope_enum(cfg) -> set[str] | None:
    match = ENUM_LINE.search(cfg.path("events_doc").read_text(encoding="utf-8"))
    return set(re.findall(r"`([a-z_]+)`", match.group("values"))) if match else None


def vocabularies(con, cfg, snapshot_year: int) -> dict[str, set[str]]:
    """Every dimension's output vocabulary, whether or not it applies to a dataset built this run."""
    b = cfg.pipeline["brand"]
    vocab: dict[str, set[str]] = {}
    for dim in cfg.dimensions["dimensions"]:
        spec = dim.get("derive")
        if spec is None:
            continue
        kind = spec["kind"]
        if kind in ("lookup", "range_lookup"):
            path = cfg.reference(spec["reference"])
            vocab[dim["id"]] = {r[spec["value"]] for r in reference.read(path)} if path.exists() else set()
        elif kind == "brand":
            vocab[dim["id"]] = {r[spec["value"]] for r in reference.read(cfg.reference(b["registry"]))}
        elif kind == "band":
            vocab[dim["id"]] = {band["label"] for band in dim["bands"]}
        elif kind == "raw":
            f = quote(spec["field"])
            vocab[dim["id"]] = {str(v) for (v,) in con.execute(
                f"SELECT DISTINCT {f} FROM rows WHERE in_scope AND {f} IS NOT NULL").fetchall()}
        elif kind == "model":
            vocab[dim["id"]] = {v for (v,) in con.execute(
                f"SELECT DISTINCT coalesce(make_final, {quote(b['make_field'])}) || {lit(MODEL_KEY_SEPARATOR)} || model_final "
                f"FROM rows WHERE in_scope AND model_final IS NOT NULL AND {quote(b['make_field'])} IS NOT NULL").fetchall()}
    return vocab


def build(cfg, vocab: dict[str, set[str]]) -> tuple[list[dict], list[str]]:
    e = cfg.pipeline["events"]
    doc = cfg.path("events_doc")
    enum = scope_enum(cfg)
    if enum is None:
        return [], [f"could not find the scope enum table row in {doc}"]
    rows = reference.read(cfg.reference(e["file"]))
    problems: list[str] = []
    try:
        reference.require_unique([r["id"] for r in rows], e["file"])
    except Exception as exc:
        problems.append(str(exc))
    out = []
    for row in rows:
        if row[e["verified_column"]] != cfg.pipeline["boolean_true"]:
            continue
        event_id, scope = row["id"], row["scope"]
        values = reference.split(row["scope_values"], e["values_separator"])
        if scope not in enum:
            problems.append(f"{event_id}: scope {scope!r} is not in the enum in {doc.name}")
        elif scope in e["scope_without_values"]:
            if values:
                problems.append(f"{event_id}: scope {scope!r} takes no values but lists {values}")
        elif values:
            dim_id = e["scope_dimension_aliases"].get(scope, scope)
            if dim_id not in vocab:
                problems.append(f"{event_id}: scope {scope!r} has no dimension to resolve {values} against")
            else:
                unresolved = [v for v in values if v not in vocab[dim_id]]
                if unresolved:
                    problems.append(f"{event_id}: {scope} values do not resolve: {unresolved}")
        if not row["source_url"]:
            problems.append(f"{event_id}: verified without a source_url")
        if not row["date_start"]:
            problems.append(f"{event_id}: verified without a date_start")
        record = {k: (v if v != "" else None) for k, v in row.items() if k != e["verified_column"]}
        record["scope_values"] = values
        out.append(record)
    out.sort(key=lambda r: (r["date_start"] or "", r["id"]))
    return out, problems
