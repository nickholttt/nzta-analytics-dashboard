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

    def source_field(self, logical: str) -> str:
        return self.pipeline["fields"][logical]


def load(root: Path = ROOT, overrides: dict | None = None) -> Config:
    pipeline = json.loads((root / "config" / "pipeline.json").read_text(encoding="utf-8"))
    dimensions = json.loads((root / pipeline["paths"]["dimensions"]).read_text(encoding="utf-8"))
    return Config(root, pipeline, dimensions, overrides or {})
