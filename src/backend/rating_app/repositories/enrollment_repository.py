from rating_app.models import CourseOffering, Enrollment, Student


class EnrollmentRepository:
    def get_all(self) -> list[Enrollment]:
        return list(Enrollment.objects.select_related("student", "offering").all())

    def get_by_id(self, enrollment_id: str) -> Enrollment:
        return Enrollment.objects.select_related("student", "offering").get(id=enrollment_id)

    def get_or_upsert(
        self,
        *,
        student: Student,
        offering: CourseOffering,
        status: str,
    ) -> tuple[Enrollment, bool]:
        defaults = {"status": status}
        lookup = {"student": student, "offering": offering}
        return Enrollment.objects.update_or_create(**lookup, defaults=defaults)

    def create(self, **enrollment_data) -> Enrollment:
        return Enrollment.objects.create(**enrollment_data)

    def update(self, enrollment: Enrollment, **enrollment_data) -> Enrollment:
        for field, value in enrollment_data.items():
            setattr(enrollment, field, value)
        enrollment.save()
        return enrollment

    def delete(self, enrollment: Enrollment) -> None:
        enrollment.delete()
