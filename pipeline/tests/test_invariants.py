"""Design invariant #1: no domain value appears as a literal in any .py file.

Collects every value from the reference files' vocabulary columns and fails if one appears as a string
constant anywhere under pipeline/. Adding a brand, powertrain, country, region, segment or event must
never require a code change.
"""

from __future__ import annotations

import ast
from pathlib import Path

from pipeline import config, reference

PIPELINE = Path(__file__).resolve().parent.parent

VOCABULARY_COLUMNS = {
    "brand_registry.csv": ["make_canonical", "aliases", "parent_group", "owner_country", "heritage_country"],
    "powertrain_map.csv": ["nzta_motive_power", "powertrain", "powertrain_detail", "powertrain_group", "powertrain_group_label"],
    "segment_map.csv": ["vehicle_type", "body_type", "segment", "segment_group"],
    "tla_region.csv": ["tla", "region"],
    "import_status_map.csv": ["nzta_import_status", "import_status"],
    "vehicle_scope.csv": ["vehicle_type", "label", "scope_group", "trade_group"],
    "model_registry.csv": ["model_canonical", "aliases", "override_value", "match_motive_power", "match_import_status", "match_vehicle_type"],
    "mild_hybrid_models.csv": ["make", "models", "override_value", "match_motive_power", "match_import_status"],
    "events.csv": ["id", "title", "scope_values"],
    "sentinels.csv": ["raw_value"],
    "statsnz_series.csv": ["header", "series_id", "label", "group"],
    "nz_assembled_map.csv": ["nzta_nz_assembled", "label"],
    "class_map.csv": ["nzta_class", "label"],
    "transmission_map.csv": ["nzta_transmission", "group", "label"],
    "vehicle_usage_map.csv": ["nzta_vehicle_usage", "label"],
    "buyer_type_map.csv": ["nzta_owner_type", "nzta_vehicle_usage", "buyer_type"],
    # The class words of model_segment.csv (and the rule file's model_class column, which repeats them) are left out: the file's own test
    # (test_model_segment.py) states its three allowed words as the file's schema. No code reads them: the rule file names them.
    "market_type_map.csv": ["vehicle_types", "body_types", "nzta_classes", "market_type"],
    "model_segment.csv": ["models"],
}


def domain_values() -> set[str]:
    cfg = config.load()
    values: set[str] = set()
    for file, columns in VOCABULARY_COLUMNS.items():
        for row in reference.read(cfg.reference(file)):
            for column in columns:
                values.update(v.strip() for v in row[column].split("|"))
    return {v for v in values if len(v) >= 3 and not v.replace("-", "").isdigit() and not (v.startswith("<") and v.endswith(">"))}


def string_constants(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    return {node.value.strip() for node in ast.walk(tree) if isinstance(node, ast.Constant) and isinstance(node.value, str)}


def test_no_domain_value_is_hardcoded_in_python():
    vocabulary = domain_values()
    assert len(vocabulary) > 300, "vocabulary unexpectedly small; the scan would prove nothing"
    offenders = {}
    for path in sorted(PIPELINE.rglob("*.py")):
        found = sorted(string_constants(path) & vocabulary)
        if found:
            offenders[str(path.relative_to(PIPELINE))] = found
    assert not offenders, f"domain values hardcoded in code: {offenders}"
