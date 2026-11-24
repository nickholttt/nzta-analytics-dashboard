"""Gives a subset font the names the SIL Open Font License 1.1 requires of a Modified Version.

Both typefaces reserve a font name ("Plex" for IBM Plex Sans, "Source" for Source Serif 4), so a cut-down copy must not carry it in the names inside the
file. This replaces the family, full, PostScript, unique-id and variation-instance names, and leaves the copyright, licence and licence-address records
(name IDs 0, 13 and 14) exactly as the designers wrote them. Run by scripts/subset-fonts.mjs: python rename_font.py <file.woff2> <old-pattern=new> ...
"""
import re
import sys

from fontTools.ttLib import TTFont

KEPT = {0, 13, 14}
RESERVED = re.compile(r"plex|source", re.I)

path = sys.argv[1]
pairs = [a.split("=", 1) for a in sys.argv[2:]]
font = TTFont(path)
for record in font["name"].names:
    if record.nameID in KEPT:
        continue
    text = record.toUnicode()
    for old, new in pairs:
        text = re.sub(old, new, text)
    record.string = text
left = [(r.nameID, r.toUnicode()) for r in font["name"].names if r.nameID not in KEPT and RESERVED.search(r.toUnicode())]
if left:
    sys.exit(f"{path}: a reserved name is still in the file: {left}")
font.save(path)
