from decimal import Decimal

CATALOG_SYNC_LOCK_KEY = 768_001
SWITCH_NAME = "catalog_sync_proposals"

# The UKMA Data lists a catalog run reads; an apply saves each list's cursor.
UKMA_DATA_LISTS = (
    "faculties",
    "departments",
    "programmes",
    "terms",
    "courses",
    "offerings",
)

NO_TERM = "no_term"
ZERO_CREDITS = "zero_credits"
CREDITS_OUT_OF_RANGE = "credits_out_of_range"
TITLE_TOO_LONG = "title_too_long"
BAD_SAZ_CODE = "bad_saz_code"
NO_DEPARTMENT = "no_department"
UNKNOWN_PROGRAMME = "unknown_programme"
IDENTITY_COLLISION = "identity_collision"

MAX_CREDITS = Decimal("99.9")
MAX_NAME = 255
