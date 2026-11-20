// The canvas's field list, made from the data map (config/data_map.json) where the page is built and handed to the page as plain data,
// so the browser does not read the map for it. A field is a dimension the build carries for a dataset the canvas offers, plus the
// month of first registration. Its group and whether its number can be averaged come from the register field it is made from; its
// one-line definition from config/canvas.json, else from the dimension's own one-line note, else from that register field.
import dataMapDoc from "../../config/data_map.json";
import pipelineDoc from "../../config/pipeline.json";
import { dimensionLabel, dimensions } from "./config";
import type { Dimension } from "./config";
import type { Vocabulary } from "./builder";
import { TIME_FIELD, canvasSpec } from "./canvas";
import type { CanvasField, CanvasFieldGroup } from "./canvas";
import type { Manifest } from "./data";

type MapField = { name: string; source: string; bound?: string | null; group: string; kind: string; definition: string; uses: { measure: string[] } };
type DataMap = { fields: MapField[]; derive_reads: { by_kind: Record<string, string[]>; other_source_kinds?: string[] } };

const map = dataMapDoc as unknown as DataMap;
const REGISTER = "register";
const AVERAGE = "average";
// Kinds of derive that read a published series from another source and no register field the map describes: such a dimension has no
// map group, so it is listed only where config places it by hand.
const elsewhere = new Set(map.derive_reads.other_source_kinds ?? []);

// Every string in a derive block, in the order it is written: the field it reads, the reference it looks up in, and so on.
const stringsIn = (value: unknown): string[] =>
  typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(stringsIn) : [];

const boundTo = (name: unknown): MapField | undefined =>
  typeof name === "string" ? map.fields.find((f) => f.source === REGISTER && f.bound === name) : undefined;

// What a dotted path into config/pipeline.json holds (the map's derive_reads names fields that way).
const at = (path: string): unknown => path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], pipelineDoc);

// The register field a dimension is made from: the first its derive block names, else the first the map says its kind of derive reads.
export function sourceField(dimension: Pick<Dimension, "derive">): MapField | undefined {
  for (const name of stringsIn(dimension.derive)) {
    const field = boundTo(name);
    if (field) return field;
  }
  for (const item of map.derive_reads.by_kind[dimension.derive?.kind ?? ""] ?? []) {
    const field = boundTo(item.includes(".") ? at(item) : item);
    if (field) return field;
  }
  return undefined;
}

// The group a field of this kind, made from a register field of this map group, is listed under.
const groupOf = (id: string, kind: string, mapGroup: string | undefined): string | undefined =>
  canvasSpec.group_of[id] ?? canvasSpec.groups.find((g) => mapGroup !== undefined && g.map_groups.includes(mapGroup) && (!g.kinds || g.kinds.includes(kind)))?.id;

// The fields the canvas lists, in their groups. A field no dataset offers as a breakdown or a filter is still listed, with why: one whose
// table has small counts hidden (an owner field, src/lib/owner.ts) and one the builder does not offer yet.
export function canvasFields(all: Vocabulary, manifest: Manifest): CanvasFieldGroup[] {
  const live = new Set(all.datasets.flatMap((v) => manifest.datasets[v.dataset]?.live_dimensions ?? []));
  const offered = new Set(all.datasets.flatMap((v) => [...v.measures.flatMap((m) => m.dimensions.map((d) => d.id)), ...v.filters.map((f) => f.id)]));
  const owner = new Set(all.owner);
  const time = canvasSpec.time_field;
  const fields: CanvasField[] = [
    { id: TIME_FIELD, label: time.label, group: time.group, kind: time.kind, definition: time.definition, averageable: false },
    ...dimensions
      // A dimension read from another source's series is listed only where a chart can use it or config places it; one a chart can use
      // and config does not place stops the build below, so no field a chart can use is ever missing from the list.
      .filter((d) => live.has(d.id) && (offered.has(d.id) || d.id in canvasSpec.group_of || !elsewhere.has(d.derive?.kind ?? "")))
      .map((d): CanvasField => {
        const source = sourceField(d);
        const group = groupOf(d.id, d.kind, source?.group);
        if (!group) throw new Error(`config/canvas.json puts the field "${d.id}" in no group: list its data map group under groups, or the field under group_of`);
        return {
          id: d.id,
          label: dimensionLabel(d.id) ?? d.id,
          group,
          kind: d.kind,
          // The dimension's own help line, written once in config/dimensions.json; the canvas's shorter line where it has one.
          definition: canvasSpec.definitions[d.id] ?? d.help ?? source?.definition ?? "",
          averageable: Boolean(source?.uses.measure.includes(AVERAGE)),
          ...(offered.has(d.id) ? {} : { unavailable: owner.has(d.id) ? "refuse_hidden_cells" : "refuse_not_offered" }),
        };
      }),
  ];
  return canvasSpec.groups.map((g) => ({ id: g.id, label: g.label, fields: fields.filter((f) => f.group === g.id) })).filter((g) => g.fields.length > 0);
}
