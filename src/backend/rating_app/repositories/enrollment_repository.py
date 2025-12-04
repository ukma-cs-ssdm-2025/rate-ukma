from rating_app.models import CourseOffering, Enrollment, Student
from rating_app.models.choices import EnrollmentStatus


class EnrollmentRepository:
    def get_all(self) -> list[Enrollment]:
        return list(
            Enrollment.objects.select_related(
                "student__speciality", "offering__course", "offering__semester"
            ).all()
        )

    def get_by_id(self, enrollment_id: str) -> Enrollment:
        return Enrollment.objects.select_related(
            "student__speciality", "offering__course", "offering__semester"
        ).get(id=enrollment_id)

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

    def is_student_enrolled(self, student_id: str, offering_id: str) -> bool:
        return Enrollment.objects.filter(
            student_id=student_id,
            offering_id=offering_id,
            status__in=[EnrollmentStatus.ENROLLED, EnrollmentStatus.FORCED],
        ).exists()
