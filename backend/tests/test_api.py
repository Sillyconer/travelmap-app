import pytest
from httpx import AsyncClient, ASGITransport
import os
import aiosqlite
from pathlib import Path

# Override config before importing main
os.environ["DB_NAME"] = "test_travelmap.db"

from main import app
from dependencies import set_store
from store import Store

@pytest.fixture(autouse=True)
async def setup_db():
    """Setup a fresh test database for each test."""
    db_path = Path("test_travelmap.db")
    if db_path.exists():
        db_path.unlink()
    
    # Init store directly
    store = Store("test_travelmap.db")
    set_store(store)
    await store.connect()
    yield
    await store.close()
    if db_path.exists():
        db_path.unlink()

@pytest.mark.asyncio
async def test_create_trip():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testServer") as client:
        response = await client.post("/api/trips", json={
            "name": "Test Trip",
            "color": "#FF0000",
            "budget": 1000,
            "description": "Test",
            "startDate": "2024-01-01",
            "endDate": "2024-01-10"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Trip"
        assert data["color"] == "#FF0000"
        assert "id" in data

@pytest.mark.asyncio
async def test_get_trips():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testServer") as client:
        # Create one first
        await client.post("/api/trips", json={
            "name": "Test Trip 2",
            "color": "#00FF00"
        })
        
        response = await client.get("/api/trips")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Trip 2"
