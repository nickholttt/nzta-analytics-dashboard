// The records of a reference file by its name under data/reference ("display_names.csv"), each by column name, or nothing where it is not there.
export function readReference(name: string): Record<string, string>[] | undefined;
