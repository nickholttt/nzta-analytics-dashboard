// The address of a generated page (config/answer_pages.json): one short, safe piece of a path for each value of a field, made from the value
// alone. Pure, names no value, and gives the same address on every machine, so a page keeps its address from one build to the next.
//
// Rules, in order:
//   - the value is folded to the letters and digits of plain ASCII: accents are taken off (a vowel with a macron or an acute is the same vowel),
//     case is lowered, and every run of anything else (spaces, punctuation, slashes, the separator of a compound value) becomes one hyphen;
//   - a value that loses a letter or digit that has no plain form (a letter outside the Latin alphabet) is marked, so it cannot take the address of
//     a value that only differs in that letter;
//   - two values of one field that fold to the same text each carry a short code made from the whole value as written, so neither is the other's;
//   - a value that folds to nothing, or to something too long to read, is given its code with a plain word in front.
// The code is a hash of the value as written (FNV-1a, 32 bits, in base 36): the same value always has the same code, with no table to keep.

// How many characters of the folded text an address may carry before its code.
export const MAX_SLUG_TEXT = 60;

// The word an address of a value that folds to nothing starts with.
const EMPTY_TEXT = "x";

// A short code from a whole value: 32-bit FNV-1a over its UTF-8 bytes, written in base 36 and padded to seven characters.
export function slugCode(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

type Folded = { text: string; lossy: boolean };

// The plain-ASCII form of a value, and whether anything with a letter's or a digit's meaning was lost in making it.
export function foldValue(value: string): Folded {
  const base = value.normalize("NFKD").replace(/\p{M}+/gu, "");
  // Whatever is a letter or a digit and still not a plain one was lost.
  const lossy = /[\p{L}\p{N}]/u.test(base.replace(/[A-Za-z0-9]+/g, ""));
  const text = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return { text, lossy };
}

// The address of every value of a field: value -> slug. Unique within the list, and the same for a value whatever else is in the list unless
// another value folds to the same text.
export function slugsFor(values: readonly string[]): Map<string, string> {
  const folded = new Map<string, Folded>();
  const sharing = new Map<string, number>();
  for (const value of new Set(values)) {
    const f = foldValue(value);
    folded.set(value, f);
    sharing.set(f.text, (sharing.get(f.text) ?? 0) + 1);
  }
  const slugs = new Map<string, string>();
  const used = new Set<string>();
  for (const [value, f] of [...folded].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const tooLong = f.text.length > MAX_SLUG_TEXT;
    const coded = f.lossy || tooLong || f.text === "" || (sharing.get(f.text) ?? 0) > 1;
    const text = f.text === "" ? EMPTY_TEXT : tooLong ? f.text.slice(0, MAX_SLUG_TEXT).replace(/-+$/, "") : f.text;
    let slug = coded ? `${text}-${slugCode(value)}` : text;
    // A code that met another value's (a hash collision, which 32 bits make rare) is made longer from the value itself until it is the value's own.
    for (let i = 1; used.has(slug); i += 1) slug = `${text}-${slugCode(`${value}\u0000${i}`)}`;
    used.add(slug);
    slugs.set(value, slug);
  }
  return slugs;
}
