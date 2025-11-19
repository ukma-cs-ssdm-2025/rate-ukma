from rest_framework.exceptions import NotFound


class UserNotFoundError(NotFound):
    default_detail = "User not found"
    default_code = "user_not_found"
