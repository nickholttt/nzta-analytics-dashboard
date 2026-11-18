// The host's limits on one deploy (D-146), read from Cloudflare Pages' limits page (developers.cloudflare.com/pages/platform/limits/,
// "Last updated Sep 5, 2026", read 2026-11-18): "Cloudflare Pages sites can contain up to 20,000 files on the Free plan." and "The maximum
// file size for a single Cloudflare Pages site asset is 25 MiB." The page states no limit on a deploy's total size. Each kept snapshot adds a
// cube's files (D-131), so the file count grows every month; the public-build check fails before the upload rather than let the host refuse
// the deploy or drop files. Built-ins only, as kept-snapshots.mjs is.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const HOST_LIMITS = { max_files: 20000, max_file_bytes: 25 * 1024 * 1024 };

export function hostLimitProblems(root, limits = HOST_LIMITS) {
  const problems = [];
  const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) => statSync(join(root, f)).isFile());
  if (files.length > limits.max_files) {
    problems.push(`the output holds ${files.length} files and the host serves at most ${limits.max_files} a deploy: keep fewer snapshots or fewer files in each`);
  }
  for (const file of files) {
    const bytes = statSync(join(root, file)).size;
    if (bytes > limits.max_file_bytes) problems.push(`${file} is ${bytes} bytes and the host serves no file over ${limits.max_file_bytes} bytes`);
  }
  return problems;
}
