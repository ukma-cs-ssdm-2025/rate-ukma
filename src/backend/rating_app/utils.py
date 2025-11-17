"""Utility functions for the rating_app."""

from pydantic_core import ErrorDetails


def pydantic_errors_to_drf_format(
    errors: list[ErrorDetails],
) -> dict[str, list[str]]:
    """
    Convert Pydantic validation errors to DRF ValidationError format.

    Args:
        errors: List of Pydantic error dictionaries from ValidationError.errors()

    Returns:
        Dictionary mapping field names to lists of error messages,
        suitable for DRF's ValidationError

    Example:
        >>> errors = [
        ...     {'loc': ('field1',), 'msg': 'Invalid value', 'type': 'value_error'},
        ...     {'loc': ('field2', 0), 'msg': 'Required', 'type': 'missing'}
        ... ]
        >>> pydantic_errors_to_drf_format(errors)
        {'field1': ['Invalid value'], 'field2.0': ['Required']}
    """
    drf_errors: dict[str, list[str]] = {}

    for error in errors:
        # Convert location tuple to a field path string
        # e.g., ('field1',) -> 'field1', ('field1', 0, 'nested') -> 'field1.0.nested'
        loc = error.get("loc", ())
        field_path = ".".join(str(part) for part in loc) if loc else "non_field_errors"

        # Get the error message
        msg = error.get("msg", "Validation error")

        # Add to the errors dict
        if field_path not in drf_errors:
            drf_errors[field_path] = []
        drf_errors[field_path].append(msg)

    return drf_errors
