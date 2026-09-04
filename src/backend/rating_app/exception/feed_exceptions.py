from rest_framework.exceptions import ValidationError


class InvalidCursorError(ValidationError):
    """Raised when a client sends a cursor the server did not issue.

    Cursors travel in URLs, so they arrive truncated, hand-edited or stale from
    a bookmark. Subclassing DRF's `ValidationError` lets the shared
    `exception_handler` render this as the standard 400 envelope, instead of
    the 500 an unhandled decode error would produce.
    """

    default_detail = "Invalid feed cursor"
    default_code = "invalid_feed_cursor"
