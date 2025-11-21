from datetime import datetime
from typing import Any

from rating_app.models import Semester
from rating_app.models.choices import SemesterTerm
from rating_app.repositories.protocol import IRepository


class SemesterRepository(IRepository[Semester]):
    def get_all(self) -> list[Semester]:
        return list(Semester.objects.all())

    def get_by_id(self, semester_id: str) -> Semester:
        return Semester.objects.get(id=semester_id)

    def get_or_create(self, *, year: int, term: str) -> tuple[Semester, bool]:
        return Semester.objects.get_or_create(year=year, term=term)

    def create(self, **semester_data) -> Semester:
        return Semester.objects.create(**semester_data)

    def update(self, semester: Semester, **semester_data) -> Semester:
        for field, value in semester_data.items():
            setattr(semester, field, value)
        semester.save()
        return semester

    def delete(self, semester: Semester) -> None:
        semester.delete()

    def filter(self, *args: Any, **kwargs: Any) -> list[Semester]:
        #! TODO: not implemented
        return self.get_all()

    def get_current(self) -> Semester:
        month = datetime.now().month
        if month >= 9 and month <= 12:
            term = SemesterTerm.FALL
        elif month >= 1 and month < 5:
            term = SemesterTerm.SPRING
        else:
            term = SemesterTerm.SUMMER

        year = datetime.now().year
        current_sem = Semester.objects.get(year=year, term=term)

        return current_sem
