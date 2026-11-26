// One field's counts split by a condition (the fact table's columns, read where the site is built), for pages that show each total beside its parts: the
// vehicles first registered new and the used imports, which add up to the total the one-field slice gives. Pure: it names no field or value, so
// tests/site/ runs it with made-up columns.
//
// A cut is used only where it agrees with the slice the page already shows, month by month and value by value (docs/CUBE_SCHEMA.md: a combination with
// no row is zero). Where it does not, the field has no cut and its page is drawn exactly as it was, with no switch, strip or extra column.
import type { SliceRow } from "./data";
import { isReservedValue } from "./chartSentence";

// The fact table's columns the site needs, lined up by position: each row is one count of vehicles with these values in this month.
export type FactColumns = { month: readonly string[]; n: readonly number[]; values: Readonly<Record<string, readonly string[]>> };

const SEPARATOR = "\u0000";

// A pair slice's rows (the vehicles with one value of each of two fields in a month: the a_value and b_value of the published file) as the fact table's columns,
// so the one cut reads either. `side` is the side the field is on in the pair (findPair); the condition is the other. A cut made from the pair agrees with one
// made from the fact table's rows of the same counts, which hold more fields and so more rows.
export type PairRows = { month: readonly string[]; n: readonly number[]; a: readonly string[]; b: readonly string[] };
export function pairColumns(rows: PairRows, field: string, condition: string, side: "a" | "b"): FactColumns {
  return { month: rows.month, n: rows.n, values: { [field]: side === "a" ? rows.a : rows.b, [condition]: side === "a" ? rows.b : rows.a } };
}

export class Cut {
  private constructor(
    // month -> value -> condition -> count
    private readonly cells: ReadonlyMap<string, ReadonlyMap<string, ReadonlyMap<string, number>>>,
    private readonly order: readonly string[],
  ) {}

  // The counts of `field` by `condition` over the fact table's rows. The conditions are listed in `order`, then any other the table holds as it holds it.
  // With `only`, just the rows where another field has that value: the cut of the vehicles of one powertrain, say.
  static from(columns: FactColumns, field: string, condition: string, order: readonly string[], only?: { field: string; value: string }): Cut | undefined {
    const values = columns.values[field];
    const conditions = columns.values[condition];
    const filter = only ? columns.values[only.field] : undefined;
    const length = columns.n.length;
    if (!values || !conditions || values.length !== length || conditions.length !== length || columns.month.length !== length) return undefined;
    if (only && (!filter || filter.length !== length)) return undefined;
    const cells = new Map<string, Map<string, Map<string, number>>>();
    const seen = new Set<string>();
    for (let i = 0; i < length; i++) {
      const n = columns.n[i];
      if (!Number.isFinite(n)) return undefined;
      if (only && filter?.[i] !== only.value) continue;
      const month = columns.month[i];
      let byValue = cells.get(month);
      if (!byValue) cells.set(month, (byValue = new Map()));
      let byCondition = byValue.get(values[i]);
      if (!byCondition) byValue.set(values[i], (byCondition = new Map()));
      byCondition.set(conditions[i], (byCondition.get(conditions[i]) ?? 0) + n);
      seen.add(conditions[i]);
    }
    const listed = order.filter((c) => seen.has(c));
    const rest = [...seen].filter((c) => !order.includes(c)).sort();
    return new Cut(cells, [...listed, ...rest]);
  }

  // The conditions the table holds, in the order they are shown.
  conditions = (): string[] => [...this.order];

  // A value's count under a condition in a month: zero where there is no row.
  at = (value: string, condition: string, month: string): number => this.cells.get(month)?.get(value)?.get(condition) ?? 0;

  // The sum over months.
  sum = (value: string, condition: string, months: readonly string[]): number => months.reduce((s, m) => s + this.at(value, condition, m), 0);

  // A value's count over every condition in a month.
  all = (value: string, month: string): number => {
    let total = 0;
    for (const n of this.cells.get(month)?.get(value)?.values() ?? []) total += n;
    return total;
  };

  // Every vehicle under a condition in a month.
  total = (condition: string, month: string): number => {
    let total = 0;
    for (const byCondition of this.cells.get(month)?.values() ?? []) total += byCondition.get(condition) ?? 0;
    return total;
  };

  // Every value the table holds in the months, in no order.
  values = (months: readonly string[]): string[] => {
    const out = new Set<string>();
    for (const m of months) for (const v of this.cells.get(m)?.keys() ?? []) out.add(v);
    return [...out];
  };

  // Whether this cut's every count is the sum of the same count in each of `parts`, and the parts hold nothing more: the cut of all the vehicles is
  // the cuts of each powertrain added up.
  agreesWithSum(parts: readonly Cut[]): boolean {
    let mine = 0;
    for (const [month, byValue] of this.cells) {
      for (const [value, byCondition] of byValue) {
        for (const [condition, n] of byCondition) {
          mine += n;
          if (parts.reduce((s, p) => s + p.at(value, condition, month), 0) !== n) return false;
        }
      }
    }
    let theirs = 0;
    for (const p of parts) for (const byValue of p.cells.values()) for (const byCondition of byValue.values()) for (const n of byCondition.values()) theirs += n;
    return mine === theirs;
  }

  // Whether the cut says what the slice says: every slice row's count is the sum over conditions, no row of the slice is hidden, and the table holds
  // no value in a month that the slice does not.
  agreesWith(slice: readonly SliceRow[] | undefined): boolean {
    if (!slice) return false;
    const listed = new Set<string>();
    for (const r of slice) {
      if (r.hidden || r.notBrokenDown || !Number.isFinite(r.n)) return false;
      if (this.all(r.value, r.month) !== r.n) return false;
      listed.add(`${r.month}${SEPARATOR}${r.value}`);
    }
    for (const [month, byValue] of this.cells) for (const value of byValue.keys()) if (!listed.has(`${month}${SEPARATOR}${value}`)) return false;
    return true;
  }
}

// The fewest vehicles over the months that any value the build names has: below it a value may be one the cap grouped as other, so a place by a part of
// the count (new alone) cannot be said for it. Nothing where the slice names no value.
export function capFloor(slice: readonly SliceRow[] | undefined, months: readonly string[]): number | undefined {
  if (!slice) return undefined;
  const wanted = new Set(months);
  const sums = new Map<string, number>();
  for (const r of slice) if (wanted.has(r.month) && !isReservedValue(r.value) && Number.isFinite(r.n)) sums.set(r.value, (sums.get(r.value) ?? 0) + r.n);
  return sums.size === 0 ? undefined : Math.min(...sums.values());
}
