"""Handlers that write one kind of sync change to Rate UKMA.

A handler runs inside the apply's transaction and writes exactly the rows its
kind describes. ``exists`` answers whether the row a ``new`` change would
create is already there, so the stale pre-pass can supersede it as ``exists``
and a dependency can be checked without applying anything. Catalog kinds
register in PRs 7b and 7c; an unregistered kind is left proposed.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from rating_app.models import SyncChange

HandlerFunction = Callable[[SyncChange], None]


@dataclass(frozen=True)
class Handler:
    apply: HandlerFunction
    exists: Callable[[str], bool] | None = None


HANDLERS: dict[str, Handler] = {}


def register(
    kind: str, *, exists: Callable[[str], bool] | None = None
) -> Callable[[HandlerFunction], HandlerFunction]:
    def decorator(handler: HandlerFunction) -> HandlerFunction:
        HANDLERS[kind] = Handler(apply=handler, exists=exists)
        return handler

    return decorator


def handler_for(kind: str) -> Handler | None:
    return HANDLERS.get(kind)


from rating_app.sync.handlers import teachers  # noqa: E402,F401  # registers the teacher kinds
