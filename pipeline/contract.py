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

# A pair slice is a 1-D slice split by a second dimension: the same counts, keyed by both values.
PAIR_SEPARATOR = "__"
PAIR_COLUMNS = [
    ("month", "DATE"),
    ("a_value", "VARCHAR"),
    ("b_value", "VARCHAR"),
    ("n", "INTEGER"),
    ("denominator", "INTEGER"),
    ("fc_sum", "DOUBLE"),
    ("fc_n", "INTEGER"),
    ("fc_eligible_n", "INTEGER"),
]
