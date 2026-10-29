import uuid

from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import extend_schema
from pydantic import ValidationError as ModelValidationError

from rating_app.application_schemas.personal_plan import (
    PlanCoursePutParams,
    PlanCoursePutRequest,
)
from rating_app.application_schemas.student import Student
from rating_app.exception.course_exceptions import InvalidCourseIdentifierError
from rating_app.serializers import PersonalPlanSerializer
from rating_app.services import PersonalPlanService, StudentService
from rating_app.views.decorators import require_student

from .responses import R_PERSONAL_PLAN, R_PERSONAL_PLAN_PLACE, R_PERSONAL_PLAN_REMOVE

logger = structlog.get_logger(__name__)


def _parse_course_id(course_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(course_id)
    except ValueError as exc:
        raise InvalidCourseIdentifierError() from exc


@extend_schema(tags=["student", "personal-plan"])
class PersonalPlanViewSet(viewsets.ViewSet):
    student_service: StudentService | None = None
    personal_plan_service: PersonalPlanService | None = None

    @extend_schema(
        summary="The student's personal study plan.",
        description="Study years with their semesters: courses taken per САЗ for past and "
        "current years, the student's picks for the current and later ones.",
        responses=R_PERSONAL_PLAN,
    )
    @require_student
    def retrieve(self, request, student: Student) -> Response:
        assert self.personal_plan_service is not None

        plan = self.personal_plan_service.get_plan(student)
        return Response(PersonalPlanSerializer(plan).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Put a course into a semester of the plan.",
        description="Adds the course, or moves it if it is already planned elsewhere. "
        "Also promotes a backup to main and demotes a main course to backup.",
        request=PlanCoursePutRequest,
        responses=R_PERSONAL_PLAN_PLACE,
    )
    @require_student
    def place(self, request, course_id: str, student: Student) -> Response:
        assert self.personal_plan_service is not None

        parsed_course_id = _parse_course_id(course_id)
        try:
            request_params = PlanCoursePutRequest.model_validate(request.data)
        except ModelValidationError as e:
            logger.error("validation_error", errors=e.errors())
            raise ValidationError(
                {".".join(map(str, error["loc"])): [error["msg"]] for error in e.errors()}
            ) from e
        params = PlanCoursePutParams(**request_params.model_dump(), course_id=parsed_course_id)

        plan = self.personal_plan_service.place_course(student, params)
        return Response(PersonalPlanSerializer(plan).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Drop a course from the plan.",
        description="Only the student's own picks: courses taken per САЗ stay.",
        responses=R_PERSONAL_PLAN_REMOVE,
    )
    @require_student
    def remove(self, request, course_id: str, student: Student) -> Response:
        assert self.personal_plan_service is not None

        self.personal_plan_service.remove_course(student, _parse_course_id(course_id))
        return Response(status=status.HTTP_204_NO_CONTENT)
