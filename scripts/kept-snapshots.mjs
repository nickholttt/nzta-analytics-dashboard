// The snapshots a deploy keeps beside the newest (D-131). The deploy unpacks each earlier cube release into
// public/data/snapshots/<YYYY-MM>/, exactly as released; this checks what is there and writes the one file the page reads to know which
// months it may open, public/data/snapshots/index.json:
//   node scripts/kept-snapshots.mjs [public/data]
// Exit 0 when every kept folder is sound and the index is written; exit 1, naming the folder, when one is not. Built-ins only, so the
// workflow runs it without the site's dependencies and a maintainer can run it by hand. check-public-build.mjs reads the same rules through
// problemsIn and indexProblems.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const INDEX_FILE = "index.json";
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
};

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
  const kept = writeIndex(dataDir);
  console.log(`Earlier snapshots kept: ${kept.length}${kept.length ? ` (${kept.map((s) => s.month).join(", ")})` : ""}; snapshots/${INDEX_FILE} written.`);
}
