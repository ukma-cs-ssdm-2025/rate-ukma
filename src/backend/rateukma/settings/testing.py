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
ENABLE_CACHE = False

# Keep tests isolated from the local Redis: waffle caches flag lookups in the
# default cache, so a real backend leaks state between tests and across runs
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}

# Use DB sessions in tests since the cache backend is disabled
SESSION_ENGINE = "django.contrib.sessions.backends.db"
