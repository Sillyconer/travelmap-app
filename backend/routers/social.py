from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from dependencies import get_current_user, get_store
from models import FriendOut, FriendRequestCreate, FriendRequestOut, UserOut

router = APIRouter(prefix="/api/social", tags=["social"])


@router.get("/friends", response_model=list[FriendOut])
async def list_friends(current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    return await store.list_friends(current_user.id)


@router.get("/friend-requests", response_model=list[FriendRequestOut])
async def list_friend_requests(current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    return await store.list_friend_requests_for_user(current_user.id)


@router.post("/friend-requests", response_model=FriendRequestOut, status_code=201)
async def send_friend_request(data: FriendRequestCreate, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    try:
        return await store.send_friend_request(current_user.id, data.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/friend-requests/{request_id}/accept")
async def accept_friend_request(request_id: int, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    ok = await store.accept_friend_request(request_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Friend request not found")
    return {"ok": True}
