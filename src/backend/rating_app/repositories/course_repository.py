from typing import Any

from django.core.paginator import EmptyPage, Paginator
from django.db.models import Avg, Count, F

from rating_app.models import Course


class CourseRepository:
    def get_all(self) -> list[Course]:
        return list(Course.objects.all())

    def get_by_id(self, course_id: str) -> Course:
        return (
            Course.objects.select_related("department__faculty")
            .prefetch_related("offerings__semester", "course_specialities__speciality")
            .annotate(
                avg_difficulty_annot=Avg("offerings__ratings__difficulty"),
                avg_usefulness_annot=Avg("offerings__ratings__usefulness"),
                ratings_count_annot=Count("offerings__ratings__id", distinct=True),
            )
            .get(id=course_id)
        )

    def filter(
        self,
        name: str | None = None,
        type_kind: str | None = None,
        faculty: str | None = None,
        department: str | None = None,
        speciality: str | None = None,
        avg_difficulty_order: str | None = None,
        avg_usefulness_order: str | None = None,
        page_size: int = 20,
        page_number: int = 1,
    ) -> dict[str, Any]:
        """
        Returns a paginated result:
            {
              "items": [Course, ...],
              "page": 1,
              "page_size": 20,
              "total": 153,
              "total_pages": 8,
            }

        Sorting:
            avg_difficulty_order: "asc" or "desc" (None = no sort)
            avg_usefulness_order: "asc" or "desc" (None = no sort)
        """
        courses = (
            Course.objects.select_related("department__faculty")
            .prefetch_related("course_specialities__speciality")
            .all()
        )

        # Filters
        filters: dict[str, Any] = {}
        if name:
            filters["title__icontains"] = name
        if faculty:
            filters["department__faculty_id"] = faculty
        if department:
            filters["department_id"] = department

        courses = courses.filter(**filters)

        if type_kind:
            courses = courses.filter(course_specialities__type_kind=type_kind)
        if speciality:
            courses = courses.filter(course_specialities__speciality_id=speciality)

        # Always annotate avg ratings (needed by serializer)
        courses = courses.annotate(
            avg_difficulty_annot=Avg("offerings__ratings__difficulty"),
            avg_usefulness_annot=Avg("offerings__ratings__usefulness"),
            ratings_count_annot=Count("offerings__ratings__id", distinct=True),
        )

        # Sorting logic with nulls last
        order_by_fields = []
        if avg_difficulty_order in ("asc", "desc"):
            # Use F expression with nulls_last for proper null handling
            field = F("avg_difficulty_annot")
            if avg_difficulty_order == "asc":
                order_by_fields.append(field.asc(nulls_last=True))
            else:
                order_by_fields.append(field.desc(nulls_last=True))
        if avg_usefulness_order in ("asc", "desc"):
            field = F("avg_usefulness_annot")
            if avg_usefulness_order == "asc":
                order_by_fields.append(field.asc(nulls_last=True))
            else:
                order_by_fields.append(field.desc(nulls_last=True))

        if order_by_fields:
            # Apply custom sorting with title as secondary sort
            courses = courses.order_by(*order_by_fields, "title")
        else:
            # Default ordering to avoid pagination warning
            courses = courses.order_by("title")

        # Avoid duplicates from M2M joins
        courses = courses.distinct()

        # guardrails
        page_size = max(1, min(int(page_size or 20), 100))
        page_number = max(1, int(page_number or 1))

        paginator = Paginator(courses, page_size)
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages)

        items = list(page_obj.object_list)

        return {
            "items": items,
            "page": page_obj.number,
            "page_size": page_obj.paginator.per_page,
            "total": paginator.count,
            "total_pages": paginator.num_pages,
        }

    def create(self, **course_data) -> Course:
        return Course.objects.create(**course_data)

    def update(self, course: Course, **course_data) -> Course:
        for field, value in course_data.items():
            setattr(course, field, value)
        course.save()
        return course

    def delete(self, course: Course) -> None:
        course.delete()
