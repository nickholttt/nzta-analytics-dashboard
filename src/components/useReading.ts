// Where a question reads its figures from (src/lib/kept.ts), for the Build page and for each chart of a canvas: the newest snapshot at
// once for a question that is not pinned or is pinned to the snapshot served or ahead of it, and for one pinned to an earlier month once the
// index, that snapshot's manifest and the values chosen have been read. Undefined until then, and for a new question until it is read, so a
// chart is never drawn from one snapshot and then another.
import { useEffect, useRef, useState } from "react";
import { isMonthKey, questionParams } from "../lib/builder";
import type { Question } from "../lib/builder";
import { loadKeptSnapshots, loadManifest, loadSlice } from "../lib/data";
import type { Manifest } from "../lib/data";
import { readingFor } from "../lib/kept";
import type { Loaders, Owner, Reading } from "../lib/kept";
import { servedMonth } from "../lib/pin";

const loaders: Loaders = { index: loadKeptSnapshots, manifest: loadManifest, slice: loadSlice };
const FROM_NEWEST: Reading = { kind: "served" };

export function useReading(q: Question, served: Manifest | null | undefined, owner: Owner): Reading | undefined {
  const key = `${String(questionParams(q))}|${q.values.join("|")}|${q.values2?.join("|") ?? ""}`;
  const [decided, setDecided] = useState<{ key: string; reading: Reading } | null>(null);
  const latestQuestion = useRef(q);
  latestQuestion.current = q;
  const earlier = Boolean(served && isMonthKey(q.snapshot) && q.snapshot < servedMonth(served));
  useEffect(() => {
    if (!earlier || !served) return;
    let current = true;
    readingFor(latestQuestion.current, served, loaders, owner).then((reading) => current && setDecided({ key, reading }));
    return () => {
      current = false;
    };
    // The question is read through its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, earlier, served, owner]);
  if (!isMonthKey(q.snapshot) || served === null) return FROM_NEWEST;
  if (served === undefined) return undefined;
  if (!earlier) return FROM_NEWEST;
  return decided?.key === key ? decided.reading : undefined;
}
