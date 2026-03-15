from rest_framework.exceptions import NotFound


class NotificationCursorNotFoundError(NotFound):
    default_detail = "Notification cursor not found for this user"
    default_code = "notification_cursor_not_found"
