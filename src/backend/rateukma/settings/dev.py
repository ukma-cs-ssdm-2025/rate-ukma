from ._base import *  # noqa: F403
from ._logging import *  # noqa: F403

# Performance metrics configuration
PERFORMANCE_METRICS_FILE = BASE_DIR / "profiling" / "profile_results.json"  # noqa: F405 - BASE_DIR configured in base
CPROFILE_OUTPUT_FILE = BASE_DIR / "profiling" / "cprofile_output.txt"  # noqa: F405 - BASE_DIR configured in base
