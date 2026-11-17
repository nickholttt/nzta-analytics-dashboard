// Which breakdowns sit under which, read from the data map (config/data_map.json, relations.rolls_up_to) and the dimensions config defines.
// A field that rolls up to another has each of its values under one value of the other, so a grid of the two would show the same split twice
// (D-114 point 8, D-122). Pure, with no imports, and no field named: the map says which, and a dimension stands for a map field when it is
// that field or is read from it alone.
export type MapField = { name: string; bound?: string | null; relations: { rolls_up_to: { to: string }[] } };
export type MapDimension = { id: string; derive: { kind: string; field?: string } };

// The dimensions a map field stands for: the one with its bound name, and any that is a lookup, a copy or a banding of that field alone. A
// dimension read from several fields (a segment from type, body and weight) is not that field, so a roll-up of the field does not carry to it.
export const standingFor = (field: MapField, dimensions: readonly MapDimension[]): string[] =>
  field.bound ? dimensions.filter((d) => d.id === field.bound || (d.derive.field === field.bound && ["raw", "lookup", "band"].includes(d.derive.kind))).map((d) => d.id) : [];

// For each dimension, the dimensions it rolls up to, through any number of steps (a model under its brand under its group).
export function rollUps(map: readonly MapField[], dimensions: readonly MapDimension[]): Map<string, Set<string>> {
  const direct = new Map<string, Set<string>>();
  for (const field of map) {
    for (const { to } of field.relations.rolls_up_to) {
      // The target is another field of the map, by its name, or a dimension that is not a field of its own, by its id.
      const named = map.find((f) => f.name === to);
      const targets = named ? standingFor(named, dimensions) : dimensions.filter((d) => d.id === to).map((d) => d.id);
      for (const from of standingFor(field, dimensions)) {
        for (const target of targets) if (target !== from) direct.set(from, (direct.get(from) ?? new Set()).add(target));
      }
    }
  }
  const closed = new Map<string, Set<string>>();
  const reach = (id: string, seen: Set<string>): Set<string> => {
    const out = new Set<string>();
    for (const next of direct.get(id) ?? []) {
      if (seen.has(next)) continue;
      out.add(next);
      for (const further of reach(next, new Set([...seen, next]))) out.add(further);
    }
    return out;
  };
  for (const id of direct.keys()) closed.set(id, reach(id, new Set([id])));
  return closed;
}

// Whether either of the two rolls up to the other.
export const nested = (ups: Map<string, Set<string>>, a: string, b: string): boolean => Boolean(ups.get(a)?.has(b) || ups.get(b)?.has(a));
