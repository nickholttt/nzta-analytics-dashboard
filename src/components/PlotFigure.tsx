import { useEffect, useRef, useState } from "react";

// Renders a Plot figure at the width of its container, and again whenever that width changes.
export function PlotFigure({ render }: { render: (width: number) => Element }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;
    const figure = render(width);
    ref.current?.replaceChildren(figure);
    return () => figure.remove();
  }, [render, width]);

  return <div ref={ref} className="chart" />;
}
