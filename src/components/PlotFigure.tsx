import { useEffect, useRef } from "react";

export function PlotFigure({ render }: { render: () => Element }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const figure = render();
    ref.current?.replaceChildren(figure);
    return () => figure.remove();
  }, [render]);
  return <div ref={ref} />;
}
