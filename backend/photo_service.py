"""
TravelMap Backend — Photo Service

Handles file storage, thumbnail generation (via Pillow), and cleanup.
"""

from __future__ import annotations

import uuid
from pathlib import Path

from PIL import Image

from config import PHOTOS_DIR, THUMBS_DIR, THUMB_MAX_SIZE


def save_photo(file_bytes: bytes, original_name: str, mime: str) -> dict:
    """
    Save an uploaded photo to disk, generate a thumbnail, and return metadata.

    Returns a dict with: filename, width, height, url, thumb_url
    """
    # Generate a unique filename preserving the original extension
    ext = Path(original_name).suffix.lower() or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = PHOTOS_DIR / unique_name

    # Write original file
    file_path.write_bytes(file_bytes)

    # Get dimensions and generate thumbnail
    width, height, thumb_url = 0, 0, ""
    try:
        with Image.open(file_path) as img:
            # Handle EXIF rotation
            img = _apply_exif_rotation(img)
            width, height = img.size

            # Generate thumbnail as JPEG for universality
            thumb_name = f"{unique_name.rsplit('.', 1)[0]}_thumb.jpg"
            thumb_path = THUMBS_DIR / thumb_name
            thumb = img.copy()
            thumb.thumbnail(THUMB_MAX_SIZE, Image.Resampling.LANCZOS)
            # Convert to RGB for JPEG compatibility (handles RGBA, P, etc.)
            if thumb.mode not in ("RGB", "L"):
                thumb = thumb.convert("RGB")
            thumb.save(thumb_path, "JPEG", quality=85)
            thumb_url = f"/photos/thumbs/{thumb_name}"
    except Exception:
        # If we can't process the image, still keep the original
        pass

    return {
        "filename": unique_name,
        "width": width,
        "height": height,
        "url": f"/photos/{unique_name}",
        "thumb_url": thumb_url,
    }


def delete_photo_files(filename: str) -> None:
    """Remove the original photo and its thumbnail from disk."""
    original = PHOTOS_DIR / filename
    if original.exists():
        original.unlink()

    # Try to find and remove the thumbnail
    stem = filename.rsplit(".", 1)[0]
    thumb = THUMBS_DIR / f"{stem}_thumb.jpg"
    if thumb.exists():
        thumb.unlink()


def clear_all_photo_files() -> None:
    """Remove all photo files and thumbnails from disk."""
    for f in PHOTOS_DIR.iterdir():
        if f.is_file():
            f.unlink()
    for f in THUMBS_DIR.iterdir():
        if f.is_file():
            f.unlink()


def _apply_exif_rotation(img: Image.Image) -> Image.Image:
    """Rotate image based on EXIF orientation tag."""
    try:
        from PIL import ExifTags
        exif = img.getexif()
        orientation_key = None
        for key, val in ExifTags.TAGS.items():
            if val == "Orientation":
                orientation_key = key
                break
        if orientation_key and orientation_key in exif:
            orientation = exif[orientation_key]
            rotations = {
                3: 180,
                6: 270,
                8: 90,
            }
            if orientation in rotations:
                img = img.rotate(rotations[orientation], expand=True)
    except Exception:
        pass
    return img
