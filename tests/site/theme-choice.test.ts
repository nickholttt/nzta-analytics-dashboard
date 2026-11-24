// Which theme applies, and the script every page's head runs to apply a visitor's choice (src/lib/themeChoice.ts). The script is run here from its own
// text, as the page carries it, against a stand-in for the browser.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";

const { appliedTheme, bootTheme, isThemeName } = await import("../../src/lib/themeChoice.ts");

test("with no choice the device setting decides, a valid choice overrides it, and a value that is not a theme is no choice", () => {
  assert.equal(appliedTheme(null, false), "light");
  assert.equal(appliedTheme(undefined, true), "dark");
  assert.equal(appliedTheme("dark", false), "dark");
  assert.equal(appliedTheme("light", true), "light");
  for (const bad of ["", "Dark", "auto", "dark ", "1"]) assert.equal(appliedTheme(bad, true), "dark", `"${bad}" is not a choice`);
  assert.ok(isThemeName("dark") && isThemeName("light") && !isThemeName("auto") && !isThemeName(null));
});

// A stand-in for the page: the root element's attributes and classes, listeners by event, toggle buttons, a store, and a device setting.
function page({ stored, deviceDark = false, throwing = false }: { stored?: string; deviceDark?: boolean; throwing?: boolean }) {
  const attributes = new Map<string, string>();
  const classes = new Set<string>();
  const listeners: Record<string, ((event: unknown) => void)[]> = {};
  const media: Record<string, ((event: unknown) => void)[]> = {};
  const toggle = { state: "false", setAttribute: (name: string, value: string) => void (name === "aria-pressed" && (toggle.state = value)), closest: (selector: string) => (selector === "[data-theme-toggle]" ? toggle : null) };
  const store = new Map<string, string>(stored === undefined ? [] : [["theme", stored]]);
  const device = { matches: deviceDark, addEventListener: (_: string, fn: (e: unknown) => void) => void (media.change ??= []).push(fn) };
  const winListeners: Record<string, ((event: unknown) => void)[]> = {};
  const doc = {
    documentElement: {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => void attributes.set(name, value),
      removeAttribute: (name: string) => void attributes.delete(name),
      classList: { add: (name: string) => void classes.add(name) },
    },
    querySelectorAll: () => [toggle],
    addEventListener: (type: string, fn: (e: unknown) => void) => void (listeners[type] ??= []).push(fn),
  };
  const win = {
    matchMedia: () => device,
    localStorage: {
      getItem: (key: string) => {
        if (throwing) throw new Error("blocked");
        return store.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (throwing) throw new Error("blocked");
        store.set(key, value);
      },
      removeItem: (key: string) => {
        if (throwing) throw new Error("blocked");
        store.delete(key);
      },
    },
    addEventListener: (type: string, fn: (e: unknown) => void) => void (winListeners[type] ??= []).push(fn),
  };
  // Run the function as the page does: from its text.
  new Function("document", "window", `(${bootTheme.toString()})("theme", document, window)`)(doc, win);
  return {
    theme: () => attributes.get("data-theme"),
    classes,
    store,
    toggle,
    click: () => listeners.click.forEach((fn) => fn({ target: toggle })),
    clickElsewhere: () => listeners.click.forEach((fn) => fn({ target: { closest: () => null } })),
    ready: () => listeners.DOMContentLoaded.forEach((fn) => fn({})),
    deviceChanges: (dark: boolean) => {
      device.matches = dark;
      media.change.forEach((fn) => fn({}));
    },
    otherTab: (value: string | null) => {
      if (value === null) store.delete("theme");
      else store.set("theme", value);
      winListeners.storage.forEach((fn) => fn({ key: "theme" }));
    },
  };
}

test("a stored choice is applied before anything is drawn; none, or a bad one, leaves the device setting to decide", () => {
  assert.equal(page({ stored: "dark" }).theme(), "dark");
  assert.equal(page({ stored: "light", deviceDark: true }).theme(), "light");
  for (const stored of [undefined, "", "blue", "Dark", "null"]) assert.equal(page({ stored }).theme(), undefined, `stored ${JSON.stringify(stored)}`);
  assert.equal(page({ throwing: true }).theme(), undefined, "storage that throws is no choice");
});

test("the toggle shows only once the script has run, and reads the theme that applies", () => {
  const p = page({ deviceDark: true });
  assert.ok(p.classes.has("theme-js"));
  p.ready();
  assert.equal(p.toggle.state, "true", "the device is dark, so the toggle starts pressed");
  p.deviceChanges(false);
  assert.equal(p.toggle.state, "false", "the device setting changing while no choice is made");
});

test("a click switches to the other theme from the one that applies, and keeps a choice that differs from the device under one key", () => {
  const p = page({ deviceDark: true });
  p.click();
  assert.equal(p.theme(), "light");
  assert.deepEqual([...p.store], [["theme", "light"]]);
  assert.equal(p.toggle.state, "false");
  p.clickElsewhere();
  assert.equal(p.theme(), "light", "a click that is not on the toggle changes nothing");
});

test("a click back to what the device says drops the choice, so the page follows the device again", () => {
  const p = page({ deviceDark: true });
  p.click();
  p.click();
  assert.equal(p.theme(), undefined, "dark is what the device says: no override is left on the page");
  assert.deepEqual([...p.store], [], "and nothing is kept");
  assert.equal(p.toggle.state, "true");
  p.deviceChanges(false);
  assert.equal(p.toggle.state, "false", "the device setting is followed once more");
  const kept = page({ stored: "dark", deviceDark: false });
  kept.click();
  assert.equal(kept.theme(), undefined);
  assert.deepEqual([...kept.store], [], "a choice stored earlier is dropped the same way");
});

test("a choice that cannot be kept still holds for the page", () => {
  const p = page({ throwing: true });
  p.click();
  assert.equal(p.theme(), "dark");
  assert.equal(p.toggle.state, "true");
});

test("a choice made in another tab is followed, and clearing it hands the decision back to the device", () => {
  const p = page({ deviceDark: false });
  p.otherTab("dark");
  assert.equal(p.theme(), "dark");
  p.otherTab(null);
  assert.equal(p.theme(), undefined);
});
