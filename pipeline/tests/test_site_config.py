"""Config the site reads must agree with the cube contract the pipeline writes.

`config/dimensions.json` gives a compound dimension a `key_separator` so the site can show its values as words. The
pipeline does not read that key: it joins the parts with the contract's constant. If the two ever differed, the site
would stop splitting the values and nothing in the pipeline would notice, so this test holds them equal.
"""

from __future__ import annotations

from pipeline import config
from pipeline.contract import MODEL_KEY_SEPARATOR

# The derive kind whose values the pipeline writes as two parts joined by the contract's separator (pipeline/derive.py).
COMPOUND_KIND = "model"


def test_a_compound_dimension_declares_the_separator_the_pipeline_writes():
    dimensions = config.load().dimensions["dimensions"]
    compound = [d for d in dimensions if d.get("derive", {}).get("kind") == COMPOUND_KIND]
    assert compound, "no dimension with a compound value: this test would pass without checking anything"
    for dim in compound:
        assert dim.get("key_separator") == MODEL_KEY_SEPARATOR, (
            f"{dim['id']}: key_separator in config/dimensions.json must equal the cube contract's "
            f"MODEL_KEY_SEPARATOR, which is what the pipeline joins the parts with"
        )
    declared = [d["id"] for d in dimensions if "key_separator" in d and d not in compound]
    assert not declared, f"key_separator is declared on dimensions whose values are not compound: {declared}"


# ---- The sentences the site writes about the data (CLAUDE.md invariant 8) ----
#
# The templates in config are words, written once. Each may use only the placeholders the code fills, names no figure or
# year, and carries no causal or judgement word. The lists they are held to are in config/narrative/rules.json.

import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
# The pattern src/lib/sentences.ts fills: {dotted.path} with an optional |filter.
PLACEHOLDER = re.compile(r"\{([a-z_]+(?:\.[A-Za-z0-9_]+)*)(\|[a-z]+)?\}")


