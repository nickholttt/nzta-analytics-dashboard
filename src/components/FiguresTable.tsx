// A chart's figures as a table behind a disclosure: the text equivalent of a chart that has no table of its own
// (WCAG 1.1.1), since a chart drawn as one image hides its axis labels from a screen reader. The rows are built only
// once it is opened: a trend can run to hundreds of months. The same rows are what the panel's download writes (src/lib/figures.ts).
import { useCallback, useRef, useState } from "react";
import { cellText } from "../lib/figures";
import type { Cell, Column } from "../lib/figures";
import { useFigures } from "./FiguresContext";

type Props = {
  // Names the table for a screen reader: what the figures are, and for which period.
  label: string;
  // The months or period the figures are for, said in the file of figures.
  period: string;
  // The first column names each row; text columns are set left, figures right.
  columns: Column[];
  // The first cell of each row must be unique.
  rows: () => Cell[][];
};

export function FiguresTable(props: Props) {
  const { label, columns, rows } = props;
  const [open, setOpen] = useState(false);
  const latest = useRef(props);
  latest.current = props;
  const getter = useCallback(() => ({ period: latest.current.period, columns: latest.current.columns, rows: latest.current.rows() }), []);
  useFigures(getter);
  const align = (i: number) => (i === 0 || columns[i]?.text ? "text" : "figure");
  return (
    <details className="figures" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>The figures behind this chart</summary>
      {open ? (
        <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
          <table className="key">
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th key={c.name} scope="col" className={i === 0 || c.text ? "text" : undefined}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows().map((cells) => (
                <tr key={cellText(cells[0])}>
                  {cells.map((cell, i) => (
                    <td key={columns[i]?.name ?? i} className={align(i)}>
                      {cellText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </details>
  );
}
