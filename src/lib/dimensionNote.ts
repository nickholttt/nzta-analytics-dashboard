// A dimension's note, which may depend on the state of the dataset it is read in (D-109 review). A note is data in config/dimensions.json;
// where what it says holds only in some states of a build, it names a condition from the short list below and may give the note to
// use when the condition does not hold (or none). Pure, with no imports, and no dimension named: the condition is a state of the
// build, not of any one dimension.
export type NoteState = {
  // The dataset divides its hybrids into mild and full, and so has a mild line (manifest: mild_split_published, absent meaning true).
  splitPublished: boolean;
};

export const NOTE_CONDITIONS: Record<string, (state: NoteState) => boolean> = {
  split_published: (state) => state.splitPublished,
};

export type NoteFields = {
  note?: string;
  note_template?: string;
  public_note?: string;
  // A condition from NOTE_CONDITIONS. When it does not hold, `note` and `public_note` are replaced by the matching `_otherwise`, or by
  // nothing where there is none, and `note_template` is not used.
  note_condition?: string;
  note_otherwise?: string;
  public_note_otherwise?: string;
};

// The note a view carries: plain text, or a template to fill from the manifest. A public page reads public_note where there is one.
// A condition the list does not know is taken to hold, so a typo shows the note and the config test (which checks every name) fails.
export function dimensionNote(d: NoteFields | undefined, internal: boolean, state: NoteState): { plain?: string; template?: string } {
  if (!d) return {};
  const holds = d.note_condition === undefined ? true : (NOTE_CONDITIONS[d.note_condition]?.(state) ?? true);
  if (!internal && d.public_note) return { plain: holds ? d.public_note : d.public_note_otherwise };
  if (!holds) return { plain: d.note_otherwise };
  return { plain: d.note, template: d.note_template };
}
