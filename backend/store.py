"""
TravelMap Backend — SQLite Data Store

Implements all CRUD operations for trips, places, photos, and persons.
Uses aiosqlite for async SQLite access.
"""

from __future__ import annotations

import json
import re
import uuid
import aiosqlite
from pathlib import Path

from config import DB_PATH
from models import (
    Trip, TripCreate, TripUpdate,
    ItineraryItemCreate, ItineraryItemOut, ItineraryItemUpdate,
    Place, PlaceCreate, PlaceUpdate,
    PhotoOut,
    Person, PersonCreate, PersonUpdate,
    UserOut, FriendOut, FriendRequestOut, ExpenseOut, UserUpdate,
    CommentCreate, CommentOut, CommentReactionOut,
    NotificationOut,
    TripMemberOut,
    ProfileFriendOut, ProfileMapPointOut, ProfileOut, ProfilePhotoOut, ProfileSearchResult, ProfileTripOut, ProfileUpdate,
    ShareLinkOut,
)


# ══════════════════════════════════════════════════════════════════════════════
# Schema
# ══════════════════════════════════════════════════════════════════════════════

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS trips (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id   TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    color       TEXT    NOT NULL DEFAULT '#E74C3C',
    description TEXT    NOT NULL DEFAULT '',
    budget      REAL    NOT NULL DEFAULT 0,
    spent       REAL    NOT NULL DEFAULT 0,
    start_date  TEXT    NOT NULL DEFAULT '',
    end_date    TEXT    NOT NULL DEFAULT '',
    rating      INTEGER NOT NULL DEFAULT 0,
    user_id     INTEGER,
    visibility  TEXT    NOT NULL DEFAULT 'friends_only'
);

