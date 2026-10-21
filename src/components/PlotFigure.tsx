import { useEffect, useRef, useState } from "react";

// Renders a Plot figure at the width of its container, and again whenever that width changes.
// onWidth tells the parent that width, for anything outside the figure that depends on it.
export function PlotFigure({ render, onWidth }: { render: (width: number) => Element; onWidth?: (width: number) => void }) {
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
    ref.current?.replaceChildren(figure);
    return () => figure.remove();
  }, [render, width]);

  return <div ref={ref} className="chart" />;
}
