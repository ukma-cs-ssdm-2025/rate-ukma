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
AVAILABLE_MEMORY=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
MAX_REQUESTS=$((AVAILABLE_MEMORY * 2 / 1024))

# optimal number of workers
CORES=$(nproc)
MEMORY_PER_WORKER=150
MAX_WORKERS_BY_MEMORY=$((AVAILABLE_MEMORY / MEMORY_PER_WORKER))
WORKERS=$((CORES < MAX_WORKERS_BY_MEMORY ? CORES : MAX_WORKERS_BY_MEMORY)) # for bigger instances we can use $((2 * CORES + 1))
WORKERS=$((WORKERS < 1 ? 1 : WORKERS)) # minimum 1 worker

# number of threads
THREADS=2 # for bigger instances we can use 4

# start gunicorn
echo "Starting gunicorn with $WORKERS workers, $THREADS threads and $MAX_REQUESTS max requests"

GUNICORN_ARGS=(
    --timeout 300
    --bind 0.0.0.0:8000
    --workers "$WORKERS"
    --worker-class gthread
    --threads "$THREADS"
    --access-logfile -
    --max-requests "$MAX_REQUESTS"
    --max-requests-jitter "$((MAX_REQUESTS / 10))"
    --keep-alive 5
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
