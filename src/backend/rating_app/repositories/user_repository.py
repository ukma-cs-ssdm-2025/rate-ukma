from django.contrib.auth import get_user_model

import structlog

logger = structlog.get_logger(__name__)


class UserRepository:
    def __init__(self):
        self._user_model = get_user_model()

    def get_by_email(self, email: str):
        """Get a user by email."""
        try:
            return self._user_model.objects.get(email=email)
        except self._user_model.DoesNotExist:
            return None
        except self._user_model.MultipleObjectsReturned:
            logger.warning("multiple_users_with_same_email", email=email)
            return None
