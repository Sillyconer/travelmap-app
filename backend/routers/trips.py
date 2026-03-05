"""
TravelMap Backend — Trip API Router

Endpoints for trip CRUD, person assignment, and trip listing.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models import Trip, TripCreate, TripUpdate
from dependencies import get_store

router = APIRouter(prefix="/api/trips", tags=["trips"])


@router.get("", response_model=list[Trip])
async def list_trips():
    """List all trips with places, photos, and person IDs."""
    store = get_store()
    return await store.get_trips()


@router.get("/{trip_id}", response_model=Trip)
async def get_trip(trip_id: int):
    """Get a single trip by ID."""
    store = get_store()
    trip = await store.get_trip(trip_id)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")
    return trip


@router.post("", response_model=Trip, status_code=201)
async def create_trip(data: TripCreate):
    """Create a new trip."""
    store = get_store()
    return await store.create_trip(data)


@router.post("/{trip_id}/update", response_model=Trip)
async def update_trip(trip_id: int, data: TripUpdate):
    """Update trip metadata."""
    store = get_store()
    trip = await store.update_trip(trip_id, data)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")
    return trip


@router.delete("/{trip_id}")
async def delete_trip(trip_id: int):
    """Delete a trip and all associated data."""
    store = get_store()
    if not await store.delete_trip(trip_id):
        raise HTTPException(404, f"Trip {trip_id} not found")
    return {"ok": True}


@router.post("/{trip_id}/persons", response_model=Trip)
async def assign_persons(trip_id: int, person_ids: str):
    """
    Set person assignments for a trip.
    Accepts a comma-separated list of person IDs.
    """
    store = get_store()
    ids = [int(x.strip()) for x in person_ids.split(",") if x.strip()]
    trip = await store.set_trip_persons(trip_id, ids)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")
    return trip
