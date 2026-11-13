// A chart's figures as a table behind a disclosure: the text equivalent of a chart that has no table of its own
// (WCAG 1.1.1), since a chart drawn as one image hides its axis labels from a screen reader. The rows are built only
// once it is opened: a trend can run to hundreds of months.
import { useState } from "react";

type Props = {
  // Names the table for a screen reader: what the figures are, and for which period.
  label: string;
  // The first column names each row; text columns are set left, figures right.
  columns: { name: string; text?: boolean }[];
  // The first cell of each row must be unique.
  rows: () => string[][];
};

export function FiguresTable({ label, columns, rows }: Props) {
  const [open, setOpen] = useState(false);
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
                <tr key={cells[0]}>
                  {cells.map((cell, i) => (
                    <td key={columns[i]?.name ?? i} className={align(i)}>
                      {cell}
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
