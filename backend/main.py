"""
TravelMap Backend — Main Application

FastAPI application entry point. Sets up:
- SQLite store lifecycle (connect on startup, close on shutdown)
- API routers for trips, places, photos, persons
- Static file serving for photos and the frontend build
- CORS middleware for development
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import HOST, PORT, PHOTOS_DIR, THUMBS_DIR
from store import Store
from dependencies import set_store
from routers import auth, comments, finance, itinerary, notifications, profiles, search, trips, places, photos, persons, sharing, social


# ── Lifespan (startup / shutdown) ────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage async resources: open DB on start, close on shutdown."""
    store = Store()
    await store.connect()
    set_store(store)
    print(f"✓ Database connected")
    yield
    await store.close()
    print("✓ Database closed")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="TravelMap API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(trips.router)
app.include_router(places.router)
app.include_router(photos.router)
app.include_router(persons.router)
app.include_router(sharing.router)
app.include_router(auth.router)
app.include_router(social.router)
app.include_router(finance.router)
app.include_router(profiles.router)
app.include_router(notifications.router)
app.include_router(search.router)
app.include_router(comments.router)
app.include_router(itinerary.router)

# ── Static files ──────────────────────────────────────────────────────────────

# Serve uploaded photos
# Legacy/static paths
app.mount("/photos/thumbs", StaticFiles(directory=str(THUMBS_DIR)), name="thumbs")
app.mount("/photos", StaticFiles(directory=str(PHOTOS_DIR)), name="photos")

# API-style paths used by stored photo URLs
app.mount("/api/photos/thumb", StaticFiles(directory=str(THUMBS_DIR)), name="api-photo-thumbs")
app.mount("/api/photos/raw", StaticFiles(directory=str(PHOTOS_DIR)), name="api-photo-raw")

# Serve the frontend build (production mode)
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
