import { useContext, useEffect, useRef, useState } from "react";
import { SentenceContext } from "./ChartSentence";
import { TableOnlyContext } from "./FiguresContext";

// Renders a Plot figure at the width of its container, and again whenever that width changes.
// onWidth tells the parent that width, for anything outside the figure that depends on it.
// label: what the chart draws, for a screen reader. The chart is one image to assistive technology: Plot names each of
// its mark groups ("rect", "rule"), which says nothing to a listener and is not allowed on an element with no role, so
// those names are dropped and the image, or the figure holding it and its legend, carries the label.
// Where the panel shows the figures as a table (TableOnlyContext), nothing is drawn: the element is not there to measure.
// The chart's sentence, once it has one, describes the figure to assistive technology (aria-describedby), so a screen reader reads it with the chart.
// reserve: the height a figure will have, where the chart knows it before it draws (a ranking's follows its bars); otherwise the two heights of
// src/lib/theme.ts, chosen by the card's width in src/styles/canvas.css.
export function PlotFigure({ render, onWidth, label, reserve }: { render: (width: number) => Element; onWidth?: (width: number) => void; label: string; reserve?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Whether a figure is in the element yet. Until it is, the element holds the height a figure has (src/lib/theme.ts, chartHeight), so the
  // sentence and the table under it do not jump down when the figure arrives a frame after the width is known.
  const [drawn, setDrawn] = useState(false);
  const tableOnly = useContext(TableOnlyContext);
  const sentence = useContext(SentenceContext);
  const describedBy = sentence?.text ? sentence.id : undefined;

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
  }, [onWidth, tableOnly]);

  useEffect(() => {
    if (!width || tableOnly) return;
    const figure = render(width);
    figure.setAttribute("role", "img");
    figure.setAttribute("aria-label", label);
    for (const named of figure.querySelectorAll("[aria-label]")) named.removeAttribute("aria-label");
    ref.current?.replaceChildren(figure);
    setDrawn(true);
    return () => figure.remove();
  }, [render, width, label, tableOnly]);

  // After the figure is drawn, and again when only the sentence arrives or goes: the picture is not redrawn for it.
  useEffect(() => {
    const figure = ref.current?.firstElementChild;
    if (!figure) return;
    if (describedBy) figure.setAttribute("aria-describedby", describedBy);
    else figure.removeAttribute("aria-describedby");
  }, [describedBy, render, width, label, tableOnly]);

  const waiting = !drawn;
  return tableOnly ? null : <div ref={ref} className={waiting && reserve === undefined ? "chart chart-reserved" : "chart"} style={waiting && reserve !== undefined ? { minHeight: reserve } : undefined} />;
}
