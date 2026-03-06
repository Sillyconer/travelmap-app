import os
import uuid
import logging
from fastapi import UploadFile, HTTPException
from PIL import Image, ImageOps
from config import PHOTOS_DIR, THUMBS_DIR
from models import PhotoOut
from store import Store

logger = logging.getLogger(__name__)

# Constants
THUMB_SIZE = (400, 400)
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.avif'}

def ensure_photo_dirs():
    """Ensure the upload and thumbnail directories exist."""
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    os.makedirs(THUMBS_DIR, exist_ok=True)

ensure_photo_dirs()

def is_allowed_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS

async def process_and_save_upload(file: UploadFile, trip_id: int | None, user_id: int, store: Store) -> PhotoOut:
    """
    Saves the original uploaded file, creates a thumbnail, and registers it in the DB.
    Requires external EXIF metadata (lat/lng/timestamp) to be passed via the UploadFile form wrapper,
    or we can let the frontend send it later via a PUT request.
    For this implementation, the frontend StagingTable will pass it via Form fields.
    """
    original_name = file.filename or "upload.jpg"

    if not is_allowed_file(original_name):
        raise HTTPException(status_code=400, detail="File type not allowed")

    # Generate unique filenames
    ext = os.path.splitext(original_name)[1].lower()
    unique_id = str(uuid.uuid4())
    img_filename = f"{unique_id}{ext}"
    thumb_filename = f"{unique_id}.webp"
    
    img_path = os.path.join(PHOTOS_DIR, img_filename)
    thumb_path = os.path.join(THUMBS_DIR, thumb_filename)

    # 1. Save original to disk
    try:
        content = await file.read()
        with open(img_path, "wb") as f:
            f.write(content)
            
        # 2. Process with Pillow
        # Pillow handle HEIC/AVIF if system libraries are present, but fallback gracefully
        with Image.open(img_path) as img:
            # Correct rotation based on EXIF before stripping it
            img = ImageOps.exif_transpose(img)
            
            width, height = img.size
            
            # Generate cropsquare Thumbnail
            # Cover mode: crop to aspect ratio then resize
            thumb = img.copy()
            # Calculate cropping box
            min_dim = min(width, height)
            left = (width - min_dim) / 2
            top = (height - min_dim) / 2
            right = (width + min_dim) / 2
            bottom = (height + min_dim) / 2
            
            thumb = thumb.crop((left, top, right, bottom))
            thumb.thumbnail(THUMB_SIZE, Image.Resampling.LANCZOS)
            
            # Save thumbnail as WebP (strips EXIF by default, highly compressed)
            if thumb.mode in ("RGBA", "P"):
                thumb = thumb.convert("RGB")
            thumb.save(thumb_path, "WEBP", quality=85)
            
    except Exception as e:
        logger.error(f"Error processing image {file.filename}: {e}")
        # Cleanup
        if os.path.exists(img_path): os.remove(img_path)
        if os.path.exists(thumb_path): os.remove(thumb_path)
        raise HTTPException(status_code=500, detail="Failed to process image")

    # 3. Create DB Record (initial bare record, frontend will PATCH with GPS data)
    photo_data = {
        "trip_id": trip_id,
        "name": original_name,
        "filename": img_filename,
        "mime": file.content_type or "image/jpeg",
        "width": width,
        "height": height,
        "url": f"/api/photos/raw/{img_filename}",
        "thumb_url": f"/api/photos/thumb/{thumb_filename}"
    }
    
    # Store should be updated to use the new method API matching store.py
    new_photo = await store.create_photo(
        user_id=user_id,
        trip_id=photo_data["trip_id"],
        name=photo_data["name"],
        filename=photo_data["filename"],
        mime=photo_data["mime"],
        width=photo_data["width"],
        height=photo_data["height"],
        lat=None,
        lng=None,
        place_id=None,
        taken_at=None,
        url=photo_data["url"],
        thumb_url=photo_data["thumb_url"]
    )
    return new_photo

async def delete_photo_files(photo: dict):
    """Deletes the physical files associated with a photo."""
    img_path = os.path.join(PHOTOS_DIR, photo['filename'])
    thumb_filename = photo['filename'].rsplit('.', 1)[0] + '.webp'
    thumb_path = os.path.join(THUMBS_DIR, thumb_filename)
    
    if os.path.exists(img_path):
        os.remove(img_path)
    if os.path.exists(thumb_path):
        os.remove(thumb_path)

