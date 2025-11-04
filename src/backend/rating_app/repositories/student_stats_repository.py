from typing import Any

from django.db.models import Q

from rating_app.models import CourseOffering


class StudentStatisticsRepository:
    """
    Get student specific statistics (specifically on courses/offerings rated).
    """

    def get_rating_stats(self, student_id: str) -> list[dict[str, Any]]:
        """
        Returns a lightweight rating history for a student.
        Each record is an attended course with its offerings
        (those that student was enrolled in).
        """
        offerings_qs = (
            CourseOffering.objects.filter(
                Q(enrollments__student_id=student_id)
                & (Q(enrollments__status="ENROLLED") | Q(enrollments__status="FORCED"))
            )
            .select_related("course", "semester")
            .prefetch_related("ratings", "enrollments")
            .distinct()
        )

        courses_dict: dict[str, dict[str, Any]] = {}

        for offering in offerings_qs:
            course_id = str(offering.course.id)

            rating_obj = offering.ratings.filter(student_id=student_id).first()  # type: ignore[attr-defined]
            rated = None
            if rating_obj:
                rated = {
                    "difficulty": rating_obj.difficulty,
                    "usefulness": rating_obj.usefulness,
                    "comment": rating_obj.comment,
                    "created_at": rating_obj.created_at,
                }

            offering_data = {
                "id": str(offering.id),
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
        from rating_app.models import CourseOffering

        offerings_qs = (
            CourseOffering.objects.filter(
                Q(enrollments__student_id=student_id)
                & (Q(enrollments__status="ENROLLED") | Q(enrollments__status="FORCED"))
            )
            .select_related("course", "semester")
            .prefetch_related("ratings")
            .distinct()
            .order_by("semester__year", "semester__term", "course__title")
        )

        result = []
        for offering in offerings_qs:
            rating_obj = offering.ratings.filter(student_id=student_id).first()  # type: ignore[attr-defined]
            rated = None
            if rating_obj:
                rated = {
                    "difficulty": rating_obj.difficulty,
                    "usefulness": rating_obj.usefulness,
                    "comment": rating_obj.comment,
                    "created_at": rating_obj.created_at,
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
