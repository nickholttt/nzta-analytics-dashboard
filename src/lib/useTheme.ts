import { useSyncExternalStore } from "react";
import { PALETTES, type Palette, type ThemeName } from "./theme";
import { appliedTheme } from "./themeChoice";

const DEVICE_DARK = "(prefers-color-scheme: dark)";

function current(): ThemeName {
  return appliedTheme(document.documentElement.getAttribute("data-theme"), window.matchMedia(DEVICE_DARK).matches);
}

// A change of the visitor's choice (the toggle, or another tab through the page's head script) shows as data-theme on <html>; a change of
// the device setting, while no choice is made, as the media query's own event.
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const device = window.matchMedia(DEVICE_DARK);
  device.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    device.removeEventListener("change", onChange);
  };
}

// The palette of the theme that applies, and a new one whenever it changes, so a renderer that lists it among what it draws from redraws
// without a reload. Where there is no document (the build's own render of an island) it is the light palette, which is what the page
// starts as before its script has run.
export function usePalette(): Palette {
  return PALETTES[useSyncExternalStore<ThemeName>(subscribe, current, () => "light")];
}
