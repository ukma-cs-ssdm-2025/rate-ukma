from collections.abc import Iterator
from contextlib import contextmanager

from django.db import connections


@contextmanager
def advisory_lock(key: int) -> Iterator[bool]:
    """Holds Postgres advisory lock ``key`` for the block, on a connection of
    its own, so the job's transactions cannot release it. Yields False, and
    holds nothing, when another session has it."""
    connection = connections.create_connection("default")
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_lock(%s)", [key])
            row = cursor.fetchone()
            held = bool(row and row[0])
        try:
            yield held
        finally:
            if held:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_unlock(%s)", [key])
    finally:
        connection.close()
