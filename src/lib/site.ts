// Whether this build carries the internal pages, /status and /sense-check. The public deploy builds with
// INTERNAL_PAGES=false and removes those pages (D-056), so nothing links to them there; a local build keeps them.
export const INTERNAL_PAGES = import.meta.env.INTERNAL_PAGES !== "false";
