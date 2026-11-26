from rest_framework import status
from rest_framework.exceptions import APIException, NotFound


class UkmaDataNotConfiguredError(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "UKMA Data is not configured: set UKMA_DATA_URL and UKMA_DATA_API_KEY."
    default_code = "ukma_data_not_configured"


class UkmaDataUnavailableError(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "UKMA Data is unavailable."
    default_code = "ukma_data_unavailable"


class UkmaDataForbiddenError(APIException):
    """UKMA Data refused the server's key: it lacks a scope the endpoint needs."""

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Ключ UKMA Data цього сервера не має доступу до цього розділу"
    default_code = "ukma_data_forbidden"


class UkmaDataDecideDisabledError(UkmaDataForbiddenError):
    """The server's UKMA Data key lacks `review:decide`, so /data stays read-only."""

    default_detail = "Тут лише перегляд: рішення змінюють спільні дані САЗ"


class UkmaDataDecisionNotFoundError(NotFound):
    """UKMA Data does not know the case or course the decision names."""

    default_detail = "UKMA Data не знає такої справи або дисципліни"
    default_code = "ukma_data_not_found"


REFUSAL_TEXT: dict[str, str] = {
    "same_course": "Не можна об'єднати дисципліну саму із собою.",
    "course_merged": "Цю дисципліну вже об'єднано з іншою.",
    "target_merged": "Дисципліну, з якою об'єднують, уже об'єднано з іншою.",
    "level_mismatch": "Дисципліни різного рівня: об'єднати можна лише однакові.",
    "not_merged": "Цю дисципліну не об'єднано, тож роз'єднувати нічого.",
    "not_student_match": "Це не справа про студента.",
    "not_open": "Справу вже закрито або вона неактуальна.",
}

REFUSAL_FALLBACK = "UKMA Data відмовила в цьому рішенні"


class UkmaDataDecisionRefusedError(APIException):
    """UKMA Data answered 409: the decision would leave the data inconsistent."""

    status_code = status.HTTP_409_CONFLICT
    default_code = "ukma_data_refused"

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(detail=REFUSAL_TEXT.get(reason, REFUSAL_FALLBACK))
