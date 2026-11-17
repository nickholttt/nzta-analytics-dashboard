// The snapshots a deploy keeps beside the newest (D-131). The deploy unpacks each earlier cube release into
// public/data/snapshots/<YYYY-MM>/; this checks what is there, removes from each folder the tables of any owner field that its manifest does not
// say the small-cell rule was applied to (a kept folder is the release less those tables, so the site never serves a table the page refuses to
// read), prints what it removed, and writes the one file the page reads to know which months it may open, public/data/snapshots/index.json:
//   node scripts/kept-snapshots.mjs [public/data]
// Exit 0 when every kept folder is sound and the index is written; exit 1, naming the folder, when one is not. Built-ins only, so the
// workflow runs it without the site's dependencies and a maintainer can run it by hand. check-public-build.mjs reads the same rules through
// problemsIn, indexProblems and ownerTableProblems.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const INDEX_FILE = "index.json";
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// A pair's file is {dim_a}__{dim_b}.parquet (docs/CUBE_SCHEMA.md); src/lib/data.ts holds the same separator.
const PAIR_SEPARATOR = "__";
// The key of a snapshot's manifest, on a dataset, that says the small-cell rule was applied: one block for each dimension protected. The same
// name as SMALL_CELL_KEY in src/lib/kept.ts, which a test holds equal.
export const SMALL_CELL_KEY = "small_cells";

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
};

// Every string in a derive block: the field it reads, the reference it looks up in, and so on.
const stringsIn = (value) => (typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(stringsIn) : []);

// The dimensions that are, or read, a field the data map calls an owner field (its class is owner_restricted, or its group is one of the owner
// groups). The same rule as ownerDimensions in src/lib/owner.ts, from the same two files, with no dimension named here; a test holds the two equal.
export function ownerDimensionIds(map, dimensions) {
  const bound = new Set(map.fields.filter((f) => f.bound && (f.privacy === "owner_restricted" || map.owner_groups.includes(f.group ?? ""))).map((f) => f.bound));
  return dimensions.filter((d) => bound.has(d.id) || stringsIn(d.derive).some((s) => bound.has(s))).map((d) => d.id);
}
const config = (name) => JSON.parse(readFileSync(new URL(`../config/${name}`, import.meta.url), "utf8"));
export const realOwnerDimensions = () => ownerDimensionIds(config("data_map.json"), config("dimensions.json").dimensions);

// The owner tables of a kept folder that its manifest does not cover: for each dataset's cube slice, fact column and pair file naming an owner
// dimension, the path (relative to the folder) unless the manifest says, on that dataset, that the rule was applied to that dimension.
export function uncoveredOwnerTables(folder, owner = realOwnerDimensions()) {
  const manifest = readJson(join(folder, "manifest.json"));
  const found = [];
  for (const kind of ["cube", "facts", "pairs"]) {
    const base = join(folder, kind);
    if (!existsSync(base)) continue;
    for (const dataset of readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const covered = manifest?.datasets?.[dataset.name]?.[SMALL_CELL_KEY];
      const applied = (d) => covered && typeof covered === "object" && !Array.isArray(covered) && typeof covered[d] === "object" && covered[d] !== null && !Array.isArray(covered[d]);
      for (const file of readdirSync(join(base, dataset.name))) {
        if (!file.endsWith(".parquet")) continue;
        const named = file.slice(0, -".parquet".length).split(PAIR_SEPARATOR);
        const sides = kind === "pairs" ? named : [named.join(PAIR_SEPARATOR)];
        if (sides.some((d) => owner.includes(d) && !applied(d))) found.push(`${kind}/${dataset.name}/${file}`);
      }
    }
  }
  return found.sort();
}

