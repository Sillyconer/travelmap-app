"""
TravelMap Backend — Sharing API Router

Endpoints for creating, resolving, and revoking shareable links
for individual photos and trip albums.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from models import ShareLinkCreate, ShareLinkOut, UserOut
from dependencies import get_current_user, get_store

router = APIRouter(tags=["sharing"])


@router.post("/api/share", response_model=ShareLinkOut, status_code=201)
async def create_share_link(data: ShareLinkCreate, current_user: UserOut = Depends(get_current_user)):
    """
    Create a shareable link for a photo or album.

    - type: 'photo' or 'album'
    - photoId: required if type is 'photo'
    - tripId: required if type is 'album'
    """
    store = get_store()

    if data.type == "photo":
        if data.photo_id is None:
            raise HTTPException(400, "photoId is required for photo shares")
        # Verify photo exists
        async with store.db.execute(
            "SELECT id FROM photos WHERE id = ? AND user_id = ?", (data.photo_id, current_user.id)
        ) as cur:
            if not await cur.fetchone():
                raise HTTPException(404, f"Photo {data.photo_id} not found")
        link = await store.create_share_link("photo", data.photo_id, None)

    elif data.type == "album":
        if data.trip_id is None:
            raise HTTPException(400, "tripId is required for album shares")
        trip = await store.get_trip(data.trip_id, current_user.id)
        if not trip:
            raise HTTPException(404, f"Trip {data.trip_id} not found")
        link = await store.create_share_link("album", None, data.trip_id)

    else:
        raise HTTPException(400, f"Invalid share type: {data.type}. Must be 'photo' or 'album'.")

    return link


@router.get("/api/share/{token}")
async def resolve_share_link(token: str):
    """
    Resolve a share token and return the associated content.

    Returns different payloads depending on the link type:
    - photo: { link, photo }
    - album: { link, trip (with photos) }
    """
    store = get_store()
    link = await store.get_share_link(token)
    if not link:
        raise HTTPException(404, "Share link not found or has been revoked")

    if link.type == "photo":
        # Fetch the photo
        async with store.db.execute("SELECT * FROM photos WHERE id = ?", (link.photo_id,)) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "The shared photo no longer exists")

        photo = store._row_to_photo(row)
        return {
            "link": link.model_dump(by_alias=True),
            "type": "photo",
            "photo": photo.model_dump(by_alias=True),
        }

    elif link.type == "album":
        async with store.db.execute("SELECT user_id FROM trips WHERE id = ?", (link.trip_id,)) as cur:
            trip_row = await cur.fetchone()
        if not trip_row:
            raise HTTPException(404, "The shared album no longer exists")
        trip = await store.get_trip(link.trip_id, trip_row["user_id"])
        if not trip:
            raise HTTPException(404, "The shared album no longer exists")

        return {
            "link": link.model_dump(by_alias=True),
            "type": "album",
            "trip": trip.model_dump(by_alias=True),
        }

    raise HTTPException(500, "Unknown share link type")


@router.delete("/api/share/{token}")
async def revoke_share_link(token: str, current_user: UserOut = Depends(get_current_user)):
    """Revoke (delete) a share link."""
    store = get_store()
    async with store.db.execute(
        """
        SELECT s.id
        FROM share_links s
        LEFT JOIN photos p ON p.id = s.photo_id
        LEFT JOIN trips t ON t.id = s.trip_id
        WHERE s.token = ? AND (p.user_id = ? OR t.user_id = ?)
        """,
        (token, current_user.id, current_user.id),
    ) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Share link not found")

    deleted = await store.delete_share_link(token)
    if not deleted:
        raise HTTPException(404, "Share link not found")
    return {"ok": True}
