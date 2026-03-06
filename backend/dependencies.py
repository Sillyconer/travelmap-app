"""
TravelMap Backend — Dependency Injection

Provides the shared Store instance to all routers.
"""

from __future__ import annotations

from fastapi import Header, HTTPException

from auth_utils import decode_access_token
from models import UserOut
from store import Store

# Singleton store instance — initialised in main.py on startup
_store: Store | None = None


def set_store(store: Store) -> None:
    global _store
    _store = store


def get_store() -> Store:
    assert _store is not None, "Store not initialised — call set_store() first"
    return _store


async def get_current_user(authorization: str | None = Header(default=None)) -> UserOut:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    store = get_store()
    user = await store.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
