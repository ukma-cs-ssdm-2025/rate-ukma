"""The semester the view tests freeze time inside.

The rating gate opens at the semester midpoint, so tests need a date on each
side of it. Importing these from a normal module keeps test files from
importing each other (or `conftest`, whose importability depends on the
rootdir being on `sys.path`).
"""

from rating_app.models.choices import SemesterTerm

DEFAULT_YEAR = 2023
DEFAULT_TERM = SemesterTerm.FALL
DEFAULT_DATE = "2023-10-25"
DEFAULT_BEFORE_MIDTERM_DATE = "2023-09-25"
DEFAULT_AFTER_MIDTERM_DATE = "2023-11-25"
