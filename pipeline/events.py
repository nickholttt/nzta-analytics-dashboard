"""events.json: verified events only, each scope value resolved against the vocabulary its dimension produces."""

from __future__ import annotations

import re

from . import reference
from .contract import MODEL_KEY_SEPARATOR
from .normalise import lit
from .reference import quote

# The schema table in docs/EVENTS_LAYER.md is the only statement of each column's rules, so they are read from it.
ENUM_ROW = re.compile(r"^\| `(?P<column>[a-z_]+)` \| enum \|(?P<values>[^|]*)\|", re.M)
TITLE_ROW = re.compile(r"^\| `title` \|[^|]*\|\s*≤(?P<max>\d+) chars", re.M)


def schema_enums(cfg) -> dict[str, set[str]]:
    """Every enum column in the schema table, with its values."""
    text = cfg.path("events_doc").read_text(encoding="utf-8")
    return {m.group("column"): set(re.findall(r"`([a-z_]+)`", m.group("values"))) for m in ENUM_ROW.finditer(text)}


def title_limit(cfg) -> int | None:
    match = TITLE_ROW.search(cfg.path("events_doc").read_text(encoding="utf-8"))
    return int(match.group("max")) if match else None


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
    enums, title_max = schema_enums(cfg), title_limit(cfg)
    # A table row reworded so it no longer parses as an enum would otherwise drop its check without a word.
    unread = [c for c in e["enum_columns"] if c not in enums]
    if unread:
        return [], [f"could not find the enum table rows for {unread} in {doc}"]
    if title_max is None:
        return [], [f"could not find the title length in the table row for title in {doc}"]
    enum = enums["scope"]
    rows = reference.read(cfg.reference(e["file"]))
    problems: list[str] = []
    try:
        reference.require_unique([r["id"] for r in rows], e["file"])
    except Exception as exc:
        problems.append(str(exc))
    hidden = {e["verified_column"], *e["unpublished_columns"]}
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
        # A mechanism outside the enum would also lose the measurement warning on the chart (invariant 7).
        for column, allowed in sorted(enums.items()):
            if column != "scope" and row.get(column) not in allowed:
                problems.append(f"{event_id}: {column} {row.get(column)!r} is not in the enum in {doc.name}")
        if len(row["title"]) > title_max:
            problems.append(f"{event_id}: title is {len(row['title'])} characters, over the {title_max} allowed in {doc.name}")
        if not row["source_url"]:
            problems.append(f"{event_id}: verified without a source_url")
        if not row["date_start"]:
            problems.append(f"{event_id}: verified without a date_start")
        record = {k: (v if v != "" else None) for k, v in row.items() if k not in hidden}
        record["scope_values"] = values
        out.append(record)
    out.sort(key=lambda r: (r["date_start"] or "", r["id"]))
    return out, problems
