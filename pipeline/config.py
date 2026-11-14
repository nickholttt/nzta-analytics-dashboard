"""Loads config/pipeline.json and config/dimensions.json and resolves paths."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


@dataclass
class Config:
    root: Path
    pipeline: dict
    dimensions: dict
    overrides: dict = field(default_factory=dict)

    def path(self, key: str) -> Path:
        if key in self.overrides:
            return Path(self.overrides[key])
        if key == "snapshots":
            return self.root / self.pipeline["snapshot_archive"]["dir"]
        return self.root / self.pipeline["paths"][key]

    def reference(self, name: str) -> Path:
        if "reference_dir" in self.overrides:
            return Path(self.overrides["reference_dir"]) / name
        return self.root / self.pipeline["reference_dir"] / name

    def supplied(self, source_id: str) -> dict:
        return self.pipeline["supplied"][source_id]

    def supplied_store(self, source_id: str) -> Path:
        """The directory of a supplied source's store. An override names the folder that holds one store per source id."""
        if "supplied" in self.overrides:
            return Path(self.overrides["supplied"]) / source_id
        return self.root / self.supplied(source_id)["store"]

    def source_field(self, logical: str) -> str:
        return self.pipeline["fields"][logical]


def load(root: Path = ROOT, overrides: dict | None = None) -> Config:
    pipeline = json.loads((root / "config" / "pipeline.json").read_text(encoding="utf-8"))
    dimensions = json.loads((root / pipeline["paths"]["dimensions"]).read_text(encoding="utf-8"))
    return Config(root, pipeline, dimensions, overrides or {})
