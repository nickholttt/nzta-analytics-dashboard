// Writes the site's font files (src/fonts/) from the two variable typefaces already in node_modules (@fontsource-variable), cut to the
// characters a New Zealand page needs, so that a first visit downloads about 40 KB of type and not 170 KB (work order 3, lane A).
//   node scripts/subset-fonts.mjs [--python <python that has fonttools and brotli>]
// Run by hand when the characters below change; the output is committed. It needs Python's fonttools and brotli (pip install fonttools
// brotli), which are tools for this one script and not dependencies of the site. The typefaces are SIL Open Font License 1.1 (their
// licence files sit beside the files they made).
//
// Each family is cut into pieces that load only when a page's text uses them (the browser reads each @font-face's unicode-range):
//   latin     Basic Latin, the punctuation, quotes, dashes, arrows and signs the site's words and tables use
//   accents   the accented letters of Latin-1 (brand names), loaded only on a page that has one
//   macron    the macron vowels of te reo Maori (and the combining macron), loaded only on a page that has one
// A character in none of them is drawn from the next font in the stack (src/styles/site.css). The weight axis is kept (400 to 700) so
// every weight the styles use is one file. Source Serif's optical-size axis is fixed at one size: the headings are the only text in it, and
// the axis alone was most of the file.
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const python = args.includes("--python") ? args[args.indexOf("--python") + 1] : "python";
const from = (pkg, file) => join(root, "node_modules/@fontsource-variable", pkg, "files", file);
const out = join(root, "src/fonts");
const tmp = join(root, "node_modules/.cache/subset-fonts");
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });

// The unicode-range of each piece: what the subset keeps, and what src/styles/site.css declares for it. They must be the same list.
export const PIECES = {
  latin: "U+0020-007E,U+00A0,U+00A7,U+00B0-00B1,U+00B7,U+00D7,U+00F7,U+2010-2015,U+2018-201E,U+2022,U+2026,U+2190-2193,U+2212,U+2264-2265",
  accents: "U+00C0-00D6,U+00D8-00F6,U+00F8-00FF",
  macron: "U+0100-0101,U+0112-0113,U+012A-012B,U+014C-014D,U+016A-016B,U+0304",
};
const FEATURES = "kern,tnum,pnum,lnum,case,ccmp,locl,mark,mkmk";

const families = [
  { name: "plex", pkg: "ibm-plex-sans", file: (piece) => `ibm-plex-sans-${piece === "macron" ? "latin-ext" : "latin"}-wght-normal.woff2`, axes: ["wght=400:700"], pieces: ["latin", "accents", "macron"], licence: "node_modules/@fontsource-variable/ibm-plex-sans/LICENSE" },
  { name: "serif", pkg: "source-serif-4", file: (piece) => `source-serif-4-${piece === "macron" ? "latin-ext" : "latin"}-opsz-normal.woff2`, axes: ["wght=400:700", "opsz=28"], pieces: ["latin", "macron"], licence: "node_modules/@fontsource-variable/source-serif-4/LICENSE" },
];

const run = (module, argv) => {
  const r = spawnSync(python, ["-m", module, ...argv], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`${module} failed:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
};

for (const family of families) {
  for (const piece of family.pieces) {
    const source = from(family.pkg, family.file(piece));
    if (!existsSync(source)) {
      console.error(`${source} is not installed: run npm install.`);
      process.exit(2);
    }
    const instance = join(tmp, `${family.name}-${piece}.ttf`);
    run("fontTools.varLib.instancer", [source, ...family.axes, "-o", instance]);
    const target = join(out, `${family.name}-${piece}.woff2`);
    run("fontTools.subset", [instance, `--unicodes=${PIECES[piece]}`, `--layout-features=${FEATURES}`, "--flavor=woff2", `--output-file=${target}`]);
    rmSync(instance);
    console.log(`${target.slice(root.length + 1)}: ${statSync(target).size} bytes`);
  }
  const licence = join(root, family.licence);
  if (existsSync(licence)) copyFileSync(licence, join(out, `LICENSE-${family.name}.txt`));
}
