from __future__ import annotations

from io import BytesIO
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image

from config import AVATARS_DIR
from dependencies import get_current_user, get_store
from models import (
    FavoritePhotosUpdate,
    FeaturedFriendsUpdate,
    FeaturedTripsUpdate,
    ProfileOut,
    ProfileSearchResult,
    ProfileUpdate,
    UserOut,
)

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("/search", response_model=list[ProfileSearchResult])
async def search_profiles(q: str = "", limit: int = 25, current_user: UserOut = Depends(get_current_user)):
    if not q.strip():
        return []
    store = get_store()
    return await store.search_profiles(q, current_user.id, max(1, min(limit, 100)))


@router.get("/me", response_model=ProfileOut)
async def my_profile(current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    profile = await store.get_profile_by_user_id(current_user.id, current_user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.patch("/me", response_model=ProfileOut)
async def update_my_profile(data: ProfileUpdate, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    try:
        return await store.update_profile(current_user.id, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/me/avatar", response_model=ProfileOut)
async def upload_my_avatar(file: UploadFile = File(...), current_user: UserOut = Depends(get_current_user)):
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Avatar must be an image file")
    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Avatar too large (max 5MB)")

    try:
        image = Image.open(BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    image.thumbnail((512, 512))
    filename = f"avatar_{current_user.id}_{uuid.uuid4().hex[:12]}.png"
    path = AVATARS_DIR / filename
    image.save(path, format="PNG", optimize=True)

    store = get_store()
    previous_avatar = current_user.avatar_url
    avatar_url = f"/api/avatars/{filename}"
    await store.set_user_avatar_url(current_user.id, avatar_url)

    if previous_avatar and previous_avatar.startswith("/api/avatars/"):
        old_name = previous_avatar.split("/api/avatars/")[-1]
        old_path = AVATARS_DIR / old_name
        if old_path.exists() and old_path.is_file() and old_path != path:
            old_path.unlink(missing_ok=True)

    profile = await store.get_profile_by_user_id(current_user.id, current_user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.delete("/me/avatar", response_model=ProfileOut)
async def delete_my_avatar(current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    previous_avatar = current_user.avatar_url
    await store.set_user_avatar_url(current_user.id, "")
    if previous_avatar and previous_avatar.startswith("/api/avatars/"):
        old_name = previous_avatar.split("/api/avatars/")[-1]
        old_path = AVATARS_DIR / old_name
        if old_path.exists() and old_path.is_file():
            old_path.unlink(missing_ok=True)
    profile = await store.get_profile_by_user_id(current_user.id, current_user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.put("/me/featured-trips", response_model=list[dict])
async def update_featured_trips(payload: FeaturedTripsUpdate, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    try:
        trips = await store.set_profile_featured_trips(current_user.id, payload.trip_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return [t.model_dump(by_alias=True) for t in trips]


@router.put("/me/favorite-photos", response_model=list[dict])
async def update_favorite_photos(payload: FavoritePhotosUpdate, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    try:
        photos = await store.set_profile_favorite_photos(current_user.id, payload.photo_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return [p.model_dump(by_alias=True) for p in photos]


@router.put("/me/featured-friends", response_model=list[dict])
async def update_featured_friends(payload: FeaturedFriendsUpdate, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    try:
        friends = await store.set_profile_featured_friends(current_user.id, payload.user_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return [f.model_dump(by_alias=True) for f in friends]


@router.get("/me/options", response_model=dict)
async def profile_options(current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    return await store.get_profile_options(current_user.id)


@router.get("/{username}", response_model=ProfileOut)
async def public_profile(username: str, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    profile = await store.get_profile_by_username(current_user.id, username)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile
