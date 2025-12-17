from decimal import Decimal
from typing import cast
from uuid import UUID

from rating_app.application_schemas.course import Course as CourseDTO
from rating_app.models.choices import CourseStatus
from rating_app.models.course import Course as CourseModel

from .protocol import IDjangoToDomainModelMapper


class CourseModelMapper(IDjangoToDomainModelMapper[CourseModel, CourseDTO]):
    def map_to_dto(self, model: CourseModel) -> CourseDTO:
        course_id = cast(UUID, model.id)

        title = str(model.title)
        description = str(getattr(model, "description", ""))

        department = getattr(model, "department", None)
        department_id = cast(UUID | None, getattr(model, "department_id", None))
        if department_id is None and department is not None:
            department_id = cast(UUID, department.id)
        if department_id is None:
            department_id = UUID(int=0)

        faculty = getattr(department, "faculty", None) if department else None

        raw_status = str(getattr(model, "status", ""))
        status = (
            CourseStatus(raw_status) if raw_status in CourseStatus.values else CourseStatus.PLANNED
        )

        avg_difficulty_raw = cast(float | Decimal | None, model.avg_difficulty)
        avg_usefulness_raw = cast(float | Decimal | None, model.avg_usefulness)
        ratings_count_raw = cast(int | None, model.ratings_count)

        return CourseDTO(
            id=course_id,
            title=title,
            description=description,
            status=status,
            department_id=department_id,
            department_name=department.name if department else "",
            faculty_name=faculty.name if faculty else "",
            specialities=list(model.specialities.values()),  # type: ignore[attr-defined]
            avg_difficulty=(float(avg_difficulty_raw) if avg_difficulty_raw is not None else None),
            avg_usefulness=(float(avg_usefulness_raw) if avg_usefulness_raw is not None else None),
            ratings_count=int(ratings_count_raw or 0),
        )
