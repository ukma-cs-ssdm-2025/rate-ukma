from rating_app.models import Semester


class SemesterRepository:
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
