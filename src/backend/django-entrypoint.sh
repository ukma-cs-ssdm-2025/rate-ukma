#!/bin/bash

set -e # exit on error
set -o pipefail # exit on pipe error
set -o nounset # exit on unset variable
set -m # enable job control

gunicorn_process=""

# function to handle gunicorn shutdown
shutdown() {
    echo "Shutting down gunicorn gracefully..."

    if [[ -n ${gunicorn_process:-} ]]; then
        kill -SIGINT "$gunicorn_process" 2>/dev/null || true
        wait "$gunicorn_process" 2>/dev/null || true
    fi

    echo "Gunicorn shutdown complete"
    return 0
}

# trap SIGTERM and SIGINT
trap shutdown SIGTERM SIGINT

# starting django project
uv run python manage.py migrate --noinput
mkdir -p "${STATIC_ROOT}"
uv run python manage.py collectstatic --noinput

# available memory in MB
AVAILABLE_MEMORY_KB=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
AVAILABLE_MEMORY_MB=$((AVAILABLE_MEMORY_KB / 1024))
MAX_REQUESTS=$((AVAILABLE_MEMORY_MB * 2))

# optimal number of workers
# sync workers handle one request at a time (no threads), so we run ~2x the
# process count gthread used (it had 2 threads/worker) to keep equivalent
# concurrency for I/O-bound requests. Still capped by available memory.
CORES=$(nproc)
MEMORY_PER_WORKER_MB=150
MAX_WORKERS_BY_MEMORY=$((AVAILABLE_MEMORY_MB / MEMORY_PER_WORKER_MB))
WORKERS_BY_CORES=$((4 * CORES + 1))
WORKERS=$((WORKERS_BY_CORES < MAX_WORKERS_BY_MEMORY ? WORKERS_BY_CORES : MAX_WORKERS_BY_MEMORY))
WORKERS=$((WORKERS < 1 ? 1 : WORKERS))

# Allow override via environment variable
if [[ -n "${GUNICORN_WORKERS:-}" ]]; then
    WORKERS="$GUNICORN_WORKERS"
fi # minimum 1 worker

# start gunicorn
echo "Starting gunicorn (sync) with $WORKERS workers and $MAX_REQUESTS max requests"

GUNICORN_ARGS=(
    --timeout 300
    --bind 0.0.0.0:8000
    --workers "$WORKERS"
    # sync worker: one request per worker, no persistent keep-alive connection
    # pool. This removes the gthread CLOSE_WAIT socket leak (issue #609, ADR-0008)
    # at its root. Each connection is closed after a single request, which matches
    # nginx's upstream "Connection: close" exactly, so we give up nothing.
    # (sync ignores --threads and --keep-alive, so they are intentionally absent.)
    --worker-class sync
    --access-logfile -
    --max-requests "$MAX_REQUESTS"
    --max-requests-jitter "$((MAX_REQUESTS / 10))"
)

# environment-specific settings
if [[ "${DJANGO_SETTINGS_MODULE:-}" = "rateukma.settings.dev" ]]; then
    echo "Development environment detected, hot reload enabled"
    GUNICORN_ARGS+=( --reload )
else
    echo "Production environment detected, preload enabled"
    GUNICORN_ARGS+=( --preload )
fi

gunicorn rateukma.wsgi:application "${GUNICORN_ARGS[@]}" &

# keeping gunicorn process running
gunicorn_process=$!
wait "$gunicorn_process"
