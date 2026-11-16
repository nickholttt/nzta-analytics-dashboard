// How a chart hands the panel the table of figures it draws, so the panel's download button writes that table and no other (D-111).
// The chart registers a function that builds its Figures when asked: the rows of a long series are built only at the click.
import { createContext, useContext, useEffect } from "react";
import type { Figures } from "../lib/figures";

export type FiguresGetter = () => Figures;
export const FiguresContext = createContext<((getter: FiguresGetter | null) => void) | null>(null);

// The getter must keep its identity from one render to the next (a ref or useCallback), or the chart registers again on every render.
export function useFigures(getter: FiguresGetter) {
  const register = useContext(FiguresContext);
  useEffect(() => {
    register?.(getter);
    return () => register?.(null);
  }, [register, getter]);
}
