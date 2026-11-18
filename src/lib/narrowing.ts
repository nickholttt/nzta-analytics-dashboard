// Fields the register records for only a kind of vehicle (config/data_map.json, `recorded_for`), and the condition that keeps that kind. A
// question that breaks the vehicles down by such a field starts with the condition already applied, so the answer is about the vehicles the
// field describes and not mostly a gap; the visitor can remove it (D-132). Which class of vehicle is kept by which condition is config
// (config/presets.json, builder.narrowings): a class with no entry there narrows nothing. Pure, with no imports of data or config, and no field,
// dimension or value named: the map says which fields, the config says which condition.
import { standingFor } from "./nesting";
import type { MapDimension, MapField } from "./nesting";

// What keeps a class of vehicle: the dimension and the value of it, and the words for the vehicles it keeps (a phrase in config, filled into a
// sentence).
export type NarrowingRule = { dimension: string; value: string; kind: string };
export type Narrowing = NarrowingRule & { class: string };

export type RecordedField = MapField & { recorded_for?: string[] };

// The conditions the fields behind a dimension call for: one per class the map says the field is recorded for and the config can express.
export function narrowingsOf(id: string, map: readonly RecordedField[], dimensions: readonly MapDimension[], rules: Record<string, NarrowingRule>): Narrowing[] {
  const found: Narrowing[] = [];
  for (const field of map) {
    if (!standingFor(field, dimensions).includes(id)) continue;
    for (const cls of field.recorded_for ?? []) {
      const rule = rules[cls];
      if (rule && !found.some((n) => n.dimension === rule.dimension && n.value === rule.value)) found.push({ class: cls, ...rule });
    }
  }
  return found;
}
