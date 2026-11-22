from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    resp = drf_exception_handler(exc, context)
    if resp is None:
        return resp

    if isinstance(resp.data, dict):
        detail = resp.data.get("detail", "Validation failed")
        body = {"detail": detail, "status": resp.status_code}

        fields = {k: v for k, v in resp.data.items() if k != "detail"}
        if fields:
            body["fields"] = fields

        code = getattr(detail, "code", None)
        if code is not None:
            body["code"] = code

        resp.data = body
    return resp
