from rest_framework import status
from rest_framework.exceptions import APIException


class UkmaDataNotConfiguredError(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "UKMA Data is not configured: set UKMA_DATA_URL and UKMA_DATA_API_KEY."
    default_code = "ukma_data_not_configured"


class UkmaDataUnavailableError(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "UKMA Data is unavailable."
    default_code = "ukma_data_unavailable"