// The kept folders as they stand: for each one named like a month, its snapshot date, and every way the folder or the folder of snapshots is
// not sound. dataDir is the folder that holds manifest.json (public/data, or dist/data).
export function readKept(dataDir) {
  const root = join(dataDir, "snapshots");
  const kept = [];
  const problems = [];
  if (!existsSync(root)) return { kept, problems };
  const served = readJson(join(dataDir, "manifest.json"))?.latest_snapshot;
  const servedMonth = typeof served === "string" && DATE.test(served) ? served.slice(0, 7) : undefined;
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.isFile() && entry.name === INDEX_FILE) continue;
    const where = `snapshots/${entry.name}`;
    if (!entry.isDirectory() || !MONTH.test(entry.name)) {
      problems.push(`${where} is not a folder named for a month (YYYY-MM)`);
      continue;
    }
    const manifest = readJson(join(root, entry.name, "manifest.json"));
    const date = manifest?.latest_snapshot;
    if (manifest === undefined) problems.push(`${where} has no readable manifest.json`);
    else if (typeof date !== "string" || !DATE.test(date)) problems.push(`${where}/manifest.json names no snapshot date (latest_snapshot)`);
    else if (date.slice(0, 7) !== entry.name) problems.push(`${where}/manifest.json is the snapshot of ${date}, not a snapshot of ${entry.name}`);
    else if (servedMonth && entry.name >= servedMonth) problems.push(`${where} is not earlier than the newest snapshot (${servedMonth}), which is served from the data folder itself`);
    else kept.push({ month: entry.name, snapshot: date });
  }
  return { kept, problems };
}

// Removes the uncovered owner tables of every sound kept folder, and says what it removed.
export function withholdOwnerTables(dataDir, owner = realOwnerDimensions()) {
  const removed = [];
  for (const { month } of readKept(dataDir).kept) {
    const folder = join(dataDir, "snapshots", month);
    for (const path of uncoveredOwnerTables(folder, owner)) {
      rmSync(join(folder, path));
      removed.push(`snapshots/${month}/${path}`);
    }
  }
  return removed;
}

// For the public-build check: an owner table of a kept folder that its manifest does not cover is still in the output.
export function ownerTableProblems(dataDir, owner = realOwnerDimensions()) {
  return readKept(dataDir).kept.flatMap(({ month }) =>
    uncoveredOwnerTables(join(dataDir, "snapshots", month), owner).map((path) => `snapshots/${month}/${path} is a table of an owner field that the snapshot does not say the small-cell rule was applied to`),
  );
}

// The problems of the folders alone.
export const problemsIn = (dataDir) => readKept(dataDir).problems;

// The index must list exactly the sound folders, once each, in order. Absent with no folders is fine: the page treats a missing index as
// none kept.
export function indexProblems(dataDir) {
  const { kept, problems } = readKept(dataDir);
  const path = join(dataDir, "snapshots", INDEX_FILE);
  const index = existsSync(path) ? readJson(path) : null;
  if (index === undefined) return [...problems, `snapshots/${INDEX_FILE} is not readable JSON`];
  if (index === null) return kept.length ? [...problems, `snapshots/${INDEX_FILE} is missing, and ${kept.length} snapshot(s) are kept`] : problems;
  const listed = Array.isArray(index.snapshots) ? index.snapshots.map((s) => `${s?.month} ${s?.snapshot}`) : undefined;
  const folders = kept.map((s) => `${s.month} ${s.snapshot}`);
  if (!listed) return [...problems, `snapshots/${INDEX_FILE} has no list of snapshots`];
  if (listed.join("\n") !== folders.join("\n")) {
    return [...problems, `snapshots/${INDEX_FILE} lists [${listed.join(", ")}], but the sound folders are [${folders.join(", ")}]`];
  }
  return problems;
}

// Writes the index of the sound folders; the caller has checked there are none that are not.
export function writeIndex(dataDir) {
  const { kept } = readKept(dataDir);
  mkdirSync(join(dataDir, "snapshots"), { recursive: true });
  writeFileSync(join(dataDir, "snapshots", INDEX_FILE), `${JSON.stringify({ snapshots: kept }, null, 2)}\n`);
  return kept;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataDir = resolve(process.argv[2] ?? "public/data");
  const problems = problemsIn(dataDir);
  if (problems.length) {
    console.error(problems.map((p) => `- ${p}`).join("\n"));
    process.exit(1);
  }
  for (const path of withholdOwnerTables(dataDir)) console.log(`Withheld ${path}: a table of an owner field that its snapshot does not say the small-cell rule was applied to.`);
  const kept = writeIndex(dataDir);
  console.log(`Earlier snapshots kept: ${kept.length}${kept.length ? ` (${kept.map((s) => s.month).join(", ")})` : ""}; snapshots/${INDEX_FILE} written.`);
}
