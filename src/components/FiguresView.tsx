// A chart's figures as a table on the page, in place of its picture: the same table the chart's download writes (src/lib/figures.ts),
// for a visitor who wants the numbers and not the drawing (CLAUDE.md, Shapes: a table of the figures is always available). The chart
// itself stays mounted and out of sight, so the figures are the ones it would draw and nothing is worked out twice.
import { cellText } from "../lib/figures";
import type { FiguresGetter } from "./FiguresContext";

type Props = {
  // The chart's own table of figures, once it has registered one.
  getter: FiguresGetter | null;
  // Names the table for a screen reader.
  label: string;
  // What to say until the chart has its figures.
  loading: string;
};

export function FiguresView({ getter, label, loading }: Props) {
  if (!getter) return <p className="meta">{loading}</p>;
  const { period, columns, rows } = getter();
  const side = (i: number) => (i === 0 || columns[i]?.text ? "text" : "figure");
  return (
    <div className="table-scroll figures-view" role="region" aria-label={label} tabIndex={0}>
      <table className="key">
        <caption className="visually-hidden">{period}</caption>
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
          {rows.map((cells) => (
            <tr key={cellText(cells[0])}>
              {cells.map((cell, i) => {
                const marked = typeof cell === "string" ? undefined : cell.mark;
                return (
                  <td key={columns[i]?.name ?? i} className={marked ? `${side(i)} marked` : side(i)} title={typeof cell === "string" ? undefined : cell.reason}>
                    {cellText(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
