// The files the build published (public/data), read from the folder the site is built from: Astro builds with the project's folder as its working
// directory. Used only where the site is built (the pages' own files), never in a browser, which reads published data only through src/lib/data.ts.
// A file that is not there gives nothing, and the page that wanted it is not drawn. A plain module with a declaration file, as the site's types carry
// no Node types.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const readPublished = (relative) => {
  try {
    const file = readFileSync(join(process.cwd(), "public", "data", relative));
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  } catch {
    return undefined;
  }
};
