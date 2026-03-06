from __future__ import annotations

import io
import zipfile
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from config import PHOTOS_DIR
from dependencies import get_current_user, get_store
from models import PhotoOut, PhotoUpdate, UserOut
from services.photo_service import delete_photo_files, process_and_save_upload

router = APIRouter(tags=["photos"])


class PhotoAssign(BaseModel):
    trip_id: int | None = Field(None, alias="tripId")
    place_id: int | None = Field(None, alias="placeId")

    model_config = {"populate_by_name": True}


@router.post("/api/trips/{trip_id}/photos", response_model=PhotoOut, status_code=201)
async def upload_photo(
    trip_id: int,
    file: Annotated[UploadFile, File(description="The photo file")],
    lat: Annotated[float | None, Form()] = None,
    lng: Annotated[float | None, Form()] = None,
    place_id: Annotated[int | None, Form(alias="placeId")] = None,
    taken_at: Annotated[int | None, Form(alias="takenAt")] = None,
    current_user: UserOut = Depends(get_current_user),
):
    store = get_store()
    trip = await store.get_trip(trip_id, current_user.id)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")
    if not await store.user_can_edit_trip(current_user.id, trip_id):
        raise HTTPException(403, "You only have viewer access to this trip")

    new_photo = await process_and_save_upload(file, trip_id, current_user.id, store)

    if lat is not None or lng is not None or taken_at is not None or place_id is not None:
        await store.db.execute(
            "UPDATE photos SET lat = ?, lng = ?, taken_at = ?, place_id = ? WHERE id = ? AND user_id = ?",
            (lat, lng, taken_at, place_id, new_photo.id, current_user.id),
        )
        await store.db.commit()
        async with store.db.execute("SELECT * FROM photos WHERE id = ?", (new_photo.id,)) as cur:
            row = await cur.fetchone()
            if row:
                new_photo = store._row_to_photo(row)

    return new_photo


@router.post("/api/photos/upload", response_model=PhotoOut, status_code=201)
async def upload_unattached_photo(
    file: Annotated[UploadFile, File(description="The photo file")],
    lat: Annotated[float | None, Form()] = None,
    lng: Annotated[float | None, Form()] = None,
    taken_at: Annotated[int | None, Form(alias="takenAt")] = None,
    current_user: UserOut = Depends(get_current_user),
):
    store = get_store()
    new_photo = await process_and_save_upload(file, None, current_user.id, store)

    if lat is not None or lng is not None or taken_at is not None:
        await store.db.execute(
            "UPDATE photos SET lat = ?, lng = ?, taken_at = ? WHERE id = ? AND user_id = ?",
            (lat, lng, taken_at, new_photo.id, current_user.id),
        )
        await store.db.commit()
        async with store.db.execute("SELECT * FROM photos WHERE id = ?", (new_photo.id,)) as cur:
            row = await cur.fetchone()
            if row:
                new_photo = store._row_to_photo(row)

    return new_photo


@router.post("/api/photos/{photo_id}/assign", response_model=PhotoOut)
async def assign_photo(photo_id: int, data: PhotoAssign, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    if data.trip_id is not None:
        trip = await store.get_trip(data.trip_id, current_user.id)
        if not trip:
            raise HTTPException(404, f"Trip {data.trip_id} not found")
        if not await store.user_can_edit_trip(current_user.id, data.trip_id):
            raise HTTPException(403, "You only have viewer access to this trip")

    photo = await store.assign_photo(current_user.id, photo_id, data.trip_id, data.place_id)
    if not photo:
        raise HTTPException(404, f"Photo {photo_id} not found")
    return photo


@router.post("/api/trips/{trip_id}/photos/{photo_id}/update", response_model=PhotoOut)
async def update_photo(trip_id: int, photo_id: int, data: PhotoUpdate, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    if not await store.user_can_edit_trip(current_user.id, trip_id):
        raise HTTPException(403, "You only have viewer access to this trip")
    photo = await store.update_photo(current_user.id, trip_id, photo_id, data.place_id)
    if not photo:
        raise HTTPException(404, f"Photo {photo_id} not found in trip {trip_id}")
    return photo


@router.delete("/api/trips/{trip_id}/photos/{photo_id}")
async def delete_photo(trip_id: int, photo_id: int, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    if not await store.user_can_edit_trip(current_user.id, trip_id):
        raise HTTPException(403, "You only have viewer access to this trip")
    async with store.db.execute(
        "SELECT filename FROM photos WHERE id = ? AND trip_id = ? AND user_id = ?",
        (photo_id, trip_id, current_user.id),
    ) as cur:
        row = await cur.fetchone()

    if not row:
        raise HTTPException(404, f"Photo {photo_id} not found in trip {trip_id}")

    deleted_filename = await store.delete_photo(current_user.id, trip_id, photo_id)
    if deleted_filename:
        await delete_photo_files({"filename": deleted_filename})

    return {}


@router.get("/api/trips/{trip_id}/photos/download")
async def download_photos(trip_id: int, ids: str = "", current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    trip = await store.get_trip(trip_id, current_user.id)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")

    selected_ids = {int(x.strip()) for x in ids.split(",") if x.strip()} if ids else None
    photos = trip.photos if selected_ids is None else [p for p in trip.photos if p.id in selected_ids]

    if not photos:
        raise HTTPException(404, "No photos to download")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for photo in photos:
            file_path = PHOTOS_DIR / photo.filename
            if file_path.exists():
                zf.write(file_path, photo.name)
    buffer.seek(0)

    trip_name = trip.name.replace(" ", "_")
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{trip_name}_photos.zip"'},
    )


@router.get("/api/photos", response_model=list[dict])
async def list_all_photos(current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    return await store.get_all_photos(current_user.id)


@router.delete("/api/photos")
async def clear_all_photos(current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    count = await store.clear_all_photos(current_user.id)
    return {"removed": count}
