# The site's font files

These five files are cut-down copies of two typefaces, made by `scripts/subset-fonts.mjs` (with `scripts/rename_font.py`) from the variable fonts in the
npm packages `@fontsource-variable/ibm-plex-sans` and `@fontsource-variable/source-serif-4`, both 5.3.0.

| files | cut from | font version | named inside the file |
|---|---|---|---|
| `plex-latin`, `plex-accents`, `plex-macron` | IBM Plex Sans (IBM Corp.) | 3.201 | NZVR Sans |
| `serif-latin`, `serif-macron` | Source Serif 4 (Adobe) | 4.004 | NZVR Serif |

Each is cut to the characters a New Zealand page uses (the range of each is in `src/styles/site.css`). The weight axis is kept (400 to 700); Source Serif's
optical-size axis is fixed at one size.

Both typefaces are licensed under the SIL Open Font License 1.1 (`LICENSE-plex.txt`, `LICENSE-serif.txt`), and both reserve a font name ("Plex" and "Source").
A cut-down copy is a Modified Version under that licence and may not carry the reserved name, so the script renames the copies inside the file (family,
full, PostScript, unique-id and variation-instance names) to "NZVR Sans" and "NZVR Serif". The copyright, licence and licence-address records (name IDs
0, 13 and 14) are kept exactly as the designers wrote them. The files are not sold on their own.
