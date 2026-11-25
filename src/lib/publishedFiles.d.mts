// A file of the published data by its path under public/data ("cube/<dataset>/<field>.parquet", "events.json"), or nothing where it is not there.
export function readPublished(relative: string): ArrayBuffer | undefined;
