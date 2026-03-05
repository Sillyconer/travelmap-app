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
    rating      INTEGER NOT NULL DEFAULT 0
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
    trip_id   INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
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
    color TEXT NOT NULL DEFAULT '#4A90D9'
);

CREATE TABLE IF NOT EXISTS trip_persons (
    trip_id   INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    PRIMARY KEY (trip_id, person_id)
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
        await self._db.commit()

    async def close(self) -> None:
        if self._db:
            await self._db.close()

    @property
    def db(self) -> aiosqlite.Connection:
        assert self._db is not None, "Store not connected"
        return self._db

    # ── Trips ─────────────────────────────────────────────────────────────

    async def get_trips(self) -> list[Trip]:
        """Fetch all trips with their places, photos, and person IDs."""
        rows = await self.db.execute_fetchall("SELECT * FROM trips ORDER BY id")
        trips = []
        for row in rows:
            trip = await self._build_trip(dict(row))
            trips.append(trip)
        return trips

    async def get_trip(self, trip_id: int) -> Trip | None:
        async with self.db.execute(
            "SELECT * FROM trips WHERE id = ?", (trip_id,)
        ) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return await self._build_trip(dict(row))

    async def create_trip(self, data: TripCreate) -> Trip:
        cursor = await self.db.execute(
            "INSERT INTO trips (name, color) VALUES (?, ?)",
            (data.name, data.color),
        )
        await self.db.commit()
        return await self.get_trip(cursor.lastrowid)  # type: ignore

    async def update_trip(self, trip_id: int, data: TripUpdate) -> Trip | None:
        fields = data.model_dump(exclude_none=True)
        if not fields:
            return await self.get_trip(trip_id)
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
        return await self.get_trip(trip_id)

    async def delete_trip(self, trip_id: int) -> bool:
        cursor = await self.db.execute(
            "DELETE FROM trips WHERE id = ?", (trip_id,)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def set_trip_persons(self, trip_id: int, person_ids: list[int]) -> Trip | None:
        """Replace all person assignments for a trip."""
        await self.db.execute(
            "DELETE FROM trip_persons WHERE trip_id = ?", (trip_id,)
        )
        for pid in person_ids:
            await self.db.execute(
                "INSERT OR IGNORE INTO trip_persons (trip_id, person_id) VALUES (?, ?)",
                (trip_id, pid),
            )
        await self.db.commit()
        return await self.get_trip(trip_id)

    async def _build_trip(self, row: dict) -> Trip:
        """Assemble a full Trip object from a DB row."""
        trip_id = row["id"]
        places = await self._get_places(trip_id)
        photos = await self._get_photos(trip_id)
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
            places=places,
            photos=photos,
            personIds=person_ids,
        )

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
        return Place(id=cursor.lastrowid, name=data.name, lat=data.lat, lng=data.lng, note=data.note)

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

    async def reorder_places(self, trip_id: int, ordered_ids: list[int]) -> Trip | None:
        """Update sort_order for all places in a trip based on the given ID order."""
        for idx, place_id in enumerate(ordered_ids):
            await self.db.execute(
                "UPDATE places SET sort_order = ? WHERE id = ? AND trip_id = ?",
                (idx, place_id, trip_id),
            )
        await self.db.commit()
        return await self.get_trip(trip_id)

    # ── Photos ────────────────────────────────────────────────────────────

    async def _get_photos(self, trip_id: int) -> list[PhotoOut]:
        rows = await self.db.execute_fetchall(
            "SELECT * FROM photos WHERE trip_id = ? ORDER BY id", (trip_id,)
        )
        return [self._row_to_photo(r) for r in rows]

    async def get_all_photos(self) -> list[dict]:
        """Get all photos across all trips (for the library view)."""
        rows = await self.db.execute_fetchall(
            "SELECT p.*, t.name AS trip_name FROM photos p JOIN trips t ON p.trip_id = t.id ORDER BY p.taken_at DESC, p.id DESC"
        )
        return [
            {**self._row_to_photo(r).model_dump(by_alias=True), "tripId": r["trip_id"], "tripName": r["trip_name"]}
            for r in rows
        ]

    async def create_photo(
        self, trip_id: int, *, name: str, filename: str, mime: str,
        width: int, height: int, lat: float | None, lng: float | None,
        place_id: int | None, taken_at: int | None, url: str, thumb_url: str,
    ) -> PhotoOut:
        cursor = await self.db.execute(
            """INSERT INTO photos
               (trip_id, name, filename, mime, width, height, lat, lng, place_id, taken_at, url, thumb_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (trip_id, name, filename, mime, width, height, lat, lng, place_id, taken_at, url, thumb_url),
        )
        await self.db.commit()
        async with self.db.execute("SELECT * FROM photos WHERE id = ?", (cursor.lastrowid,)) as cur:
            row = await cur.fetchone()
        return self._row_to_photo(row)

    async def update_photo(self, trip_id: int, photo_id: int, place_id: int | None) -> PhotoOut | None:
        await self.db.execute(
            "UPDATE photos SET place_id = ? WHERE id = ? AND trip_id = ?",
            (place_id, photo_id, trip_id),
        )
        await self.db.commit()
        async with self.db.execute(
            "SELECT * FROM photos WHERE id = ? AND trip_id = ?", (photo_id, trip_id)
        ) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return self._row_to_photo(row)

    async def delete_photo(self, trip_id: int, photo_id: int) -> str | None:
        """Delete a photo record and return its filename for disk cleanup."""
        async with self.db.execute(
            "SELECT filename FROM photos WHERE id = ? AND trip_id = ?", (photo_id, trip_id)
        ) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        filename = row["filename"]
        await self.db.execute(
            "DELETE FROM photos WHERE id = ? AND trip_id = ?", (photo_id, trip_id)
        )
        await self.db.commit()
        return filename

    async def clear_all_photos(self) -> int:
        """Delete ALL photo records. Returns count of deleted rows."""
        async with self.db.execute("SELECT COUNT(*) as cnt FROM photos") as cursor:
            row = await cursor.fetchone()
        count = row["cnt"] if row else 0
        await self.db.execute("DELETE FROM photos")
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

    async def get_persons(self) -> list[Person]:
        rows = await self.db.execute_fetchall("SELECT * FROM persons ORDER BY id")
        return [Person(id=r["id"], name=r["name"], color=r["color"]) for r in rows]

    async def create_person(self, data: PersonCreate) -> Person:
        cursor = await self.db.execute(
            "INSERT INTO persons (name, color) VALUES (?, ?)",
            (data.name, data.color),
        )
        await self.db.commit()
        return Person(id=cursor.lastrowid, name=data.name, color=data.color)

    async def update_person(self, person_id: int, data: PersonUpdate) -> Person | None:
        fields = data.model_dump(exclude_none=True)
        if not fields:
            async with self.db.execute("SELECT * FROM persons WHERE id = ?", (person_id,)) as cursor:
                row = await cursor.fetchone()
            if not row:
                return None
            return Person(id=row["id"], name=row["name"], color=row["color"])

        sets = [f"{k} = ?" for k in fields]
        vals = list(fields.values()) + [person_id]
        await self.db.execute(
            f"UPDATE persons SET {', '.join(sets)} WHERE id = ?", vals
        )
        await self.db.commit()
        async with self.db.execute("SELECT * FROM persons WHERE id = ?", (person_id,)) as cursor:
            row = await cursor.fetchone()
        if not row:
            return None
        return Person(id=row["id"], name=row["name"], color=row["color"])

    async def delete_person(self, person_id: int) -> bool:
        cursor = await self.db.execute(
            "DELETE FROM persons WHERE id = ?", (person_id,)
        )
        await self.db.commit()
        return cursor.rowcount > 0
