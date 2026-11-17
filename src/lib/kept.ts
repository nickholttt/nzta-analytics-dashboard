// Where a pinned question reads its figures from (D-131). A deploy keeps the cube of every earlier snapshot beside the newest (the index of the
// months kept: src/lib/snapshotIndex.ts), so a question pinned to such a month can show that month's figures as that cube holds them. The page
// reads a kept snapshot only when all of these hold, and otherwise does what a pin with no kept snapshot does (src/lib/pin.ts, D-125), saying so:
//   - the pin is a month before the snapshot served, and the index lists it;
//   - that snapshot can answer the question: it built the dataset, the fields the question names are live in it, and it holds every value chosen;
//   - no field the question names is one that describes the owner, unless that snapshot says the small-cell rule was applied to its tables.
// Only the Build page imports this; the Explore page, which has no pins, does not download it.
import { builderSpec } from "./config";
import { builderPresets, isMonthKey } from "./builder";
import type { Question } from "./builder";
import type { Manifest } from "./data";
import { pinNote, servedMonth } from "./pin";
import type { PinNote } from "./pin";
import { resolvePreset, servedFrom } from "./resolve";
import { fillTemplate } from "./sentences";
import type { KeptSnapshots } from "./snapshotIndex";

// The key of a snapshot's manifest that says the small-cell rule (D-096, D-127) was applied to its owner-field tables: for each dataset, one entry
// for each dimension whose slice had small cells hidden (docs/CUBE_SCHEMA.md, the manifest's small_cells block). Nothing else reads the key.
export const SMALL_CELL_KEY = "small_cells";

// The dimensions made from an owner field, as the vocabulary gives them (Vocabulary.owner).
export type Owner = ReadonlySet<string>;

// Whether a table of this dimension in this snapshot may be read: any dimension that reads no owner field, and an owner one only where the
// snapshot's manifest says the small-cell rule was applied to it. A snapshot built before the rule says nothing, so its owner tables are not read.
export function ownerSliceReady(manifest: Manifest, dataset: string, dimension: string, owner: Owner): boolean {
  if (!owner.has(dimension)) return true;
  const applied = (manifest.datasets[dataset] as unknown as Record<string, unknown> | undefined)?.[SMALL_CELL_KEY];
  if (typeof applied !== "object" || applied === null || Array.isArray(applied)) return false;
  // The entry itself must be a block describing the rule's application: null, false or a list under the key does not say it was applied.
  const entry = Object.prototype.hasOwnProperty.call(applied, dimension) ? (applied as Record<string, unknown>)[dimension] : undefined;
  return typeof entry === "object" && entry !== null && !Array.isArray(entry);
}

// The month of the kept snapshot a question is pinned to, if it is pinned to one: a month before the snapshot served that the index lists.
export function keptMonth(q: Question, served: Manifest, index: KeptSnapshots | null): string | undefined {
  return isMonthKey(q.snapshot) && q.snapshot < servedMonth(served) && index?.has(q.snapshot) ? q.snapshot : undefined;
}

// What a question reads, as the charts will draw it: each chart's dataset, the fields it names, and the values chosen for each.
type Asks = { dataset: string; fields: { dimension: string; values: string[] }[] };
function asks(q: Question, manifest: Manifest): Asks[] {
  return builderPresets(q).map((p) => ({
    dataset: servedFrom(p.dataset, manifest) ?? p.dataset ?? "",
    fields: [
      ...(p.dimension ? [{ dimension: p.dimension, values: p.values ?? [] }] : []),
      ...(p.dimension2 ? [{ dimension: p.dimension2, values: p.values2 ?? [] }] : []),
      ...Object.entries(p.where ?? {}).map(([dimension, values]) => ({ dimension, values })),
    ],
  }));
}

export type Holds = "yes" | "no" | "owner";

// Whether some chart of the question cannot be drawn from a snapshot: a dataset it did not build, a field not live in it, a pair or fact table it
// lacks. Nothing is drawn, whatever is shown.
export const blockedIn = (q: Question, manifest: Manifest): boolean => {
  const charts = builderPresets(q);
  return charts.length === 0 || charts.some((p) => resolvePreset(p, manifest).preventsRender.length > 0);
};

// Whether a snapshot's manifest lets it answer the question: every chart resolves against it, and no owner field is read from a table that the
// small-cell rule has not been applied to.
export function holds(q: Question, kept: Manifest, owner: Owner): Holds {
  if (blockedIn(q, kept)) return "no";
  return asks(q, kept).every((a) => a.fields.every((f) => ownerSliceReady(kept, a.dataset, f.dimension, owner))) ? "yes" : "owner";
}

