import { useEffect, useRef, useState } from "react";

// Renders a Plot figure at the width of its container, and again whenever that width changes.
// onWidth tells the parent that width, for anything outside the figure that depends on it.
// label: what the chart draws, for a screen reader. The chart is one image to assistive technology: Plot names each of
// its mark groups ("rect", "rule"), which says nothing to a listener and is not allowed on an element with no role, so
// those names are dropped and the image, or the figure holding it and its legend, carries the label.
export function PlotFigure({ render, onWidth, label }: { render: (width: number) => Element; onWidth?: (width: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      setWidth(w);
      onWidth?.(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onWidth]);

  useEffect(() => {
    if (!width) return;
    const figure = render(width);
    figure.setAttribute("role", "img");
    figure.setAttribute("aria-label", label);
    for (const named of figure.querySelectorAll("[aria-label]")) named.removeAttribute("aria-label");
    ref.current?.replaceChildren(figure);
    return () => figure.remove();
  }, [render, width, label]);

  return <div ref={ref} className="chart" />;
}
