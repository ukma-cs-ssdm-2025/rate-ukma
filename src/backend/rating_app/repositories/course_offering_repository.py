from typing import Any

from rating_app.models import Course, CourseOffering, Semester
from rating_app.repositories.protocol import IRepository


class CourseOfferingRepository(IRepository[CourseOffering]):
    def get_all(self) -> list[CourseOffering]:
        return list(CourseOffering.objects.select_related("course", "semester").all())

    def get_by_id(self, offering_id: str) -> CourseOffering:
        return CourseOffering.objects.select_related("course", "semester").get(id=offering_id)

    def get_by_course(self, course_id: str) -> list[CourseOffering]:
        return list(CourseOffering.objects.select_related("course").filter(course_id=course_id))

    def get_or_upsert(
        self,
        *,
        course: Course,
        semester: Semester,
        code: str,
        exam_type: str,
        practice_type: str | None,
        credits: float,
        weekly_hours: int,
        lecture_count: int | None,
        practice_count: int | None,
        max_students: int | None,
        max_groups: int | None,
        group_size_min: int | None,
        group_size_max: int | None,
    ) -> tuple[CourseOffering, bool]:
        lookup = {"code": code}
        defaults = {
            "course": course,
            "semester": semester,
            "exam_type": exam_type,
            "practice_type": practice_type,
            "credits": credits,
            "weekly_hours": weekly_hours,
            "lecture_count": lecture_count,
            "practice_count": practice_count,
            "max_students": max_students,
            "max_groups": max_groups,
            "group_size_min": group_size_min,
            "group_size_max": group_size_max,
        }
        return CourseOffering.objects.update_or_create(**lookup, defaults=defaults)

    def create(self, **offering_data) -> CourseOffering:
        return CourseOffering.objects.create(**offering_data)

    def update(self, offering: CourseOffering, **offering_data) -> CourseOffering:
        for field, value in offering_data.items():
            setattr(offering, field, value)
        offering.save()
        return offering

    def delete(self, offering: CourseOffering) -> None:
        offering.delete()

    def get_or_create(self, *args: Any, **kwargs: Any) -> tuple[CourseOffering, bool]:
        #! TODO: not implemented
        return self.get_or_upsert(*args, **kwargs)

    def filter(self, *args: Any, **kwargs: Any) -> list[CourseOffering]:
        #! TODO: not implemented
        return self.get_all()
