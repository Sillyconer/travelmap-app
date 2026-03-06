"""
TravelMap Backend — Configuration

Global settings for paths, currency, and server behaviour.
All paths are relative to this file's parent directory.
"""

from pathlib import Path
import os

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
PHOTOS_DIR = DATA_DIR / "photos"
THUMBS_DIR = PHOTOS_DIR / "thumbs"
AVATARS_DIR = DATA_DIR / "avatars"
DB_PATH = DATA_DIR / "travelmap.db"

# Ensure runtime directories exist
DATA_DIR.mkdir(exist_ok=True)
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
THUMBS_DIR.mkdir(parents=True, exist_ok=True)
AVATARS_DIR.mkdir(parents=True, exist_ok=True)

# ── Server ────────────────────────────────────────────────────────────────────
HOST = "0.0.0.0"
PORT = 8000

# ── Thumbnails ────────────────────────────────────────────────────────────────
THUMB_MAX_SIZE = (400, 400)  # Max width x height for generated thumbnails

# ── Currency ──────────────────────────────────────────────────────────────────
CURRENCY_SYMBOL = "£"  # Configurable global currency symbol

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "travelmap-dev-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_HOURS = int(os.getenv("JWT_EXPIRES_HOURS", "72"))
