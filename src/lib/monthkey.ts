// A month as "YYYY-MM" from whatever a Parquet reader hands back for a date. Pure, so a test can run it.
// A slice holds a few hundred distinct months across tens of thousands of rows, so each instant is converted once.
const INSTANT_KEYS = new Map<number, string>();
const keyOfInstant = (ms: number) => {
  let key = INSTANT_KEYS.get(ms);
  if (key === undefined) INSTANT_KEYS.set(ms, (key = new Date(ms).toISOString().slice(0, 7)));
  return key;
};
export function monthKey(value: unknown): string {
  if (value instanceof Date) return keyOfInstant(value.getTime());
  if (typeof value === "string") return value.slice(0, 7);
  if (typeof value === "number" || typeof value === "bigint") return keyOfInstant(Number(value) * 86_400_000);
  throw new Error(`unreadable month value: ${String(value)}`);
}
