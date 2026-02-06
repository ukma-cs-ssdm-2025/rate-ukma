from typing import Any

from django.db.models import Prefetch, Q

from rating_app.application_schemas.student import Student as StudentDTO
from rating_app.exception.student_exceptions import StudentNotFoundError
from rating_app.models import CourseOffering, Rating, Student
from rating_app.repositories.to_domain_mappers import StudentMapper


class StudentStatisticsRepository:
    """
    Get student specific statistics (specifically on courses/offerings rated).
    """

    def __init__(self, mapper: StudentMapper) -> None:
        self._mapper = mapper

    def get_student_by_user_id(self, user_id: str) -> StudentDTO:
        try:
            model = Student.objects.select_related("speciality").get(user_id=user_id)
        except Student.DoesNotExist as err:
            raise StudentNotFoundError() from err
        return self._mapper.process(model)

    def get_rating_stats(self, student_id: str) -> list[dict[str, Any]]:
        """
        Returns a lightweight rating history for a student.
        Each record is an attended course with its offerings
        (those that student was enrolled in).
        """
        student_ratings = Prefetch(
            "ratings",
            queryset=Rating.objects.filter(student_id=student_id),
            to_attr="student_ratings_list",
        )

        offerings_qs = (
            CourseOffering.objects.filter(
                Q(enrollments__student_id=student_id)
                & (Q(enrollments__status="ENROLLED") | Q(enrollments__status="FORCED"))
            )
            .select_related("course", "semester")
            .prefetch_related(student_ratings)
            .distinct()
        )

        courses_dict: dict[str, dict[str, Any]] = {}

        for offering in offerings_qs:
            course_id = str(offering.course.id)

            student_ratings_list: list[Rating] = getattr(offering, "student_ratings_list", [])
            rating_obj = student_ratings_list[0] if student_ratings_list else None
            rated = None
            if rating_obj:
                rated = {
                    "id": str(rating_obj.id),
                    "difficulty": rating_obj.difficulty,
                    "usefulness": rating_obj.usefulness,
                    "comment": rating_obj.comment,
                    "created_at": rating_obj.created_at,
                    "is_anonymous": rating_obj.is_anonymous,
                }

            offering_data = {
                "id": str(offering.id),
                "course_id": course_id,
                "year": offering.semester.year,
                "season": offering.semester.term,
                "rated": rated,
            }

            if course_id not in courses_dict:
                courses_dict[course_id] = {"id": course_id, "offerings": []}

            courses_dict[course_id]["offerings"].append(offering_data)

        return list(courses_dict.values())

    def get_detailed_rating_stats(self, student_id: str) -> list[dict[str, Any]]:
        """
        Returns detailed rating history for a student.
        Each record is an attended course offering.
        """

        student_ratings = Prefetch(
            "ratings",
            queryset=Rating.objects.filter(student_id=student_id),
            to_attr="student_ratings_list",
        )

        offerings_qs = (
            CourseOffering.objects.filter(
                Q(enrollments__student_id=student_id)
                & (Q(enrollments__status="ENROLLED") | Q(enrollments__status="FORCED"))
            )
            .select_related("course", "semester")
            .prefetch_related(student_ratings)
            .distinct()
            .order_by("semester__year", "semester__term", "course__title")
        )

        result = []
        for offering in offerings_qs:
            student_ratings_list: list[Rating] = getattr(offering, "student_ratings_list", [])
            rating_obj = student_ratings_list[0] if student_ratings_list else None
            rated = None
            if rating_obj:
                rated = {
                    "id": str(rating_obj.id),
                    "difficulty": rating_obj.difficulty,
                    "usefulness": rating_obj.usefulness,
                    "comment": rating_obj.comment,
                    "created_at": rating_obj.created_at,
                    "is_anonymous": rating_obj.is_anonymous,
                }

            result.append(
                {
                    "course_id": str(offering.course.id),
                    "course_title": offering.course.title,
                    "course_code": offering.code,
                    "course_offering_id": str(offering.id),
                    "semester": {"year": offering.semester.year, "season": offering.semester.term},
                    "rated": rated,
                }
            )

        return result
