from typing import Any

from django.db.models.query import QuerySet

from rating_app.models import Course, CourseOffering, Semester
from rating_app.repositories.protocol import IRepository


class CourseOfferingRepository(IRepository[CourseOffering]):
    def get_all(self) -> list[CourseOffering]:
        return list(self._build_base_queryset().all())

    def get_by_id(self, id: str) -> CourseOffering:
        return self._build_base_queryset().get(id=id)

    def get_by_course(self, course_id: str) -> list[CourseOffering]:
        return list(self._build_base_queryset().filter(course_id=course_id))

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
        return CourseOffering.objects.update_or_create(code=code, defaults=defaults)

    def create(self, **offering_data) -> CourseOffering:
        return CourseOffering.objects.create(**offering_data)

    def update(self, obj: CourseOffering, **offering_data) -> CourseOffering:
        for field, value in offering_data.items():
            setattr(obj, field, value)
        obj.save()
        return obj

    # TODO: rewrite with id
    def delete(self, offering: CourseOffering) -> None:
        offering.delete()

    def get_or_create(self, *args: Any, **kwargs: Any) -> tuple[CourseOffering, bool]:
        return self.get_or_upsert(*args, **kwargs)

    def filter(self, *args: Any, **kwargs: Any) -> list[CourseOffering]:
        # not used in filtering yet, returns plain queryset
        return self.get_all()

    def _build_base_queryset(self) -> QuerySet[CourseOffering]:
        return CourseOffering.objects.select_related("course", "semester")
