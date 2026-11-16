// The order a page fetches its charts in. A page's first chart should not share the connection with the charts below it,
// so a deferred panel draws nothing from the cube until the page's first chart has its rows (or has failed, or has
// nothing to draw) and the panel is near the screen. The gate is per page load and opens once.
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