CREATE TABLE IF NOT EXISTS places (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id  INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name     TEXT    NOT NULL,
    lat      REAL    NOT NULL,
    lng      REAL    NOT NULL,
    note     TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS itinerary_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    title      TEXT    NOT NULL,
    day_index  INTEGER NOT NULL DEFAULT 1,
    start_at   TEXT    NOT NULL DEFAULT '',
    end_at     TEXT    NOT NULL DEFAULT '',
    place_id   INTEGER REFERENCES places(id) ON DELETE SET NULL,
    note       TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_itinerary_trip_day_sort
    ON itinerary_items(trip_id, day_index, sort_order, id);

CREATE TABLE IF NOT EXISTS photos (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id   INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    name      TEXT    NOT NULL,
    filename  TEXT    NOT NULL,
    mime      TEXT    NOT NULL DEFAULT 'image/jpeg',
    width     INTEGER NOT NULL DEFAULT 0,
    height    INTEGER NOT NULL DEFAULT 0,
    lat       REAL,
    lng       REAL,
    place_id  INTEGER REFERENCES places(id) ON DELETE SET NULL,
    taken_at  INTEGER,
    url       TEXT    NOT NULL DEFAULT '',
    thumb_url TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS persons (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#4A90D9',
    user_id INTEGER,
    is_owner INTEGER NOT NULL DEFAULT 0,
    linked_user_id INTEGER
);

CREATE TABLE IF NOT EXISTS trip_persons (
    trip_id   INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    PRIMARY KEY (trip_id, person_id)
);

CREATE TABLE IF NOT EXISTS share_links (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT    NOT NULL UNIQUE,
    type       TEXT    NOT NULL,
    photo_id   INTEGER REFERENCES photos(id) ON DELETE CASCADE,
    trip_id    INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    display_name  TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    person_id     INTEGER NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
    home_country  TEXT    NOT NULL DEFAULT '',
    home_currency TEXT    NOT NULL DEFAULT 'USD',
    profile_theme TEXT    NOT NULL DEFAULT 'dark-matter',
    avatar_url    TEXT    NOT NULL DEFAULT '',
    about_me      TEXT    NOT NULL DEFAULT '',
    show_world_map INTEGER NOT NULL DEFAULT 1,
    show_featured_trips INTEGER NOT NULL DEFAULT 1,
    show_favorite_photos INTEGER NOT NULL DEFAULT 1,
    show_featured_friends INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile_featured_trips (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, trip_id)
);

CREATE TABLE IF NOT EXISTS profile_favorite_photos (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_id   INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, photo_id)
);

CREATE TABLE IF NOT EXISTS profile_featured_friends (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, friend_user_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        TEXT    NOT NULL DEFAULT 'pending',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(from_user_id, to_user_id)
);

CREATE TABLE IF NOT EXISTS friends (
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, friend_user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT    NOT NULL,
    group_key   TEXT    NOT NULL DEFAULT '',
    title       TEXT    NOT NULL,
    message     TEXT    NOT NULL,
    payload     TEXT    NOT NULL DEFAULT '{}',
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    is_read     INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type  TEXT    NOT NULL,
    entity_id    INTEGER NOT NULL,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body         TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_entity
    ON comments(entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comment_reactions (
    comment_id   INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji        TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment
    ON comment_reactions(comment_id, emoji);

CREATE TABLE IF NOT EXISTS trip_members (
    trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         TEXT    NOT NULL DEFAULT 'member',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (trip_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id       INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    place_id      INTEGER REFERENCES places(id) ON DELETE SET NULL,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount        REAL    NOT NULL,
    currency      TEXT    NOT NULL,
    amount_home   REAL    NOT NULL,
    home_currency TEXT    NOT NULL,
    rate_used     REAL    NOT NULL,
    note          TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expense_splits (
    expense_id    INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_home   REAL    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (expense_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_splits_expense
    ON expense_splits(expense_id);

CREATE INDEX IF NOT EXISTS idx_expense_splits_user
    ON expense_splits(user_id);
"""

VALID_PROFILE_THEMES = {
    "dark-matter",
    "positron",
    "voyager",
    "oceanic",
    "atlas-sand",
    "pine-trail",
}

VALID_TRIP_MEMBER_ROLES = {"viewer", "editor"}
MENTION_RE = re.compile(r"@([A-Za-z0-9_]{3,32})")


# ══════════════════════════════════════════════════════════════════════════════
# Store class
# ══════════════════════════════════════════════════════════════════════════════

class Store:
    """Async SQLite store for TravelMap data."""

    def __init__(self, db_path: Path = DB_PATH):
        self._db_path = db_path
        self._db: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        """Open the database and create tables if needed."""
        self._db = await aiosqlite.connect(self._db_path)
        self._db.row_factory = aiosqlite.Row
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA foreign_keys=ON")
        await self._db.executescript(SCHEMA_SQL)
        await self._migrate_schema()
        await self._ensure_default_user()
        await self._db.commit()

    async def _migrate_schema(self) -> None:
        await self._ensure_photos_trip_nullable()
        await self._ensure_column("trips", "user_id", "INTEGER")
        await self._ensure_column("trips", "visibility", "TEXT NOT NULL DEFAULT 'friends_only'")
        await self._ensure_column("photos", "user_id", "INTEGER")
        await self._ensure_column("persons", "user_id", "INTEGER")
        await self._ensure_column("persons", "is_owner", "INTEGER NOT NULL DEFAULT 0")
        await self._ensure_column("persons", "linked_user_id", "INTEGER")
        await self._ensure_column("users", "home_country", "TEXT NOT NULL DEFAULT ''")
        await self._ensure_column("users", "home_currency", "TEXT NOT NULL DEFAULT 'USD'")
        await self._ensure_column("users", "profile_theme", "TEXT NOT NULL DEFAULT 'dark-matter'")
        await self._ensure_column("users", "avatar_url", "TEXT NOT NULL DEFAULT ''")
        await self._ensure_column("users", "about_me", "TEXT NOT NULL DEFAULT ''")
        await self._ensure_column("trips", "public_id", "TEXT NOT NULL DEFAULT ''")
        await self._ensure_column("users", "show_world_map", "INTEGER NOT NULL DEFAULT 1")
        await self._ensure_column("users", "show_featured_trips", "INTEGER NOT NULL DEFAULT 1")
        await self._ensure_column("users", "show_favorite_photos", "INTEGER NOT NULL DEFAULT 1")
        await self._ensure_column("users", "show_featured_friends", "INTEGER NOT NULL DEFAULT 1")
        await self._ensure_column("notifications", "group_key", "TEXT NOT NULL DEFAULT ''")
        await self._ensure_column("notifications", "occurrence_count", "INTEGER NOT NULL DEFAULT 1")
        await self._ensure_column("notifications", "is_archived", "INTEGER NOT NULL DEFAULT 0")
        await self._ensure_column("notifications", "updated_at", "TEXT NOT NULL DEFAULT (datetime('now'))")

        await self.db.execute("UPDATE trips SET user_id = 1 WHERE user_id IS NULL")
        await self.db.execute("UPDATE photos SET user_id = 1 WHERE user_id IS NULL")
        await self.db.execute("UPDATE persons SET user_id = 1 WHERE user_id IS NULL")
        await self.db.execute("UPDATE trips SET visibility = 'friends_only' WHERE visibility IS NULL OR visibility = ''")
        await self.db.execute("UPDATE notifications SET group_key = '' WHERE group_key IS NULL")
        await self.db.execute("UPDATE notifications SET occurrence_count = 1 WHERE occurrence_count IS NULL OR occurrence_count < 1")
        await self.db.execute("UPDATE notifications SET is_archived = 0 WHERE is_archived IS NULL")
        await self.db.execute("UPDATE notifications SET updated_at = created_at WHERE updated_at IS NULL")
        rows = await self.db.execute_fetchall("SELECT id FROM trips WHERE public_id IS NULL OR public_id = ''")
        for row in rows:
            await self.db.execute("UPDATE trips SET public_id = ? WHERE id = ?", (str(uuid.uuid4()), int(row["id"])))
        await self.db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_public_id ON trips(public_id)")

        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS profile_featured_trips (
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
                sort_order INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, trip_id)
            )
            """
        )
        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS profile_favorite_photos (
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                photo_id   INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
                sort_order INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, photo_id)
            )
            """
        )
        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS profile_featured_friends (
                user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                friend_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                sort_order   INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, friend_user_id)
            )
            """
        )
        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS notifications (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type        TEXT    NOT NULL,
                group_key   TEXT    NOT NULL DEFAULT '',
                title       TEXT    NOT NULL,
                message     TEXT    NOT NULL,
                payload     TEXT    NOT NULL DEFAULT '{}',
                occurrence_count INTEGER NOT NULL DEFAULT 1,
                is_read     INTEGER NOT NULL DEFAULT 0,
                is_archived INTEGER NOT NULL DEFAULT 0,
                updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
                created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        await self.db.execute(
            "CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)"
        )
        await self.db.execute(
            "CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)"
        )
        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS comments (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type  TEXT    NOT NULL,
                entity_id    INTEGER NOT NULL,
                user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                body         TEXT    NOT NULL,
                created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        await self.db.execute(
            "CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id, created_at DESC)"
        )
        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS comment_reactions (
                comment_id   INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
                user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                emoji        TEXT    NOT NULL,
                created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (comment_id, user_id, emoji)
            )
            """
        )
        await self.db.execute(
            "CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id, emoji)"
        )
        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS expense_splits (
                expense_id    INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
                user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount_home   REAL    NOT NULL,
                created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (expense_id, user_id)
            )
            """
        )
        await self.db.execute("CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id)")
        await self.db.execute("CREATE INDEX IF NOT EXISTS idx_expense_splits_user ON expense_splits(user_id)")

    async def _ensure_photos_trip_nullable(self) -> None:
        rows = await self.db.execute_fetchall("PRAGMA table_info(photos)")
        if not rows:
            return

        trip_col = next((r for r in rows if r["name"] == "trip_id"), None)
        if not trip_col or int(trip_col["notnull"]) == 0:
            return

        await self.db.executescript(
            """
            CREATE TABLE IF NOT EXISTS photos_new (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id   INTEGER REFERENCES trips(id) ON DELETE CASCADE,
                user_id   INTEGER,
                name      TEXT    NOT NULL,
                filename  TEXT    NOT NULL,
                mime      TEXT    NOT NULL DEFAULT 'image/jpeg',
                width     INTEGER NOT NULL DEFAULT 0,
                height    INTEGER NOT NULL DEFAULT 0,
                lat       REAL,
                lng       REAL,
                place_id  INTEGER REFERENCES places(id) ON DELETE SET NULL,
                taken_at  INTEGER,
                url       TEXT    NOT NULL DEFAULT '',
                thumb_url TEXT    NOT NULL DEFAULT ''
            );

            INSERT INTO photos_new (id, trip_id, user_id, name, filename, mime, width, height, lat, lng, place_id, taken_at, url, thumb_url)
            SELECT id, trip_id, user_id, name, filename, mime, width, height, lat, lng, place_id, taken_at, url, thumb_url
            FROM photos;

            DROP TABLE photos;
            ALTER TABLE photos_new RENAME TO photos;
            """
        )

    async def _ensure_column(self, table_name: str, column_name: str, column_def: str) -> None:
        rows = await self.db.execute_fetchall(f"PRAGMA table_info({table_name})")
        existing = {r["name"] for r in rows}
        if column_name not in existing:
            await self.db.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}")

    async def _ensure_default_user(self) -> None:
        async with self.db.execute("SELECT id FROM users LIMIT 1") as cur:
            existing_user = await cur.fetchone()
        if existing_user:
            return

        async with self.db.execute(
            "SELECT id FROM persons WHERE is_owner = 1 ORDER BY id LIMIT 1"
        ) as cur:
            owner_person = await cur.fetchone()

        if owner_person:
            person_id = owner_person["id"]
        else:
            cursor = await self.db.execute(
                "INSERT INTO persons (name, color, user_id, is_owner) VALUES (?, ?, ?, 1)",
                ("Owner", "#4A90D9", 1),
            )
            person_id = int(cursor.lastrowid or 0)

        await self.db.execute(
            """
            INSERT INTO users
                (id, username, display_name, password_hash, person_id, home_country, home_currency, profile_theme, about_me, show_world_map, show_featured_trips, show_favorite_photos, show_featured_friends)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 1)
            """,
            (1, "owner", "Owner", "", person_id, "", "USD", "dark-matter", ""),
        )

    async def close(self) -> None:
        if self._db:
            await self._db.close()

    @property
    def db(self) -> aiosqlite.Connection:
        assert self._db is not None, "Store not connected"
        return self._db

    # ── Trips ─────────────────────────────────────────────────────────────

    async def get_trips(self, user_id: int) -> list[Trip]:
        """Fetch all trips with their places, photos, and person IDs."""
        rows = await self.db.execute_fetchall(
            """
            SELECT t.*, CASE WHEN t.user_id = ? THEN 0 ELSE 1 END AS is_shared
            FROM trips t
            LEFT JOIN trip_members tm ON tm.trip_id = t.id
            WHERE t.user_id = ? OR tm.user_id = ?
            GROUP BY t.id
            ORDER BY is_shared, t.id
            """,
            (user_id, user_id, user_id),
        )
        trips = []
        for row in rows:
            trip = await self._build_trip(dict(row), user_id)
            trips.append(trip)
        return trips

    async def get_owned_trips(self, user_id: int) -> list[Trip]:
        rows = await self.db.execute_fetchall("SELECT * FROM trips WHERE user_id = ? ORDER BY id", (user_id,))
        return [await self._build_trip(dict(row), user_id) for row in rows]

    async def get_shared_trips(self, user_id: int) -> list[Trip]:
        rows = await self.db.execute_fetchall(
            """
            SELECT t.*, 1 AS is_shared
            FROM trips t
            JOIN trip_members tm ON tm.trip_id = t.id
            WHERE tm.user_id = ? AND t.user_id != ?
            ORDER BY t.id
            """,
            (user_id, user_id),
        )
        return [await self._build_trip(dict(row), user_id) for row in rows]

    async def get_trip(self, trip_id: int, user_id: int) -> Trip | None:
        if not await self.user_can_access_trip(user_id, trip_id):
            return None
        async with self.db.execute("SELECT * FROM trips WHERE id = ?", (trip_id,)) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return await self._build_trip(dict(row), user_id)

    async def get_trip_by_public_id(self, public_id: str, user_id: int) -> Trip | None:
        async with self.db.execute("SELECT id FROM trips WHERE public_id = ?", (public_id,)) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return await self.get_trip(int(row["id"]), user_id)

    async def create_trip(self, user_id: int, data: TripCreate) -> Trip:
        public_id = str(uuid.uuid4())
        cursor = await self.db.execute(
            "INSERT INTO trips (public_id, name, color, user_id, visibility) VALUES (?, ?, ?, ?, ?)",
            (public_id, data.name, data.color, user_id, data.visibility),
        )
        await self.db.commit()
        last_id = int(cursor.lastrowid or 0)
        trip = await self.get_trip(last_id, user_id)
        assert trip is not None
        return trip

    async def update_trip(self, trip_id: int, user_id: int, data: TripUpdate) -> Trip | None:
        if not await self.user_is_trip_owner(user_id, trip_id):
            return None
        fields = data.model_dump(exclude_none=True)
        if not fields:
            return await self.get_trip(trip_id, user_id)
        # Map camelCase aliases to snake_case columns
        col_map = {"startDate": "start_date", "endDate": "end_date"}
        sets = []
        vals = []
        for key, val in fields.items():
            col = col_map.get(key, key)
            sets.append(f"{col} = ?")
            vals.append(val)
        vals.append(trip_id)
        await self.db.execute(
            f"UPDATE trips SET {', '.join(sets)} WHERE id = ?", vals
        )
        await self.db.commit()
        return await self.get_trip(trip_id, user_id)

    async def delete_trip(self, trip_id: int, user_id: int) -> bool:
        if not await self.user_is_trip_owner(user_id, trip_id):
            return False
        cursor = await self.db.execute(
            "DELETE FROM trips WHERE id = ?", (trip_id,)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def set_trip_persons(self, trip_id: int, user_id: int, person_ids: list[int]) -> Trip | None:
        """Replace all person assignments for a trip."""
        if not await self.user_is_trip_owner(user_id, trip_id):
            return None
        await self.db.execute(
            "DELETE FROM trip_persons WHERE trip_id = ?", (trip_id,)
        )
        for pid in person_ids:
            await self.db.execute(
                "INSERT OR IGNORE INTO trip_persons (trip_id, person_id) VALUES (?, ?)",
                (trip_id, pid),
            )
        await self.db.commit()
        return await self.get_trip(trip_id, user_id)

    async def _build_trip(self, row: dict, user_id: int) -> Trip:
        """Assemble a full Trip object from a DB row."""
        trip_id = row["id"]
        access_role = await self.user_trip_access_role(user_id, trip_id)
        places = await self._get_places(trip_id)
        photos = await self._get_photos(trip_id, user_id)
        person_ids = await self._get_trip_person_ids(trip_id, viewer_user_id=user_id, owner_user_id=row["user_id"])
        return Trip(
            id=row["id"],
            publicId=row["public_id"],
            name=row["name"],
            color=row["color"],
            description=row["description"],
            budget=row["budget"],
            spent=row["spent"],
            startDate=row["start_date"],
            endDate=row["end_date"],
            rating=row["rating"],
            visibility=row.get("visibility", "friends_only"),
            ownerUserId=row["user_id"],
            isShared=bool(row.get("is_shared", row["user_id"] != user_id)),
            accessRole=access_role,
            places=places,
            photos=photos,
            personIds=person_ids,
        )

    async def user_is_trip_owner(self, user_id: int, trip_id: int) -> bool:
        async with self.db.execute("SELECT 1 FROM trips WHERE id = ? AND user_id = ?", (trip_id, user_id)) as cursor:
            return await cursor.fetchone() is not None

    async def user_is_trip_member(self, user_id: int, trip_id: int) -> bool:
        async with self.db.execute("SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?", (trip_id, user_id)) as cursor:
            return await cursor.fetchone() is not None

    async def user_trip_access_role(self, user_id: int, trip_id: int) -> str:
        if await self.user_is_trip_owner(user_id, trip_id):
            return "owner"
        async with self.db.execute("SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?", (trip_id, user_id)) as cursor:
            row = await cursor.fetchone()
        if not row:
            return "none"
        role = (row["role"] or "viewer").strip().lower()
        if role == "member":
            return "editor"
        if role not in VALID_TRIP_MEMBER_ROLES:
            return "viewer"
        return role

    async def user_can_edit_trip(self, user_id: int, trip_id: int) -> bool:
        role = await self.user_trip_access_role(user_id, trip_id)
        return role in {"owner", "editor"}

    async def user_can_access_trip(self, user_id: int, trip_id: int) -> bool:
        return (await self.user_trip_access_role(user_id, trip_id)) != "none"

    async def _get_trip_person_ids(self, trip_id: int, viewer_user_id: int, owner_user_id: int) -> list[int]:
        """
        Return person IDs that should map to this trip for the current viewer.

        - Owners see explicit trip_person assignments plus owner/member mappings.
        - Shared members get IDs mapped into *their* person list so person filtering works.
        """
        person_ids: set[int] = set()

        # Explicit trip-person assignments exist in the owner's person namespace.
        explicit_rows = await self.db.execute_fetchall(
            "SELECT person_id FROM trip_persons WHERE trip_id = ?", (trip_id,)
        )
        if viewer_user_id == owner_user_id:
            person_ids.update(r["person_id"] for r in explicit_rows)

        # Include owner user mapped to viewer's person list.
        owner_person_rows = await self.db.execute_fetchall(
            """
            SELECT id
            FROM persons
            WHERE user_id = ?
              AND ((is_owner = 1 AND ? = ?) OR linked_user_id = ?)
            """,
            (viewer_user_id, viewer_user_id, owner_user_id, owner_user_id),
        )
        person_ids.update(r["id"] for r in owner_person_rows)

        # Include trip member users mapped to viewer's linked friend persons.
        member_rows = await self.db.execute_fetchall(
            "SELECT user_id FROM trip_members WHERE trip_id = ?", (trip_id,)
        )
        member_user_ids = [r["user_id"] for r in member_rows]
        if member_user_ids:
            placeholders = ",".join(["?"] * len(member_user_ids))
            member_person_rows = await self.db.execute_fetchall(
                f"SELECT id FROM persons WHERE user_id = ? AND linked_user_id IN ({placeholders})",
                (viewer_user_id, *member_user_ids),
            )
            person_ids.update(r["id"] for r in member_person_rows)

        return sorted(person_ids)

    # ── Places ────────────────────────────────────────────────────────────

    async def _get_places(self, trip_id: int) -> list[Place]:
        rows = await self.db.execute_fetchall(
            "SELECT * FROM places WHERE trip_id = ? ORDER BY sort_order, id",
            (trip_id,),
        )
        return [Place(id=r["id"], name=r["name"], lat=r["lat"], lng=r["lng"], note=r["note"]) for r in rows]

    async def create_place(self, trip_id: int, data: PlaceCreate) -> Place:
        # Determine next sort_order
        async with self.db.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM places WHERE trip_id = ?",
            (trip_id,),
        ) as cursor:
            row = await cursor.fetchone()
        next_order = row["next_order"] if row else 0

        cursor = await self.db.execute(
            "INSERT INTO places (trip_id, name, lat, lng, note, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
            (trip_id, data.name, data.lat, data.lng, data.note, next_order),
        )
        await self.db.commit()
        return Place(id=int(cursor.lastrowid or 0), name=data.name, lat=data.lat, lng=data.lng, note=data.note)

    async def update_place(self, trip_id: int, place_id: int, data: PlaceUpdate) -> Place | None:
        fields = data.model_dump(exclude_none=True)
        if not fields:
            # Return current place unchanged
            async with self.db.execute(
                "SELECT * FROM places WHERE id = ? AND trip_id = ?", (place_id, trip_id)
            ) as cursor:
                row = await cursor.fetchone()
            if not row:
                return None
            return Place(id=row["id"], name=row["name"], lat=row["lat"], lng=row["lng"], note=row["note"])

        sets = [f"{k} = ?" for k in fields]
        vals = list(fields.values()) + [place_id, trip_id]
        await self.db.execute(
            f"UPDATE places SET {', '.join(sets)} WHERE id = ? AND trip_id = ?", vals
        )
        await self.db.commit()
        async with self.db.execute(
            "SELECT * FROM places WHERE id = ? AND trip_id = ?", (place_id, trip_id)
        ) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return Place(id=row["id"], name=row["name"], lat=row["lat"], lng=row["lng"], note=row["note"])

    async def delete_place(self, trip_id: int, place_id: int) -> bool:
        cursor = await self.db.execute(
            "DELETE FROM places WHERE id = ? AND trip_id = ?", (place_id, trip_id)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def reorder_places(self, trip_id: int, user_id: int, ordered_ids: list[int]) -> Trip | None:
        """Update sort_order for all places in a trip based on the given ID order."""
        for idx, place_id in enumerate(ordered_ids):
            await self.db.execute(
                "UPDATE places SET sort_order = ? WHERE id = ? AND trip_id = ?",
                (idx, place_id, trip_id),
            )
        await self.db.commit()
        return await self.get_trip(trip_id, user_id)

    # ── Itinerary ─────────────────────────────────────────────────────────

    async def list_itinerary_items(self, trip_id: int, user_id: int) -> list[ItineraryItemOut]:
        if not await self.user_can_access_trip(user_id, trip_id):
            return []
        rows = await self.db.execute_fetchall(
            """
            SELECT id, trip_id, title, day_index, start_at, end_at, place_id, note, sort_order, created_at
            FROM itinerary_items
            WHERE trip_id = ?
            ORDER BY day_index ASC, sort_order ASC, id ASC
            """,
            (trip_id,),
        )
        return [
            ItineraryItemOut(
                id=row["id"],
                tripId=row["trip_id"],
                title=row["title"],
                dayIndex=row["day_index"],
                startAt=row["start_at"] or "",
                endAt=row["end_at"] or "",
                placeId=row["place_id"],
                note=row["note"] or "",
                sortOrder=row["sort_order"],
                createdAt=row["created_at"],
            )
            for row in rows
        ]

    async def create_itinerary_item(self, trip_id: int, user_id: int, data: ItineraryItemCreate) -> ItineraryItemOut | None:
        if not await self.user_can_edit_trip(user_id, trip_id):
            return None
        day_index = max(1, int(data.day_index or 1))
        async with self.db.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM itinerary_items WHERE trip_id = ? AND day_index = ?",
            (trip_id, day_index),
        ) as cursor:
            row = await cursor.fetchone()
        next_order = int(row["next_order"] if row else 0)

        cursor = await self.db.execute(
            """
            INSERT INTO itinerary_items (trip_id, title, day_index, start_at, end_at, place_id, note, sort_order, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                trip_id,
                data.title.strip(),
                day_index,
                data.start_at.strip(),
                data.end_at.strip(),
                data.place_id,
                data.note.strip(),
                next_order,
                user_id,
            ),
        )
        await self.db.commit()

        async with self.db.execute(
            """
            SELECT id, trip_id, title, day_index, start_at, end_at, place_id, note, sort_order, created_at
            FROM itinerary_items
            WHERE id = ?
            """,
            (int(cursor.lastrowid or 0),),
        ) as fetch:
            created = await fetch.fetchone()
        if not created:
            return None
        return ItineraryItemOut(
            id=created["id"],
            tripId=created["trip_id"],
            title=created["title"],
            dayIndex=created["day_index"],
            startAt=created["start_at"] or "",
            endAt=created["end_at"] or "",
            placeId=created["place_id"],
            note=created["note"] or "",
            sortOrder=created["sort_order"],
            createdAt=created["created_at"],
        )

    async def delete_itinerary_item(self, trip_id: int, item_id: int, user_id: int) -> bool:
        if not await self.user_can_edit_trip(user_id, trip_id):
            return False
        cursor = await self.db.execute(
            "DELETE FROM itinerary_items WHERE id = ? AND trip_id = ?",
            (item_id, trip_id),
        )
        await self.db.commit()
        return (cursor.rowcount or 0) > 0

    async def update_itinerary_item(self, trip_id: int, item_id: int, user_id: int, data: ItineraryItemUpdate) -> ItineraryItemOut | None:
        if not await self.user_can_edit_trip(user_id, trip_id):
            return None
        fields = data.model_dump(exclude_none=True)
        if "day_index" in fields:
            fields["day_index"] = max(1, int(fields["day_index"]))
        if not fields:
            items = await self.list_itinerary_items(trip_id, user_id)
            for item in items:
                if item.id == item_id:
                    return item
            return None

        sets = [f"{key} = ?" for key in fields.keys()]
        values = list(fields.values()) + [item_id, trip_id]
        await self.db.execute(
            f"UPDATE itinerary_items SET {', '.join(sets)} WHERE id = ? AND trip_id = ?",
            values,
        )
        await self.db.commit()
        items = await self.list_itinerary_items(trip_id, user_id)
        for item in items:
            if item.id == item_id:
                return item
        return None

    # ── Photos ────────────────────────────────────────────────────────────

    async def _get_photos(self, trip_id: int, user_id: int) -> list[PhotoOut]:
        rows = await self.db.execute_fetchall(
            "SELECT * FROM photos WHERE trip_id = ? AND user_id = ? ORDER BY id", (trip_id, user_id)
        )
        return [self._row_to_photo(r) for r in rows]

    async def get_all_photos(self, user_id: int) -> list[dict]:
        """Get all photos across all trips (for the library view)."""
        rows = await self.db.execute_fetchall(
            """
            SELECT p.*, t.name AS trip_name
            FROM photos p
            LEFT JOIN trips t ON p.trip_id = t.id
            WHERE p.user_id = ?
            ORDER BY p.taken_at DESC, p.id DESC
            """,
            (user_id,),
        )
        return [
            {
                **self._row_to_photo(r).model_dump(by_alias=True),
                "tripId": r["trip_id"],
                "tripName": r["trip_name"] if r["trip_name"] else "Unassigned",
            }
            for r in rows
        ]

    async def create_photo(
        self, user_id: int, trip_id: int | None, *, name: str, filename: str, mime: str,
        width: int, height: int, lat: float | None, lng: float | None,
        place_id: int | None, taken_at: int | None, url: str, thumb_url: str,
    ) -> PhotoOut:
        cursor = await self.db.execute(
            """INSERT INTO photos
               (trip_id, user_id, name, filename, mime, width, height, lat, lng, place_id, taken_at, url, thumb_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (trip_id, user_id, name, filename, mime, width, height, lat, lng, place_id, taken_at, url, thumb_url),
        )
        await self.db.commit()
        async with self.db.execute("SELECT * FROM photos WHERE id = ?", (cursor.lastrowid,)) as cur:
            row = await cur.fetchone()
        return self._row_to_photo(row)

    async def add_unattached_photo(
        self, user_id: int, *, name: str, filename: str, mime: str,
        width: int, height: int, lat: float | None, lng: float | None,
        place_id: int | None, taken_at: int | None, url: str, thumb_url: str,
    ) -> PhotoOut:
        return await self.create_photo(
            user_id=user_id,
            trip_id=None,
            name=name,
            filename=filename,
            mime=mime,
            width=width,
            height=height,
            lat=lat,
            lng=lng,
            place_id=place_id,
            taken_at=taken_at,
            url=url,
            thumb_url=thumb_url,
        )

    async def update_photo(self, user_id: int, trip_id: int, photo_id: int, place_id: int | None) -> PhotoOut | None:
        await self.db.execute(
            "UPDATE photos SET place_id = ? WHERE id = ? AND trip_id = ? AND user_id = ?",
            (place_id, photo_id, trip_id, user_id),
        )
        await self.db.commit()
        async with self.db.execute(
            "SELECT * FROM photos WHERE id = ? AND trip_id = ? AND user_id = ?", (photo_id, trip_id, user_id)
        ) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return self._row_to_photo(row)

    async def assign_photo(self, user_id: int, photo_id: int, trip_id: int | None, place_id: int | None) -> PhotoOut | None:
        await self.db.execute(
            "UPDATE photos SET trip_id = ?, place_id = ? WHERE id = ? AND user_id = ?",
            (trip_id, place_id, photo_id, user_id),
        )
        await self.db.commit()
        async with self.db.execute(
            "SELECT * FROM photos WHERE id = ? AND user_id = ?", (photo_id, user_id)
        ) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return self._row_to_photo(row)

    async def delete_photo(self, user_id: int, trip_id: int, photo_id: int) -> str | None:
        """Delete a photo record and return its filename for disk cleanup."""
        async with self.db.execute(
            "SELECT filename FROM photos WHERE id = ? AND trip_id = ? AND user_id = ?", (photo_id, trip_id, user_id)
        ) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        filename = row["filename"]
        await self.db.execute(
            "DELETE FROM photos WHERE id = ? AND trip_id = ? AND user_id = ?", (photo_id, trip_id, user_id)
        )
        await self.db.commit()
        return filename

    async def clear_all_photos(self, user_id: int) -> int:
        """Delete ALL photo records. Returns count of deleted rows."""
        async with self.db.execute("SELECT COUNT(*) as cnt FROM photos WHERE user_id = ?", (user_id,)) as cursor:
            row = await cursor.fetchone()
        count = row["cnt"] if row else 0
        await self.db.execute("DELETE FROM photos WHERE user_id = ?", (user_id,))
        await self.db.commit()
        return count

    @staticmethod
    def _row_to_photo(row) -> PhotoOut:
        return PhotoOut(
            id=row["id"],
            name=row["name"],
            filename=row["filename"],
            mime=row["mime"],
            width=row["width"],
            height=row["height"],
            lat=row["lat"],
            lng=row["lng"],
            placeId=row["place_id"],
            takenAt=row["taken_at"],
            url=row["url"],
            thumbUrl=row["thumb_url"],
        )

    # ── Persons ───────────────────────────────────────────────────────────

    async def get_persons(self, user_id: int) -> list[Person]:
        rows = await self.db.execute_fetchall(
            """
            SELECT p.*,
                   CASE WHEN p.linked_user_id IS NOT NULL THEN 1 ELSE 0 END AS is_friend
            FROM persons p
            WHERE p.user_id = ?
            ORDER BY p.is_owner DESC, is_friend DESC, p.id
            """,
            (user_id,),
        )
        return [
            Person(
                id=r["id"],
                name=r["name"],
                color=r["color"],
                isOwner=bool(r["is_owner"]),
                isFriend=bool(r["is_friend"]),
            )
            for r in rows
        ]

    async def create_person(self, user_id: int, data: PersonCreate) -> Person:
        cursor = await self.db.execute(
            "INSERT INTO persons (name, color, user_id, is_owner) VALUES (?, ?, ?, 0)",
            (data.name, data.color, user_id),
        )
        await self.db.commit()
        return Person(id=int(cursor.lastrowid or 0), name=data.name, color=data.color, isOwner=False, isFriend=False)

    async def update_person(self, user_id: int, person_id: int, data: PersonUpdate) -> Person | None:
        fields = data.model_dump(exclude_none=True)
        if not fields:
            async with self.db.execute(
                "SELECT * FROM persons WHERE id = ? AND user_id = ?", (person_id, user_id)
            ) as cursor:
                row = await cursor.fetchone()
            if not row:
                return None
            return Person(
                id=row["id"],
                name=row["name"],
                color=row["color"],
                isOwner=bool(row["is_owner"]),
                isFriend=bool(row["linked_user_id"] is not None),
            )

        sets = [f"{k} = ?" for k in fields]
        vals = list(fields.values()) + [person_id, user_id]
        await self.db.execute(
            f"UPDATE persons SET {', '.join(sets)} WHERE id = ? AND user_id = ?", vals
        )
        await self.db.commit()
        async with self.db.execute(
            "SELECT * FROM persons WHERE id = ? AND user_id = ?", (person_id, user_id)
        ) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return Person(
            id=row["id"],
            name=row["name"],
            color=row["color"],
            isOwner=bool(row["is_owner"]),
            isFriend=bool(row["linked_user_id"] is not None),
        )

    async def delete_person(self, user_id: int, person_id: int) -> bool:
        async with self.db.execute(
            "SELECT is_owner FROM persons WHERE id = ? AND user_id = ?", (person_id, user_id)
        ) as cursor:
            row = await cursor.fetchone()
        if not row or bool(row["is_owner"]):
            return False

        cursor = await self.db.execute(
            "DELETE FROM persons WHERE id = ? AND user_id = ?", (person_id, user_id)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    # ── Users ─────────────────────────────────────────────────────────────

    async def create_user(self, username: str, display_name: str, password_hash: str) -> UserOut:
        person_cursor = await self.db.execute(
            "INSERT INTO persons (name, color, user_id, is_owner) VALUES (?, ?, ?, 1)",
            (display_name, "#4A90D9", 0),
        )
        person_id = int(person_cursor.lastrowid or 0)

        user_cursor = await self.db.execute(
            "INSERT INTO users (username, display_name, password_hash, person_id) VALUES (?, ?, ?, ?)",
            (username, display_name, password_hash, person_id),
        )
        user_id = int(user_cursor.lastrowid or 0)

        await self.db.execute("UPDATE persons SET user_id = ? WHERE id = ?", (user_id, person_id))
        await self.db.commit()

        user = await self.get_user_by_id(user_id)
        assert user is not None
        return user

    async def update_user(self, user_id: int, data: UserUpdate) -> UserOut | None:
        fields = data.model_dump(exclude_none=True)
        if not fields:
            return await self.get_user_by_id(user_id)

        theme_value = fields.get("profileTheme", fields.get("profile_theme"))
        if theme_value is not None and theme_value not in VALID_PROFILE_THEMES:
            raise ValueError("Invalid profile theme")

        col_map = {
            "displayName": "display_name",
            "homeCountry": "home_country",
            "homeCurrency": "home_currency",
        }
        sets = []
        vals = []
        for key, value in fields.items():
            sets.append(f"{col_map.get(key, key)} = ?")
            vals.append(value)
        vals.append(user_id)

        await self.db.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", vals)

        if "displayName" in fields:
            async with self.db.execute("SELECT person_id FROM users WHERE id = ?", (user_id,)) as cursor:
                row = await cursor.fetchone()
            if row:
                await self.db.execute(
                    "UPDATE persons SET name = ? WHERE id = ?",
                    (fields["displayName"], row["person_id"]),
                )

        await self.db.commit()
        return await self.get_user_by_id(user_id)

    async def get_user_by_username(self, username: str) -> UserOut | None:
        async with self.db.execute("SELECT * FROM users WHERE username = ?", (username,)) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return UserOut(
            id=row["id"],
            username=row["username"],
            displayName=row["display_name"],
            personId=row["person_id"],
            homeCountry=row["home_country"],
            homeCurrency=row["home_currency"],
            profileTheme=row["profile_theme"],
            avatarUrl=row["avatar_url"] or "",
            createdAt=row["created_at"],
        )

    async def get_user_password_hash(self, username: str) -> str | None:
        async with self.db.execute("SELECT password_hash FROM users WHERE username = ?", (username,)) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return row["password_hash"]

    async def get_user_by_id(self, user_id: int) -> UserOut | None:
        async with self.db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return UserOut(
            id=row["id"],
            username=row["username"],
            displayName=row["display_name"],
            personId=row["person_id"],
            homeCountry=row["home_country"],
            homeCurrency=row["home_currency"],
            profileTheme=row["profile_theme"],
            avatarUrl=row["avatar_url"] or "",
            createdAt=row["created_at"],
        )

    async def set_user_avatar_url(self, user_id: int, avatar_url: str) -> UserOut | None:
        await self.db.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (avatar_url, user_id))
        await self.db.commit()
        return await self.get_user_by_id(user_id)

    async def list_currency_codes(self) -> list[str]:
        rows = await self.db.execute_fetchall("SELECT DISTINCT home_currency AS currency FROM users UNION SELECT DISTINCT currency FROM expenses")
        known = {r["currency"] for r in rows if r["currency"]}
        known.update({"USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "INR"})
        return sorted(known)

    # ── Profiles ──────────────────────────────────────────────────────────

    async def get_profile_by_username(self, viewer_user_id: int, username: str) -> ProfileOut | None:
        async with self.db.execute("SELECT * FROM users WHERE username = ?", (username,)) as cursor:
            user = await cursor.fetchone()
        if not user:
            return None
        return await self._build_profile(viewer_user_id, user["id"])

    async def get_profile_by_user_id(self, viewer_user_id: int, profile_user_id: int) -> ProfileOut | None:
        async with self.db.execute("SELECT id FROM users WHERE id = ?", (profile_user_id,)) as cursor:
            user = await cursor.fetchone()
        if not user:
            return None
        return await self._build_profile(viewer_user_id, profile_user_id)

    async def _build_profile(self, viewer_user_id: int, profile_user_id: int) -> ProfileOut:
        async with self.db.execute("SELECT * FROM users WHERE id = ?", (profile_user_id,)) as cursor:
            user = await cursor.fetchone()
        assert user is not None

        featured_rows = await self.db.execute_fetchall(
            """
            SELECT t.id, t.name, t.color,
                   (SELECT COUNT(*) FROM places p WHERE p.trip_id = t.id) AS places_count,
                   (SELECT COUNT(*) FROM photos ph WHERE ph.trip_id = t.id) AS photos_count
            FROM profile_featured_trips pft
            JOIN trips t ON t.id = pft.trip_id
            WHERE pft.user_id = ?
            ORDER BY pft.sort_order, t.id
            """,
            (profile_user_id,),
        )
        featured_trips = [
            ProfileTripOut(
                id=r["id"],
                name=r["name"],
                color=r["color"],
                placesCount=int(r["places_count"]),
                photosCount=int(r["photos_count"]),
            )
            for r in featured_rows
        ]

        photo_rows = await self.db.execute_fetchall(
            """
            SELECT ph.id, ph.name, ph.url, ph.thumb_url
            FROM profile_favorite_photos pfp
            JOIN photos ph ON ph.id = pfp.photo_id
            WHERE pfp.user_id = ?
            ORDER BY pfp.sort_order, ph.id
            """,
            (profile_user_id,),
        )
        favorite_photos = [
            ProfilePhotoOut(
                id=r["id"],
                name=r["name"],
                url=r["url"],
                thumbUrl=r["thumb_url"],
            )
            for r in photo_rows
        ]

        friend_rows = await self.db.execute_fetchall(
            """
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.home_country, u.home_currency
            FROM profile_featured_friends pff
            JOIN users u ON u.id = pff.friend_user_id
            WHERE pff.user_id = ?
            ORDER BY pff.sort_order, u.display_name
            """,
            (profile_user_id,),
        )
        featured_friends = [
            ProfileFriendOut(
                userId=r["id"],
                username=r["username"],
                displayName=r["display_name"],
                avatarUrl=r["avatar_url"] or "",
                homeCountry=r["home_country"],
                homeCurrency=r["home_currency"],
            )
            for r in friend_rows
        ]

        map_rows = await self.db.execute_fetchall(
            """
            SELECT p.id AS place_id, p.lat, p.lng, p.sort_order,
                   t.id AS trip_id, t.name AS trip_name, t.color AS trip_color
            FROM trips t
            JOIN places p ON p.trip_id = t.id
            WHERE t.user_id = ?
            ORDER BY t.id DESC, p.sort_order, p.id
            LIMIT 800
            """,
            (profile_user_id,),
        )
        map_places = [
            ProfileMapPointOut(
                placeId=r["place_id"],
                tripId=r["trip_id"],
                tripName=r["trip_name"],
                tripColor=r["trip_color"],
                lat=float(r["lat"]),
                lng=float(r["lng"]),
                sortOrder=int(r["sort_order"]),
            )
            for r in map_rows
        ]

        return ProfileOut(
            userId=user["id"],
            username=user["username"],
            displayName=user["display_name"],
            avatarUrl=user["avatar_url"] or "",
            homeCountry=user["home_country"],
            homeCurrency=user["home_currency"],
            profileTheme=user["profile_theme"],
            aboutMe=user["about_me"],
            showWorldMap=bool(user["show_world_map"]),
            showFeaturedTrips=bool(user["show_featured_trips"]),
            showFavoritePhotos=bool(user["show_favorite_photos"]),
            showFeaturedFriends=bool(user["show_featured_friends"]),
            featuredTrips=featured_trips,
            featuredFriends=featured_friends,
            favoritePhotos=favorite_photos,
            mapPlaces=map_places,
            isSelf=viewer_user_id == user["id"],
        )

    async def search_profiles(self, query: str, viewer_user_id: int, limit: int = 25) -> list[ProfileSearchResult]:
        term = f"%{query.strip()}%"
        rows = await self.db.execute_fetchall(
            """
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.profile_theme, u.about_me,
                   CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END AS is_friend
            FROM users u
            LEFT JOIN friends f ON f.user_id = ? AND f.friend_user_id = u.id
            WHERE u.username LIKE ? OR u.display_name LIKE ?
            ORDER BY is_friend DESC, u.display_name ASC
            LIMIT ?
            """,
            (viewer_user_id, term, term, limit),
        )
        return [
            ProfileSearchResult(
                userId=r["id"],
                username=r["username"],
                displayName=r["display_name"],
                avatarUrl=r["avatar_url"] or "",
                profileTheme=r["profile_theme"],
                aboutMe=r["about_me"] or "",
                isFriend=bool(r["is_friend"]),
            )
            for r in rows
        ]

    async def update_profile(self, user_id: int, data: ProfileUpdate) -> ProfileOut:
        fields = data.model_dump(exclude_none=True)
        if not fields:
            profile = await self.get_profile_by_user_id(user_id, user_id)
            assert profile is not None
            return profile

        theme_value = fields.get("profileTheme", fields.get("profile_theme"))
        if theme_value is not None and theme_value not in VALID_PROFILE_THEMES:
            raise ValueError("Invalid profile theme")

        about = fields.get("aboutMe", fields.get("about_me"))
        if about is not None and len(about) > 600:
            raise ValueError("About me is too long (max 600)")

        user_update_data = {
            "displayName": fields.get("displayName", fields.get("display_name")),
            "homeCountry": fields.get("homeCountry", fields.get("home_country")),
            "homeCurrency": fields.get("homeCurrency", fields.get("home_currency")),
            "profileTheme": theme_value,
        }
        await self.update_user(user_id, UserUpdate(**{k: v for k, v in user_update_data.items() if v is not None}))

        profile_updates = []
        profile_vals = []
        col_map = {
            "aboutMe": "about_me",
            "about_me": "about_me",
            "showWorldMap": "show_world_map",
            "show_world_map": "show_world_map",
            "showFeaturedTrips": "show_featured_trips",
            "show_featured_trips": "show_featured_trips",
            "showFavoritePhotos": "show_favorite_photos",
            "show_favorite_photos": "show_favorite_photos",
            "showFeaturedFriends": "show_featured_friends",
            "show_featured_friends": "show_featured_friends",
        }
        for key, val in fields.items():
            col = col_map.get(key)
            if not col:
                continue
            profile_updates.append(f"{col} = ?")
            if isinstance(val, bool):
                profile_vals.append(1 if val else 0)
            else:
                profile_vals.append(val)

        if profile_updates:
            profile_vals.append(user_id)
            await self.db.execute(f"UPDATE users SET {', '.join(profile_updates)} WHERE id = ?", profile_vals)
            await self.db.commit()

        profile = await self.get_profile_by_user_id(user_id, user_id)
        assert profile is not None
        return profile

    async def set_profile_featured_trips(self, user_id: int, trip_ids: list[int]) -> list[ProfileTripOut]:
        clean_ids = list(dict.fromkeys([int(tid) for tid in trip_ids if tid]))
        if len(clean_ids) > 8:
            raise ValueError("You can feature at most 8 trips")

        if clean_ids:
            placeholders = ",".join(["?"] * len(clean_ids))
            rows = await self.db.execute_fetchall(
                f"SELECT id FROM trips WHERE user_id = ? AND id IN ({placeholders})",
                (user_id, *clean_ids),
            )
            existing = {r["id"] for r in rows}
            if existing != set(clean_ids):
                raise ValueError("All featured trips must belong to you")

        await self.db.execute("DELETE FROM profile_featured_trips WHERE user_id = ?", (user_id,))
        for idx, trip_id in enumerate(clean_ids):
            await self.db.execute(
                "INSERT INTO profile_featured_trips (user_id, trip_id, sort_order) VALUES (?, ?, ?)",
                (user_id, trip_id, idx),
            )
        await self.db.commit()

        profile = await self.get_profile_by_user_id(user_id, user_id)
        assert profile is not None
        return profile.featured_trips

    async def set_profile_favorite_photos(self, user_id: int, photo_ids: list[int]) -> list[ProfilePhotoOut]:
        clean_ids = list(dict.fromkeys([int(pid) for pid in photo_ids if pid]))
        if len(clean_ids) > 6:
            raise ValueError("You can feature between 1 and 6 photos")

        if clean_ids:
            placeholders = ",".join(["?"] * len(clean_ids))
            rows = await self.db.execute_fetchall(
                f"SELECT id FROM photos WHERE user_id = ? AND id IN ({placeholders})",
                (user_id, *clean_ids),
            )
            existing = {r["id"] for r in rows}
            if existing != set(clean_ids):
                raise ValueError("All favorite photos must belong to you")

        await self.db.execute("DELETE FROM profile_favorite_photos WHERE user_id = ?", (user_id,))
        for idx, photo_id in enumerate(clean_ids):
            await self.db.execute(
                "INSERT INTO profile_favorite_photos (user_id, photo_id, sort_order) VALUES (?, ?, ?)",
                (user_id, photo_id, idx),
            )
        await self.db.commit()

        profile = await self.get_profile_by_user_id(user_id, user_id)
        assert profile is not None
        return profile.favorite_photos

    async def set_profile_featured_friends(self, user_id: int, friend_user_ids: list[int]) -> list[ProfileFriendOut]:
        clean_ids = list(dict.fromkeys([int(fid) for fid in friend_user_ids if fid]))
        if len(clean_ids) > 12:
            raise ValueError("You can feature at most 12 friends")

        if clean_ids:
            placeholders = ",".join(["?"] * len(clean_ids))
            rows = await self.db.execute_fetchall(
                f"SELECT friend_user_id FROM friends WHERE user_id = ? AND friend_user_id IN ({placeholders})",
                (user_id, *clean_ids),
            )
            existing = {r["friend_user_id"] for r in rows}
            if existing != set(clean_ids):
                raise ValueError("All featured friends must be your friends")

        await self.db.execute("DELETE FROM profile_featured_friends WHERE user_id = ?", (user_id,))
        for idx, fid in enumerate(clean_ids):
            await self.db.execute(
                "INSERT INTO profile_featured_friends (user_id, friend_user_id, sort_order) VALUES (?, ?, ?)",
                (user_id, fid, idx),
            )
        await self.db.commit()

        profile = await self.get_profile_by_user_id(user_id, user_id)
        assert profile is not None
        return profile.featured_friends

    async def get_profile_options(self, user_id: int) -> dict:
        trips_rows = await self.db.execute_fetchall(
            """
            SELECT t.id, t.name, t.color,
                   (SELECT COUNT(*) FROM places p WHERE p.trip_id = t.id) AS places_count,
                   (SELECT COUNT(*) FROM photos ph WHERE ph.trip_id = t.id) AS photos_count
            FROM trips t
            WHERE t.user_id = ?
            ORDER BY t.id DESC
            """,
            (user_id,),
        )
        photos_rows = await self.db.execute_fetchall(
            "SELECT id, name, url, thumb_url FROM photos WHERE user_id = ? ORDER BY id DESC LIMIT 150",
            (user_id,),
        )
        friends_rows = await self.db.execute_fetchall(
            """
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.home_country, u.home_currency
            FROM friends f
            JOIN users u ON u.id = f.friend_user_id
            WHERE f.user_id = ?
            ORDER BY u.display_name
            """,
            (user_id,),
        )
        return {
            "trips": [
                ProfileTripOut(
                    id=r["id"],
                    name=r["name"],
                    color=r["color"],
                    placesCount=int(r["places_count"]),
                    photosCount=int(r["photos_count"]),
                ).model_dump(by_alias=True)
                for r in trips_rows
            ],
            "photos": [
                ProfilePhotoOut(
                    id=r["id"],
                    name=r["name"],
                    url=r["url"],
                    thumbUrl=r["thumb_url"],
                ).model_dump(by_alias=True)
                for r in photos_rows
            ],
            "friends": [
                ProfileFriendOut(
                    userId=r["id"],
                    username=r["username"],
                    displayName=r["display_name"],
                    avatarUrl=r["avatar_url"] or "",
                    homeCountry=r["home_country"],
                    homeCurrency=r["home_currency"],
                ).model_dump(by_alias=True)
                for r in friends_rows
            ],
            "themes": sorted(VALID_PROFILE_THEMES),
        }

    # ── Notifications ─────────────────────────────────────────────────────

    async def create_notification(
        self,
        user_id: int,
        notification_type: str,
        title: str,
        message: str,
        payload: dict | None = None,
        group_key: str | None = None,
        *,
        aggregate: bool = True,
        commit: bool = True,
    ) -> int:
        payload_obj = payload or {}
        payload_json = json.dumps(payload_obj, separators=(",", ":"))
        resolved_group_key = (group_key or "").strip()
        if not resolved_group_key and aggregate and notification_type in {"photo_commented", "comment_mention"}:
            entity_type = str(payload_obj.get("entityType") or "")
            entity_id = str(payload_obj.get("entityId") or "")
            if entity_type and entity_id:
                resolved_group_key = f"{notification_type}:{entity_type}:{entity_id}"

        if aggregate and resolved_group_key:
            async with self.db.execute(
                """
                SELECT id
                FROM notifications
                WHERE user_id = ? AND type = ? AND group_key = ? AND is_read = 0
                ORDER BY id DESC
                LIMIT 1
                """,
                (user_id, notification_type, resolved_group_key),
            ) as cursor:
                existing = await cursor.fetchone()
            if existing:
                await self.db.execute(
                    """
                    UPDATE notifications
                    SET title = ?,
                        message = ?,
                        payload = ?,
                        occurrence_count = occurrence_count + 1,
                        updated_at = datetime('now')
                    WHERE id = ?
                    """,
                    (title, message, payload_json, int(existing["id"])),
                )
                if commit:
                    await self.db.commit()
                return int(existing["id"])

        cursor = await self.db.execute(
            """
            INSERT INTO notifications (user_id, type, group_key, title, message, payload, occurrence_count, is_read, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, 0, datetime('now'))
            """,
            (user_id, notification_type, resolved_group_key, title, message, payload_json),
        )
        if commit:
            await self.db.commit()
        return int(cursor.lastrowid or 0)

    async def list_notifications(
        self,
        user_id: int,
        *,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
        include_archived: bool = False,
    ) -> list[NotificationOut]:
        safe_limit = max(1, min(limit, 100))
        safe_offset = max(0, offset)
        where_parts = ["user_id = ?"]
        if unread_only:
            where_parts.append("is_read = 0")
        if not include_archived:
            where_parts.append("is_archived = 0")
        where_clause = "WHERE " + " AND ".join(where_parts)
        rows = await self.db.execute_fetchall(
            f"""
            SELECT id, type, title, message, payload, occurrence_count, is_read, created_at, updated_at
            FROM notifications
            {where_clause}
            ORDER BY datetime(updated_at) DESC, id DESC
            LIMIT ? OFFSET ?
            """,
            (user_id, safe_limit, safe_offset),
        )
        result = []
        for row in rows:
            payload: dict
            try:
                decoded = json.loads(row["payload"] or "{}")
                payload = decoded if isinstance(decoded, dict) else {}
            except json.JSONDecodeError:
                payload = {}
            result.append(
                NotificationOut(
                    id=row["id"],
                    type=row["type"],
                    title=row["title"],
                    message=row["message"],
                    payload=payload,
                    occurrenceCount=int(row["occurrence_count"] or 1),
                    isRead=bool(row["is_read"]),
                    createdAt=row["created_at"],
                    updatedAt=row["updated_at"] or row["created_at"],
                )
            )
        return result

    async def get_unread_notification_count(self, user_id: int) -> int:
        async with self.db.execute(
            "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0 AND is_archived = 0",
            (user_id,),
        ) as cursor:
            row = await cursor.fetchone()
        return int(row["count"] if row else 0)

    async def mark_notifications_read(self, user_id: int, notification_ids: list[int]) -> int:
        ids = list(dict.fromkeys([int(nid) for nid in notification_ids if nid]))
        if not ids:
            return 0
        placeholders = ",".join(["?"] * len(ids))
        cursor = await self.db.execute(
            f"UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN ({placeholders})",
            (user_id, *ids),
        )
        await self.db.commit()
        return int(cursor.rowcount or 0)

    async def mark_all_notifications_read(self, user_id: int) -> int:
        cursor = await self.db.execute(
            "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0 AND is_archived = 0",
            (user_id,),
        )
        await self.db.commit()
        return int(cursor.rowcount or 0)

    async def archive_notifications(self, user_id: int, notification_ids: list[int]) -> int:
        ids = list(dict.fromkeys([int(nid) for nid in notification_ids if nid]))
        if not ids:
            return 0
        placeholders = ",".join(["?"] * len(ids))
        cursor = await self.db.execute(
            f"UPDATE notifications SET is_archived = 1, updated_at = datetime('now') WHERE user_id = ? AND id IN ({placeholders})",
            (user_id, *ids),
        )
        await self.db.commit()
        return int(cursor.rowcount or 0)

    # ── Comments ──────────────────────────────────────────────────────────

    async def _can_access_comment_entity(self, user_id: int, entity_type: str, entity_id: int) -> bool:
        kind = entity_type.strip().lower()
        if kind == "trip":
            return await self.user_can_access_trip(user_id, entity_id)
        if kind == "photo":
            async with self.db.execute("SELECT trip_id, user_id FROM photos WHERE id = ?", (entity_id,)) as cursor:
                row = await cursor.fetchone()
            if not row:
                return False
            if row["trip_id"] is not None:
                return await self.user_can_access_trip(user_id, int(row["trip_id"]))
            return int(row["user_id"]) == user_id
        return False

    async def list_comments(self, user_id: int, entity_type: str, entity_id: int, limit: int = 100) -> list[CommentOut]:
        if not await self._can_access_comment_entity(user_id, entity_type, entity_id):
            return []

        safe_limit = max(1, min(limit, 200))
        rows = await self.db.execute_fetchall(
            """
            SELECT c.id, c.entity_type, c.entity_id, c.user_id, c.body, c.created_at,
                   u.username, u.display_name
            FROM comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.entity_type = ? AND c.entity_id = ?
            ORDER BY c.id ASC
            LIMIT ?
            """,
            (entity_type.strip().lower(), entity_id, safe_limit),
        )
        comments: list[CommentOut] = []
        for row in rows:
            reaction_rows = await self.db.execute_fetchall(
                """
                SELECT emoji,
                       COUNT(*) AS count,
                       SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS reacted
                FROM comment_reactions
                WHERE comment_id = ?
                GROUP BY emoji
                ORDER BY count DESC, emoji ASC
                """,
                (user_id, row["id"]),
            )
            comments.append(
                CommentOut(
                    id=row["id"],
                    entityType=row["entity_type"],
                    entityId=row["entity_id"],
                    userId=row["user_id"],
                    username=row["username"],
                    displayName=row["display_name"],
                    body=row["body"],
                    canDelete=row["user_id"] == user_id,
                    createdAt=row["created_at"],
                    reactions=[
                        CommentReactionOut(
                            emoji=reaction["emoji"],
                            count=int(reaction["count"]),
                            reacted=bool(reaction["reacted"]),
                        )
                        for reaction in reaction_rows
                    ],
                )
            )
        return comments

    async def get_comment_counts(self, user_id: int, entity_type: str, entity_ids: list[int]) -> dict[int, int]:
        kind = entity_type.strip().lower()
        if kind not in {"trip", "photo"}:
            return {}
        unique_ids = sorted({int(entity_id) for entity_id in entity_ids if int(entity_id) > 0})
        if not unique_ids:
            return {}

        accessible_ids: list[int] = []
        for entity_id in unique_ids:
            if await self._can_access_comment_entity(user_id, kind, entity_id):
                accessible_ids.append(entity_id)
        if not accessible_ids:
            return {}

        placeholders = ",".join(["?"] * len(accessible_ids))
        rows = await self.db.execute_fetchall(
            f"""
            SELECT entity_id, COUNT(*) AS count
            FROM comments
            WHERE entity_type = ?
              AND entity_id IN ({placeholders})
            GROUP BY entity_id
            """,
            (kind, *accessible_ids),
        )
        counts = {entity_id: 0 for entity_id in accessible_ids}
        for row in rows:
            counts[int(row["entity_id"])] = int(row["count"])
        return counts

    async def create_comment(self, user_id: int, data: CommentCreate) -> CommentOut:
        entity_type = data.entity_type.strip().lower()
        if entity_type not in {"trip", "photo"}:
            raise ValueError("Unsupported comment entity")
        body = data.body.strip()
        if len(body) < 1:
            raise ValueError("Comment body is required")
        if len(body) > 1000:
            raise ValueError("Comment is too long (max 1000)")
        if not await self._can_access_comment_entity(user_id, entity_type, data.entity_id):
            raise ValueError("You cannot comment on this item")

        cursor = await self.db.execute(
            "INSERT INTO comments (entity_type, entity_id, user_id, body) VALUES (?, ?, ?, ?)",
            (entity_type, data.entity_id, user_id, body),
        )
        comment_id = int(cursor.lastrowid or 0)

        trip_public_id: str | None = None
        if entity_type == "trip":
            async with self.db.execute("SELECT public_id FROM trips WHERE id = ?", (data.entity_id,)) as cursor_trip:
                trip_row = await cursor_trip.fetchone()
            if trip_row:
                trip_public_id = trip_row["public_id"]

        author = await self.get_user_by_id(user_id)
        if author:
            mention_usernames = {m.group(1).lower() for m in MENTION_RE.finditer(body)}
            for username in mention_usernames:
                mentioned_user = await self.get_user_by_username(username)
                if not mentioned_user or mentioned_user.id == user_id:
                    continue
                if not await self._can_access_comment_entity(mentioned_user.id, entity_type, data.entity_id):
                    continue
                await self.create_notification(
                    mentioned_user.id,
                    "comment_mention",
                    "You were mentioned",
                    f"{author.display_name} mentioned you in a comment.",
                    payload={
                        "commentId": comment_id,
                        "entityType": entity_type,
                        "entityId": data.entity_id,
                        "tripPublicId": trip_public_id,
                        "fromUserId": author.id,
                        "fromUsername": author.username,
                        "fromDisplayName": author.display_name,
                    },
                    commit=False,
                )

            if entity_type == "photo":
                async with self.db.execute(
                    "SELECT user_id, trip_id FROM photos WHERE id = ?",
                    (data.entity_id,),
                ) as cursor:
                    photo_row = await cursor.fetchone()
                if photo_row:
                    if photo_row["trip_id"] is not None:
                        async with self.db.execute("SELECT public_id FROM trips WHERE id = ?", (int(photo_row["trip_id"]),)) as cursor_trip:
                            linked_trip = await cursor_trip.fetchone()
                        if linked_trip:
                            trip_public_id = linked_trip["public_id"]
                    photo_owner_id = int(photo_row["user_id"])
                    if photo_owner_id != user_id:
                        await self.create_notification(
                            photo_owner_id,
                            "photo_commented",
                            "New photo comment",
                            f"{author.display_name} commented on your photo.",
                            payload={
                                "photoId": data.entity_id,
                                "entityType": "photo",
                                "entityId": data.entity_id,
                                "tripId": photo_row["trip_id"],
                                "tripPublicId": trip_public_id,
                                "fromUserId": author.id,
                                "fromUsername": author.username,
                                "fromDisplayName": author.display_name,
                            },
                            commit=False,
                        )

        await self.db.commit()

        comments = await self.list_comments(user_id, entity_type, data.entity_id, limit=200)
        for comment in comments:
            if comment.id == comment_id:
                return comment
        raise ValueError("Failed to create comment")

    async def delete_comment(self, user_id: int, comment_id: int) -> bool:
        cursor = await self.db.execute(
            "DELETE FROM comments WHERE id = ? AND user_id = ?",
            (comment_id, user_id),
        )
        await self.db.commit()
        return (cursor.rowcount or 0) > 0

    async def toggle_comment_reaction(self, user_id: int, comment_id: int, emoji: str) -> list[CommentReactionOut]:
        clean_emoji = emoji.strip()
        if not clean_emoji:
            raise ValueError("Emoji is required")
        if len(clean_emoji) > 16:
            raise ValueError("Emoji value is invalid")

        async with self.db.execute(
            "SELECT entity_type, entity_id FROM comments WHERE id = ?",
            (comment_id,),
        ) as cursor:
            comment = await cursor.fetchone()
        if not comment:
            raise ValueError("Comment not found")
        if not await self._can_access_comment_entity(user_id, comment["entity_type"], int(comment["entity_id"])):
            raise ValueError("You cannot react to this comment")

        async with self.db.execute(
            "SELECT 1 FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?",
            (comment_id, user_id, clean_emoji),
        ) as cursor:
            existing = await cursor.fetchone()

        if existing:
            await self.db.execute(
                "DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?",
                (comment_id, user_id, clean_emoji),
            )
        else:
            await self.db.execute(
                "INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES (?, ?, ?)",
                (comment_id, user_id, clean_emoji),
            )
        await self.db.commit()

        reaction_rows = await self.db.execute_fetchall(
            """
            SELECT emoji,
                   COUNT(*) AS count,
                   SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS reacted
            FROM comment_reactions
            WHERE comment_id = ?
            GROUP BY emoji
            ORDER BY count DESC, emoji ASC
            """,
            (user_id, comment_id),
        )
        return [
            CommentReactionOut(
                emoji=row["emoji"],
                count=int(row["count"]),
                reacted=bool(row["reacted"]),
            )
            for row in reaction_rows
        ]

    # ── Friends ───────────────────────────────────────────────────────────

    async def are_friends(self, user_id: int, other_user_id: int) -> bool:
        async with self.db.execute(
            "SELECT 1 FROM friends WHERE user_id = ? AND friend_user_id = ?",
            (user_id, other_user_id),
        ) as cursor:
            return await cursor.fetchone() is not None

    async def send_friend_request(self, from_user_id: int, username: str) -> FriendRequestOut:
        target = await self.get_user_by_username(username)
        if not target:
            raise ValueError("User not found")
        if target.id == from_user_id:
            raise ValueError("Cannot friend yourself")
        if await self.are_friends(from_user_id, target.id):
            raise ValueError("Already friends")

        cursor = await self.db.execute(
            """
            INSERT OR REPLACE INTO friend_requests (id, from_user_id, to_user_id, status, created_at)
            VALUES (
                COALESCE((SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?), NULL),
                ?, ?, 'pending', datetime('now')
            )
            """,
            (from_user_id, target.id, from_user_id, target.id),
        )
        await self.db.commit()
        async with self.db.execute(
            """
            SELECT fr.*, u.username AS from_username, u.display_name AS from_display_name,
                   tu.username AS to_username, tu.display_name AS to_display_name
            FROM friend_requests fr
            JOIN users u ON u.id = fr.from_user_id
            JOIN users tu ON tu.id = fr.to_user_id
            WHERE fr.id = ?
            """,
            (int(cursor.lastrowid or 0),),
        ) as c:
            row = await c.fetchone()
        if not row:
            async with self.db.execute(
                """
                SELECT fr.*, u.username AS from_username, u.display_name AS from_display_name,
                       tu.username AS to_username, tu.display_name AS to_display_name
                FROM friend_requests fr
                JOIN users u ON u.id = fr.from_user_id
                JOIN users tu ON tu.id = fr.to_user_id
                WHERE fr.from_user_id = ? AND fr.to_user_id = ?
                """,
                (from_user_id, target.id),
            ) as c2:
                row = await c2.fetchone()
        assert row is not None
        await self.create_notification(
            target.id,
            "friend_request_received",
            "New friend request",
            f"{row['from_display_name']} sent you a friend request.",
            payload={
                "requestId": row["id"],
                "fromUserId": row["from_user_id"],
                "fromUsername": row["from_username"],
            },
        )
        return FriendRequestOut(
            id=row["id"],
            fromUserId=row["from_user_id"],
            toUserId=row["to_user_id"],
            fromUsername=row["from_username"],
            fromDisplayName=row["from_display_name"],
            toUsername=row["to_username"],
            toDisplayName=row["to_display_name"],
            status=row["status"],
            createdAt=row["created_at"],
        )

    async def list_friend_requests_for_user(self, user_id: int) -> list[FriendRequestOut]:
        rows = await self.db.execute_fetchall(
            """
            SELECT fr.*, u.username AS from_username, u.display_name AS from_display_name,
                   tu.username AS to_username, tu.display_name AS to_display_name
            FROM friend_requests fr
            JOIN users u ON u.id = fr.from_user_id
            JOIN users tu ON tu.id = fr.to_user_id
            WHERE fr.to_user_id = ? AND fr.status = 'pending'
            ORDER BY fr.id DESC
            """,
            (user_id,),
        )
        return [
            FriendRequestOut(
                id=r["id"],
                fromUserId=r["from_user_id"],
                toUserId=r["to_user_id"],
                fromUsername=r["from_username"],
                fromDisplayName=r["from_display_name"],
                toUsername=r["to_username"],
                toDisplayName=r["to_display_name"],
                status=r["status"],
                createdAt=r["created_at"],
            )
            for r in rows
        ]

    async def list_outgoing_friend_requests_for_user(self, user_id: int) -> list[FriendRequestOut]:
        rows = await self.db.execute_fetchall(
            """
            SELECT fr.*, fu.username AS from_username, fu.display_name AS from_display_name,
                   tu.username AS to_username, tu.display_name AS to_display_name
            FROM friend_requests fr
            JOIN users fu ON fu.id = fr.from_user_id
            JOIN users tu ON tu.id = fr.to_user_id
            WHERE fr.from_user_id = ? AND fr.status = 'pending'
            ORDER BY fr.id DESC
            """,
            (user_id,),
        )
        return [
            FriendRequestOut(
                id=r["id"],
                fromUserId=r["from_user_id"],
                toUserId=r["to_user_id"],
                fromUsername=r["from_username"],
                fromDisplayName=r["from_display_name"],
                toUsername=r["to_username"],
                toDisplayName=r["to_display_name"],
                status=r["status"],
                createdAt=r["created_at"],
            )
            for r in rows
        ]

    async def accept_friend_request(self, request_id: int, user_id: int) -> bool:
        async with self.db.execute(
            "SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = 'pending'",
            (request_id, user_id),
        ) as cursor:
            row = await cursor.fetchone()
        if not row:
            return False

        from_user_id = row["from_user_id"]
        await self.db.execute("UPDATE friend_requests SET status = 'accepted' WHERE id = ?", (request_id,))
        await self.db.execute(
            "INSERT OR IGNORE INTO friends (user_id, friend_user_id) VALUES (?, ?)",
            (from_user_id, user_id),
        )
        await self.db.execute(
            "INSERT OR IGNORE INTO friends (user_id, friend_user_id) VALUES (?, ?)",
            (user_id, from_user_id),
        )
        await self._ensure_friend_person(from_user_id, user_id)
        await self._ensure_friend_person(user_id, from_user_id)
        to_user = await self.get_user_by_id(user_id)
        if to_user:
            await self.create_notification(
                from_user_id,
                "friend_request_accepted",
                "Friend request accepted",
                f"{to_user.display_name} accepted your friend request.",
                payload={
                    "requestId": request_id,
                    "userId": to_user.id,
                    "username": to_user.username,
                },
                commit=False,
            )
        await self.db.commit()
        return True

    async def decline_friend_request(self, request_id: int, user_id: int) -> bool:
        cursor = await self.db.execute(
            "UPDATE friend_requests SET status = 'declined' WHERE id = ? AND to_user_id = ? AND status = 'pending'",
            (request_id, user_id),
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def cancel_outgoing_friend_request(self, request_id: int, user_id: int) -> bool:
        cursor = await self.db.execute(
            "DELETE FROM friend_requests WHERE id = ? AND from_user_id = ? AND status = 'pending'",
            (request_id, user_id),
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def _ensure_friend_person(self, owner_user_id: int, friend_user_id: int) -> None:
        friend = await self.get_user_by_id(friend_user_id)
        if not friend:
            return
        async with self.db.execute(
            "SELECT id FROM persons WHERE user_id = ? AND linked_user_id = ?",
            (owner_user_id, friend_user_id),
        ) as cursor:
            existing = await cursor.fetchone()
        if existing:
            await self.db.execute(
                "UPDATE persons SET name = ? WHERE id = ?",
                (friend.display_name, existing["id"]),
            )
            return
        await self.db.execute(
            "INSERT INTO persons (name, color, user_id, is_owner, linked_user_id) VALUES (?, ?, ?, 0, ?)",
            (friend.display_name, "#5C7EA6", owner_user_id, friend_user_id),
        )

    async def list_friends(self, user_id: int) -> list[FriendOut]:
        rows = await self.db.execute_fetchall(
            """
            SELECT u.*
            FROM friends f
            JOIN users u ON u.id = f.friend_user_id
            WHERE f.user_id = ?
            ORDER BY u.display_name
            """,
            (user_id,),
        )
        return [
            FriendOut(
                id=r["id"],
                username=r["username"],
                displayName=r["display_name"],
                avatarUrl=r["avatar_url"] or "",
                personId=r["person_id"],
                homeCountry=r["home_country"],
                homeCurrency=r["home_currency"],
            )
            for r in rows
        ]

    async def remove_friend(self, user_id: int, friend_user_id: int) -> bool:
        removed = False
        cursor_a = await self.db.execute(
            "DELETE FROM friends WHERE user_id = ? AND friend_user_id = ?",
            (user_id, friend_user_id),
        )
        cursor_b = await self.db.execute(
            "DELETE FROM friends WHERE user_id = ? AND friend_user_id = ?",
            (friend_user_id, user_id),
        )
        removed = cursor_a.rowcount > 0 or cursor_b.rowcount > 0

        await self.db.execute(
            "DELETE FROM persons WHERE user_id = ? AND linked_user_id = ? AND is_owner = 0",
            (user_id, friend_user_id),
        )
        await self.db.execute(
            "DELETE FROM persons WHERE user_id = ? AND linked_user_id = ? AND is_owner = 0",
            (friend_user_id, user_id),
        )
        await self.db.execute(
            "DELETE FROM profile_featured_friends WHERE user_id = ? AND friend_user_id = ?",
            (user_id, friend_user_id),
        )
        await self.db.execute(
            "DELETE FROM profile_featured_friends WHERE user_id = ? AND friend_user_id = ?",
            (friend_user_id, user_id),
        )
        await self.db.commit()
        return removed

    async def search_users(self, query: str, viewer_user_id: int, limit: int = 25) -> list[dict]:
        term = f"%{query.strip()}%"
        rows = await self.db.execute_fetchall(
            """
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.home_country, u.home_currency,
                   CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END AS is_friend,
                   CASE WHEN incoming.id IS NULL THEN 0 ELSE 1 END AS has_incoming,
                   CASE WHEN outgoing.id IS NULL THEN 0 ELSE 1 END AS has_outgoing
            FROM users u
            LEFT JOIN friends f ON f.user_id = ? AND f.friend_user_id = u.id
            LEFT JOIN friend_requests incoming
                ON incoming.from_user_id = u.id AND incoming.to_user_id = ? AND incoming.status = 'pending'
            LEFT JOIN friend_requests outgoing
                ON outgoing.from_user_id = ? AND outgoing.to_user_id = u.id AND outgoing.status = 'pending'
            WHERE u.id != ?
              AND (u.username LIKE ? OR u.display_name LIKE ?)
            ORDER BY is_friend DESC, u.display_name ASC
            LIMIT ?
            """,
            (viewer_user_id, viewer_user_id, viewer_user_id, viewer_user_id, term, term, limit),
        )
        return [
            {
                "id": r["id"],
                "username": r["username"],
                "displayName": r["display_name"],
                "avatarUrl": r["avatar_url"] or "",
                "homeCountry": r["home_country"],
                "homeCurrency": r["home_currency"],
                "isFriend": bool(r["is_friend"]),
                "hasIncoming": bool(r["has_incoming"]),
                "hasOutgoing": bool(r["has_outgoing"]),
            }
            for r in rows
        ]

    async def unified_search(self, user_id: int, query: str, limit: int = 8) -> dict:
        clean_query = query.strip()
        term = f"%{clean_query}%"
        prefix_term = f"{clean_query}%"
        safe_limit = max(1, min(limit, 25))

        trip_rows = await self.db.execute_fetchall(
            """
            SELECT DISTINCT t.id, t.public_id, t.name, t.color,
                   CASE
                     WHEN lower(t.name) = lower(?) THEN 0
                     WHEN lower(t.name) LIKE lower(?) THEN 1
                     ELSE 2
                   END AS rank
            FROM trips t
            LEFT JOIN trip_members tm ON tm.trip_id = t.id
            WHERE (t.user_id = ? OR tm.user_id = ?)
              AND t.name LIKE ?
            ORDER BY rank ASC, t.id DESC
            LIMIT ?
            """,
            (clean_query, prefix_term, user_id, user_id, term, safe_limit),
        )

        place_rows = await self.db.execute_fetchall(
            """
            SELECT p.id, p.name, p.note, p.trip_id, t.public_id AS trip_public_id, t.name AS trip_name,
                   CASE
                     WHEN lower(p.name) = lower(?) THEN 0
                     WHEN lower(p.name) LIKE lower(?) THEN 1
                     ELSE 2
                   END AS rank
            FROM places p
            JOIN trips t ON t.id = p.trip_id
            LEFT JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = ?
            WHERE (t.user_id = ? OR tm.user_id = ?)
              AND (p.name LIKE ? OR p.note LIKE ?)
            ORDER BY rank ASC, p.id DESC
            LIMIT ?
            """,
            (clean_query, prefix_term, user_id, user_id, user_id, term, term, safe_limit),
        )

        photo_rows = await self.db.execute_fetchall(
            """
            SELECT p.id, p.name, p.thumb_url, p.trip_id, t.public_id AS trip_public_id, t.name AS trip_name,
                   CASE
                     WHEN lower(p.name) = lower(?) THEN 0
                     WHEN lower(p.name) LIKE lower(?) THEN 1
                     ELSE 2
                   END AS rank
            FROM photos p
            LEFT JOIN trips t ON t.id = p.trip_id
            WHERE p.user_id = ?
              AND p.name LIKE ?
            ORDER BY rank ASC, p.id DESC
            LIMIT ?
            """,
            (clean_query, prefix_term, user_id, term, safe_limit),
        )

        profile_rows = await self.db.execute_fetchall(
            """
            SELECT u.id, u.username, u.display_name, u.avatar_url,
                   CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END AS is_friend,
                   CASE
                     WHEN lower(u.username) = lower(?) OR lower(u.display_name) = lower(?) THEN 0
                     WHEN lower(u.username) LIKE lower(?) OR lower(u.display_name) LIKE lower(?) THEN 1
                     ELSE 2
                   END AS rank
            FROM users u
            LEFT JOIN friends f ON f.user_id = ? AND f.friend_user_id = u.id
            WHERE u.id != ?
              AND (u.username LIKE ? OR u.display_name LIKE ?)
            ORDER BY is_friend DESC, rank ASC, u.display_name ASC
            LIMIT ?
            """,
            (clean_query, clean_query, prefix_term, prefix_term, user_id, user_id, term, term, safe_limit),
        )

        return {
            "trips": [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "color": r["color"],
                    "route": f"/trips/{r['public_id']}",
                }
                for r in trip_rows
            ],
            "places": [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "note": r["note"] or "",
                    "tripId": r["trip_id"],
                    "tripName": r["trip_name"],
                    "route": f"/trips/{r['trip_public_id']}",
                }
                for r in place_rows
            ],
            "photos": [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "thumbUrl": r["thumb_url"],
                    "tripId": r["trip_id"],
                    "tripName": r["trip_name"] or "Unassigned",
                    "route": "/photos" if r["trip_id"] is None else f"/trips/{r['trip_public_id']}",
                }
                for r in photo_rows
            ],
            "profiles": [
                {
                    "id": r["id"],
                    "username": r["username"],
                    "displayName": r["display_name"],
                    "avatarUrl": r["avatar_url"] or "",
                    "isFriend": bool(r["is_friend"]),
                    "route": f"/profiles/{r['username']}",
                }
                for r in profile_rows
            ],
        }

    # ── Trip Members ──────────────────────────────────────────────────────

    async def invite_friend_to_trip(self, owner_user_id: int, trip_id: int, friend_user_id: int, role: str = "viewer") -> bool:
        if not await self.user_is_trip_owner(owner_user_id, trip_id):
            return False
        if not await self.are_friends(owner_user_id, friend_user_id):
            return False
        clean_role = role.strip().lower()
        if clean_role == "member":
            clean_role = "editor"
        if clean_role not in VALID_TRIP_MEMBER_ROLES:
            return False
        async with self.db.execute("SELECT name, public_id FROM trips WHERE id = ?", (trip_id,)) as cursor:
            trip_row = await cursor.fetchone()
        if not trip_row:
            return False
        owner = await self.get_user_by_id(owner_user_id)
        await self.db.execute(
            "INSERT OR REPLACE INTO trip_members (trip_id, user_id, role) VALUES (?, ?, ?)",
            (trip_id, friend_user_id, clean_role),
        )
        if owner:
            await self.create_notification(
                friend_user_id,
                "trip_invite",
                "Trip invite",
                f"{owner.display_name} invited you to '{trip_row['name']}'.",
                payload={"tripId": trip_id, "tripPublicId": trip_row["public_id"], "ownerUserId": owner_user_id},
                commit=False,
            )
        await self.db.commit()
        return True

    async def set_trip_member_role(self, owner_user_id: int, trip_id: int, member_user_id: int, role: str) -> bool:
        if not await self.user_is_trip_owner(owner_user_id, trip_id):
            return False
        if member_user_id == owner_user_id:
            return False
        clean_role = role.strip().lower()
        if clean_role == "member":
            clean_role = "editor"
        if clean_role not in VALID_TRIP_MEMBER_ROLES:
            return False
        cursor = await self.db.execute(
            "UPDATE trip_members SET role = ? WHERE trip_id = ? AND user_id = ?",
            (clean_role, trip_id, member_user_id),
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def remove_trip_member(self, owner_user_id: int, trip_id: int, member_user_id: int) -> bool:
        if not await self.user_is_trip_owner(owner_user_id, trip_id):
            return False
        cursor = await self.db.execute(
            "DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?",
            (trip_id, member_user_id),
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def list_trip_members(self, trip_id: int) -> list[TripMemberOut]:
        async with self.db.execute("SELECT user_id FROM trips WHERE id = ?", (trip_id,)) as cursor:
            owner_row = await cursor.fetchone()
        if not owner_row:
            return []

        owner_user_id = int(owner_row["user_id"])
        async with self.db.execute("SELECT * FROM users WHERE id = ?", (owner_user_id,)) as cursor:
            owner_user = await cursor.fetchone()

        member_rows = await self.db.execute_fetchall(
            """
            SELECT u.*, tm.role
            FROM trip_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.trip_id = ? AND tm.user_id != ?
            ORDER BY u.display_name
            """,
            (trip_id, owner_user_id),
        )

        members: list[TripMemberOut] = []
        if owner_user:
            members.append(
                TripMemberOut(
                    id=owner_user["id"],
                    username=owner_user["username"],
                    displayName=owner_user["display_name"],
                    avatarUrl=owner_user["avatar_url"] or "",
                    personId=owner_user["person_id"],
                    homeCountry=owner_user["home_country"],
                    homeCurrency=owner_user["home_currency"],
                    role="owner",
                )
            )

        members.extend(
            TripMemberOut(
                id=r["id"],
                username=r["username"],
                displayName=r["display_name"],
                avatarUrl=r["avatar_url"] or "",
                personId=r["person_id"],
                homeCountry=r["home_country"],
                homeCurrency=r["home_currency"],
                role=("editor" if (r["role"] or "viewer") == "member" else (r["role"] or "viewer")),
            )
            for r in member_rows
        )
        return members

    async def get_trip_participant_ids(self, trip_id: int) -> list[int]:
        async with self.db.execute("SELECT user_id FROM trips WHERE id = ?", (trip_id,)) as cursor:
            owner = await cursor.fetchone()
        if not owner:
            return []
        member_rows = await self.db.execute_fetchall(
            "SELECT user_id FROM trip_members WHERE trip_id = ?",
            (trip_id,),
        )
        return sorted({int(owner["user_id"]), *[int(row["user_id"]) for row in member_rows]})

    # ── Expenses ──────────────────────────────────────────────────────────

    async def create_expense(
        self,
        user_id: int,
        trip_id: int,
        place_id: int | None,
        amount: float,
        currency: str,
        amount_home: float,
        home_currency: str,
        rate_used: float,
        note: str,
        splits_home: list[tuple[int, float]] | None = None,
    ) -> ExpenseOut:
        cursor = await self.db.execute(
            """
            INSERT INTO expenses (trip_id, place_id, user_id, amount, currency, amount_home, home_currency, rate_used, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (trip_id, place_id, user_id, amount, currency.upper(), amount_home, home_currency.upper(), rate_used, note),
        )
        expense_id = int(cursor.lastrowid or 0)

        split_rows = splits_home or []
        if split_rows:
            await self.db.execute("DELETE FROM expense_splits WHERE expense_id = ?", (expense_id,))
            for split_user_id, split_amount in split_rows:
                await self.db.execute(
                    "INSERT INTO expense_splits (expense_id, user_id, amount_home) VALUES (?, ?, ?)",
                    (expense_id, int(split_user_id), float(split_amount)),
                )
        await self.db.commit()
        async with self.db.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,)) as c:
            row = await c.fetchone()
        assert row is not None
        return ExpenseOut(
            id=row["id"],
            tripId=row["trip_id"],
            placeId=row["place_id"],
            amount=row["amount"],
            currency=row["currency"],
            amountHome=row["amount_home"],
            homeCurrency=row["home_currency"],
            rateUsed=row["rate_used"],
            note=row["note"],
            createdAt=row["created_at"],
        )

    async def list_expenses(self, trip_id: int, user_id: int) -> list[ExpenseOut]:
        if not await self.user_can_access_trip(user_id, trip_id):
            return []
        rows = await self.db.execute_fetchall(
            "SELECT * FROM expenses WHERE trip_id = ? ORDER BY id DESC", (trip_id,)
        )
        return [
            ExpenseOut(
                id=r["id"],
                tripId=r["trip_id"],
                placeId=r["place_id"],
                amount=r["amount"],
                currency=r["currency"],
                amountHome=r["amount_home"],
                homeCurrency=r["home_currency"],
                rateUsed=r["rate_used"],
                note=r["note"],
                createdAt=r["created_at"],
            )
            for r in rows
        ]

    async def get_trip_settlement(self, trip_id: int, user_id: int) -> dict:
        if not await self.user_can_access_trip(user_id, trip_id):
            return {
                "participants": [],
                "transfers": [],
                "total": 0.0,
                "perPerson": 0.0,
                "homeCurrency": "USD",
                "mixedCurrencies": False,
                "expenseBreakdowns": [],
            }

        async with self.db.execute("SELECT user_id FROM trips WHERE id = ?", (trip_id,)) as cursor:
            trip_row = await cursor.fetchone()
        if not trip_row:
            return {
                "participants": [],
                "transfers": [],
                "total": 0.0,
                "perPerson": 0.0,
                "homeCurrency": "USD",
                "mixedCurrencies": False,
                "expenseBreakdowns": [],
            }

        owner_id = int(trip_row["user_id"])
        member_rows = await self.db.execute_fetchall("SELECT user_id FROM trip_members WHERE trip_id = ?", (trip_id,))
        participant_ids = sorted({owner_id, *[int(r["user_id"]) for r in member_rows]})
        if not participant_ids:
            return {
                "participants": [],
                "transfers": [],
                "total": 0.0,
                "perPerson": 0.0,
                "homeCurrency": "USD",
                "mixedCurrencies": False,
                "expenseBreakdowns": [],
            }

        placeholders = ",".join(["?"] * len(participant_ids))
        user_rows = await self.db.execute_fetchall(
            f"SELECT id, username, display_name FROM users WHERE id IN ({placeholders})",
            tuple(participant_ids),
        )
        users_by_id = {
            int(r["id"]): {
                "userId": int(r["id"]),
                "username": r["username"],
                "displayName": r["display_name"],
            }
            for r in user_rows
        }

        expense_rows = await self.db.execute_fetchall(
            "SELECT id, user_id, amount, currency, amount_home, home_currency, note, created_at FROM expenses WHERE trip_id = ? ORDER BY id DESC",
            (trip_id,),
        )
        if not expense_rows:
            participants = [
                {
                    **users_by_id.get(uid, {"userId": uid, "username": f"user-{uid}", "displayName": f"User {uid}"}),
                    "paid": 0.0,
                    "share": 0.0,
                    "balance": 0.0,
                }
                for uid in participant_ids
            ]
            return {
                "participants": participants,
                "transfers": [],
                "total": 0.0,
                "perPerson": 0.0,
                "homeCurrency": "USD",
                "mixedCurrencies": False,
                "expenseBreakdowns": [],
            }

        paid_map = {uid: 0.0 for uid in participant_ids}
        share_map = {uid: 0.0 for uid in participant_ids}
        expense_breakdowns: list[dict] = []
        currencies = {str(r["home_currency"] or "USD") for r in expense_rows}
        for row in expense_rows:
            payer_id = int(row["user_id"])
            expense_id = int(row["id"])
            amount_home = float(row["amount_home"])
            if payer_id in paid_map:
                paid_map[payer_id] += amount_home

            split_rows = await self.db.execute_fetchall(
                "SELECT user_id, amount_home FROM expense_splits WHERE expense_id = ?",
                (expense_id,),
            )
            breakdown_shares: list[dict] = []
            if split_rows:
                for split in split_rows:
                    split_user_id = int(split["user_id"])
                    split_amount = float(split["amount_home"])
                    if split_user_id in share_map:
                        share_map[split_user_id] += split_amount
                    breakdown_shares.append(
                        {
                            "userId": split_user_id,
                            "username": users_by_id.get(split_user_id, {}).get("username", f"user-{split_user_id}"),
                            "displayName": users_by_id.get(split_user_id, {}).get("displayName", f"User {split_user_id}"),
                            "amount": round(split_amount, 2),
                        }
                    )
            else:
                equal_share = amount_home / len(participant_ids)
                for participant_id in participant_ids:
                    share_map[participant_id] += equal_share
                    breakdown_shares.append(
                        {
                            "userId": participant_id,
                            "username": users_by_id.get(participant_id, {}).get("username", f"user-{participant_id}"),
                            "displayName": users_by_id.get(participant_id, {}).get("displayName", f"User {participant_id}"),
                            "amount": round(equal_share, 2),
                        }
                    )

            expense_breakdowns.append(
                {
                    "expenseId": expense_id,
                    "payerUserId": payer_id,
                    "payerDisplayName": users_by_id.get(payer_id, {}).get("displayName", f"User {payer_id}"),
                    "amount": float(row["amount"]),
                    "currency": str(row["currency"]),
                    "amountHome": round(amount_home, 2),
                    "homeCurrency": str(row["home_currency"] or "USD"),
                    "note": row["note"] or "",
                    "createdAt": row["created_at"],
                    "shares": breakdown_shares,
                }
            )

        total = sum(paid_map.values())
        per_person = (total / len(participant_ids)) if participant_ids else 0.0

        participants = []
        balances: list[dict] = []
        for uid in participant_ids:
            paid = round(paid_map.get(uid, 0.0), 2)
            share = round(share_map.get(uid, 0.0), 2)
            balance = round(paid - share, 2)
            participants.append(
                {
                    **users_by_id.get(uid, {"userId": uid, "username": f"user-{uid}", "displayName": f"User {uid}"}),
                    "paid": paid,
                    "share": share,
                    "balance": balance,
                }
            )
            balances.append({"userId": uid, "amount": balance})

        creditors = [b.copy() for b in balances if b["amount"] > 0.009]
        debtors = [b.copy() for b in balances if b["amount"] < -0.009]
        transfers: list[dict] = []

        i = 0
        j = 0
        while i < len(debtors) and j < len(creditors):
            debtor = debtors[i]
            creditor = creditors[j]
            amount = min(-debtor["amount"], creditor["amount"])
            amount = round(amount, 2)
            if amount > 0:
                transfers.append(
                    {
                        "fromUserId": debtor["userId"],
                        "toUserId": creditor["userId"],
                        "amount": amount,
                    }
                )
                debtor["amount"] = round(debtor["amount"] + amount, 2)
                creditor["amount"] = round(creditor["amount"] - amount, 2)
            if debtor["amount"] >= -0.009:
                i += 1
            if creditor["amount"] <= 0.009:
                j += 1

        home_currency = sorted(currencies)[0] if currencies else "USD"
        return {
            "participants": participants,
            "transfers": transfers,
            "total": round(total, 2),
            "perPerson": round(per_person, 2),
            "homeCurrency": home_currency,
            "mixedCurrencies": len(currencies) > 1,
            "expenseBreakdowns": expense_breakdowns,
        }

    # ── Share Links ──────────────────────────────────────────────────────

    async def create_share_link(self, link_type: str, photo_id: int | None, trip_id: int | None) -> ShareLinkOut:
        """Create a new share link with a unique token."""
        import secrets
        token = secrets.token_urlsafe(8)  # ~11 chars, URL-safe

        cursor = await self.db.execute(
            "INSERT INTO share_links (token, type, photo_id, trip_id) VALUES (?, ?, ?, ?)",
            (token, link_type, photo_id, trip_id),
        )
        await self.db.commit()

        return ShareLinkOut(
            id=int(cursor.lastrowid or 0),
            token=token,
            type=link_type,
            photoId=photo_id,
            tripId=trip_id,
            url=f"/s/{token}",
            createdAt="",
        )

    async def get_share_link(self, token: str) -> ShareLinkOut | None:
        """Resolve a share token to its link record."""
        async with self.db.execute(
            "SELECT * FROM share_links WHERE token = ?", (token,)
        ) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return ShareLinkOut(
            id=row["id"],
            token=row["token"],
            type=row["type"],
            photoId=row["photo_id"],
            tripId=row["trip_id"],
            url=f"/s/{row['token']}",
            createdAt=row["created_at"],
        )

    async def delete_share_link(self, token: str) -> bool:
        """Revoke a share link by token."""
        cursor = await self.db.execute(
            "DELETE FROM share_links WHERE token = ?", (token,)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def get_share_links_for_photo(self, photo_id: int) -> list[ShareLinkOut]:
        rows = await self.db.execute_fetchall(
            "SELECT * FROM share_links WHERE type = 'photo' AND photo_id = ?", (photo_id,)
        )
        return [
            ShareLinkOut(
                id=r["id"], token=r["token"], type=r["type"],
                photoId=r["photo_id"], tripId=r["trip_id"],
                url=f"/s/{r['token']}", createdAt=r["created_at"],
            )
            for r in rows
        ]

    async def get_share_links_for_trip(self, trip_id: int) -> list[ShareLinkOut]:
        rows = await self.db.execute_fetchall(
            "SELECT * FROM share_links WHERE type = 'album' AND trip_id = ?", (trip_id,)
        )
        return [
            ShareLinkOut(
                id=r["id"], token=r["token"], type=r["type"],
                photoId=r["photo_id"], tripId=r["trip_id"],
                url=f"/s/{r['token']}", createdAt=r["created_at"],
            )
            for r in rows
        ]
