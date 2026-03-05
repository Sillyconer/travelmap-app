"""
TravelMap Backend — Photo API Router

Endpoints for photo upload, update, delete, and zip download.
Uses multipart/form-data for uploads instead of base64 JSON.
"""

from __future__ import annotations

import io
import zipfile
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from models import PhotoOut, PhotoUpdate
from dependencies import get_store
from photo_service import save_photo, delete_photo_files, clear_all_photo_files
from config import PHOTOS_DIR

router = APIRouter(tags=["photos"])


@router.post("/api/trips/{trip_id}/photos", response_model=PhotoOut, status_code=201)
async def upload_photo(
    trip_id: int,
    file: Annotated[UploadFile, File(description="The photo file")],
    lat: Annotated[float | None, Form()] = None,
    lng: Annotated[float | None, Form()] = None,
    place_id: Annotated[int | None, Form(alias="placeId")] = None,
    taken_at: Annotated[int | None, Form(alias="takenAt")] = None,
):
    """
    Upload a photo to a trip via multipart/form-data.

    - lat/lng are optional (unlocated photos allowed)
    - placeId optionally associates the photo with a place
    - takenAt is a Unix ms timestamp from EXIF
    """
    store = get_store()

    # Verify trip exists
    trip = await store.get_trip(trip_id)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")

    # Read file bytes and save to disk
    file_bytes = await file.read()
    mime = file.content_type or "image/jpeg"
    result = save_photo(file_bytes, file.filename or "photo.jpg", mime)

    # Persist to database
    photo = await store.create_photo(
        trip_id,
        name=file.filename or "photo.jpg",
        filename=result["filename"],
        mime=mime,
        width=result["width"],
        height=result["height"],
        lat=lat,
        lng=lng,
        place_id=place_id,
        taken_at=taken_at,
        url=result["url"],
        thumb_url=result["thumb_url"],
    )
    return photo


@router.post("/api/trips/{trip_id}/photos/{photo_id}/update", response_model=PhotoOut)
async def update_photo(trip_id: int, photo_id: int, data: PhotoUpdate):
    """Update photo metadata (e.g., assign to a place)."""
    store = get_store()
    photo = await store.update_photo(trip_id, photo_id, data.place_id)
    if not photo:
        raise HTTPException(404, f"Photo {photo_id} not found in trip {trip_id}")
    return photo


@router.delete("/api/trips/{trip_id}/photos/{photo_id}")
async def delete_photo(trip_id: int, photo_id: int):
    """Delete a single photo (file + DB record)."""
    store = get_store()
    filename = await store.delete_photo(trip_id, photo_id)
    if not filename:
        raise HTTPException(404, f"Photo {photo_id} not found in trip {trip_id}")
    delete_photo_files(filename)
    return {}


@router.get("/api/trips/{trip_id}/photos/download")
async def download_photos(trip_id: int, ids: str = ""):
    """
    Download selected photos as a zip.
    Pass comma-separated photo IDs, or omit for all photos in the trip.
    """
    store = get_store()
    trip = await store.get_trip(trip_id)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")

    selected_ids = {int(x.strip()) for x in ids.split(",") if x.strip()} if ids else None
    photos = trip.photos if selected_ids is None else [p for p in trip.photos if p.id in selected_ids]

    if not photos:
        raise HTTPException(404, "No photos to download")

    # Build zip in memory
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
async def list_all_photos():
    """Get all photos across all trips (for the photo library view)."""
    store = get_store()
    return await store.get_all_photos()


@router.delete("/api/photos")
async def clear_all_photos():
    """⚠️ Delete ALL photos (files + DB records). Danger zone."""
    store = get_store()
    count = await store.clear_all_photos()
    clear_all_photo_files()
    return {"removed": count}
