from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from dependencies import get_current_user, get_store, rate_limit
from models import CommentCreate, CommentOut, CommentReactionToggle, UserOut

router = APIRouter(prefix="/api/comments", tags=["comments"])


@router.get("", response_model=list[CommentOut])
async def list_comments(
    entity_type: str,
    entity_id: int,
    limit: int = 100,
    current_user: UserOut = Depends(get_current_user),
):
    store = get_store()
    return await store.list_comments(current_user.id, entity_type, entity_id, limit=limit)


@router.post("", response_model=CommentOut, status_code=201)
async def create_comment(
    data: CommentCreate,
    _: None = Depends(rate_limit("comments_create", 40, 60)),
    current_user: UserOut = Depends(get_current_user),
):
    store = get_store()
    try:
        return await store.create_comment(current_user.id, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{comment_id}")
async def delete_comment(comment_id: int, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    ok = await store.delete_comment(current_user.id, comment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"ok": True}


@router.post("/{comment_id}/reactions", response_model=list[dict])
async def toggle_comment_reaction(
    comment_id: int,
    data: CommentReactionToggle,
    _: None = Depends(rate_limit("comments_react", 120, 60)),
    current_user: UserOut = Depends(get_current_user),
):
    store = get_store()
    try:
        reactions = await store.toggle_comment_reaction(current_user.id, comment_id, data.emoji)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return [r.model_dump() for r in reactions]
