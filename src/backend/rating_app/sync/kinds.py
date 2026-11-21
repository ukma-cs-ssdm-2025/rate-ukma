"""Every kind of change a sync run can propose, in apply order.

The never-auto set is derived here, never listed by hand: a kind in the
`mapping` group, or one that can move ratings between courses, always needs a
person. The database check constraint on `SyncPolicy` is built from the same
tuple, so adding such a kind without a migration fails CI.
"""

from __future__ import annotations

from dataclasses import dataclass

TEACHERS = "teachers"
CATALOG = "catalog"

LINK = "link"
NEW = "new"
CHANGE = "change"
MAPPING = "mapping"
REMOVED = "removed"


@dataclass(frozen=True, slots=True)
class SyncKind:
    name: str
    source: str
    group: str
    order: int
    moves_ratings: bool = False


KINDS: tuple[SyncKind, ...] = (
    SyncKind("new_faculty", CATALOG, NEW, 10),
    SyncKind("link_faculty", CATALOG, LINK, 11),
    SyncKind("change_faculty", CATALOG, CHANGE, 12),
    SyncKind("new_department", CATALOG, NEW, 20),
    SyncKind("link_department", CATALOG, LINK, 21),
    SyncKind("change_department", CATALOG, CHANGE, 22),
    SyncKind("new_course", CATALOG, NEW, 30),
    SyncKind("link_course", CATALOG, LINK, 31),
    SyncKind("change_course", CATALOG, CHANGE, 32),
    SyncKind("new_offering", CATALOG, NEW, 40),
    SyncKind("link_offering", CATALOG, LINK, 41),
    SyncKind("change_offering", CATALOG, CHANGE, 42),
    SyncKind("teacher_created", TEACHERS, NEW, 50),
    SyncKind("teacher_link_added", TEACHERS, CHANGE, 51),
    SyncKind("teacher_link_removed", TEACHERS, CHANGE, 52),
    SyncKind("merge_courses", CATALOG, MAPPING, 60, moves_ratings=True),
    SyncKind("move_offering", CATALOG, MAPPING, 61, moves_ratings=True),
    SyncKind("place_offering", CATALOG, MAPPING, 62),
    SyncKind("relink_course", CATALOG, MAPPING, 63),
    SyncKind("removed_course", CATALOG, REMOVED, 70),
    SyncKind("removed_offering", CATALOG, REMOVED, 71),
)

KIND_BY_NAME: dict[str, SyncKind] = {kind.name: kind for kind in KINDS}

NEVER_AUTO_KINDS: tuple[str, ...] = tuple(
    sorted(kind.name for kind in KINDS if kind.group == MAPPING or kind.moves_ratings)
)
