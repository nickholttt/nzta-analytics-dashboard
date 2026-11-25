// The plain English lint's logic (config/narrative/plain_english.json), shared by scripts/check-plain-english.mjs (the built
// public pages and config) and its tests. Built-ins only. A hit is { rule, source, text }: which rule, where the visitor would
// read it, and the words around it.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function loadRules(repoRoot) {
  const read = (relative) => JSON.parse(readFileSync(join(repoRoot, relative), "utf8"));
  const config = read("config/narrative/plain_english.json");

  const checks = [
    ...config.banned_terms.map((t) => ({
      rule: t.term,
      regex: new RegExp(`\\b${escapeRegExp(t.term).replace(/\\? /g, "\\s+")}(?:s|es|d)?\\b`, "gi"),
      sayInstead: t.say_instead,
      words: false,
    })),
    ...config.banned_patterns.map((p) => ({ rule: p.name, regex: new RegExp(p.pattern, "gi"), sayInstead: p.say_instead, words: false, pagesOnly: p.pages_only === true })),
  ];

  // Ids are read from config, never listed: every "id" holding an underscore or a hyphen, and the keys of pipeline.json's datasets.
  // An id reads as an id, not as a phrase, when it holds an underscore or two hyphens ("long-run" is a phrase).
  const isIdLike = (id) => id.includes("_") || (id.match(/-/g) ?? []).length >= 2;
  const ids = new Set(Object.keys(read("config/pipeline.json").datasets ?? {}).filter(isIdLike));
  // A retired dataset is no longer a key of pipeline.json or an "id" anywhere, yet an older link still names it and the bundle holds it
  // (dimensions.json, retired_datasets), so its id stays banned in a page and in config words.
  for (const id of Object.keys(read("config/dimensions.json").retired_datasets ?? {})) if (!id.startsWith("$") && isIdLike(id)) ids.add(id);
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (key === "id" && typeof value === "string" && isIdLike(value)) ids.add(value);
        else walk(value);
      }
    }
  };
  for (const file of readdirSync(join(repoRoot, "config")).filter((f) => f.endsWith(".json"))) walk(read(`config/${file}`));
  if (ids.size > 0) {
    checks.push({
      rule: "internal id",
      regex: new RegExp(`(?<![A-Za-z0-9_-])(?:${[...ids].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})(?![A-Za-z0-9_-])`, "g"),
      sayInstead: "the name a visitor sees for it",
      // A lone token in config is an id or a value in its own right; only a sentence that holds one is a leak.
      words: true,
    });
  }
  return { checks, allow: config.allow ?? [], configFiles: config.config_files.map((f) => (typeof f === "string" ? { file: f } : f)), skipKeys: new Set(config.skip_keys ?? []), wordKeys: new Set(config.word_keys ?? []), ids };
}

// The hits in one piece of text a visitor reads. `isWords` is true when the text is a sentence or a phrase and false for a lone token;
// `inConfig` is true for a config string, which is a template that may hold placeholders.
export function findHits(rules, source, text, isWords = true, inConfig = false) {
  const hits = [];
  const read = inConfig ? text.replace(/\{[^}]*\}/g, "{}") : text;
  for (const check of rules.checks) {
    if (check.words && !isWords) continue;
    if (check.pagesOnly && inConfig) continue;
    for (const m of read.matchAll(check.regex)) {
      const from = Math.max(0, m.index - 30);
      hits.push({ rule: check.rule, source, text: `${from > 0 ? "..." : ""}${read.slice(from, m.index + m[0].length + 30).replace(/\s+/g, " ")}`, sayInstead: check.sayInstead });
    }
  }
  return hits;
}

