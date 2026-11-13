// Synchronises chart options and permalinks with URL search params and hash anchors.

function getSearchParams(): URLSearchParams | null {
  if (typeof window === "undefined" || !window.location) return null;
  return new URLSearchParams(window.location.search);
}

/**
 * Reads an option for a preset from URL search parameters.
 * Checks scoped param `<presetId>.<key>`, `<presetId>_<key>`, and if the current hash matches, `<key>`.
 */
export function getParam(presetId: string, key: string, defaultValue: string): string {
  const params = getSearchParams();
  if (!params) return defaultValue;

  // 1. Scoped parameter: <presetId>.<key> (e.g. brand-owner-origin.granularity)
  const scopedDot = params.get(`${presetId}.${key}`);
  if (scopedDot !== null && scopedDot !== "") return scopedDot;

  // 2. Scoped parameter: <presetId>_<key>
  const scopedUnderscore = params.get(`${presetId}_${key}`);
  if (scopedUnderscore !== null && scopedUnderscore !== "") return scopedUnderscore;

  // 3. Unscoped parameter if the URL hash targets this preset
  const activeHash = window.location.hash.replace(/^#/, "");
  if (activeHash === presetId) {
    const unscoped = params.get(key);
    if (unscoped !== null && unscoped !== "") return unscoped;
  }

  return defaultValue;
}

/**
 * Updates an option in the URL search parameters without triggering a page reload.
 * Deletes the parameter if set to default.
 */
export function setParam(presetId: string, key: string, value: string, defaultValue: string): void {
  if (typeof window === "undefined" || !window.history || !window.location) return;

  const url = new URL(window.location.href);
  const scopedKey = `${presetId}.${key}`;

  if (value === defaultValue) {
    url.searchParams.delete(scopedKey);
    url.searchParams.delete(`${presetId}_${key}`);
    // If active hash is this preset and an unscoped key exists, remove it too
    if (url.hash.replace(/^#/, "") === presetId) {
      url.searchParams.delete(key);
    }
  } else {
    url.searchParams.set(scopedKey, value);
  }

  const query = url.searchParams.toString();
  const newRelativePathQuery = url.pathname + (query ? `?${query}` : "") + url.hash;
  window.history.replaceState(null, "", newRelativePathQuery);
}

/**
 * Returns a shareable URL string targeting the preset with its active scoped parameters.
 */
export function getShareableUrl(presetId: string): string {
  if (typeof window === "undefined" || !window.location) return `#${presetId}`;

  const url = new URL(window.location.href);
  url.hash = presetId;
  return url.toString();
}
