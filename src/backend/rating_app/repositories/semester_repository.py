from typing import Any

from rating_app.models import Semester
from rating_app.repositories.protocol import IRepository


class SemesterRepository(IRepository[Semester]):
    def get_all(self) -> list[Semester]:  # type: ignore[override]
        return list(Semester.objects.all())  # type: ignore[return-value]

    def get_by_id(self, semester_id: str) -> Semester:  # type: ignore[override]
        return Semester.objects.get(id=semester_id)

    def get_or_create(self, *, year: int, term: str) -> tuple[Semester, bool]:  # type: ignore[override]
        return Semester.objects.get_or_create(year=year, term=term)

    def create(self, **semester_data) -> Semester:
        return Semester.objects.create(**semester_data)

    def update(self, semester: Semester, **semester_data) -> Semester:  # type: ignore[override]
        for field, value in semester_data.items():
            setattr(semester, field, value)
        semester.save()
        return semester

    def delete(self, semester: Semester) -> None:  # type: ignore[override]
        semester.delete()

    def filter(self, *args: Any, **kwargs: Any) -> list[Semester]:  # type: ignore[override]
        #! TODO: not implemented
        return self.get_all()