// Whether a value chosen for a field is one the snapshot's own table of that field holds (a table lists only values with vehicles in them).
export const hasValues = (rows: readonly { value: string }[], chosen: readonly string[]): boolean => {
  const present = new Set(rows.map((r) => r.value));
  return chosen.every((v) => present.has(v));
};

export type Reading =
  // The newest snapshot, as D-125: no pin, or a pin at or after it, or a pin to a month with no kept snapshot.
  | { kind: "served" }
  // The kept snapshot of this month: every figure of the question is read from its folder.
  | { kind: "kept"; month: string; manifest: Manifest }
  // A kept snapshot that cannot answer the question, or whose table for it is withheld: the newest is shown, and the page says why.
  | { kind: "withheld"; month: string; manifest: Manifest; why: "missing" | "owner" };

export type Loaders = {
  index: () => Promise<KeptSnapshots | null>;
  manifest: (month: string) => Promise<Manifest>;
  slice: (dataset: string, dimension: string, month: string) => Promise<readonly { value: string }[]>;
};

// Decides where a question reads from. A kept snapshot whose files cannot be read is as if it were not kept: the page then does what D-125 did.
export async function readingFor(q: Question, served: Manifest, load: Loaders, owner: Owner): Promise<Reading> {
  if (!isMonthKey(q.snapshot) || q.snapshot >= servedMonth(served)) return { kind: "served" };
  // A question the newest snapshot cannot draw either is not the kept one's fault: it is shown as it is shown today.
  if (blockedIn(q, served)) return { kind: "served" };
  const month = keptMonth(q, served, await load.index());
  if (!month) return { kind: "served" };
  let manifest: Manifest;
  try {
    manifest = await load.manifest(month);
  } catch {
    return { kind: "served" };
  }
  const verdict = holds(q, manifest, owner);
  if (verdict !== "yes") return { kind: "withheld", month, manifest, why: verdict === "owner" ? "owner" : "missing" };
  try {
    for (const a of asks(q, manifest)) {
      for (const f of a.fields) {
        if (f.values.length && !hasValues(await load.slice(a.dataset, f.dimension, month), f.values)) return { kind: "withheld", month, manifest, why: "missing" };
      }
    }
  } catch {
    // A table that could not be fetched says nothing about what the snapshot holds, so no claim is made: the page does what D-125 did.
    return { kind: "served" };
  }
  return { kind: "kept", month, manifest };
}

// The kept snapshot a picker's suggestions are counted in: the month the question reads from, when that snapshot can give a list for this field, and
// otherwise none (the newest's). It can where the field is live in it and, for a list counted among conditions, carried by its fact table, and where
// no owner field named is one its manifest leaves uncovered: a condition picker opened with no value yet is not in the question, so `asks` has not
// checked its field, and this does.
export function pickerMonth(reading: Reading | undefined, dataset: string, dimension: string, where: Record<string, string[]>, owner: Owner): string | undefined {
  if (reading?.kind !== "kept") return undefined;
  const served = servedFrom(dataset, reading.manifest) ?? dataset;
  const entry = reading.manifest.datasets[served];
  if (!entry) return undefined;
  const conditions = Object.entries(where).filter(([, kept]) => kept.length > 0).map(([d]) => d);
  const named = [dimension, ...conditions];
  const filtered = conditions.length > 0;
  return named.every((d) => ownerSliceReady(reading.manifest, served, d, owner) && entry.live_dimensions.includes(d) && (!filtered || Boolean(entry.facts?.dimensions.includes(d)))) ? reading.month : undefined;
}

export type KeptNote = PinNote | { kind: "kept" | "withheld"; text: string };

// The line above the chart for a pinned question, given where it reads from; undefined for a question that is not pinned.
export function pinLine(q: Question, served: Manifest, reading: Reading): KeptNote | undefined {
  const newest = pinNote(q, served);
  if (reading.kind === "served" || !newest) return newest;
  const notices = builderSpec.notices;
  const say = (template: string) => fillTemplate(template, { pinned: q.snapshot, date: reading.manifest.latest_snapshot }).text;
  if (reading.kind === "withheld") {
    return { kind: "withheld", text: `${say(reading.why === "owner" ? notices.pin_kept_withheld : notices.pin_kept_missing)} ${newest.text}` };
  }
  // Where the dataset ends before the snapshot or the pinned month has no window, the line the kept snapshot gives is the one that says so.
  const own = pinNote(q, reading.manifest);
  return own && own.kind !== "same" ? own : { kind: "kept", text: say(notices.pin_kept) };
}
