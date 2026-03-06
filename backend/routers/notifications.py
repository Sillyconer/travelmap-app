from __future__ import annotations

from fastapi import APIRouter, Depends

from dependencies import get_current_user, get_store
from models import NotificationOut, NotificationReadUpdate, UserOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
    current_user: UserOut = Depends(get_current_user),
):
    store = get_store()
    return await store.list_notifications(
        current_user.id,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )


@router.get("/unread-count", response_model=dict)
async def unread_count(current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    count = await store.get_unread_notification_count(current_user.id)
    return {"count": count}


@router.post("/read", response_model=dict)
async def mark_read(payload: NotificationReadUpdate, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    updated = await store.mark_notifications_read(current_user.id, payload.ids)
    return {"updated": updated}


@router.post("/read-all", response_model=dict)
async def mark_all_read(current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    updated = await store.mark_all_notifications_read(current_user.id)
    return {"updated": updated}
