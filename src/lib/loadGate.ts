// The order a page fetches its charts in. A page's first chart should not share the connection with the charts below it,
// so a deferred panel draws nothing from the cube until the page's first chart is drawn (or has failed, or has nothing to draw)
// and the panel is near the screen. The gate is per page load and opens once.
let open = false;
const waiting = new Set<() => void>();

export function openGate() {
  if (open) return;
  open = true;
  for (const run of waiting) run();
  waiting.clear();
}

// Runs `run` once the gate is open (at once if it already is). The returned function cancels a run still waiting.
export function whenGateOpens(run: () => void): () => void {
  if (open) {
    run();
    return () => {};
  }
  waiting.add(run);
  return () => void waiting.delete(run);
}

// Whether a panel at this place is near the visible part of the page: within `margin` viewport heights above or below it. The
// same margin the panel's observer uses (a root margin of 100%), but read from the page as it is laid out now, so a panel that was
// near only while every panel was a short placeholder is not taken for near once the first chart has drawn and pushed it down.
export function isNearScreen(rect: { top: number; bottom: number }, viewportHeight: number, margin = 1): boolean {
  return rect.bottom >= -margin * viewportHeight && rect.top <= (1 + margin) * viewportHeight;
}
