"""Handlers that write one kind of sync change to Rate UKMA.

A handler runs inside the apply's transaction and writes exactly the rows its
kind describes. ``exists`` answers whether the row a ``new`` change would
create is already there, so the stale pre-pass can supersede it as ``exists``
and a dependency can be checked without applying anything. A ``link`` kind's
``exists`` answers whether its row is linked, so ``requires`` naming it is met
once it applied.

Catalog writes are set-based, so a catalog handler also registers
``apply_many``: the apply passes it every ready change of that kind and it
writes them in a few statements instead of one per row.

A handler returns an optional report (counts a person should see, such as a
merge's old -> new course ids); the apply folds it into the approval's counts.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from rating_app.models import SyncChange

HandlerReport = dict[str, object]
HandlerFunction = Callable[[SyncChange], HandlerReport | None]
ManyHandlerFunction = Callable[[list[SyncChange]], HandlerReport | None]


class ChangeNotReadyError(Exception):
    """The handler cannot apply this change yet; the apply leaves it proposed."""


class ChangeStaleError(Exception):
    """The change's premise no longer holds; the apply supersedes it as stale."""


@dataclass(frozen=True)
class Handler:
    apply: HandlerFunction
    exists: Callable[[str], bool] | None = None
    apply_many: ManyHandlerFunction | None = None


HANDLERS: dict[str, Handler] = {}


def register(
    kind: str,
    *,
    exists: Callable[[str], bool] | None = None,
    apply_many: ManyHandlerFunction | None = None,
) -> Callable[[HandlerFunction], HandlerFunction]:
    def decorator(handler: HandlerFunction) -> HandlerFunction:
        HANDLERS[kind] = Handler(apply=handler, exists=exists, apply_many=apply_many)
        return handler

    return decorator


def handler_for(kind: str) -> Handler | None:
    return HANDLERS.get(kind)


from rating_app.sync.handlers import catalog, mapping, teachers  # noqa: E402,F401  # register kinds
