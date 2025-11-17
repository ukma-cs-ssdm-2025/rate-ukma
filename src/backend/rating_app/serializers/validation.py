from pydantic_core import ErrorDetails


def pydantic_errors_to_drf_format(errors: list[ErrorDetails]) -> dict[str, list[str]]:
    drf_errors: dict[str, list[str]] = {}
    for error in errors:
        loc = error.get("loc", ())
        field_path = ".".join(str(part) for part in loc) if loc else "non_field_errors"
        msg = error.get("msg", "Validation error")
        if field_path not in drf_errors:
            drf_errors[field_path] = []
        drf_errors[field_path].append(msg)
    return drf_errors
