from typing import Any

from django.core.paginator import Paginator
from django.db.models import Avg, Count, F

from rating_app.constants import DEFAULT_PAGE_NUMBER, MAX_PAGE_SIZE, MIN_PAGE_SIZE
from rating_app.filters import CourseFilterPayload, CourseFilters
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

    def filter(self, filters: CourseFilters | None = None, **kwargs) -> CourseFilterPayload:
        """
        Returns a paginated result:
            {
              "items": [Course, ...],
              "page": 1,
              "page_size": 20,
              "total": 153,
              "total_pages": 8,
              "filters": CourseFilters(...),
            }

        Sorting:
            avg_difficulty_order: "asc" or "desc" (None = no sort)
            avg_usefulness_order: "asc" or "desc" (None = no sort)
        """
        courses = (
            Course.objects.select_related("department__faculty")
            .prefetch_related(
                "course_specialities__speciality",
                "offerings__semester",
                "offerings__instructors",
            )
            .all()
        )
        if filters is None:
            filters = CourseFilters(**kwargs)

        # Filters
        q_filters: dict[str, Any] = {}
        if filters.name:
            q_filters["title__icontains"] = filters.name
        if filters.faculty:
            q_filters["department__faculty_id"] = filters.faculty
        if filters.department:
            q_filters["department_id"] = filters.department
        if filters.semester_year:
            q_filters["offerings__semester__year"] = filters.semester_year
        if filters.semester_term:
            q_filters["offerings__semester__term"] = filters.semester_term
        if filters.instructor:
            q_filters["offerings__instructors__id"] = filters.instructor

        courses = courses.filter(**q_filters)

        if filters.type_kind:
            courses = courses.filter(course_specialities__type_kind=filters.type_kind)
        if filters.speciality:
            courses = courses.filter(course_specialities__speciality_id=filters.speciality)

        # Always annotate avg ratings (needed by serializer)
        courses = courses.annotate(
            avg_difficulty_annot=Avg("offerings__ratings__difficulty"),
            avg_usefulness_annot=Avg("offerings__ratings__usefulness"),
            ratings_count_annot=Count("offerings__ratings__id", distinct=True),
        )

        # Sorting logic with nulls last
        order_by_fields = []
        if filters.avg_difficulty_order:
            field = F("avg_difficulty_annot")
            if filters.avg_difficulty_order == "asc":
                order_by_fields.append(field.asc(nulls_last=True))
            else:
                order_by_fields.append(field.desc(nulls_last=True))
        if filters.avg_usefulness_order:
            field = F("avg_usefulness_annot")
            if filters.avg_usefulness_order == "asc":
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
        page_size = max(MIN_PAGE_SIZE, min(int(filters.page_size), MAX_PAGE_SIZE))
        page_number = max(DEFAULT_PAGE_NUMBER, int(filters.page))

        paginator = Paginator(courses, page_size)
        page_obj = paginator.get_page(page_number)

        items = list(page_obj.object_list)

        return CourseFilterPayload(
            items=items,
            page=page_obj.number,
            page_size=page_obj.paginator.per_page,
            total=paginator.count,
            total_pages=paginator.num_pages,
            filters=filters,
        )

    def create(self, **course_data) -> Course:
        return Course.objects.create(**course_data)

    def update(self, course: Course, **course_data) -> Course:
        for field, value in course_data.items():
            setattr(course, field, value)
        course.save()
        return course

    def delete(self, course: Course) -> None:
        course.delete()
