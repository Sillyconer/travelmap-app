"""
TravelMap Backend — SQLite Data Store

Implements all CRUD operations for trips, places, photos, and persons.
Uses aiosqlite for async SQLite access.
"""

from __future__ import annotations

import aiosqlite
from pathlib import Path

from config import DB_PATH
from models import (
    Trip, TripCreate, TripUpdate,
    Place, PlaceCreate, PlaceUpdate,
    PhotoOut,
    Person, PersonCreate, PersonUpdate,
    UserOut, FriendOut, FriendRequestOut, ExpenseOut, UserUpdate,
    ShareLinkOut,
)


# ══════════════════════════════════════════════════════════════════════════════
# Schema
# ══════════════════════════════════════════════════════════════════════════════

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS trips (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
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
"""


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
        await self._ensure_column("trips", "user_id", "INTEGER")
        await self._ensure_column("trips", "visibility", "TEXT NOT NULL DEFAULT 'friends_only'")
        await self._ensure_column("photos", "user_id", "INTEGER")
        await self._ensure_column("persons", "user_id", "INTEGER")
        await self._ensure_column("persons", "is_owner", "INTEGER NOT NULL DEFAULT 0")
        await self._ensure_column("persons", "linked_user_id", "INTEGER")
        await self._ensure_column("users", "home_country", "TEXT NOT NULL DEFAULT ''")
        await self._ensure_column("users", "home_currency", "TEXT NOT NULL DEFAULT 'USD'")

        await self.db.execute("UPDATE trips SET user_id = 1 WHERE user_id IS NULL")
        await self.db.execute("UPDATE photos SET user_id = 1 WHERE user_id IS NULL")
        await self.db.execute("UPDATE persons SET user_id = 1 WHERE user_id IS NULL")
        await self.db.execute("UPDATE trips SET visibility = 'friends_only' WHERE visibility IS NULL OR visibility = ''")

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
            "INSERT INTO users (id, username, display_name, password_hash, person_id, home_country, home_currency) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (1, "owner", "Owner", "", person_id, "", "USD"),
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

    async def create_trip(self, user_id: int, data: TripCreate) -> Trip:
        cursor = await self.db.execute(
            "INSERT INTO trips (name, color, user_id, visibility) VALUES (?, ?, ?, ?)",
            (data.name, data.color, user_id, data.visibility),
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
        trip = await self.get_trip(trip_id, user_id)
        if not trip:
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
        places = await self._get_places(trip_id)
        photos = await self._get_photos(trip_id, user_id)
        person_ids = await self._get_trip_person_ids(trip_id)
        return Trip(
            id=row["id"],
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

    async def user_can_access_trip(self, user_id: int, trip_id: int) -> bool:
        return await self.user_is_trip_owner(user_id, trip_id) or await self.user_is_trip_member(user_id, trip_id)

    async def _get_trip_person_ids(self, trip_id: int) -> list[int]:
        rows = await self.db.execute_fetchall(
            "SELECT person_id FROM trip_persons WHERE trip_id = ?", (trip_id,)
        )
        return [r["person_id"] for r in rows]

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
            createdAt=row["created_at"],
        )

    async def list_currency_codes(self) -> list[str]:
        rows = await self.db.execute_fetchall("SELECT DISTINCT home_currency AS currency FROM users UNION SELECT DISTINCT currency FROM expenses")
        known = {r["currency"] for r in rows if r["currency"]}
        known.update({"USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "INR"})
        return sorted(known)

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
            SELECT fr.*, u.username AS from_username, u.display_name AS from_display_name
            FROM friend_requests fr
            JOIN users u ON u.id = fr.from_user_id
            WHERE fr.id = ?
            """,
            (int(cursor.lastrowid or 0),),
        ) as c:
            row = await c.fetchone()
        if not row:
            async with self.db.execute(
                """
                SELECT fr.*, u.username AS from_username, u.display_name AS from_display_name
                FROM friend_requests fr
                JOIN users u ON u.id = fr.from_user_id
                WHERE fr.from_user_id = ? AND fr.to_user_id = ?
                """,
                (from_user_id, target.id),
            ) as c2:
                row = await c2.fetchone()
        assert row is not None
        return FriendRequestOut(
            id=row["id"],
            fromUserId=row["from_user_id"],
            toUserId=row["to_user_id"],
            fromUsername=row["from_username"],
            fromDisplayName=row["from_display_name"],
            status=row["status"],
            createdAt=row["created_at"],
        )

    async def list_friend_requests_for_user(self, user_id: int) -> list[FriendRequestOut]:
        rows = await self.db.execute_fetchall(
            """
            SELECT fr.*, u.username AS from_username, u.display_name AS from_display_name
            FROM friend_requests fr
            JOIN users u ON u.id = fr.from_user_id
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
        await self.db.commit()
        return True

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
                personId=r["person_id"],
                homeCountry=r["home_country"],
                homeCurrency=r["home_currency"],
            )
            for r in rows
        ]

    # ── Trip Members ──────────────────────────────────────────────────────

    async def invite_friend_to_trip(self, owner_user_id: int, trip_id: int, friend_user_id: int) -> bool:
        if not await self.user_is_trip_owner(owner_user_id, trip_id):
            return False
        if not await self.are_friends(owner_user_id, friend_user_id):
            return False
        await self.db.execute(
            "INSERT OR IGNORE INTO trip_members (trip_id, user_id, role) VALUES (?, ?, 'member')",
            (trip_id, friend_user_id),
        )
        await self.db.commit()
        return True

    async def remove_trip_member(self, owner_user_id: int, trip_id: int, member_user_id: int) -> bool:
        if not await self.user_is_trip_owner(owner_user_id, trip_id):
            return False
        cursor = await self.db.execute(
            "DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?",
            (trip_id, member_user_id),
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def list_trip_members(self, trip_id: int) -> list[FriendOut]:
        rows = await self.db.execute_fetchall(
            """
            SELECT u.*
            FROM trip_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.trip_id = ?
            ORDER BY u.display_name
            """,
            (trip_id,),
        )
        return [
            FriendOut(
                id=r["id"],
                username=r["username"],
                displayName=r["display_name"],
                personId=r["person_id"],
                homeCountry=r["home_country"],
                homeCurrency=r["home_currency"],
            )
            for r in rows
        ]

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
    ) -> ExpenseOut:
        cursor = await self.db.execute(
            """
            INSERT INTO expenses (trip_id, place_id, user_id, amount, currency, amount_home, home_currency, rate_used, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (trip_id, place_id, user_id, amount, currency.upper(), amount_home, home_currency.upper(), rate_used, note),
        )
        await self.db.commit()
        async with self.db.execute("SELECT * FROM expenses WHERE id = ?", (int(cursor.lastrowid or 0),)) as c:
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
