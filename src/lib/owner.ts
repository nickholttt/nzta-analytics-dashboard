// Which dimensions are made from a field that describes the owner, read from the data map (config/data_map.json) and the dimensions config defines.
// Pure, with no imports, and no field named. Worked out where the Build page's vocabulary is made (at build time) and handed to the page as plain
// ids, so the browser does not download the data map's privacy classes for it.
export type OwnerMapField = { bound?: string | null; group?: string; privacy?: string };
export type OwnerDimension = { id: string; derive?: unknown };

// Every string in a derive block: the field it reads, the reference it looks up in, and so on.
const stringsIn = (value: unknown): string[] =>
  typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(stringsIn) : [];

// The dimensions that are, or read, a field the map calls an owner field (its class is owner_restricted, or its group is one of the owner groups).
export function ownerDimensions(map: { owner_groups: string[]; fields: readonly OwnerMapField[] }, dimensions: readonly OwnerDimension[]): string[] {
  const bound = new Set(
    map.fields.filter((f) => f.bound && (f.privacy === "owner_restricted" || map.owner_groups.includes(f.group ?? ""))).map((f) => f.bound as string),
  );
  return dimensions.filter((d) => bound.has(d.id) || stringsIn(d.derive).some((s) => bound.has(s))).map((d) => d.id);
}
