"""
TravelMap Backend — Pydantic Models

Defines the data transfer objects for the REST API. These mirror
the core entities: Trip, Place, Photo, Person.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── Person ────────────────────────────────────────────────────────────────────
class PersonCreate(BaseModel):
    name: str
    color: str = "#4A90D9"


class PersonUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class Person(BaseModel):
    id: int
    name: str
    color: str
    is_owner: bool = Field(False, alias="isOwner")

    model_config = {"populate_by_name": True}


# ── Auth ──────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    display_name: str = Field(alias="displayName")
    password: str

    model_config = {"populate_by_name": True}


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str = Field(alias="displayName")
    person_id: int = Field(alias="personId")
    created_at: str = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


# ── Place ─────────────────────────────────────────────────────────────────────
class PlaceCreate(BaseModel):
    name: str
    lat: float
    lng: float
    note: str = ""


class PlaceUpdate(BaseModel):
    name: str | None = None
    lat: float | None = None
    lng: float | None = None
    note: str | None = None


class PlaceReorder(BaseModel):
    order: str


class Place(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    note: str = ""


# ── Photo ─────────────────────────────────────────────────────────────────────
class PhotoOut(BaseModel):
    """Photo as returned by the API."""
    id: int
    name: str
    filename: str
    mime: str
    width: int
    height: int
    lat: float | None = None
    lng: float | None = None
    place_id: int | None = Field(None, alias="placeId")
    taken_at: int | None = Field(None, alias="takenAt")
    url: str
    thumb_url: str = Field("", alias="thumbUrl")

    model_config = {"populate_by_name": True}


class PhotoUpdate(BaseModel):
    place_id: int | None = Field(None, alias="placeId")

    model_config = {"populate_by_name": True}


# ── Trip ──────────────────────────────────────────────────────────────────────
class TripCreate(BaseModel):
    name: str
    color: str = "#E74C3C"


class TripUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    budget: float | None = None
    spent: float | None = None
    start_date: str | None = Field(None, alias="startDate")
    end_date: str | None = Field(None, alias="endDate")
    rating: int | None = None
    description: str | None = None

    model_config = {"populate_by_name": True}


class Trip(BaseModel):
    """Full trip object as returned by the API."""
    id: int
    name: str
    color: str
    description: str = ""
    budget: float = 0.0
    spent: float = 0.0
    start_date: str = Field("", alias="startDate")
    end_date: str = Field("", alias="endDate")
    rating: int = 0
    places: list[Place] = []
    photos: list[PhotoOut] = []
    person_ids: list[int] = Field(default_factory=list, alias="personIds")

    model_config = {"populate_by_name": True}


# ── Share Links ──────────────────────────────────────────────────────────────
class ShareLinkCreate(BaseModel):
    """Request body for creating a share link."""
    type: str  # 'photo' or 'album'
    photo_id: int | None = Field(None, alias="photoId")
    trip_id: int | None = Field(None, alias="tripId")

    model_config = {"populate_by_name": True}


class ShareLinkOut(BaseModel):
    """Share link as returned by the API."""
    id: int
    token: str
    type: str
    photo_id: int | None = Field(None, alias="photoId")
    trip_id: int | None = Field(None, alias="tripId")
    url: str
    created_at: str = Field("", alias="createdAt")

    model_config = {"populate_by_name": True}

