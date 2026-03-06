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
    is_friend: bool = Field(False, alias="isFriend")

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
    home_country: str = Field("", alias="homeCountry")
    home_currency: str = Field("USD", alias="homeCurrency")
    profile_theme: str = Field("dark-matter", alias="profileTheme")
    created_at: str = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


class UserUpdate(BaseModel):
    display_name: str | None = Field(None, alias="displayName")
    home_country: str | None = Field(None, alias="homeCountry")
    home_currency: str | None = Field(None, alias="homeCurrency")
    profile_theme: str | None = Field(None, alias="profileTheme")

    model_config = {"populate_by_name": True}


class FriendRequestCreate(BaseModel):
    username: str


class TripMemberRoleUpdate(BaseModel):
    role: str


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    message: str
    payload: dict = Field(default_factory=dict)
    occurrence_count: int = Field(1, alias="occurrenceCount")
    is_read: bool = Field(alias="isRead")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")

    model_config = {"populate_by_name": True}


class NotificationReadUpdate(BaseModel):
    ids: list[int] = Field(default_factory=list)


class CommentCreate(BaseModel):
    entity_type: str = Field(alias="entityType")
    entity_id: int = Field(alias="entityId")
    body: str

    model_config = {"populate_by_name": True}


class CommentReactionToggle(BaseModel):
    emoji: str


class CommentReactionOut(BaseModel):
    emoji: str
    count: int
    reacted: bool


class CommentOut(BaseModel):
    id: int
    entity_type: str = Field(alias="entityType")
    entity_id: int = Field(alias="entityId")
    user_id: int = Field(alias="userId")
    username: str
    display_name: str = Field(alias="displayName")
    body: str
    can_delete: bool = Field(alias="canDelete")
    created_at: str = Field(alias="createdAt")
    reactions: list[CommentReactionOut] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


# ── Profiles ──────────────────────────────────────────────────────────────────
class ProfileTripOut(BaseModel):
    id: int
    name: str
    color: str
    places_count: int = Field(alias="placesCount")
    photos_count: int = Field(alias="photosCount")

    model_config = {"populate_by_name": True}


class ProfilePhotoOut(BaseModel):
    id: int
    name: str
    url: str
    thumb_url: str = Field(alias="thumbUrl")

    model_config = {"populate_by_name": True}


class ProfileMapPointOut(BaseModel):
    place_id: int = Field(alias="placeId")
    trip_id: int = Field(alias="tripId")
    trip_name: str = Field(alias="tripName")
    trip_color: str = Field(alias="tripColor")
    lat: float
    lng: float
    sort_order: int = Field(alias="sortOrder")

    model_config = {"populate_by_name": True}


class ProfileFriendOut(BaseModel):
    user_id: int = Field(alias="userId")
    username: str
    display_name: str = Field(alias="displayName")
    home_country: str = Field("", alias="homeCountry")
    home_currency: str = Field("USD", alias="homeCurrency")

    model_config = {"populate_by_name": True}


class ProfileOut(BaseModel):
    user_id: int = Field(alias="userId")
    username: str
    display_name: str = Field(alias="displayName")
    home_country: str = Field("", alias="homeCountry")
    home_currency: str = Field("USD", alias="homeCurrency")
    profile_theme: str = Field("dark-matter", alias="profileTheme")
    about_me: str = Field("", alias="aboutMe")
    show_world_map: bool = Field(True, alias="showWorldMap")
    show_featured_trips: bool = Field(True, alias="showFeaturedTrips")
    show_favorite_photos: bool = Field(True, alias="showFavoritePhotos")
    show_featured_friends: bool = Field(True, alias="showFeaturedFriends")
    featured_trips: list[ProfileTripOut] = Field(default_factory=list, alias="featuredTrips")
    featured_friends: list[ProfileFriendOut] = Field(default_factory=list, alias="featuredFriends")
    favorite_photos: list[ProfilePhotoOut] = Field(default_factory=list, alias="favoritePhotos")
    map_places: list[ProfileMapPointOut] = Field(default_factory=list, alias="mapPlaces")
    is_self: bool = Field(False, alias="isSelf")

    model_config = {"populate_by_name": True}


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(None, alias="displayName")
    home_country: str | None = Field(None, alias="homeCountry")
    home_currency: str | None = Field(None, alias="homeCurrency")
    profile_theme: str | None = Field(None, alias="profileTheme")
    about_me: str | None = Field(None, alias="aboutMe")
    show_world_map: bool | None = Field(None, alias="showWorldMap")
    show_featured_trips: bool | None = Field(None, alias="showFeaturedTrips")
    show_favorite_photos: bool | None = Field(None, alias="showFavoritePhotos")
    show_featured_friends: bool | None = Field(None, alias="showFeaturedFriends")

    model_config = {"populate_by_name": True}


class ProfileSearchResult(BaseModel):
    user_id: int = Field(alias="userId")
    username: str
    display_name: str = Field(alias="displayName")
    profile_theme: str = Field(alias="profileTheme")
    about_me: str = Field("", alias="aboutMe")
    is_friend: bool = Field(False, alias="isFriend")

    model_config = {"populate_by_name": True}


class FeaturedTripsUpdate(BaseModel):
    trip_ids: list[int] = Field(default_factory=list, alias="tripIds")

    model_config = {"populate_by_name": True}


class FavoritePhotosUpdate(BaseModel):
    photo_ids: list[int] = Field(default_factory=list, alias="photoIds")

    model_config = {"populate_by_name": True}


class FeaturedFriendsUpdate(BaseModel):
    user_ids: list[int] = Field(default_factory=list, alias="userIds")

    model_config = {"populate_by_name": True}


class FriendOut(BaseModel):
    id: int
    username: str
    display_name: str = Field(alias="displayName")
    person_id: int = Field(alias="personId")
    home_country: str = Field("", alias="homeCountry")
    home_currency: str = Field("USD", alias="homeCurrency")

    model_config = {"populate_by_name": True}


class TripMemberOut(FriendOut):
    role: str = "viewer"


class FriendRequestOut(BaseModel):
    id: int
    from_user_id: int = Field(alias="fromUserId")
    to_user_id: int = Field(alias="toUserId")
    from_username: str = Field("", alias="fromUsername")
    from_display_name: str = Field("", alias="fromDisplayName")
    to_username: str = Field("", alias="toUsername")
    to_display_name: str = Field("", alias="toDisplayName")
    status: str
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
    visibility: str = "friends_only"


class TripUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    budget: float | None = None
    spent: float | None = None
    start_date: str | None = Field(None, alias="startDate")
    end_date: str | None = Field(None, alias="endDate")
    rating: int | None = None
    description: str | None = None
    visibility: str | None = None

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
    visibility: str = "friends_only"
    owner_user_id: int = Field(alias="ownerUserId")
    is_shared: bool = Field(False, alias="isShared")
    access_role: str = Field("owner", alias="accessRole")
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


class ExpenseCreate(BaseModel):
    trip_id: int = Field(alias="tripId")
    place_id: int | None = Field(None, alias="placeId")
    amount: float
    currency: str
    note: str = ""

    model_config = {"populate_by_name": True}


class ExpenseOut(BaseModel):
    id: int
    trip_id: int = Field(alias="tripId")
    place_id: int | None = Field(None, alias="placeId")
    amount: float
    currency: str
    amount_home: float = Field(alias="amountHome")
    home_currency: str = Field(alias="homeCurrency")
    rate_used: float = Field(alias="rateUsed")
    note: str = ""
    created_at: str = Field(alias="createdAt")

    model_config = {"populate_by_name": True}

