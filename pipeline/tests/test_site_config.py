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
    # The one-line form of a field's note (D-137).
    found.extend(_canvas_templates())
    found.extend(_starter_templates())
    found.extend(_chart_sentence_templates())
    found.extend(_comparison_templates())
    for dimension in dimensions["dimensions"]:
        if "public_line" in dimension:
            found.append(("line", f"dimension {dimension['id']} public_line", dimension["public_line"]))
    for dataset in dimensions["datasets"]:
        for key, text in (dataset.get("words") or {}).items():
            if not key.startswith("$"):
                found.append(("words", f"dataset {dataset['id']} words.{key}", text))
        for key in ("source_note", "not_built_message", "basis_note"):
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


def _canvas_templates() -> list[tuple[str, str, str]]:
    """The canvas's words (config/canvas.json, D-147): its interface words and the reasons it gives, and the names of its
    chart types, measures, kinds, groups and time field. Its definitions are not among them: a definition says what a field
    holds and may name it, as the data map's does."""
    canvas = _json("config/canvas.json")
    found = [("canvas", f"canvas.words.{key}", text) for key, text in canvas["words"].items() if not key.startswith("$")]
    for block in ("measures", "measure_kinds", "kinds"):
        found += [("canvas", f"canvas.{block}.{key}", text) for key, text in canvas[block].items() if not key.startswith("$")]
    for entry in [*canvas["chart_types"], canvas["table"]]:
        found += [("canvas", f"canvas.chart_types.{entry['id']}.{key}", entry[key]) for key in ("label", "help")]
    found += [("canvas", f"canvas.groups.{group['id']}.label", group["label"]) for group in canvas["groups"]]
    found.append(("canvas", "canvas.time_field.label", canvas["time_field"]["label"]))
    return found


def _starter_templates() -> list[tuple[str, str, str]]:
    """The starter canvases' words (config/starter_canvases.json): each starter's title and description, held to the same rules as the
    canvas's words. The charts of a starter are questions in config's own terms (ids and the values a condition keeps), not words."""
    starters = _json("config/starter_canvases.json")["starters"]
    return [("canvas", f"starters.{starter['id']}.{key}", starter[key]) for starter in starters for key in ("title", "description")]


# What in config/comparison.json is not a template: the kinds of figure the public section lists, which are ids the build writes.
_COMPARISON_NOT_A_TEMPLATE = re.compile(r"^public_kinds\[\d+\]$")


def _comparison_templates() -> list[tuple[str, str, str]]:
    """The words of "How our figures compare" on the Differences page (config/comparison.json, D-150): every text in the file but
    the kinds of figure it lists, so a word added later is linted without being named here."""
    return [("comparison", f"comparison.{path}", text) for path, text in _strings(_json("config/comparison.json"))
            if not _COMPARISON_NOT_A_TEMPLATE.match(path)]


def _chart_sentence_templates() -> list[tuple[str, str, str]]:
    """The sentence under every chart (config/narrative/chart_sentences.json, work order 3 lane A): every text in the file is a template."""
    return [("chart_sentence", f"chart_sentences.{key}", text) for key, text in _json("config/narrative/chart_sentences.json").items() if not key.startswith("$")]


# What in config/canvas.json is not a template: the ids the code reads (of the page, a chart, a group, a chart type, a field, a
# data map group, a kind) and the definitions, which say what a field holds and may name it.
_CANVAS_NOT_A_TEMPLATE = re.compile(
    r"^(id|chart_prefix"
    r"|time_field\.(id|group|kind|definition|map_fields\[\d+\])"
    r"|groups\[\d+\]\.(id|map_groups\[\d+\]|kinds\[\d+\])"
    r"|group_of\..+|definitions\..+"
    r"|chart_types\[\d+\]\.id|table\.id)$"
)


def _strings(node, path: str = ""):
    """Every text in a config document with where it sits, comments (keys that start with $) left out."""
    if isinstance(node, str):
        yield path, node
    elif isinstance(node, dict):
        for key, value in node.items():
            if not key.startswith("$"):
                yield from _strings(value, f"{path}.{key}" if path else key)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from _strings(value, f"{path}[{index}]")


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


def test_the_lint_reads_every_interface_word_and_every_one_line_note():
    """The one-line form of a field's note and the canvas's words are held to the same rules as the rest."""
    found = _templates()
    lines = {where for kind, where, _ in found if kind == "line"}
    noted = {f"dimension {d['id']} public_line" for d in _json("config/dimensions.json")["dimensions"] if "public_line" in d}
    assert noted and lines == noted, "a one-line note in config/dimensions.json is not linted"
    # The canvas's words (config/canvas.json): every text in the file is linted unless it is an id or a definition, so a block or
    # a key added to it later is linted too, or is named here as one of those.
    linted = {text for kind, _, text in found if kind == "canvas"}
    texts = [(path, text) for path, text in _strings(_json("config/canvas.json")) if not _CANVAS_NOT_A_TEMPLATE.match(path)]
    assert len(texts) >= 50, "the canvas's words have gone missing: this test would pass without checking anything"
    for path, text in texts:
        assert text in linted, f"config/canvas.json {path} is a text the lint does not read"
    assert all(not where.startswith("canvas.definitions") for kind, where, _ in found if kind == "canvas"), "a field's definition is not a template"


