// A reference file (data/reference/<name>.csv) read from the folder the site is built from, as src/lib/publishedFiles.mjs reads the published data.
// Used only where the site is built, never in a browser. A file that is not there gives nothing, and what wanted it is drawn as it was before. A plain
// module with a declaration file, as the site's types carry no Node types.
import { readFileSync } from "node:fs";
import { join } from "node:path";

// One CSV record per line, quoted fields allowed ("" for a quote inside one), the first line naming the columns.
function parse(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

export const readReference = (name) => {
  try {
    const [head, ...rest] = parse(readFileSync(join(process.cwd(), "data", "reference", name), "utf8"));
    return rest.map((cells) => Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""])));
  } catch {
    return undefined;
  }
};
