// Which theme applies. With no choice made, the device setting decides, in CSS alone (src/styles/site.css). A visitor's choice is kept in
// their browser's localStorage under one key (config/site.json, theme.storage_key), written on the visitor's own device and never sent
// anywhere, and shows as data-theme on <html>. Both the page's head and the charts read it through the rules here.

import type { ThemeName } from "./theme";

export const isThemeName = (value: unknown): value is ThemeName => value === "light" || value === "dark";

// The theme that applies: the visitor's choice when data-theme holds one, otherwise the device setting. Anything else in the attribute
// (a hand-edited or stale value) is not a choice.
export function appliedTheme(attribute: string | null | undefined, deviceIsDark: boolean): ThemeName {
  return isThemeName(attribute) ? attribute : deviceIsDark ? "dark" : "light";
}

// The script every page carries in its head, run before the page is drawn so there is no flash of the wrong theme. It is this function's own text
// (the page writes bootTheme.toString() into an inline script), so it must use nothing outside its parameters and the browser. It:
//   - applies the stored choice if it is "light" or "dark" (a missing, unreadable or any other stored value is no choice, and the device decides);
//   - marks <html> with the class theme-js, which is what shows the toggle: without scripts there is no toggle, and no promise it makes is kept;
//   - makes a click on the toggle switch the theme that applies and update every toggle's state. A choice that differs from the device
//     setting is stored; one that is what the device already says is no override, so it is dropped and the page follows the device again;
//   - follows a choice made in another tab, and the device setting while no choice is made.
// The storage is guarded because a private window or blocked site data can make the accessor throw: the toggle then still works for the page.
export function bootTheme(key: string, doc: Document = document, win: Window = window): void {
  const root = doc.documentElement;
  const device = win.matchMedia("(prefers-color-scheme: dark)");
  const read = (): string | null => {
    try {
      const value = win.localStorage.getItem(key);
      return value === "light" || value === "dark" ? value : null;
    } catch (error) {
      return null;
    }
  };
  const apply = () => {
    const stored = read();
    if (stored) root.setAttribute("data-theme", stored);
    else root.removeAttribute("data-theme");
  };
  const applied = () => {
    const attribute = root.getAttribute("data-theme");
    return attribute === "light" || attribute === "dark" ? attribute : device.matches ? "dark" : "light";
  };
  const show = () => {
    const toggles = doc.querySelectorAll("[data-theme-toggle]");
    for (let i = 0; i < toggles.length; i++) toggles[i].setAttribute("aria-pressed", String(applied() === "dark"));
  };
  apply();
  root.classList.add("theme-js");
  doc.addEventListener("DOMContentLoaded", show);
  device.addEventListener("change", show);
  win.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) {
      apply();
      show();
    }
  });
  doc.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (!target || !target.closest || !target.closest("[data-theme-toggle]")) return;
    const next = applied() === "dark" ? "light" : "dark";
    const override = next !== (device.matches ? "dark" : "light");
    if (override) root.setAttribute("data-theme", next);
    else root.removeAttribute("data-theme");
    try {
      if (override) win.localStorage.setItem(key, next);
      else win.localStorage.removeItem(key);
    } catch (error) {
      // The choice holds for this page, and is not kept.
    }
    show();
  });
}
