from dataclasses import dataclass

from rest_framework.fields import ValidationError


@dataclass
class CourseQueryParams:
    name: str | None = None
    type_kind: str | None = None
    instructor: str | None = None
    faculty: str | None = None
    department: str | None = None
    speciality: str | None = None
    semester_year: int | None = None
    semester_term: str | None = None
    avg_difficulty_min: float | None = None
    avg_difficulty_max: float | None = None
    avg_usefulness_min: float | None = None
    avg_usefulness_max: float | None = None
    avg_difficulty_order: str | None = None
    avg_usefulness_order: str | None = None


class CourseFilterParser:
    INVALID_VALUE = "Invalid value"

    def __init__(self, min_rating: float, max_rating: float, semester_term_enum):
        self.min_rating = min_rating
        self.max_rating = max_rating
        self.semester_term_enum = semester_term_enum

    def parse(self, query_params: dict) -> CourseQueryParams:
        semester_year = self._parse_semester_year(query_params.get("semesterYear"))
        semester_term = self._parse_semester_term(query_params.get("semesterTerm"))

        avg_difficulty_min = self._parse_rating_value(
            "avg_difficulty_min", query_params.get("avg_difficulty_min")
        )
        avg_difficulty_max = self._parse_rating_value(
            "avg_difficulty_max", query_params.get("avg_difficulty_max")
        )
        self._validate_rating_range(
            avg_difficulty_min, avg_difficulty_max, "avg_difficulty_min", "avg_difficulty_max"
        )

        avg_usefulness_min = self._parse_rating_value(
            "avg_usefulness_min", query_params.get("avg_usefulness_min")
        )
        avg_usefulness_max = self._parse_rating_value(
            "avg_usefulness_max", query_params.get("avg_usefulness_max")
        )
        self._validate_rating_range(
            avg_usefulness_min, avg_usefulness_max, "avg_usefulness_min", "avg_usefulness_max"
        )

        return CourseQueryParams(
            name=query_params.get("name"),
            type_kind=query_params.get("typeKind"),
            instructor=query_params.get("instructor"),
            faculty=query_params.get("faculty"),
            department=query_params.get("department"),
            speciality=query_params.get("speciality"),
            semester_year=semester_year,
            semester_term=semester_term,
            avg_difficulty_min=avg_difficulty_min,
            avg_difficulty_max=avg_difficulty_max,
            avg_usefulness_min=avg_usefulness_min,
            avg_usefulness_max=avg_usefulness_max,
            avg_difficulty_order=query_params.get("avg_difficulty_order"),
            avg_usefulness_order=query_params.get("avg_usefulness_order"),
        )

    def _parse_rating_value(self, param: str, raw_value: str | None) -> float | None:
        if raw_value is None:
            return None

        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            raise ValidationError({param: [self.INVALID_VALUE]}) from None

        if not (self.min_rating <= value <= self.max_rating):
            raise ValidationError({param: ["Value out of range"]})

        return value

    def _parse_semester_year(self, raw: str | None) -> int | None:
        if raw is None:
            return None

        try:
            year = int(raw)
        except (ValueError, TypeError):
            raise ValidationError({"semesterYear": [self.INVALID_VALUE]}) from None

        if year < 1991:
            raise ValidationError({"semesterYear": ["Value out of range"]})

        return year

    def _parse_semester_term(self, raw: str | None) -> str | None:
        if raw is None:
            return None

        normalized_term = raw.upper()
        if normalized_term in self.semester_term_enum.values:
            return normalized_term

        raise ValidationError({"semesterTerm": [self.INVALID_VALUE]})

    def _validate_rating_range(
        self, min_val: float | None, max_val: float | None, min_name: str, max_name: str
    ) -> None:
        if min_val is not None and max_val is not None and min_val > max_val:
            raise ValidationError(
                {
                    min_name: [f"Must be less than or equal to {max_name}"],
                    max_name: [f"Must be greater than or equal to {min_name}"],
                }
            )
