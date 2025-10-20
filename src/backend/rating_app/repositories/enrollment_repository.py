from ..models import Enrollment
from ..models.choices import EnrollmentStatus


class EnrollmentRepository:
    def is_student_enrolled(self, student_id: str, offering_id: str) -> bool:
        return Enrollment.objects.filter(
            student_id=student_id,
            offering_id=offering_id,
            status__in=[EnrollmentStatus.ENROLLED, EnrollmentStatus.FORCED],
        ).exists()
