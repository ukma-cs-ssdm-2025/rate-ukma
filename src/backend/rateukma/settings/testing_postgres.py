from . import _base
from .testing import *  # noqa: F403

DATABASES = _base.DATABASES
# Undoes testing.py: the analytics views exist only through migrations
MIGRATION_MODULES = {}