// Every string in a config file that a visitor may read, with where it is. A key beginning with $ is the maintainer's note.
export function configWords(rules, repoRoot) {
  const found = [];
  for (const { file, only_keys: onlyKeys, skip_keys: fileSkip } of rules.configFiles) {
    const only = onlyKeys ? new Set(onlyKeys) : undefined;
    const skip = new Set([...rules.skipKeys, ...(fileSkip ?? [])]);
    const walk = (node, path, key) => {
      if (typeof node === "string") {
        if (!only || only.has(key)) found.push({ source: `${file} > ${path}`, text: node });
      }
      else if (Array.isArray(node)) node.forEach((item, i) => walk(item, `${path}[${item && typeof item === "object" && typeof item.id === "string" ? item.id : i}]`, key));
      else if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
          if (key.startsWith("$") || skip.has(key)) continue;
          walk(value, path ? `${path}.${key}` : key, key);
        }
      }
    };
    walk(JSON.parse(readFileSync(join(repoRoot, file), "utf8")), "", "");
  }
  return found;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”" };
export const decodeEntities = (s) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (all, dec, hex, name) =>
    dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : (ENTITIES[name.toLowerCase()] ?? all),
  );

// Everything a visitor reads in one built page, as { source, text, isWords }: the title, the description and the other meta
// words, the text a screen reader or a sighted visitor meets, the words in alt, aria-label and similar attributes, and the words
// handed to an island as props (an island draws its own text in the browser, so its props are the nearest the page's file holds).
const WORD_ATTRIBUTES = ["alt", "aria-label", "title", "placeholder", "aria-description", "aria-roledescription", "aria-valuetext"];
// `wordKeys` are the prop names that hold words a visitor reads: a lone id under one of them is a leak, where under any other key (id,
// dimension, dataset, measure) it is an id doing its job.
export function pageWords(html, wordKeys = new Set()) {
  const found = [];
  const add = (source, text, isWords = true) => {
    const clean = decodeEntities(text).replace(/\s+/g, " ").trim();
    if (clean) found.push({ source, text: clean, isWords });
  };

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title) add("title", title[1]);

  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const name = /\b(?:name|property)="([^"]*)"/i.exec(tag)?.[1];
    const content = /\bcontent="([^"]*)"/i.exec(tag)?.[1];
    if (name && content && /^(description|og:|twitter:)/i.test(name) && !/(:image|:url|:card|:type)$/i.test(name)) add(`meta ${name}`, content);
    if (name && content && /(:image:alt)$/i.test(name)) add(`meta ${name}`, content);
  }

  for (const island of html.matchAll(/<astro-island\b[^>]*\bprops="([^"]*)"/gi)) {
    let props;
    try {
      props = JSON.parse(decodeEntities(island[1]));
    } catch {
      continue;
    }
    const walk = (node, path, key) => {
      if (typeof node === "string") add(`island props ${path}`, node, /\s/.test(node) || wordKeys.has(key));
      else if (Array.isArray(node)) node.forEach((item, i) => walk(item, `${path}[${i}]`, key));
      else if (node && typeof node === "object") for (const [k, value] of Object.entries(node)) walk(value, path ? `${path}.${k}` : k, k);
    };
    walk(props, "", "");
  }

  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|template|head)\b[\s\S]*?<\/\1>/gi, " ");
  // A tag is read with its quotes in mind: an attribute value may hold ">".
  for (const [tag, name] of body.matchAll(/<([a-z][a-z0-9-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
    for (const attribute of WORD_ATTRIBUTES) {
      const m = new RegExp(`\\s${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
      if (m) add(attribute, m[1] ?? m[2]);
    }
    // The text a field or a button shows is its value, unless the field is a choice whose value is an id (a checkbox, a radio, a hidden field).
    if (name.toLowerCase() === "input") {
      const kind = /\stype\s*=\s*["']?([a-z]+)/i.exec(tag)?.[1]?.toLowerCase() ?? "text";
      const m = /\svalue\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
      if (m && !["checkbox", "radio", "hidden"].includes(kind)) add("input value", m[1] ?? m[2]);
    }
  }
  add("page text", body.replace(/<[^>]*>/g, " "));
  return found;
}

// A hit is allowed by an entry of the config's allow list that names its rule, and whose "in" the hit's source or page holds.
export function isAllowed(rules, hit, page) {
  return rules.allow.some((a) => a.rule === hit.rule && (hit.source.includes(a.in) || (page ?? "").includes(a.in)) && (!a.text || hit.text.includes(a.text)));
}
