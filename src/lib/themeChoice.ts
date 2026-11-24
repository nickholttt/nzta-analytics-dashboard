// Which theme applies. With no choice made, the device setting decides, in CSS alone (src/styles/site.css). A visitor's choice is kept in
// their browser's localStorage under one key (config/site.json, theme.storage_key), written on the visitor's own device and never sent
// anywhere, and shows as data-theme on <html>. The charts read it through the rules here.

import type { ThemeName } from "./theme";

export const isThemeName = (value: unknown): value is ThemeName => value === "light" || value === "dark";

// The theme that applies: the visitor's choice when data-theme holds one, otherwise the device setting. Anything else in the attribute
// (a hand-edited or stale value) is not a choice.
export function appliedTheme(attribute: string | null | undefined, deviceIsDark: boolean): ThemeName {
  return isThemeName(attribute) ? attribute : deviceIsDark ? "dark" : "light";
}
