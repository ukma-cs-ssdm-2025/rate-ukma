from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    resp = drf_exception_handler(exc, context)
    if resp is None:
        return resp
    body = {"detail": resp.data.get("detail", "Validation failed"), "status": resp.status_code}
    if isinstance(resp.data, dict):
        fields = {k: v for k, v in resp.data.items() if k != "detail"}
        if fields:
            body["fields"] = fields
    resp.data = body
    return resp