def test_the_lint_reads_every_sentence_under_a_chart():
    """Every text in config/narrative/chart_sentences.json is linted, so a sentence added to it later is too. Each comparison template has
    its sentence without the comparison, which is what a chart says where it cannot compare."""
    linted = {where for kind, where, _ in _templates() if kind == "chart_sentence"}
    keys = {key for key, text in _json("config/narrative/chart_sentences.json").items() if not key.startswith("$")}
    assert len(keys) >= 20 and linted == {f"chart_sentences.{key}" for key in keys}, "a sentence under a chart is not linted"
    for family in {key.rsplit("_", 1)[0] for key in keys if key.endswith(("_up", "_down", "_same"))}:
        assert {f"{family}_up", f"{family}_down", f"{family}_same", f"{family}_alone"} <= keys, f"{family} has a comparison with no sentence for it, or none without"


def test_the_lint_reads_every_word_of_the_starter_canvases():
    """Every text in config/starter_canvases.json is linted unless it is an id, a chart's question in config's terms, or a setting, so a
    word added to a starter later is linted too, or is named here as one of those."""
    linted = {text for kind, where, text in _templates() if where.startswith("starters.")}
    words = re.compile(r"^starters\[\d+\]\.(title|description)$")
    not_words = re.compile(r"^(id|starters\[\d+\]\.(id|charts\[\d+\]\..+))$")
    texts = [(path, text) for path, text in _strings(_json("config/starter_canvases.json"))]
    assert len(texts) >= 6 and linted, "the starters' words have gone missing: this test would pass without checking anything"
    for path, text in texts:
        assert words.match(path) or not_words.match(path), f"config/starter_canvases.json {path} is a text this test does not place"
        if words.match(path):
            assert text in linted, f"config/starter_canvases.json {path} is a text the lint does not read"


def test_the_lint_reads_the_words_of_the_comparison_with_published_figures():
    linted = [where for kind, where, _ in _templates() if kind == "comparison"]
    assert len(linted) >= 20, "the comparison's words have gone missing: this test would pass without checking anything"
    assert not any(where.startswith("comparison.public_kinds") for where in linted), "a kind of figure is an id, not a template"


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


def test_no_ratio_divides_datasets_that_are_never_charted_together():
    datasets = {d["id"]: d for d in _json("config/dimensions.json")["datasets"]}
    never = {frozenset((d["id"], other)) for d in datasets.values() for other in d.get("never_charted_with", [])}
    assert never, "no dataset is marked never_charted_with: this test would pass without checking anything"
    for pair in never:
        assert len(pair) == 2 and pair <= set(datasets), f"never_charted_with names a dataset config does not define, or itself: {sorted(pair)}"
    ratios = [m for m in _json("config/measures.json")["derived_measures"] if "numerator_dataset" in m]
    assert ratios, "no ratio measure: this test would pass without checking anything"
    for m in ratios:
        assert frozenset((m["numerator_dataset"], m["denominator_dataset"])) not in never, f"{m['id']}: it divides datasets config says are never charted together"


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
    "powertrain_map.csv": ["powertrain", "powertrain_detail", "powertrain_group", "powertrain_group_label"],
    "segment_map.csv": ["segment", "segment_group"],
    "vehicle_scope.csv": ["label", "trade_group"],
    "import_status_map.csv": ["import_status"],
    "tla_region.csv": ["region"],
    "statsnz_series.csv": ["label"],
    "nz_assembled_map.csv": ["label"],
    "class_map.csv": ["label"],
    "transmission_map.csv": ["group"],
    "vehicle_usage_map.csv": ["label"],
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
    return {n for n in names if n and n.lower() not in ordinary}


def test_there_are_domain_names_to_check_templates_against():
    names = _domain_names()
    mild = _json("config/pipeline.json")["hybrid_classification"]["mild_powertrain"]
    assert len(names) > 100 and mild in names, "the reference names did not load: this test would pass without checking anything"


def _names_in(text: str) -> list[str]:
    """Every domain name a template text holds: whole words, ignoring case, with a simple plural."""
    bare = PLACEHOLDER.sub(" ", text)
    return sorted(n for n in _domain_names() if re.search(rf"(?<![\w-]){re.escape(n)}(?:s|es)?(?![\w-])", bare, re.IGNORECASE))


def test_the_lint_catches_a_short_name_a_plural_and_a_different_case():
    short = sorted((n for n in _domain_names() if len(n) <= 3), key=len)
    assert len(short) >= 3, "no short names loaded: this test would pass without checking anything"
    for name in short[:3]:
        for text in (f"The share of {name}s rose", f"{name} and others", f"sold by {name.lower()}."):
            assert name in _names_in(text), f"{text} was not caught for the name {name}"
    assert _names_in("The share of vehicles registered in the month") == []


@pytest.mark.parametrize("kind,where,text", _templates(), ids=_id)
def test_a_template_names_no_dimension_value_and_no_reference_label(kind, where, text):
    found = _names_in(text)
    assert not found, f"{where}: names {found}, values or labels that live in config and the reference files; fill them in as placeholders"
