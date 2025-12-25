from ._base import *  # noqa: F403
from ._logging import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

MIGRATION_MODULES = {app.split(".")[-1]: None for app in INSTALLED_APPS}  # noqa: F405

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = []
DEBUG = False

# Remove compression middleware during tests to avoid dependency issues
# and unnecessary processing overhead.
MIDDLEWARE = [m for m in MIDDLEWARE if "CompressionMiddleware" not in m]  # noqa: F405