def _json(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def _templates() -> list[tuple[str, str, str]]:
    """(kind, where, text) for every template the sentence work added to config."""
    presets, dimensions, measures = _json("config/presets.json"), _json("config/dimensions.json"), _json("config/measures.json")
    found: list[tuple[str, str, str]] = []
    for group in presets["groups"]:
        for preset in group["presets"]:
            for key, text in (preset.get("answer") or {}).items():
                if not key.startswith("$"):
                    found.append(("answer", f"preset {preset['id']} answer.{key}", text))
    for key, text in presets["defaults"]["phrases"].items():
        if not key.startswith("$"):
            found.append(("phrases", f"defaults.phrases.{key}", text))
    for key, text in presets["builder"]["notices"].items():
        if not key.startswith("$"):
            found.append(("notices", f"builder.notices.{key}", text))
    for dataset in dimensions["datasets"]:
        for key, text in (dataset.get("words") or {}).items():
            if not key.startswith("$"):
                found.append(("words", f"dataset {dataset['id']} words.{key}", text))
        for key in ("source_note", "not_built_message"):
            if key in dataset:
                found.append(("note", f"dataset {dataset['id']} {key}", dataset[key]))
    for derived in measures["derived_measures"]:
        if "numerator_dataset" not in derived:
            continue
        for key in ("note_template", "unit_note", "table_label"):
            if key in derived:
                found.append(("note" if key == "note_template" else key, f"derived {derived['id']} {key}", derived[key]))
        if "caveat" in derived:
            found.append(("caveat", f"derived {derived['id']} caveat.text", derived["caveat"]["text"]))
    return found


def _allowed(rules: dict, kind: str, path: str) -> bool:
    for allowed in rules["placeholders"][kind]:
        if allowed.endswith(".*") and path.startswith(allowed[:-1]):
            return True
        if path == allowed:
            return True
    return False


def _id(value):
    return value if isinstance(value, str) and len(value) < 70 else None


def test_there_are_templates_to_check():
    assert len(_templates()) >= 10, "the sentence config has gone missing: this test would pass without checking anything"


@pytest.mark.parametrize("kind,where,text", _templates(), ids=_id)
def test_a_template_uses_only_what_the_code_fills(kind, where, text):
    rules = _json("config/narrative/rules.json")
    for path, filter_ in PLACEHOLDER.findall(text):
        assert _allowed(rules, kind, path), f"{where}: {{{path}}} is not a placeholder the code fills for a {kind} template"
        assert filter_ == "" or filter_[1:] in rules["filters"], f"{where}: |{filter_[1:]} is not a filter the code applies"
    rest = PLACEHOLDER.sub("", text)
    assert "{" not in rest and "}" not in rest, f"{where}: a brace that is not a placeholder"


@pytest.mark.parametrize("kind,where,text", _templates(), ids=_id)
def test_a_template_names_no_figure_and_no_cause(kind, where, text):
    rules = _json("config/narrative/rules.json")
    bare = PLACEHOLDER.sub(" ", text)
    assert not re.search(r"\d", bare), f"{where}: a template holds no digit; a figure comes from the data"
    for word in rules["banned_words"]:
        assert not re.search(rf"\b{re.escape(word)}\b", bare, re.IGNORECASE), f"{where}: '{word}' is a causal or judgement word"


def test_every_dataset_the_builder_offers_is_defined():
    ids = {d["id"] for d in _json("config/dimensions.json")["datasets"]}
    builder = _json("config/presets.json")["builder"]
    offered = builder["datasets"]
    assert offered and set(offered) <= ids, f"builder.datasets names a dataset config/dimensions.json does not define: {set(offered) - ids}"
    assert builder["dataset"] == offered[0], "the first dataset offered is the default"


def test_a_ratio_measure_divides_one_defined_dataset_by_another():
    ids = {d["id"] for d in _json("config/dimensions.json")["datasets"]}
    ratios = [m for m in _json("config/measures.json")["derived_measures"] if "numerator_dataset" in m or "denominator_dataset" in m]
    assert ratios, "no ratio measure: this test would pass without checking anything"
    for m in ratios:
        assert m["numerator_dataset"] in ids and m["denominator_dataset"] in ids, f"{m['id']}: a dataset it names is not defined"
        assert m["numerator_dataset"] != m["denominator_dataset"], f"{m['id']}: it divides a dataset by itself"


def test_a_ratio_measure_names_only_dimensions_config_defines():
    dimensions = {d["id"] for d in _json("config/dimensions.json")["dimensions"]}
    ratios = [m for m in _json("config/measures.json")["derived_measures"] if "numerator_dataset" in m]
    named = [m for m in ratios if "numerator_dimension" in m or "numerator_narrowed_to" in m]
    assert named, "no ratio measure names its numerator's own breakdown: this test would pass without checking anything"
    for m in named:
        used = [m.get("numerator_dimension"), (m.get("numerator_narrowed_to") or {}).get("dimension")]
        for d in filter(None, used):
            assert d in dimensions, f"{m['id']}: {d} is not a dimension in config/dimensions.json"
        if "numerator_narrowed_to" in m:
            assert m["numerator_narrowed_to"].get("values"), f"{m['id']}: numerator_narrowed_to names no values"
            assert "numerator_dimension" in m, f"{m['id']}: a narrowed numerator needs the breakdown it is divided on"


def test_a_preset_with_an_answer_names_a_dataset_and_a_measure_that_exist():
    datasets = {d["id"] for d in _json("config/dimensions.json")["datasets"]}
    measures = {m["id"] for m in _json("config/measures.json")["measures"]}
    answered = [p for g in _json("config/presets.json")["groups"] for p in g["presets"] if "answer" in p]
    assert answered, "no preset has an answer: this test would pass without checking anything"
    for preset in answered:
        assert preset.get("dataset") in datasets, f"{preset['id']}: dataset {preset.get('dataset')} is not defined"
        assert preset.get("measure") in measures, f"{preset['id']}: measure {preset.get('measure')} is not defined"
        assert {"up", "down", "same", "alone"} <= set(preset["answer"]), f"{preset['id']}: an answer needs up, down, same and alone"


def test_the_measure_that_sets_the_year_change_floor_exists():
    defaults = _json("config/presets.json")["defaults"]
    measures = {m["id"]: m for m in _json("config/measures.json")["measures"]}
    measure = measures.get(defaults["year_change_measure"])
    assert measure and measure.get("guards", {}).get("min_denominator"), "year_change_measure must name a measure with a min_denominator"


# ---- A template names no value of a dimension and no label of a reference file (CLAUDE.md invariant 1 and 8) ----
#
# Words about the data are written once, in config, and name no domain value: the value comes in as a placeholder. The lint
# above checks placeholders, digits and causal words, none of which catches a template that says "hybrids" or a brand. The
# names come from the reference files and the bands in config/dimensions.json, so a value added there is caught without an edit
# here. config/narrative/rules.json lists, under ordinary_words, the few names that are also plain words in a sentence.

import csv

# (reference file, columns whose values the site shows a visitor as a value or a label)
_NAME_COLUMNS = {
    "brand_registry.csv": ["make_canonical", "parent_group", "owner_country", "heritage_country", "brand_region"],
    "powertrain_map.csv": ["powertrain", "powertrain_detail", "powertrain_group"],
    "segment_map.csv": ["segment", "segment_group"],
    "vehicle_scope.csv": ["label"],
    "import_status_map.csv": ["import_status"],
    "tla_region.csv": ["region"],
    "statsnz_series.csv": ["label"],
}


def _domain_names() -> set[str]:
    names: set[str] = set()
    for filename, columns in _NAME_COLUMNS.items():
        with (ROOT / "data" / "reference" / filename).open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                names.update((row.get(c) or "").strip() for c in columns)
    for dimension in _json("config/dimensions.json")["dimensions"]:
        names.update(band["label"] for band in dimension.get("bands", []))
    ordinary = {w.lower() for w in _json("config/narrative/rules.json").get("ordinary_words", [])}
    return {n for n in names if len(n) >= 4 and n.lower() not in ordinary}


def test_there_are_domain_names_to_check_templates_against():
    names = _domain_names()
    assert len(names) > 100 and "Mild hybrid" in names, "the reference names did not load: this test would pass without checking anything"


@pytest.mark.parametrize("kind,where,text", _templates(), ids=_id)
def test_a_template_names_no_dimension_value_and_no_reference_label(kind, where, text):
    bare = PLACEHOLDER.sub(" ", text)
    for name in _domain_names():
        assert not re.search(rf"(?<![\w-]){re.escape(name)}(?:s|es)?(?![\w-])", bare, re.IGNORECASE), (
            f"{where}: names '{name}', a value or label that lives in config and the reference files; fill it in as a placeholder"
        )
