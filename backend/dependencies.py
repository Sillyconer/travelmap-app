"""
TravelMap Backend — Dependency Injection

Provides the shared Store instance to all routers.
"""

from __future__ import annotations

from store import Store

# Singleton store instance — initialised in main.py on startup
_store: Store | None = None


def set_store(store: Store) -> None:
    global _store
    _store = store


def get_store() -> Store:
    assert _store is not None, "Store not initialised — call set_store() first"
    return _store
