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
  // The note in one line (CLAUDE.md rule 4: a caveat is one line with a link). A public page shows it in place of public_note, and links to the
  // full note, which is the method page's section for the field (D-137).
  public_line?: string;
  // A condition from NOTE_CONDITIONS. When it does not hold, `note` and `public_note` are replaced by the matching `_otherwise`, or by
  // nothing where there is none, and `note_template` is not used.
  note_condition?: string;
  note_otherwise?: string;
  public_note_otherwise?: string;
};

// The anchor of a field's section on the method page.
export const fieldNoteAnchor = (id: string): string => `field-${id}`;

// The full note a field has a section for on the method page: where it has a one-line form, and no condition. A note with a condition speaks of
// the chart it sits on (it says what the note below it holds, or goes when a build lacks what it describes), so its line stands without a section.
export const fullNote = (d: NoteFields | undefined): string | undefined => (d?.public_line && !d.note_condition ? d.public_note : undefined);

// The note a view carries: plain text, or a template to fill from the manifest. A public page reads public_line, or public_note where there is
// no line; more is set where the line has a full note to link to.
// A condition the list does not know is taken to hold, so a typo shows the note and the config test (which checks every name) fails.
export function dimensionNote(d: NoteFields | undefined, internal: boolean, state: NoteState): { plain?: string; template?: string; more?: boolean } {
  if (!d) return {};
  const holds = d.note_condition === undefined ? true : (NOTE_CONDITIONS[d.note_condition]?.(state) ?? true);
  if (!internal && d.public_note) return { plain: holds ? (d.public_line ?? d.public_note) : d.public_note_otherwise, ...(fullNote(d) !== undefined ? { more: true } : {}) };
  if (!holds) return { plain: d.note_otherwise };
  return { plain: d.note, template: d.note_template };
}
