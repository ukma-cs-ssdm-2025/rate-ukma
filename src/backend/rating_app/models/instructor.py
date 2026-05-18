from django.db import models

from .person import Person


class Instructor(Person):
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
