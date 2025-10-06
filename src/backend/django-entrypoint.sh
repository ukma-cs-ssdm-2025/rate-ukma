#!/bin/bash

set -e # exit on error
set -o pipefail # exit on pipe error
set -o nounset # exit on unset variable
set -m # enable job control

# function to handle gunicorn shutdown
shutdown() {
    echo "Shutting down gunicorn gracefully..."

    kill -SIGINT "$gunicorn_process" 2>/dev/null || true
    wait "$gunicorn_process" 2>/dev/null || true

    echo "Gunicorn shutdown complete"
    exit 0
}

# trap SIGTERM and SIGINT
trap shutdown SIGTERM SIGINT

# starting django project
python manage.py migrate --noinput
python manage.py collectstatic --noinput

# optimal number of workers
CORES=$(nproc)
WORKERS=$((2 * CORES + 1))

# available memory in MB
AVAILABLE_MEMORY=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
MAX_REQUESTS=$((AVAILABLE_MEMORY * 2 / 1024))

# start gunicorn
echo "Starting gunicorn with $WORKERS workers and $MAX_REQUESTS max requests"

GUNICORN_ARGS=(
    --timeout 300
    --bind 0.0.0.0:8000
    --workers "$WORKERS"
    --worker-class gthread
    --threads 4
    --access-logfile -
    --max-requests "$MAX_REQUESTS"
    --max-requests-jitter "$((MAX_REQUESTS / 10))"
    --keep-alive 5
)

if [ "${DJANGO_SETTINGS_MODULE:-}" = "rateukma.settings.dev" ]; then
    echo "Dev environment detected, hot reload enabled"
    GUNICORN_ARGS+=( --reload )
fi

gunicorn rateukma.wsgi:application "${GUNICORN_ARGS[@]}" &

# keeping gunicorn process running
gunicorn_process=$!
wait "$gunicorn_process"
