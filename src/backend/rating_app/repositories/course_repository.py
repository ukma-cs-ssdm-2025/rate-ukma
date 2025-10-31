from typing import Any

from django.core.paginator import Paginator
from django.db.models import Avg, Count, F, QuerySet

from rating_app.constants import DEFAULT_PAGE_NUMBER, MAX_PAGE_SIZE, MIN_PAGE_SIZE
from rating_app.filters import CourseFilterPayload, CourseFilters
from rating_app.models import Course, Department
from rating_app.models.choices import CourseStatus


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
        if filters is None:
            filters = CourseFilters(**kwargs)

        courses = self._build_base_queryset()
        courses = self._apply_basic_filters(courses, filters)
        courses = self._apply_speciality_filters(courses, filters)
        courses = self._apply_annotations(courses)
        courses = self._apply_range_filters(courses, filters)
        courses = self._apply_sorting(courses, filters)
        courses = courses.distinct()

        return self._paginate(courses, filters)

    def _build_base_queryset(self) -> QuerySet[Course]:
        return (
            Course.objects.select_related("department__faculty")
            .prefetch_related(
                "course_specialities__speciality",
                "offerings__semester",
                "offerings__instructors",
            )
            .all()
        )

    def _apply_basic_filters(
        self, courses: QuerySet[Course], filters: CourseFilters
    ) -> QuerySet[Course]:
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

        return courses.filter(**q_filters) if q_filters else courses

    def _apply_speciality_filters(
        self, courses: QuerySet[Course], filters: CourseFilters
    ) -> QuerySet[Course]:
        if filters.type_kind:
            courses = courses.filter(course_specialities__type_kind=filters.type_kind)
        if filters.speciality:
            courses = courses.filter(course_specialities__speciality_id=filters.speciality)
        return courses

    def _apply_annotations(self, courses: QuerySet[Course]) -> QuerySet[Course]:
        return courses.annotate(
            avg_difficulty_annot=Avg("offerings__ratings__difficulty"),
            avg_usefulness_annot=Avg("offerings__ratings__usefulness"),
            ratings_count_annot=Count("offerings__ratings__id", distinct=True),
        )

    def _apply_range_filters(
        self, courses: QuerySet[Course], filters: CourseFilters
    ) -> QuerySet[Course]:
        if filters.avg_difficulty_min is not None:
            courses = courses.filter(avg_difficulty_annot__gte=filters.avg_difficulty_min)
        if filters.avg_difficulty_max is not None:
            courses = courses.filter(avg_difficulty_annot__lte=filters.avg_difficulty_max)
        if filters.avg_usefulness_min is not None:
            courses = courses.filter(avg_usefulness_annot__gte=filters.avg_usefulness_min)
        if filters.avg_usefulness_max is not None:
            courses = courses.filter(avg_usefulness_annot__lte=filters.avg_usefulness_max)
        return courses

    def _apply_sorting(self, courses: QuerySet[Course], filters: CourseFilters) -> QuerySet[Course]:
        order_by_fields = self._build_order_by_fields(filters)

        if order_by_fields:
            return courses.order_by(*order_by_fields, "title")
        return courses.order_by("title")

    def _build_order_by_fields(self, filters: CourseFilters) -> list[Any]:
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
        return order_by_fields

    def _paginate(self, courses: QuerySet[Course], filters: CourseFilters) -> CourseFilterPayload:
        page_size = max(MIN_PAGE_SIZE, min(int(filters.page_size), MAX_PAGE_SIZE))
        page_number = max(DEFAULT_PAGE_NUMBER, int(filters.page))

        paginator = Paginator(courses, page_size)
        page_obj = paginator.get_page(page_number)

        return CourseFilterPayload(
            items=list(page_obj.object_list),
            page=page_obj.number,
            page_size=page_obj.paginator.per_page,
            total=paginator.count,
            total_pages=paginator.num_pages,
            filters=filters,
        )

    def get_or_create(
        self,
        *,
        title: str,
        department: Department,
        status: str = CourseStatus.PLANNED,
        description: str | None = None,
    ) -> tuple[Course, bool]:
        return Course.objects.get_or_create(
            title=title,
            department=department,
            status=status,
            description=description,
        )

    def update(self, course: Course, **course_data) -> Course:
        for field, value in course_data.items():
            setattr(course, field, value)
        course.save()
        return course

    def delete(self, course: Course) -> None:
        course.delete()
