from __future__ import annotations

import ast
from pathlib import Path

FORBIDDEN = frozenset({"apply", "revert"})


def _direct_imports(tree: ast.AST) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in {"rating_app.sync.apply", "rating_app.sync.revert"}:
                    found.add(alias.name.rsplit(".", 1)[1])
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            if node.module in {"rating_app.sync.apply", "rating_app.sync.revert"}:
                found.add(node.module.rsplit(".", 1)[1])
            elif node.module == "rating_app.sync":
                found.update(alias.name for alias in node.names if alias.name in FORBIDDEN)
    return found


def test_views_and_the_console_go_through_decisions_only():
    app = Path(__file__).resolve().parents[1]
    files = [*(app / "views").rglob("*.py"), app / "management" / "commands" / "catalog_sync.py"]
    offenders = {
        str(path.relative_to(app)): sorted(_direct_imports(ast.parse(path.read_text())))
        for path in files
        if _direct_imports(ast.parse(path.read_text())) & FORBIDDEN
    }

    assert offenders == {}
