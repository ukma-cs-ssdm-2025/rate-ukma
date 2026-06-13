from django.db import models

from .person import Person


class Instructor(Person):
    """A person creditable as a course instructor, sourced from the M365
    directory (``ingest_instructors_from_csv``). The pool is intentionally
    broad: the export cannot distinguish teaching staff from students, so most
    rows are only *candidate* instructors and the ranked instructor list
    surfaces actually-rated people first. Distinct from ``Student`` (scraped
    from the site), which the same person may also appear in.
    """

    email = models.EmailField(max_length=254, unique=True, db_index=True)

    class Meta(Person.Meta):
        abstract = False

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name} <{self.email}>"

    def __repr__(self) -> str:
        return (
            f"<Instructor id={self.id} last_name={self.last_name} "
            f"first_name={self.first_name} email={self.email}>"
        )
