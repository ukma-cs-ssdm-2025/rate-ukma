import sentry_sdk

from ._base import *  # noqa: F403
from ._logging import *  # noqa: F403

# Session configuration
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Proxy SSL header for HTTPS
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SENTRY_DSN = config("SENTRY_DSN_BACKEND", default="")  # noqa: F405
if SENTRY_DSN:
    ENVIRONMENT = config("ENVIRONMENT")  # noqa: F405
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        # Environment helps filter issues in Sentry dashboard (staging/live)
        environment=ENVIRONMENT,
        # Add data like request headers and IP for users,
        # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
        send_default_pii=True,
        # Enable logs to be sent to Sentry
        enable_logs=True,
        # Capture all transactions for now
        traces_sample_rate=1.0,
        profile_session_sample_rate=1.0,
        # Set profile_lifecycle to "trace" to automatically
        # run the profiler on when there is an active transaction
        profile_lifecycle="trace",
    )
