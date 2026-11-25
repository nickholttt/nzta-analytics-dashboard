// The display names read where the site is built (data/reference/display_names.csv, config/display_names.json), once for every page that asks.
// Nothing here reaches a browser. Where the file is missing the pages read as they did before: the register's capitals and the value's own words.
import configDoc from "../../config/display_names.json";
import { displayRows } from "./displayNames";
import type { DisplayConfig, DisplayNames } from "./displayNames";
import { readReference } from "./readReference.mjs";

export const displayConfig = configDoc as unknown as DisplayConfig;

let names: { value: DisplayNames | undefined } | undefined;

export function builtDisplayNames(): DisplayNames | undefined {
  names ??= (() => {
    const rows = displayRows(readReference(displayConfig.reference));
    return { value: rows ? { rows, config: displayConfig } : undefined };
  })();
  return names.value;
}
