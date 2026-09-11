"""Names fixed by docs/CUBE_SCHEMA.md. Changing any of these is a contract change."""

UNDEFINED = "__UNDEFINED__"
UNMAPPED = "__UNMAPPED__"
OTHER = "__OTHER__"
MODEL_KEY_SEPARATOR = "|"

SLICE_COLUMNS = [
    ("month", "DATE"),
    ("dim_value", "VARCHAR"),
    ("n", "INTEGER"),
    ("denominator", "INTEGER"),
    ("fc_sum", "DOUBLE"),
    ("fc_n", "INTEGER"),
    ("fc_eligible_n", "INTEGER"),
]
