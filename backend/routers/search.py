from __future__ import annotations

from fastapi import APIRouter, Depends

from dependencies import get_current_user, get_store
from models import UserOut

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=dict)
async def unified_search(q: str = "", limit: int = 8, current_user: UserOut = Depends(get_current_user)):
    if not q.strip():
        return {"trips": [], "places": [], "photos": [], "profiles": []}
    store = get_store()
    return await store.unified_search(current_user.id, q, limit)
