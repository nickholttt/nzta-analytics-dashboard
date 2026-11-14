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
