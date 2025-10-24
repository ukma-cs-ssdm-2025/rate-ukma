from rating_app.models import Instructor


class InstructorRepository:
    def get_all(self) -> list[Instructor]:
        return list(Instructor.objects.all())

    def get_by_id(self, instructor_id: str) -> Instructor:
        return Instructor.objects.get(id=instructor_id)

    def get_or_create(
        self,
        *,
        first_name: str,
        last_name: str,
        patronymic: str | None,
        academic_degree: str | None,
        academic_title: str | None,
    ) -> tuple[Instructor, bool]:
        return Instructor.objects.get_or_create(
            first_name=first_name,
            last_name=last_name,
            patronymic=patronymic,
            academic_degree=academic_degree,
            academic_title=academic_title,
        )

    def create(self, **instructor_data) -> Instructor:
        return Instructor.objects.create(**instructor_data)

    def update(self, instructor: Instructor, **instructor_data) -> Instructor:
        for field, value in instructor_data.items():
            setattr(instructor, field, value)
        instructor.save()
        return instructor

    def delete(self, instructor: Instructor) -> None:
        instructor.delete()
