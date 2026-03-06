import os
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

os.environ["DB_NAME"] = "test_travelmap.db"

from main import app
from dependencies import set_store
from store import Store


@pytest.fixture(autouse=True)
async def setup_db():
    db_path = Path("test_travelmap.db")
    if db_path.exists():
        db_path.unlink()

    store = Store(Path("test_travelmap.db"))
    set_store(store)
    await store.connect()
    yield
    await store.close()
    if db_path.exists():
        db_path.unlink()


@pytest.fixture
async def authed_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        register = await client.post(
            "/api/auth/register",
            json={"username": "alice", "displayName": "Alice", "password": "secret"},
        )
        assert register.status_code == 201
        token = register.json()["token"]
        client.headers.update({"Authorization": f"Bearer {token}"})
        yield client


@pytest.mark.asyncio
async def test_auth_me(authed_client: AsyncClient):
    res = await authed_client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json()["username"] == "alice"


@pytest.mark.asyncio
async def test_create_and_list_trips(authed_client: AsyncClient):
    created = await authed_client.post(
        "/api/trips",
        json={"name": "Japan", "color": "#FF0000", "visibility": "friends_only"},
    )
    assert created.status_code == 201

    listed = await authed_client.get("/api/trips")
    assert listed.status_code == 200
    payload = listed.json()
    assert len(payload) == 1
    assert payload[0]["name"] == "Japan"


@pytest.mark.asyncio
async def test_upload_unattached_and_assign_photo(authed_client: AsyncClient):
    trip = await authed_client.post(
        "/api/trips",
        json={"name": "Photo Trip", "color": "#00AAFF", "visibility": "friends_only"},
    )
    trip_id = trip.json()["id"]

    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfeA\xf4\x8f\x93\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    files = {"file": ("tiny.png", png_bytes, "image/png")}

    upload = await authed_client.post("/api/photos/upload", files=files)
    assert upload.status_code == 201
    photo_id = upload.json()["id"]

    assign = await authed_client.post(
        f"/api/photos/{photo_id}/assign",
        json={"tripId": trip_id, "placeId": None},
    )
    assert assign.status_code == 200
    assert assign.json()["id"] == photo_id

    all_photos = await authed_client.get("/api/photos")
    assert all_photos.status_code == 200
    assert len(all_photos.json()) == 1
    assert all_photos.json()[0]["tripId"] == trip_id
